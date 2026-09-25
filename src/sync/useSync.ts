import { useCallback, useEffect, useRef, useState } from 'react'
import type { SyncView } from '../ui/Settings'
import {
  adoptSignedInAccount,
  getSyncState,
  replaceRemote as replaceRemoteClient,
  syncNow as syncNowClient,
} from './syncClient'
import type { SyncDeps, SyncResult } from './syncClient'

export type UseSync = {
  sync: SyncView
  syncNow(): Promise<void>
  adoptAccount(): Promise<void>
  replaceRemote(): Promise<void>
}

const NOT_SYNCED: SyncView = { accountEmail: null, lastSyncedAt: null, status: 'idle' }

/** The view of a finished call: the stored account and sync time, plus what the call answered. */
async function viewOf(result: SyncResult): Promise<SyncView> {
  const { accountEmail, lastSyncedAt } = await getSyncState()
  const view: SyncView = { accountEmail, lastSyncedAt, status: result.status }
  if (result.status === 'error') view.message = result.message
  if (result.status === 'account-mismatch') view.signedInEmail = result.signedInEmail
  return view
}

/**
 * The phone's cloud sync as `Settings` shows it (E7-T8). Syncs on mount and whenever the browser
 * fires `online`; every call resolves once the view shows its result, and none ever rejects.
 */
export function useSync(deps?: SyncDeps): UseSync {
  const [sync, setSync] = useState<SyncView>(NOT_SYNCED)
  // Read at call time, so the handlers stay stable across renders.
  const depsRef = useRef<SyncDeps>(deps ?? {})
  depsRef.current = deps ?? {}
  const mounted = useRef(true)

  const run = useCallback(async (call: () => Promise<SyncResult>): Promise<void> => {
    try {
      const before = await getSyncState()
      if (mounted.current) setSync({ ...before, status: 'syncing' })
      const view = await viewOf(await call())
      if (mounted.current) setSync(view)
    } catch (error) {
      if (mounted.current) {
        setSync((current) => ({
          ...current,
          status: 'error',
          message: error instanceof Error ? error.message : String(error),
        }))
      }
    }
  }, [])

  const syncNow = useCallback(
    () => run(() => syncNowClient(depsRef.current)),
    [run],
  )

  const replaceRemote = useCallback(
    () => run(() => replaceRemoteClient(depsRef.current)),
    [run],
  )

  const signedInEmail = sync.status === 'account-mismatch' ? sync.signedInEmail : undefined
  const adoptAccount = useCallback(async (): Promise<void> => {
    if (signedInEmail === undefined) return
    try {
      await adoptSignedInAccount(signedInEmail)
    } catch {
      // Nothing was adopted; the sync below reports the mismatch again.
    }
    await syncNow()
  }, [signedInEmail, syncNow])

  useEffect(() => {
    mounted.current = true
    void syncNow()
    const onOnline = (): void => {
      void syncNow()
    }
    window.addEventListener('online', onOnline)
    return () => {
      mounted.current = false
      window.removeEventListener('online', onOnline)
    }
  }, [syncNow])

  return { sync, syncNow, adoptAccount, replaceRemote }
}
