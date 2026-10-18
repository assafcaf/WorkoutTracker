import type { D1Database, D1PreparedStatement } from '../d1'

/** Reserves `count` consecutive seqs for `email` and returns the first of them. */
export async function nextSeq(db: D1Database, email: string, count: number): Promise<number> {
  const row = await reserveSeqs(db, email, count).first<{ seq: number }>()
  if (!row) throw new Error('counter upsert returned no row')
  return row.seq - count + 1
}

/** Raises `email`'s counter by `count`, returning the new value (the last seq reserved). */
export function reserveSeqs(db: D1Database, email: string, count: number): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO counters (user, seq) VALUES (?1, ?2)
       ON CONFLICT (user) DO UPDATE SET seq = seq + excluded.seq
       RETURNING seq`,
    )
    .bind(email, count)
}

export function readCounter(db: D1Database, email: string): D1PreparedStatement {
  return db.prepare('SELECT seq FROM counters WHERE user = ?1').bind(email)
}
