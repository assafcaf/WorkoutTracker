import type { SyncedSetting } from '../../contract'
import type { D1Database, D1PreparedStatement } from '../d1'

/** Stores a setting when it is newer than the stored copy; its seq is the counter minus `back`. */
export function upsertSetting(db: D1Database, email: string, setting: SyncedSetting, back: number): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO settings (user, key, value, updated_at, seq)
       VALUES (?1, ?2, ?3, ?4, (SELECT seq FROM counters WHERE user = ?1) - ?5)
       ON CONFLICT (user, key) DO UPDATE
         SET value = excluded.value, updated_at = excluded.updated_at, seq = excluded.seq
         WHERE excluded.updated_at > settings.updated_at`,
    )
    .bind(email, setting.key, JSON.stringify(setting.value), setting.updatedAt, back)
}

export function insertSetting(db: D1Database, email: string, setting: SyncedSetting, back: number): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO settings (user, key, value, updated_at, seq)
       VALUES (?1, ?2, ?3, ?4, (SELECT seq FROM counters WHERE user = ?1) - ?5)`,
    )
    .bind(email, setting.key, JSON.stringify(setting.value), setting.updatedAt, back)
}

export function deleteSettings(db: D1Database, email: string): D1PreparedStatement {
  return db.prepare('DELETE FROM settings WHERE user = ?1').bind(email)
}

export function settingsSince(db: D1Database, email: string, since: number): D1PreparedStatement {
  return db
    .prepare('SELECT key, value, updated_at FROM settings WHERE user = ?1 AND seq > ?2 ORDER BY seq')
    .bind(email, since)
}
