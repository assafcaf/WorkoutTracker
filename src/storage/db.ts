import Dexie, { type Table } from 'dexie'
import type { Session } from '../types'

/**
 * A row of the `settings` table. E1-T6 owns what goes in it; `db.ts` only declares the table
 * so that task does not have to change the schema.
 */
export type SettingRow = {
  key: string
  value: unknown
}

/**
 * The local database. `sessions` is keyed by `id` and indexed by `startedAt` and `finishedAt`,
 * so the store can walk finished sessions newest-first.
 */
export class WorkoutDb extends Dexie {
  sessions!: Table<Session, string>
  settings!: Table<SettingRow, string>

  constructor() {
    super('workout-tracker')
    this.version(1).stores({
      sessions: 'id, startedAt, finishedAt',
      settings: 'key',
    })
  }
}

export const db = new WorkoutDb()

/**
 * Whether IndexedDB can actually be opened in this context.
 *
 * Reads `globalThis.indexedDB` at call time and probes it, so a missing factory, a factory
 * whose `open` throws (Safari with storage blocked) and one whose open request errors
 * (Firefox private browsing) all resolve `false` instead of throwing at the call site.
 */
export async function isStorageAvailable(): Promise<boolean> {
  throw new Error('isStorageAvailable is not implemented')
}
