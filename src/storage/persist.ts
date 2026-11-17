import { db } from './db'

/** The `settings` key the persistence answer is kept under. */
export const STORAGE_PERSISTENCE_KEY = 'storagePersistence'

/** The recorded answer: true granted, false refused, null never asked. */
export async function getPersistenceAnswer(): Promise<boolean | null> {
  const row = await db.settings.get(STORAGE_PERSISTENCE_KEY)
  return typeof row?.value === 'boolean' ? row.value : null
}

/**
 * Asks iOS to keep the app's data, once. Returns whether storage is persistent now.
 * Never calls `navigator.storage.persist()` again after a recorded answer, nor when
 * `persisted()` is already true.
 */
export async function requestPersistence(): Promise<boolean> {
  const recorded = await getPersistenceAnswer()
  if (recorded !== null) return recorded
  const storage: StorageManager | undefined =
    typeof navigator === 'undefined' ? undefined : navigator.storage
  if (!storage?.persist) return false
  try {
    if (storage.persisted && (await storage.persisted())) return true
    const granted = await storage.persist()
    await db.settings.put({ key: STORAGE_PERSISTENCE_KEY, value: granted, updatedAt: Date.now() })
    return granted
  } catch {
    return false
  }
}
