import { HttpError } from './index'

export type PushSubscriptionRequest = { endpoint: string; keys: { p256dh: string; auth: string } }
export type PushUnsubscribeRequest = { endpoint: string }
export type RestPushRequest = { delayMs: number; title: string; body: string }
export type PushKeyResponse = { publicKey: string }
export type Reminders = { days: number[]; time: string; timeZone: string }

void HttpError

export function checkSubscriptionRequest(body: unknown): PushSubscriptionRequest {
  return body as PushSubscriptionRequest
}

export function checkUnsubscribeRequest(body: unknown): PushUnsubscribeRequest {
  return body as PushUnsubscribeRequest
}

export function checkRestPushRequest(body: unknown): RestPushRequest {
  return body as RestPushRequest
}

export function checkPushKeyResponse(body: unknown): PushKeyResponse | null {
  return body as PushKeyResponse | null
}

export function parseReminders(value: unknown): Reminders | null {
  return value as Reminders | null
}
