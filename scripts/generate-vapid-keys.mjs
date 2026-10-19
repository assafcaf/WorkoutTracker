// Prints a P-256 private JWK for the VAPID_PRIVATE_KEY secret and the public key derived from it.
import { webcrypto } from 'node:crypto'

const pair = await webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
const jwk = await webcrypto.subtle.exportKey('jwk', pair.privateKey)
const raw = Buffer.from(await webcrypto.subtle.exportKey('raw', pair.publicKey))
const b64url = (b) => b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const out = { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y, d: jwk.d }

console.log('VAPID_PRIVATE_KEY (set as a Worker secret, one line):')
console.log(JSON.stringify(out))
console.log('')
console.log('Public key:')
console.log(b64url(raw))
