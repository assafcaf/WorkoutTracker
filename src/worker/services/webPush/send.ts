import type { PushKeys } from './encrypt'
import type { VapidJwk } from './vapid'

export type PushSubscriptionTarget = { endpoint: string; keys: PushKeys }

export type SendOptions = {
  jwk: VapidJwk
  subject: string
  /** Seconds the push service may hold the message. Default 3600. */
  ttl?: number
  topic?: string
  /** Epoch milliseconds. Default Date.now(). */
  now?: number
  fetch?: typeof fetch
}

export type SendResult = 'sent' | 'gone' | 'failed'

export async function sendPush(
  _target: PushSubscriptionTarget,
  _payload: string | Uint8Array,
  _options: SendOptions,
): Promise<SendResult> {
  throw new Error('NotImplementedError: sendPush')
}
