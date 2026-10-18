import { encryptPayload, type PushKeys } from './encrypt'
import { vapidHeaders, type VapidJwk } from './vapid'

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
  target: PushSubscriptionTarget,
  payload: string | Uint8Array,
  options: SendOptions,
): Promise<SendResult> {
  try {
    const bytes = typeof payload === 'string' ? new TextEncoder().encode(payload) : payload
    const body = await encryptPayload(bytes, target.keys)
    const vapid = await vapidHeaders(target.endpoint, options.jwk, options.subject, options.now ?? Date.now())
    const headers: Record<string, string> = {
      ...vapid,
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: String(options.ttl ?? 3600),
      Urgency: 'high',
    }
    if (options.topic) headers.Topic = options.topic
    const res = await (options.fetch ?? fetch)(target.endpoint, { method: 'POST', headers, body })
    if (res.status >= 200 && res.status < 300) return 'sent'
    if (res.status === 404 || res.status === 410) return 'gone'
    return 'failed'
  } catch {
    return 'failed'
  }
}
