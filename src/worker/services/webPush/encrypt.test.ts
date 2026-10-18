// @vitest-environment node
import { describe, expect, test } from 'vitest'
import { encryptPayload } from './encrypt'
import { createFakePushService, fromB64Url, toB64Url } from '../../../test/fakePushService'

const PLAINTEXT = 'When I grow up, I want to be a watermelon'

describe('O6: encryptPayload (RFC 8291)', () => {
  test('with RFC 8291 Appendix A inputs the body is byte for byte the RFC aes128gcm body', async () => {
    const body = await encryptPayload(
      new TextEncoder().encode(PLAINTEXT),
      {
        p256dh: 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
        auth: 'BTBZMqHH6r4Tts7J_aSIgg',
      },
      {
        senderKeyPair: {
          privateKey: 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw',
          publicKey: 'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8',
        },
        salt: fromB64Url('DGv6ra1nlYgDCS1FRnbzlw'),
      },
    )
    expect(toB64Url(body)).toBe(
      'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN',
    )
  })

  test('with no fixed inputs the fake push service decrypts the body back to the plaintext', async () => {
    const ua = await createFakePushService()
    const body = await encryptPayload(new TextEncoder().encode(PLAINTEXT), ua.keys)
    await ua.fetch('https://push.example/a', { method: 'POST', body })
    expect(ua.requests).toHaveLength(1)
    expect(ua.requests[0].plaintext).toBe(PLAINTEXT)
  })

  test('each call draws a fresh salt and sender key pair', async () => {
    const ua = await createFakePushService()
    const plain = new TextEncoder().encode(PLAINTEXT)
    const a = await encryptPayload(plain, ua.keys)
    const b = await encryptPayload(plain, ua.keys)
    expect(toB64Url(a.slice(0, 16))).not.toBe(toB64Url(b.slice(0, 16)))
    expect(toB64Url(a.slice(21, 86))).not.toBe(toB64Url(b.slice(21, 86)))
    // header: 16 salt, 4 record size (4096), 1 key length (65), 65 sender key
    expect(Array.from(a.slice(16, 21))).toEqual([0, 0, 16, 0, 65])
  })

  test('a body for one user agent does not decrypt for another', async () => {
    const ua = await createFakePushService()
    const other = await createFakePushService()
    const body = await encryptPayload(new TextEncoder().encode(PLAINTEXT), ua.keys)
    await other.fetch('https://push.example/a', { method: 'POST', body })
    expect(other.requests[0].plaintext).toBeNull()
  })

  test('malformed subscription keys reject instead of producing a body', async () => {
    await expect(
      encryptPayload(new TextEncoder().encode(PLAINTEXT), { p256dh: 'AAAA', auth: 'BTBZMqHH6r4Tts7J_aSIgg' }),
    ).rejects.toThrow(/^(?!NotImplementedError)/)
  })
})
