import type { D1Database, D1PreparedStatement } from './d1'
import type { Env } from './env'
import { json } from './index'
import {
  MAX_BODY_BYTES,
  SYNCED_SETTING_KEYS,
  type ReplaceRequest,
  type ReplaceResponse,
  type SyncResponse,
  type SyncedSession,
  type SyncedSetting,
} from '../sync/protocol'

/** A failure the caller should see as this HTTP status, with the message as its `error`. */
export class HttpError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'HttpError'
    this.status = status
  }
}

/** POST /api/sync: store the caller's newer rows, answer every row of theirs past `since`. */
export async function handleSync(request: Request, env: Env, email: string): Promise<Response> {
  try {
    const body = await readJsonBody(request)
    if (!isRecord(body)) throw new HttpError(400, 'body must be a JSON object')
    if (!isFiniteNumber(body.since)) throw new HttpError(400, 'since must be a number')
    const sessions = parseSessions(body.sessions)
    const settings = parseSettings(body.settings)

    await storeNewer(env.DB, email, sessions, settings)
    return json((await changesSince(env.DB, email, body.since)) satisfies SyncResponse)
  } catch (error) {
    if (error instanceof HttpError) return json({ error: error.message }, error.status)
    throw error
  }
}

/** POST /api/replace: make the caller's stored rows exactly the pushed sessions and settings. */
export async function handleReplace(request: Request, env: Env, email: string): Promise<Response> {
  try {
    const body = await readJsonBody(request)
    if (!isRecord(body)) throw new HttpError(400, 'body must be a JSON object')
    const sessions = parseSessions(body.sessions)
    const settings = parseSettings(body.settings)
    void (sessions satisfies ReplaceRequest['sessions'])
    void (settings satisfies ReplaceRequest['settings'])

    const cursor = await replaceAll(env.DB, email, sessions, settings)
    return json({ cursor } satisfies ReplaceResponse)
  } catch (error) {
    if (error instanceof HttpError) return json({ error: error.message }, error.status)
    throw error
  }
}

/** The parsed JSON body; HttpError(413) over MAX_BODY_BYTES, HttpError(400) when not JSON. */
export async function readJsonBody(request: Request): Promise<unknown> {
  const tooLarge = () => new HttpError(413, `body exceeds ${MAX_BODY_BYTES} bytes`)
  if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY_BYTES) throw tooLarge()
  const bytes = await request.arrayBuffer()
  if (bytes.byteLength > MAX_BODY_BYTES) throw tooLarge()
  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown
  } catch {
    throw new HttpError(400, 'body is not valid JSON')
  }
}

/** `value` as synced sessions; HttpError(400) unless every one has a string id and numeric updatedAt. */
export function parseSessions(value: unknown): SyncedSession[] {
  if (!Array.isArray(value)) throw new HttpError(400, 'sessions must be an array')
  for (const session of value) {
    if (!isRecord(session) || typeof session.id !== 'string' || !isFiniteNumber(session.updatedAt)) {
      throw new HttpError(400, 'every session needs a string id and a numeric updatedAt')
    }
  }
  return value as SyncedSession[]
}

/** `value` as synced settings; HttpError(400) for a key outside SYNCED_SETTING_KEYS. */
export function parseSettings(value: unknown): SyncedSetting[] {
  if (!Array.isArray(value)) throw new HttpError(400, 'settings must be an array')
  for (const setting of value) {
    if (
      !isRecord(setting) ||
      !(SYNCED_SETTING_KEYS as readonly unknown[]).includes(setting.key) ||
      !('value' in setting) ||
      !isFiniteNumber(setting.updatedAt)
    ) {
      throw new HttpError(400, `every setting needs a key in ${SYNCED_SETTING_KEYS.join(', ')}, a value and a numeric updatedAt`)
    }
  }
  return value as SyncedSetting[]
}

/** Reserves `count` consecutive seqs for `email` and returns the first of them. */
export async function nextSeq(db: D1Database, email: string, count: number): Promise<number> {
  const row = await reserveSeqs(db, email, count).first<{ seq: number }>()
  if (!row) throw new Error('counter upsert returned no row')
  return row.seq - count + 1
}

/** Raises `email`'s counter by `count`, returning the new value (the last seq reserved). */
function reserveSeqs(db: D1Database, email: string, count: number): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO counters (user, seq) VALUES (?1, ?2)
       ON CONFLICT (user) DO UPDATE SET seq = seq + excluded.seq
       RETURNING seq`,
    )
    .bind(email, count)
}

/**
 * Writes the rows newer than the stored copies in one batch. The counter bump and the rows
 * share the transaction, and each row's seq is read from the counter inside it, so a
 * concurrent sync can never see a cursor past rows that are not yet committed.
 */
async function storeNewer(
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
  for (const index of freshSessions) {
    const session = sessions[index]
    statements.push(
      db
        .prepare(
          `INSERT INTO sessions (user, id, doc, updated_at, seq)
           VALUES (?1, ?2, ?3, ?4, (SELECT seq FROM counters WHERE user = ?1) - ?5)
           ON CONFLICT (user, id) DO UPDATE
             SET doc = excluded.doc, updated_at = excluded.updated_at, seq = excluded.seq
             WHERE excluded.updated_at > sessions.updated_at`,
        )
        .bind(email, session.id, JSON.stringify(session), session.updatedAt, --offset),
    )
  }
  for (const index of freshSettings) {
    const setting = settings[index]
    statements.push(
      db
        .prepare(
          `INSERT INTO settings (user, key, value, updated_at, seq)
           VALUES (?1, ?2, ?3, ?4, (SELECT seq FROM counters WHERE user = ?1) - ?5)
           ON CONFLICT (user, key) DO UPDATE
             SET value = excluded.value, updated_at = excluded.updated_at, seq = excluded.seq
             WHERE excluded.updated_at > settings.updated_at`,
        )
        .bind(email, setting.key, JSON.stringify(setting.value), setting.updatedAt, --offset),
    )
  }
  await db.batch(statements)
}

/**
 * Deletes every row `email` has and inserts exactly the pushed sessions and settings, all in
 * one batch. Returns the cursor (the user's counter value) a following sync can pass as `since`.
 */
async function replaceAll(
  db: D1Database,
  email: string,
  sessions: SyncedSession[],
  settings: SyncedSetting[],
): Promise<number> {
  const count = sessions.length + settings.length
  const statements: D1PreparedStatement[] = [
    reserveSeqs(db, email, Math.max(count, 1)),
    db.prepare('DELETE FROM sessions WHERE user = ?1').bind(email),
    db.prepare('DELETE FROM settings WHERE user = ?1').bind(email),
  ]

  let offset = count
  for (const session of sessions) {
    statements.push(
      db
        .prepare(
          `INSERT INTO sessions (user, id, doc, updated_at, seq)
           VALUES (?1, ?2, ?3, ?4, (SELECT seq FROM counters WHERE user = ?1) - ?5)`,
        )
        .bind(email, session.id, JSON.stringify(session), session.updatedAt, --offset),
    )
  }
  for (const setting of settings) {
    statements.push(
      db
        .prepare(
          `INSERT INTO settings (user, key, value, updated_at, seq)
           VALUES (?1, ?2, ?3, ?4, (SELECT seq FROM counters WHERE user = ?1) - ?5)`,
        )
        .bind(email, setting.key, JSON.stringify(setting.value), setting.updatedAt, --offset),
    )
  }
  const results = await db.batch(statements)
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
  const { results } = await db
    .prepare(
      `SELECT ${keyColumn} AS k, updated_at FROM ${table}
       WHERE user = ?1 AND ${keyColumn} IN (SELECT value FROM json_each(?2))`,
    )
    .bind(email, JSON.stringify(pushed.map(([key]) => key)))
    .all<{ k: string; updated_at: number }>()
  const newest = new Map(results.map((row) => [row.k, row.updated_at]))

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
async function changesSince(db: D1Database, email: string, since: number): Promise<SyncResponse> {
  const [counter, sessions, settings] = (await db.batch([
    db.prepare('SELECT seq FROM counters WHERE user = ?1').bind(email),
    db.prepare('SELECT doc FROM sessions WHERE user = ?1 AND seq > ?2 ORDER BY seq').bind(email, since),
    db
      .prepare('SELECT key, value, updated_at FROM settings WHERE user = ?1 AND seq > ?2 ORDER BY seq')
      .bind(email, since),
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}
