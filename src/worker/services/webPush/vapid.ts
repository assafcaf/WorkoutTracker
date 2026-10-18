export type VapidJwk = { kty: string; crv: string; x: string; y: string; d: string }

/** The 65-byte uncompressed point of the JWK's x and y, base64url. */
export function vapidPublicKey(_jwk: VapidJwk): string {
  throw new Error('NotImplementedError: vapidPublicKey')
}

/** `{ Authorization: 'vapid t=<jwt>, k=<public key>' }`. `now` is epoch milliseconds. */
export async function vapidHeaders(
  _endpoint: string,
  _jwk: VapidJwk,
  _subject: string,
  _now: number,
): Promise<{ Authorization: string }> {
  throw new Error('NotImplementedError: vapidHeaders')
}
