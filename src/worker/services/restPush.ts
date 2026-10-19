import type { RestPushRequest } from '../../contract'
import type { Env } from '../env'
import { deleteSubscription, subscriptionsOf } from '../repositories/pushSubscriptions'
import { readVapidKey } from './push'
import { sendPush } from './webPush/send'

const DEFAULT_SUBJECT = 'mailto:admin@workout-tracker.invalid'
const REST_TTL_SECONDS = 60

/** Sends the "Rest over" push to every subscription of the user; endpoints answering gone are deleted. */
export async function sendRestOver(
  env: Env,
  user: string,
  message: Pick<RestPushRequest, 'title' | 'body'>,
): Promise<void> {
  const subs = await subscriptionsOf(env.DB, user)
  if (subs.length === 0) return
  const jwk = readVapidKey(env)
  if (!jwk) return
  const payload = JSON.stringify({ title: message.title, body: message.body, tag: 'rest', url: '/' })
  await Promise.all(
    subs.map(async (sub) => {
      const result = await sendPush({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload, {
        jwk,
        subject: env.VAPID_SUBJECT ?? DEFAULT_SUBJECT,
        ttl: REST_TTL_SECONDS,
        topic: 'rest',
      })
      if (result === 'gone') await deleteSubscription(env.DB, user, sub.endpoint)
    }),
  )
}

/** Asks the user's RestAlarm to hold the message and fire after delayMs, replacing any pending one. */
export async function scheduleRest(env: Env, user: string, request: RestPushRequest): Promise<void> {
  await stubOf(env, user).fetch(
    new Request('https://rest-alarm/rest', { method: 'POST', body: JSON.stringify({ user, ...request }) }),
  )
}

/** Cancels the user's pending rest alarm, if any. */
export async function cancelRest(env: Env, user: string): Promise<void> {
  await stubOf(env, user).fetch(new Request('https://rest-alarm/rest', { method: 'DELETE' }))
}

function stubOf(env: Env, user: string) {
  if (!env.REST_ALARM) throw new Error('REST_ALARM is not bound')
  return env.REST_ALARM.get(env.REST_ALARM.idFromName(user))
}
