import type { D1Database } from '../d1'

export type StoredSubscription = { endpoint: string; p256dh: string; auth: string }

/** Stores the subscription for the user; an endpoint held by another user moves to them. */
export async function upsertSubscription(
  db: D1Database,
  user: string,
  sub: StoredSubscription,
  createdAt: number,
): Promise<void> {
  await db.batch([
    db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?1 AND user != ?2').bind(sub.endpoint, user),
    db
      .prepare(
        `INSERT INTO push_subscriptions (user, endpoint, p256dh, auth, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5)
         ON CONFLICT (user, endpoint) DO UPDATE SET p256dh = excluded.p256dh, auth = excluded.auth`,
      )
      .bind(user, sub.endpoint, sub.p256dh, sub.auth, createdAt),
  ])
}

export async function deleteSubscription(db: D1Database, user: string, endpoint: string): Promise<void> {
  await db.prepare('DELETE FROM push_subscriptions WHERE user = ?1 AND endpoint = ?2').bind(user, endpoint).run()
}

export async function subscriptionsOf(db: D1Database, user: string): Promise<StoredSubscription[]> {
  const { results } = await db
    .prepare('SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user = ?1 ORDER BY created_at, endpoint')
    .bind(user)
    .all<StoredSubscription>()
  return results
}
