import type { Reminders } from '../../contract'
import type { Env } from '../env'

/** True when `now` falls in the 30 minutes from the reminder time, on one of its weekdays, in its time zone. */
export function isDue(_reminders: Reminders, _now: number): boolean {
  return false // stub: not implemented
}

/** Sends the "Time to train" push to every user who is due and has not trained or been reminded today. */
export async function sendDueReminders(_env: Env, _now: number): Promise<void> {
  // stub: not implemented
}
