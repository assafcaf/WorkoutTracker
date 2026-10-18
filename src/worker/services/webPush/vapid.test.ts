// @vitest-environment node
import { beforeAll, describe, expect, test } from 'vitest'
import { decodeProtectedHeader, importJWK, jwtVerify } from 'jose'
import { vapidHeaders, vapidPublicKey, type VapidJwk } from './vapid'
import { fromB64Url } from '../../../test/fakePushService'

let jwk: VapidJwk
const NOW = Date.UTC(2026, 9, 18, 12, 0, 0)
const ENDPOINT = 'https://fcm.googleapis.com/fcm/send/abc123?x=1'

beforeAll(async () => {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
  jwk = (await crypto.subtle.exportKey('jwk', pair.privateKey)) as VapidJwk
})

function parse(header: string): { t: string; k: string } {
  const m = /^vapid t=([^,\s]+), k=([^,\s]+)$/.exec(header)
  expect(m).not.toBeNull()
  return { t: m![1], k: m![2] }
}

describe('O7: vapidHeaders (RFC 8292)', () => {
  test('gives Authorization: vapid t=<jwt>, k=<public key>', async () => {
    const h = await vapidHeaders(ENDPOINT, jwk, 'mailto:ops@example.com', NOW)
    expect(Object.keys(h)).toEqual(['Authorization'])
    parse(h.Authorization)
  })

  test('k is the 65-byte uncompressed point derived from x and y, base64url', async () => {
    const { k } = parse((await vapidHeaders(ENDPOINT, jwk, 'mailto:ops@example.com', NOW)).Authorization)
    const raw = fromB64Url(k)
    expect(k).not.toMatch(/[+/=]/)
    expect(raw).toHaveLength(65)
    expect(raw[0]).toBe(4)
    expect(Array.from(raw.slice(1, 33))).toEqual(Array.from(fromB64Url(jwk.x)))
    expect(Array.from(raw.slice(33))).toEqual(Array.from(fromB64Url(jwk.y)))
    expect(vapidPublicKey(jwk)).toBe(k)
  })

  test('the JWT is ES256, carries aud, exp and sub, and verifies with k', async () => {
    const subject = 'mailto:ops@example.com'
    const { t, k } = parse((await vapidHeaders(ENDPOINT, jwk, subject, NOW)).Authorization)
    expect(decodeProtectedHeader(t).alg).toBe('ES256')
    const raw = fromB64Url(k)
    const pub = await importJWK(
      {
        kty: 'EC',
        crv: 'P-256',
        x: btoa(String.fromCharCode(...raw.slice(1, 33))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
        y: btoa(String.fromCharCode(...raw.slice(33))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
      },
      'ES256',
    )
    const { payload } = await jwtVerify(t, pub, { currentDate: new Date(NOW), algorithms: ['ES256'] })
    expect(payload.aud).toBe('https://fcm.googleapis.com')
    expect(payload.sub).toBe(subject)
    expect(typeof payload.exp).toBe('number')
    expect(payload.exp!).toBeGreaterThan(NOW / 1000)
    expect(payload.exp!).toBeLessThanOrEqual(NOW / 1000 + 24 * 60 * 60)
  })

  test('aud is the origin of the endpoint, including a port, without path or query', async () => {
    const { t } = parse((await vapidHeaders('http://localhost:8787/push/x?y=1', jwk, 'mailto:a@b.co', NOW)).Authorization)
    const claims = JSON.parse(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    expect(claims.aud).toBe('http://localhost:8787')
  })

  test('a token signed for one key does not verify with another key', async () => {
    const other = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
    const otherPub = await importJWK(
      { ...(await crypto.subtle.exportKey('jwk', other.publicKey)), kty: 'EC', alg: 'ES256' },
      'ES256',
    )
    const { t } = parse((await vapidHeaders(ENDPOINT, jwk, 'mailto:a@b.co', NOW)).Authorization)
    await expect(jwtVerify(t, otherPub, { currentDate: new Date(NOW) })).rejects.toThrow()
  })

  test('a malformed endpoint rejects', async () => {
    await expect(vapidHeaders('not a url', jwk, 'mailto:a@b.co', NOW)).rejects.toThrow(/^(?!NotImplementedError)/)
  })
})
