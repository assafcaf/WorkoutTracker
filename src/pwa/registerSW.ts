/// <reference types="vite-plugin-pwa/vanillajs" />
/**
 * Registering the app's service worker, and the handle the "Update ready" control needs.
 *
 * `registerServiceWorker` is the low-level call; `useServiceWorkerUpdate` is what the app
 * mounts, and the only place that registers, so one registration carries the callbacks the
 * "Update ready" control is driven by.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { registerSW } from 'virtual:pwa-register'

/** What the UI calls to let a waiting worker take over. */
export type UpdateHandle = {
  /** Activates the waiting worker; reloads the page unless told not to. */
  updateServiceWorker(reloadPage?: boolean): Promise<void>
}

export type RegisterOptions = {
  /** A new version is installed and waiting. Nothing has reloaded. */
  onNeedRefresh?(handle: UpdateHandle): void
  /** Everything the app needs is precached, so it will start with no network. */
  onOfflineReady?(): void
}

/**
 * Registers the service worker the build emits.
 *
 * Does nothing when `navigator.serviceWorker` is absent, so dev and the test suite are
 * unaffected.
 */
export function registerServiceWorker(options?: RegisterOptions): void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return

  // `registerSW` hands back the one function that lets a waiting worker take over, so the
  // handle E2-T3's control needs is built from it rather than from the registration.
  const updateServiceWorker = registerSW({
    onNeedRefresh: () => options?.onNeedRefresh?.({ updateServiceWorker }),
    onOfflineReady: () => options?.onOfflineReady?.(),
  })
}

/**
 * What the "Update ready" control is driven by: registers the worker once on mount, reports a
 * waiting new version, and activates it only when `update` is called.
 *
 * Finding an update does nothing on its own — no reload, no `skipWaiting` — because that is
 * exactly what would throw away the workout in progress.
 */
export function useServiceWorkerUpdate(): { needRefresh: boolean; update(): Promise<void> } {
  const [waiting, setWaiting] = useState<UpdateHandle | null>(null)
  const registered = useRef(false)

  useEffect(() => {
    // StrictMode invokes a mount effect twice. Registering twice would leave two handles and
    // a second update to find, so the first registration of this mount is the only one.
    if (registered.current) return
    registered.current = true
    registerServiceWorker({ onNeedRefresh: (handle) => setWaiting(handle) })
  }, [])

  const update = useCallback(async () => {
    // Reloading is the point: activating the waiting worker while the old code keeps running
    // would leave the trainee on the version they just asked to replace.
    if (waiting) await waiting.updateServiceWorker(true)
  }, [waiting])

  return { needRefresh: waiting !== null, update }
}
