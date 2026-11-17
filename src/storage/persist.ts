/** The `settings` key the persistence answer is kept under. */
export const STORAGE_PERSISTENCE_KEY = 'storagePersistence'

/**
 * Asks iOS to keep the app's data, once. Returns whether storage is persistent now.
 * Never calls `navigator.storage.persist()` again after a recorded refusal, nor when
 * `persisted()` is already true.
 */
export async function requestPersistence(): Promise<boolean> {
  throw new Error('NotImplementedError')
}

/** The recorded answer: true granted, false refused, null never asked. */
export async function getPersistenceAnswer(): Promise<boolean | null> {
  throw new Error('NotImplementedError')
}
