/// <reference types="vite-plugin-pwa/vanillajs" />
/**
 * Registering the app's service worker, and the handle the "Update ready" control needs.
 *
 * `E2-T2` only has to register; `E2-T3` is what calls `onNeedRefresh` and builds the control
 * that uses the handle.
 */
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
