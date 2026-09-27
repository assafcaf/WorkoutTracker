/**
 * Runs `fn` in one Dexie transaction over the `sessions` and `settings` tables, so every write
 * inside it commits together or not at all (E11-T2).
 */
export async function inTransaction<T>(mode: 'r' | 'rw', fn: () => Promise<T>): Promise<T> {
  void mode
  void fn
  throw new Error('inTransaction is not implemented')
}
