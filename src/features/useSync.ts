import { useCallback, useEffect, useRef, useState } from 'react'
import type { SyncResult, SyncService, SyncState, SyncView } from '../services/sync'

export type UseSync = {
  sync: SyncView
  syncNow(): Promise<void>
  adoptAccount(): Promise<void>
  replaceRemote(): Promise<void>
}

const NOT_SYNCED: SyncView = { accountEmail: null, lastSyncedAt: null, status: 'idle' }

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
 * Keeps the phone synced without being asked: syncs on mount, whenever the browser fires
 * `online`, and whenever the page becomes visible again, and hands out "Sync now", adopt and replace for the screens that need them. Every
 * call resolves once the view shows its result, and none of them ever rejects.
 */
export function useSync(sync: SyncService): UseSync {
  const [view, setView] = useState<SyncView>(NOT_SYNCED)
  const serviceRef = useRef<SyncService>(sync)
  serviceRef.current = sync
  const viewRef = useRef<SyncView>(view)
  viewRef.current = view
  const mounted = useRef(true)

  const show = useCallback((next: SyncView): void => {
    if (mounted.current) setView(next)
  }, [])

  /** The stored account and sync time, or none when storage cannot answer. */
  const readState = useCallback(async (): Promise<SyncState> => {
    try {
      return await serviceRef.current.state()
    } catch {
      return { accountEmail: null, lastSyncedAt: null }
    }
  }, [])

  /** Starts `call` first, so the request goes out at once, then shows it running and its result. */
  const run = useCallback(
    async (call: (service: SyncService) => Promise<SyncResult>): Promise<void> => {
      try {
        const pending = call(serviceRef.current)
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
    [show, readState],
  )

  // Calls run one after another: the service shares a call already running with any made while
  // it runs, so a sync asked for mid-sync (a finished session, `online`) or a replace would
  // otherwise be answered by the older call and never happen. Syncs waiting to start coalesce.
  const tail = useRef<Promise<void>>(Promise.resolve())
  const waitingSync = useRef<Promise<void> | null>(null)

  const enqueue = useCallback(
    (call: (service: SyncService) => Promise<SyncResult>, coalesce: boolean): Promise<void> => {
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

  const syncNow = useCallback(() => enqueue((service) => service.syncNow(), true), [enqueue])
  const replaceRemote = useCallback(
    () => enqueue((service) => service.replaceRemote(), false),
    [enqueue],
  )
  const adoptAccount = useCallback(
    () =>
      enqueue(async (service) => {
        const { signedInEmail } = viewRef.current
        if (signedInEmail !== undefined) await service.adoptAccount(signedInEmail)
        return service.syncNow()
      }, false),
    [enqueue],
  )

  useEffect(() => {
    mounted.current = true
    const onOnline = (): void => {
      void syncNow()
    }
    // An installed app coming back from the background is not a new mount: only the page's
    // visibility changes. Without this, work from another device waits for "Sync now".
    const onVisible = (): void => {
      if (document.visibilityState === 'visible') void syncNow()
    }
    window.addEventListener('online', onOnline)
    document.addEventListener('visibilitychange', onVisible)
    void syncNow()
    return () => {
      mounted.current = false
      window.removeEventListener('online', onOnline)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [syncNow])

  return { sync: view, syncNow, adoptAccount, replaceRemote }
}
