import type { PushSubscriptionRequest, PushTestResponse } from '../../contract'
import type { D1Database } from '../d1'
import type { Env } from '../env'
import { deleteSubscription, subscriptionsOf, upsertSubscription } from '../repositories/pushSubscriptions'
import { logSend, sendPush } from './webPush/send'
import { vapidPublicKey, type VapidJwk } from './webPush/vapid'

const DEFAULT_SUBJECT = 'mailto:admin@workout-tracker.invalid'

/** The VAPID key in the secret, or null when it is unset or not a P-256 JWK. */
export function readVapidKey(env: Env): VapidJwk | null {
  if (!env.VAPID_PRIVATE_KEY) return null
  try {
    const jwk = JSON.parse(env.VAPID_PRIVATE_KEY) as Partial<VapidJwk>
    if (jwk.crv !== 'P-256' || !jwk.x || !jwk.y || !jwk.d) return null
    const key = { kty: 'EC', crv: 'P-256', x: jwk.x, y: jwk.y, d: jwk.d }
    vapidPublicKey(key)
    return key
  } catch {
    return null
  }
}

/** The Worker's public key, derived from the secret; null when not configured. */
export function publicKeyOf(env: Env): string | null {
  const jwk = readVapidKey(env)
  return jwk ? vapidPublicKey(jwk) : null
}

export async function subscribe(db: D1Database, user: string, request: PushSubscriptionRequest): Promise<void> {
  await upsertSubscription(
    db,
    user,
    { endpoint: request.endpoint, p256dh: request.keys.p256dh, auth: request.keys.auth },
    Date.now(),
  )
}

export async function unsubscribe(db: D1Database, user: string, endpoint: string): Promise<void> {
  await deleteSubscription(db, user, endpoint)
}

/** Sends the message to every subscription of the user; endpoints answering gone are deleted. */
export async function pushToUser(
  env: Env,
  user: string,
  message: unknown,
  options: { fetch?: typeof fetch } = {},
): Promise<void> {
  const subs = await subscriptionsOf(env.DB, user)
  if (subs.length === 0) return
  const jwk = readVapidKey(env)
  if (!jwk) return
  const payload = JSON.stringify(message)
  await Promise.all(
    subs.map(async (sub) => {
      const result = await sendPush(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
        { jwk, subject: env.VAPID_SUBJECT ?? DEFAULT_SUBJECT, fetch: options.fetch },
      )
      logSend(sub.endpoint, result)
      if (result.result === 'gone') await deleteSubscription(env.DB, user, sub.endpoint)
    }),
  )
}

const TEST_TTL_SECONDS = 60

/** Sends a test notification at once to every subscription of the user; null when push is not configured. */
export async function sendTestPush(env: Env, user: string): Promise<PushTestResponse | null> {
  const jwk = readVapidKey(env)
  if (!jwk) return null
  const subs = await subscriptionsOf(env.DB, user)
  const payload = JSON.stringify({ title: 'Test notification', body: 'If you see this, push works.', tag: 'test', url: '/' })
  const results = await Promise.all(
    subs.map(async (sub) => {
      const answer = await sendPush({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload, {
        jwk,
        subject: env.VAPID_SUBJECT ?? DEFAULT_SUBJECT,
        ttl: TEST_TTL_SECONDS,
        topic: 'test',
      })
      logSend(sub.endpoint, answer)
      if (answer.result === 'gone') await deleteSubscription(env.DB, user, sub.endpoint)
      return { host: new URL(sub.endpoint).host, ...answer }
    }),
  )
  return { subscriptions: subs.length, results }
}
