import { HttpError } from './index'

export type PushSubscriptionRequest = { endpoint: string; keys: { p256dh: string; auth: string } }
export type PushUnsubscribeRequest = { endpoint: string }
export type RestPushRequest = { delayMs: number; title: string; body: string }
export type PushKeyResponse = { publicKey: string }
export type Reminders = { days: number[]; time: string; timeZone: string }

const MAX_ENDPOINT_LENGTH = 1024
const MAX_REST_DELAY_MS = 3_600_000
const PUSH_HOSTS = ['web.push.apple.com', 'fcm.googleapis.com', 'updates.push.services.mozilla.com']
const PUSH_HOST_SUFFIXES = ['.notify.windows.com']

export function checkSubscriptionRequest(body: unknown): PushSubscriptionRequest {
  if (!isRecord(body)) throw new HttpError(400, 'body must be a JSON object')
  const endpoint = checkedEndpoint(body.endpoint)
  if (!isRecord(body.keys)) throw new HttpError(400, 'keys must be an object')
  const { p256dh, auth } = body.keys
  const point = decodeBase64Url(p256dh, 65)
  if (!point || point[0] !== 4) throw new HttpError(400, 'p256dh must be 65 base64url bytes starting 0x04')
  if (!decodeBase64Url(auth, 16)) throw new HttpError(400, 'auth must be 16 base64url bytes')
  return { endpoint, keys: { p256dh: p256dh as string, auth: auth as string } }
}

export function checkUnsubscribeRequest(body: unknown): PushUnsubscribeRequest {
  if (!isRecord(body)) throw new HttpError(400, 'body must be a JSON object')
  return { endpoint: checkedEndpoint(body.endpoint) }
}

export function checkRestPushRequest(body: unknown): RestPushRequest {
  if (!isRecord(body)) throw new HttpError(400, 'body must be a JSON object')
  const { delayMs, title, body: text } = body
  if (typeof delayMs !== 'number' || !Number.isInteger(delayMs) || delayMs < 0 || delayMs > MAX_REST_DELAY_MS) {
    throw new HttpError(400, `delayMs must be an integer from 0 to ${MAX_REST_DELAY_MS}`)
  }
  if (typeof title !== 'string' || title.length < 1 || title.length > 80) {
    throw new HttpError(400, 'title must be 1 to 80 characters')
  }
  if (typeof text !== 'string' || text.length > 160) throw new HttpError(400, 'body must be 0 to 160 characters')
  return { delayMs, title, body: text }
}

export function checkPushKeyResponse(body: unknown): PushKeyResponse | null {
  if (!isRecord(body) || typeof body.publicKey !== 'string' || body.publicKey === '') return null
  return { publicKey: body.publicKey }
}

/** The reminders a settings value holds, or null when it is not a usable schedule. */
export function parseReminders(value: unknown): Reminders | null {
  if (!isRecord(value)) return null
  const { days, time, timeZone } = value
  if (!Array.isArray(days) || days.length === 0) return null
  if (!days.every((d) => typeof d === 'number' && Number.isInteger(d) && d >= 0 && d <= 6)) return null
  if (typeof time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return null
  if (typeof timeZone !== 'string' || !isTimeZone(timeZone)) return null
  return { days: [...new Set(days as number[])].sort((a, b) => a - b), time, timeZone }
}

function checkedEndpoint(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0) throw new HttpError(400, 'endpoint must be a string')
  if (value.length > MAX_ENDPOINT_LENGTH) throw new HttpError(400, `endpoint must be at most ${MAX_ENDPOINT_LENGTH} characters`)
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new HttpError(400, 'endpoint must be a URL')
  }
  if (url.protocol !== 'https:') throw new HttpError(400, 'endpoint must be https')
  const host = url.hostname
  if (!PUSH_HOSTS.includes(host) && !PUSH_HOST_SUFFIXES.some((s) => host.endsWith(s) && host.length > s.length)) {
    throw new HttpError(400, 'endpoint host is not a known push service')
  }
  return value
}

/** The bytes of an unpadded base64url string of exactly `length` bytes, else null. */
function decodeBase64Url(value: unknown, length: number): Uint8Array | null {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]+$/.test(value)) return null
  if (Math.ceil((length * 4) / 3) !== value.length) return null
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4)
  try {
    const raw = atob(base64)
    return raw.length === length ? Uint8Array.from(raw, (c) => c.charCodeAt(0)) : null
  } catch {
    return null
  }
}

function isTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone })
    return true
  } catch {
    return false
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
