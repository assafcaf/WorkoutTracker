import {
  adoptSignedInAccount,
  createSyncClient,
  getSyncState,
  type SyncResult,
  type SyncState,
} from '../sync/syncClient'
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

/**
 * Cloud sync over the repositories, stamped with `deps.now`. A pull that writes rows announces
 * each topic it touched once; adopting an account, which clears the local data, announces all.
 */
export function createSyncService(deps: ServiceDeps & { fetch?: typeof fetch }): SyncService {
  const { bus } = deps
  const client = createSyncClient({
    fetch: deps.fetch,
    now: deps.now,
    onPulled: (topics) => topics.forEach((topic) => bus.emit(topic)),
  })

  return {
    state: () => getSyncState(),
    syncNow: () => client.syncNow(),
    replaceRemote: () => client.replaceRemote(),
    async adoptAccount(email) {
      await adoptSignedInAccount(email)
      bus.emit('sessions')
      bus.emit('programs')
      bus.emit('preferences')
    },
  }
}
