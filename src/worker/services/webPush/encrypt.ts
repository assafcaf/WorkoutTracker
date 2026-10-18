export type PushKeys = { p256dh: string; auth: string }

export type EncryptOptions = {
  /** Fixed sender key pair and salt, for the RFC 8291 Appendix A vector. Base64url. */
  senderKeyPair?: { privateKey: string; publicKey: string }
  salt?: Uint8Array
  subtle?: SubtleCrypto
}

const enc = new TextEncoder()

export function b64urlToBytes(s: string): Uint8Array {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(b, (c) => c.charCodeAt(0))
}

export function bytesToB64url(bytes: Uint8Array): string {
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

/** RFC 8291 aes128gcm body: salt, record size, sender key, ciphertext. */
export async function encryptPayload(
  plaintext: Uint8Array,
  keys: PushKeys,
  options: EncryptOptions = {},
): Promise<Uint8Array> {
  const subtle = options.subtle ?? crypto.subtle
  const uaPub = b64urlToBytes(keys.p256dh)
  const auth = b64urlToBytes(keys.auth)
  if (uaPub.length !== 65 || uaPub[0] !== 4) throw new Error('invalid p256dh key')
  if (auth.length !== 16) throw new Error('invalid auth secret')

  let senderPriv: CryptoKey
  let senderPub: Uint8Array
  if (options.senderKeyPair) {
    senderPub = b64urlToBytes(options.senderKeyPair.publicKey)
    senderPriv = await subtle.importKey(
      'jwk',
      {
        kty: 'EC',
        crv: 'P-256',
        x: bytesToB64url(senderPub.slice(1, 33)),
        y: bytesToB64url(senderPub.slice(33, 65)),
        d: options.senderKeyPair.privateKey,
      },
      { name: 'ECDH', namedCurve: 'P-256' },
      false,
      ['deriveBits'],
    )
  } else {
    const pair = (await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
      'deriveBits',
    ])) as CryptoKeyPair
    senderPriv = pair.privateKey
    senderPub = new Uint8Array(await subtle.exportKey('raw', pair.publicKey))
  }
  const salt = options.salt ?? crypto.getRandomValues(new Uint8Array(16))

  const uaKey = await subtle.importKey('raw', uaPub, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
  const ecdh = new Uint8Array(
    await subtle.deriveBits({ name: 'ECDH', public: uaKey }, senderPriv, 256),
  )

  const hkdf = async (saltB: Uint8Array, ikm: Uint8Array, info: Uint8Array, bytes: number) => {
    const k = await subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits'])
    return new Uint8Array(
      await subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: saltB, info }, k, bytes * 8),
    )
  }
  const prk = await hkdf(auth, ecdh, concat(enc.encode('WebPush: info\0'), uaPub, senderPub), 32)
  const cek = await hkdf(salt, prk, enc.encode('Content-Encoding: aes128gcm\0'), 16)
  const nonce = await hkdf(salt, prk, enc.encode('Content-Encoding: nonce\0'), 12)

  const aes = await subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt'])
  const cipher = new Uint8Array(
    await subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aes, concat(plaintext, new Uint8Array([2]))),
  )
  return concat(salt, new Uint8Array([0, 0, 16, 0, 65]), senderPub, cipher)
}
