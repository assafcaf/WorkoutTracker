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

export type SendResult = { result: 'sent' | 'gone' | 'failed'; status: number | null; reason: string | null }

const REASON_LIMIT = 200

/** Logs one `push.send` line: the endpoint's host only, never a key, a path or the payload. */
export function logSend(endpoint: string, answer: SendResult): void {
  let host = ''
  try {
    host = new URL(endpoint).host
  } catch {
    // an unparseable endpoint has no host to log
  }
  console.log(JSON.stringify({ event: 'push.send', host, ...answer }))
}

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
    const reason = (await res.text().catch(() => '')).slice(0, REASON_LIMIT)
    const status = res.status
    if (status >= 200 && status < 300) return { result: 'sent', status, reason }
    if (status === 404 || status === 410) return { result: 'gone', status, reason }
    return { result: 'failed', status, reason }
  } catch (error) {
    return { result: 'failed', status: null, reason: error instanceof Error ? error.message : String(error) }
  }
}
