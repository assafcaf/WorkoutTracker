import type { SyncedSession } from '../../contract'
import type { D1Database, D1PreparedStatement } from '../d1'

/** Stores a session when it is newer than the stored copy; its seq is the counter minus `back`. */
export function upsertSession(db: D1Database, email: string, session: SyncedSession, back: number): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO sessions (user, id, doc, updated_at, seq)
       VALUES (?1, ?2, ?3, ?4, (SELECT seq FROM counters WHERE user = ?1) - ?5)
       ON CONFLICT (user, id) DO UPDATE
         SET doc = excluded.doc, updated_at = excluded.updated_at, seq = excluded.seq
         WHERE excluded.updated_at > sessions.updated_at`,
    )
    .bind(email, session.id, JSON.stringify(session), session.updatedAt, back)
}

export function insertSession(db: D1Database, email: string, session: SyncedSession, back: number): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO sessions (user, id, doc, updated_at, seq)
       VALUES (?1, ?2, ?3, ?4, (SELECT seq FROM counters WHERE user = ?1) - ?5)`,
    )
    .bind(email, session.id, JSON.stringify(session), session.updatedAt, back)
}

export function deleteSessions(db: D1Database, email: string): D1PreparedStatement {
  return db.prepare('DELETE FROM sessions WHERE user = ?1').bind(email)
}

export function sessionsSince(db: D1Database, email: string, since: number): D1PreparedStatement {
  return db.prepare('SELECT doc FROM sessions WHERE user = ?1 AND seq > ?2 ORDER BY seq').bind(email, since)
}
