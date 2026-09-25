import { useCallback, useEffect, useRef, useState } from 'react'
import type { SyncView } from '../ui/Settings'
import {
  adoptSignedInAccount,
  getSyncState,
  replaceRemote as replaceRemoteCall,
  syncNow as syncNowCall,
} from './syncClient'
import type { SyncDeps, SyncResult, SyncState } from './syncClient'

export type UseSync = {
  sync: SyncView
  syncNow(): Promise<void>
  adoptAccount(): Promise<void>
  replaceRemote(): Promise<void>
}

const NOT_SYNCED: SyncView = { accountEmail: null, lastSyncedAt: null, status: 'idle' }

/** The stored account and sync time, or none when storage cannot answer. */
async function readState(): Promise<SyncState> {
  try {
    return await getSyncState()
  } catch {
    return { accountEmail: null, lastSyncedAt: null }
  }
}

/** A finished call's result as Settings shows it, over the account and time now stored. */
function toView(result: SyncResult, state: SyncState): SyncView {
  switch (result.status) {
    case 'ok':
    case 'offline':
    case 'signed-out':
      return { ...state, status: result.status }
    case 'error':
      return { ...state, status: 'error', message: result.message }
    case 'account-mismatch':
      return {
        ...state,
        accountEmail: result.deviceEmail,
        status: 'account-mismatch',
        signedInEmail: result.signedInEmail,
      }
  }
}

/**
 * Keeps the phone synced without being asked: syncs on mount and whenever the browser fires
 * `online`, and hands out "Sync now", adopt and replace for the screens that need them. Every
 * call resolves once the view shows its result, and none of them ever rejects.
 */
export function useSync(deps?: SyncDeps): UseSync {
  const [sync, setSync] = useState<SyncView>(NOT_SYNCED)
  const depsRef = useRef<SyncDeps>(deps ?? {})
  depsRef.current = deps ?? {}
  const viewRef = useRef<SyncView>(sync)
  viewRef.current = sync
  const mounted = useRef(true)

  const show = useCallback((view: SyncView): void => {
    if (mounted.current) setSync(view)
  }, [])

  /** Starts `call` first, so the request goes out at once, then shows it running and its result. */
  const run = useCallback(
    async (call: (deps: SyncDeps) => Promise<SyncResult>): Promise<void> => {
      try {
        const pending = call(depsRef.current)
        let done = false
        void pending.then(() => {
          done = true
        })
        const before = await readState()
        if (!done) show({ ...before, status: 'syncing' })
        const result = await pending
        show(toView(result, await readState()))
      } catch (error) {
        show({
          ...(await readState()),
          status: 'error',
          message: error instanceof Error ? error.message : String(error),
        })
      }
    },
    [show],
  )

  // Calls run one after another: syncClient shares a call already running with any made while
  // it runs, so a sync asked for mid-sync (a finished session, `online`) or a replace would
  // otherwise be answered by the older call and never happen. Syncs waiting to start coalesce.
  const tail = useRef<Promise<void>>(Promise.resolve())
  const waitingSync = useRef<Promise<void> | null>(null)

  const enqueue = useCallback(
    (call: (deps: SyncDeps) => Promise<SyncResult>, coalesce: boolean): Promise<void> => {
      if (coalesce && waitingSync.current) return waitingSync.current
      const next: Promise<void> = tail.current.then(() => {
        if (waitingSync.current === next) waitingSync.current = null
        return run(call)
      })
      tail.current = next
      if (coalesce) waitingSync.current = next
      return next
    },
    [run],
  )

  const syncNow = useCallback(() => enqueue(syncNowCall, true), [enqueue])
  const replaceRemote = useCallback(() => enqueue(replaceRemoteCall, false), [enqueue])
  const adoptAccount = useCallback(
    () =>
      enqueue(async (callDeps) => {
        const { signedInEmail } = viewRef.current
        if (signedInEmail !== undefined) await adoptSignedInAccount(signedInEmail)
        return syncNowCall(callDeps)
      }, false),
    [enqueue],
  )

  useEffect(() => {
    mounted.current = true
    const onOnline = (): void => {
      void syncNow()
    }
    window.addEventListener('online', onOnline)
    void syncNow()
    return () => {
      mounted.current = false
      window.removeEventListener('online', onOnline)
    }
  }, [syncNow])

  return { sync, syncNow, adoptAccount, replaceRemote }
}
