import { SignJWT, importJWK } from 'jose'
import { b64urlToBytes, bytesToB64url } from './encrypt'

export type VapidJwk = { kty: string; crv: string; x: string; y: string; d: string }

/** The 65-byte uncompressed point of the JWK's x and y, base64url. */
export function vapidPublicKey(jwk: VapidJwk): string {
  const x = b64urlToBytes(jwk.x)
  const y = b64urlToBytes(jwk.y)
  const out = new Uint8Array(65)
  out[0] = 4
  out.set(x, 1 + 32 - x.length)
  out.set(y, 33 + 32 - y.length)
  return bytesToB64url(out)
}

/** `{ Authorization: 'vapid t=<jwt>, k=<public key>' }`. `now` is epoch milliseconds. */
export async function vapidHeaders(
  endpoint: string,
  jwk: VapidJwk,
  subject: string,
  now: number,
): Promise<{ Authorization: string }> {
  const key = await importJWK({ kty: 'EC', crv: 'P-256', x: jwk.x, y: jwk.y, d: jwk.d }, 'ES256')
  const iat = Math.floor(now / 1000)
  const jwt = await new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', typ: 'JWT' })
    .setAudience(new URL(endpoint).origin)
    .setSubject(subject)
    .setIssuedAt(iat)
    .setExpirationTime(iat + 12 * 60 * 60)
    .sign(key)
  return { Authorization: `vapid t=${jwt}, k=${vapidPublicKey(jwk)}` }
}
