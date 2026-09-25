import type { SyncView } from '../ui/Settings'
import type { SyncDeps } from './syncClient'

export type UseSync = {
  sync: SyncView
  syncNow(): Promise<void>
  adoptAccount(): Promise<void>
  replaceRemote(): Promise<void>
}

const NOT_SYNCED: SyncView = { accountEmail: null, lastSyncedAt: null, status: 'idle' }

/** E7-T8 red stub: never syncs. */
export function useSync(_deps?: SyncDeps): UseSync {
  return {
    sync: NOT_SYNCED,
    syncNow: () => Promise.reject(new Error('useSync.syncNow: not implemented')),
    adoptAccount: () => Promise.reject(new Error('useSync.adoptAccount: not implemented')),
    replaceRemote: () => Promise.reject(new Error('useSync.replaceRemote: not implemented')),
  }
}
