// A stand-in for a push service (FCM, Mozilla autopush, Apple). It is a `fetch` replacement
// holding a user-agent key pair: it records each request, decrypts the RFC 8291 `aes128gcm`
// body with that key, and answers a chosen status per endpoint. Deliberately independent of
// src/worker/services/webPush so it can check it.

import { webcrypto } from 'node:crypto'

// Node 18 (this host) has no global `crypto`; the Workers runtime and Node 20+ do. The code under
// test reads the global, so install it here when it is missing.
if (!(globalThis as { crypto?: unknown }).crypto) {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true })
}

export type RecordedPush = {
  endpoint: string
  method: string
  headers: Record<string, string> // lower-cased names
  body: Uint8Array
  /** The decrypted payload, or null when the body did not decrypt. */
  plaintext: string | null
}

export type FakePushService = {
  /** The subscription keys the Worker is given: base64url p256dh (65 bytes) and auth (16 bytes). */
  keys: { p256dh: string; auth: string }
  fetch: typeof fetch
  requests: RecordedPush[]
  /** Answer `status` for `endpoint` (default 201). */
  setStatus(endpoint: string, status: number): void
  /** Make `fetch` reject for `endpoint`. */
  setNetworkError(endpoint: string): void
}

const enc = new TextEncoder()
const dec = new TextDecoder()

export function fromB64Url(s: string): Uint8Array {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(b, (ch) => ch.charCodeAt(0))
}

export function toB64Url(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let at = 0
  for (const p of parts) {
    out.set(p, at)
    at += p.length
  }
  return out
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, bytes: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits'])
  return new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, bytes * 8),
  )
}

/** Decrypt an RFC 8291 aes128gcm body for the user agent holding `privateJwk`. */
export async function decryptPushBody(
  body: Uint8Array,
  privateJwk: JsonWebKey,
  uaPublic: Uint8Array,
  authSecret: Uint8Array,
): Promise<string> {
  const salt = body.slice(0, 16)
  const idLen = body[20]
  const asPublic = body.slice(21, 21 + idLen)
  const ciphertext = body.slice(21 + idLen)
  const uaPrivate = await crypto.subtle.importKey('jwk', privateJwk, { name: 'ECDH', namedCurve: 'P-256' }, false, [
    'deriveBits',
  ])
  const asKey = await crypto.subtle.importKey('raw', asPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
  const secret = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: asKey }, uaPrivate, 256))
  const ikm = await hkdf(authSecret, secret, concat(enc.encode('WebPush: info\0'), uaPublic, asPublic), 32)
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16)
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12)
  const aes = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt'])
  const padded = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, aes, ciphertext))
  let end = padded.length
  while (end > 0 && padded[end - 1] === 0) end--
  // padded[end - 1] is the 0x02 last-record delimiter
  return dec.decode(padded.slice(0, end - 1))
}

export async function createFakePushService(): Promise<FakePushService> {
  const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])
  const uaPublic = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey))
  const privateJwk = await crypto.subtle.exportKey('jwk', pair.privateKey)
  const authSecret = crypto.getRandomValues(new Uint8Array(16))
  const statuses = new Map<string, number>()
  const broken = new Set<string>()
  const requests: RecordedPush[] = []

  const fakeFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const endpoint = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    if (broken.has(endpoint)) throw new TypeError('network down')
    const headers: Record<string, string> = {}
    new Headers(init?.headers).forEach((v, k) => {
      headers[k.toLowerCase()] = v
    })
    const raw = init?.body
    const body =
      raw instanceof Uint8Array
        ? raw
        : raw instanceof ArrayBuffer
          ? new Uint8Array(raw)
          : new Uint8Array(0)
    let plaintext: string | null = null
    try {
      plaintext = await decryptPushBody(body, privateJwk, uaPublic, authSecret)
    } catch {
      plaintext = null
    }
    requests.push({ endpoint, method: init?.method ?? 'GET', headers, body, plaintext })
    return new Response(null, { status: statuses.get(endpoint) ?? 201 })
  }) as typeof fetch

  return {
    keys: { p256dh: toB64Url(uaPublic), auth: toB64Url(authSecret) },
    fetch: fakeFetch,
    requests,
    setStatus: (endpoint, status) => void statuses.set(endpoint, status),
    setNetworkError: (endpoint) => void broken.add(endpoint),
  }
}
