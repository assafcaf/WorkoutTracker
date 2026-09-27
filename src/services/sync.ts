import type { SyncResult, SyncState } from '../sync/syncClient'
import type { ServiceDeps } from './deps'

export type { SyncView } from './syncView'
export type { SyncResult, SyncState } from '../sync/syncClient'

/** The only way the UI reaches cloud sync (E11-T7). */
export type SyncService = {
  state(): Promise<SyncState>
  syncNow(): Promise<SyncResult>
  replaceRemote(): Promise<SyncResult>
  adoptAccount(email: string): Promise<void>
}

export function createSyncService(_deps: ServiceDeps & { fetch?: typeof fetch }): SyncService {
  throw new Error('NotImplementedError: createSyncService (E11-T7)')
}
