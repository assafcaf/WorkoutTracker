export type PushKeys = { p256dh: string; auth: string }

export type EncryptOptions = {
  /** Fixed sender key pair and salt, for the RFC 8291 Appendix A vector. Base64url. */
  senderKeyPair?: { privateKey: string; publicKey: string }
  salt?: Uint8Array
  subtle?: SubtleCrypto
}

/** RFC 8291 aes128gcm body: salt, record size, sender key, ciphertext. */
export async function encryptPayload(
  _plaintext: Uint8Array,
  _keys: PushKeys,
  _options?: EncryptOptions,
): Promise<Uint8Array> {
  throw new Error('NotImplementedError: encryptPayload')
}
