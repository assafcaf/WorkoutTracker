/**
 * Registering the app's service worker, and the handle the "Update ready" control needs.
 *
 * `E2-T2` only has to register; `E2-T3` is what calls `onNeedRefresh` and builds the control
 * that uses the handle.
 */

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
export function registerServiceWorker(_options?: RegisterOptions): void {
  throw new Error('registerServiceWorker is not implemented')
}
