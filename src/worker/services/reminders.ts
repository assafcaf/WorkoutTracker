import { parseReminders, type Reminders } from '../../contract'
import type { Env } from '../env'
import { deleteSubscription, subscriptionsOf } from '../repositories/pushSubscriptions'
import { claimReminderDay, reminderRows, sessionStartsSince } from '../repositories/reminders'
import { readVapidKey } from './push'
import { sendPush } from './webPush/send'

const DEFAULT_SUBJECT = 'mailto:admin@workout-tracker.invalid'
const REMINDER_TTL_SECONDS = 3600
const WINDOW_MINUTES = 30
// A local day is at most 25 hours long; look back far enough to cover it.
const LOOKBACK_MS = 26 * 3_600_000
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

type Local = { day: string; weekday: number; minutes: number }

function localOf(timeZone: string, at: number): Local {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
  }).formatToParts(new Date(at))
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  return {
    day: `${get('year')}-${get('month')}-${get('day')}`,
    weekday: WEEKDAYS.indexOf(get('weekday')),
    minutes: Number(get('hour')) * 60 + Number(get('minute')),
  }
}

/** True when `now` falls in the 30 minutes from the reminder time, on one of its weekdays, in its time zone. */
export function isDue(reminders: Reminders, now: number): boolean {
  const local = localOf(reminders.timeZone, now)
  if (!reminders.days.includes(local.weekday)) return false
  const [h, m] = reminders.time.split(':').map(Number)
  const since = local.minutes - (h * 60 + m)
  return since >= 0 && since < WINDOW_MINUTES
}

/** Sends the "Time to train" push to every user who is due and has not trained or been reminded today. */
export async function sendDueReminders(env: Env, now: number): Promise<void> {
  const jwk = readVapidKey(env)
  if (!jwk) return
  for (const row of await reminderRows(env.DB)) {
    let value: unknown
    try {
      value = JSON.parse(row.value)
    } catch {
      continue
    }
    const reminders = parseReminders(value)
    if (!reminders || !isDue(reminders, now)) continue
    const today = localOf(reminders.timeZone, now).day
    const starts = await sessionStartsSince(env.DB, row.user, now - LOOKBACK_MS)
    if (starts.some((at) => localOf(reminders.timeZone, at).day === today)) continue
    const subs = await subscriptionsOf(env.DB, row.user)
    if (subs.length === 0) continue
    if (!(await claimReminderDay(env.DB, row.user, today))) continue
    const payload = JSON.stringify({ title: 'Time to train', body: '', tag: 'reminder', url: '/' })
    await Promise.all(
      subs.map(async (sub) => {
        const result = await sendPush({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload, {
          jwk,
          subject: env.VAPID_SUBJECT ?? DEFAULT_SUBJECT,
          ttl: REMINDER_TTL_SECONDS,
          topic: 'reminder',
        })
        if (result === 'gone') await deleteSubscription(env.DB, row.user, sub.endpoint)
      }),
    )
  }
}
