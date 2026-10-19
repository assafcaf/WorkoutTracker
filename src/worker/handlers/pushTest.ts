import type { PushTestResponse } from '../../contract'
import type { Env } from '../env'
import { json } from '../http'
import { deleteSubscription, subscriptionsOf } from '../repositories/pushSubscriptions'
import { readVapidKey } from '../services/push'
import { logSend, sendPush } from '../services/webPush/send'

const DEFAULT_SUBJECT = 'mailto:admin@workout-tracker.invalid'
const TEST_TTL_SECONDS = 60

/** Sends a test notification at once to every subscription of the user and answers per device. */
export async function handlePushTest(_request: Request, env: Env, email: string): Promise<Response> {
  const jwk = readVapidKey(env)
  if (!jwk) return json({ error: 'push not configured' }, 503)
  const subs = await subscriptionsOf(env.DB, email)
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
      if (answer.result === 'gone') await deleteSubscription(env.DB, email, sub.endpoint)
      return { host: new URL(sub.endpoint).host, ...answer }
    }),
  )
  return json({ subscriptions: subs.length, results } satisfies PushTestResponse)
}
