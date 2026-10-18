import type { SyncResponse, SyncedSession, SyncedSetting } from '../../contract'
import type { D1Database, D1PreparedStatement } from '../d1'
import { readCounter, reserveSeqs } from '../repositories/counters'
import { deleteSessions, insertSession, sessionsSince, upsertSession } from '../repositories/sessions'
import { deleteSettings, insertSetting, settingsSince, upsertSetting } from '../repositories/settings'
import { storedUpdatedAt } from '../repositories/stored'
import { commit } from '../repositories/unitOfWork'

/**
 * Writes the rows newer than the stored copies in one batch. The counter bump and the rows
 * share the transaction, and each row's seq is read from the counter inside it, so a
 * concurrent sync can never see a cursor past rows that are not yet committed.
 */
export async function storeNewer(
  db: D1Database,
  email: string,
  sessions: SyncedSession[],
  settings: SyncedSetting[],
): Promise<void> {
  const freshSessions = await newerThanStored(db, 'sessions', 'id', email, sessions.map((s) => [s.id, s.updatedAt]))
  const freshSettings = await newerThanStored(db, 'settings', 'key', email, settings.map((s) => [s.key, s.updatedAt]))
  const count = freshSessions.length + freshSettings.length
  if (count === 0) return

  // The k-th written row (0-based) takes seq = counter - (count - 1 - k).
  let offset = count
  const statements: D1PreparedStatement[] = [reserveSeqs(db, email, count)]
  for (const index of freshSessions) statements.push(upsertSession(db, email, sessions[index], --offset))
  for (const index of freshSettings) statements.push(upsertSetting(db, email, settings[index], --offset))
  await commit(db, statements)
}

/**
 * Deletes every row `email` has and inserts exactly the pushed sessions and settings, all in
 * one batch. Returns the cursor (the user's counter value) a following sync can pass as `since`.
 */
export async function replaceAll(
  db: D1Database,
  email: string,
  sessions: SyncedSession[],
  settings: SyncedSetting[],
): Promise<number> {
  const count = sessions.length + settings.length
  const statements: D1PreparedStatement[] = [
    reserveSeqs(db, email, Math.max(count, 1)),
    deleteSessions(db, email),
    deleteSettings(db, email),
  ]

  let offset = count
  for (const session of sessions) statements.push(insertSession(db, email, session, --offset))
  for (const setting of settings) statements.push(insertSetting(db, email, setting, --offset))
  const results = await commit(db, statements)
  const counter = results[0] as { results: Array<{ seq: number }> }
  return counter.results[0]?.seq ?? 0
}

/**
 * Indexes of the pushed rows that would replace what is stored: newer than the stored copy
 * (ties keep it), and for a key pushed twice in one body, only the first of the newest.
 */
async function newerThanStored(
  db: D1Database,
  table: 'sessions' | 'settings',
  keyColumn: 'id' | 'key',
  email: string,
  pushed: Array<[string, number]>,
): Promise<number[]> {
  if (pushed.length === 0) return []
  const newest = await storedUpdatedAt(db, table, keyColumn, email, pushed.map(([key]) => key))

  const fresh: number[] = []
  pushed.forEach(([key, updatedAt], index) => {
    const current = newest.get(key)
    if (current !== undefined && updatedAt <= current) return
    newest.set(key, updatedAt)
    fresh.push(index)
  })
  return fresh
}

/** Every row of `email`'s past `since`, and the counter value to pass as the next `since`. */
export async function changesSince(db: D1Database, email: string, since: number): Promise<SyncResponse> {
  const [counter, sessions, settings] = (await commit(db, [
    readCounter(db, email),
    sessionsSince(db, email, since),
    settingsSince(db, email, since),
  ])) as [
    { results: Array<{ seq: number }> },
    { results: Array<{ doc: string }> },
    { results: Array<{ key: SyncedSetting['key']; value: string; updated_at: number }> },
  ]
  return {
    cursor: counter.results[0]?.seq ?? 0,
    sessions: sessions.results.map((row) => JSON.parse(row.doc) as SyncedSession),
    settings: settings.results.map((row) => ({
      key: row.key,
      value: JSON.parse(row.value) as unknown,
      updatedAt: row.updated_at,
    })),
  }
}
