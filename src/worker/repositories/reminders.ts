import type { D1Database } from '../d1'

export type ReminderRow = { user: string; value: string }

/** Every user's stored `workoutReminders` setting (the value is the JSON text). */
export async function reminderRows(db: D1Database): Promise<ReminderRow[]> {
  const { results } = await db
    .prepare("SELECT user, value FROM settings WHERE key = 'workoutReminders'")
    .all<ReminderRow>()
  return results
}

/** The `startedAt` of the user's live Sessions started at or after `since`. */
export async function sessionStartsSince(db: D1Database, user: string, since: number): Promise<number[]> {
  const { results } = await db
    .prepare(
      `SELECT json_extract(doc, '$.startedAt') AS started FROM sessions
       WHERE user = ?1 AND json_extract(doc, '$.deletedAt') IS NULL
         AND json_extract(doc, '$.startedAt') >= ?2`,
    )
    .bind(user, since)
    .all<{ started: number }>()
  return results.map((row) => row.started)
}

/** Records that the user was reminded on `day`; false when they already were. */
export async function claimReminderDay(db: D1Database, user: string, day: string): Promise<boolean> {
  const row = await db
    .prepare('INSERT INTO reminder_log (user, day) VALUES (?1, ?2) ON CONFLICT DO NOTHING RETURNING user')
    .bind(user, day)
    .first()
  return row !== null
}
