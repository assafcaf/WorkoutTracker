import type { D1Database, D1PreparedStatement } from '../d1'

/** Runs the statements in one D1 batch (one transaction), answering each statement's result. */
export function commit(db: D1Database, statements: D1PreparedStatement[]): Promise<unknown[]> {
  return db.batch(statements)
}
