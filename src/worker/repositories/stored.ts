import type { D1Database } from '../d1'

/** The stored `updated_at` of each of `email`'s rows whose key is in `keys`. */
export async function storedUpdatedAt(
  db: D1Database,
  table: 'sessions' | 'settings',
  keyColumn: 'id' | 'key',
  email: string,
  keys: string[],
): Promise<Map<string, number>> {
  const { results } = await db
    .prepare(
      `SELECT ${keyColumn} AS k, updated_at FROM ${table}
       WHERE user = ?1 AND ${keyColumn} IN (SELECT value FROM json_each(?2))`,
    )
    .bind(email, JSON.stringify(keys))
    .all<{ k: string; updated_at: number }>()
  return new Map(results.map((row) => [row.k, row.updated_at]))
}
