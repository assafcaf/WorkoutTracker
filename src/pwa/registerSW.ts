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
  /**
   * The update check was turned away by the login in front of the app (true), or got through
   * again (false). While it is turned away, no new version can ever be found.
   */
  onSignInNeeded?(needed: boolean): void
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
    onRegisteredSW: (swUrl, registration) => {
      if (registration) {
        watchForUpdates(registration, {
          checkBlocked: () => updateCheckBlocked(swUrl),
          onSignInNeeded: options?.onSignInNeeded,
        })
      }
    },
  })
}

/** How often an open app asks for a new version. */
export const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000

/**
 * Whether the worker script is behind the login: Cloudflare Access answers an expired
 * session with a redirect to its login page (or a 401/403), which `registration.update()`
 * reports only as a generic failure. A network error (offline) is not a login problem.
 */
export async function updateCheckBlocked(
  swUrl: string,
  fetchFn: typeof fetch = (...args) => fetch(...args),
): Promise<boolean> {
  try {
    const res = await fetchFn(swUrl, { redirect: 'manual', cache: 'no-store' })
    return res.type === 'opaqueredirect' || res.status === 401 || res.status === 403
  } catch {
    return false
  }
}

/**
 * Asks the server for a new service worker on launch, whenever the app comes back to the foreground, and
 * once an hour while it stays open.
 *
 * The browser only checks on a navigation, and iOS resumes a home-screen app instead of
 * relaunching it, so without this an installed app can run an old version for days after a
 * deploy. A found update still only waits ("Update ready"); nothing reloads here.
 *
 * Returns a function that stops watching.
 */
export function watchForUpdates(
  registration: Pick<ServiceWorkerRegistration, 'update'>,
  env: {
    doc?: Pick<Document, 'visibilityState' | 'addEventListener' | 'removeEventListener'>
    setInterval?: (fn: () => void, ms: number) => unknown
    clearInterval?: (id: unknown) => void
    intervalMs?: number
    /** Asked after a failed check: was it the login that turned it away? */
    checkBlocked?: () => Promise<boolean>
    onSignInNeeded?: (needed: boolean) => void
  } = {},
): () => void {
  const doc = env.doc ?? document
  const every = env.setInterval ?? ((fn, ms) => setInterval(fn, ms))
  const stop = env.clearInterval ?? ((id) => clearInterval(id as ReturnType<typeof setInterval>))
  let blocked = false
  const report = (now: boolean) => {
    if (now === blocked) return
    blocked = now
    env.onSignInNeeded?.(now)
  }
  const check = () => {
    registration.update().then(
      () => report(false),
      async () => {
        // Offline or a server hiccup: the next foreground or tick tries again. A login wall
        // is worth saying, because it never clears on its own.
        if (env.checkBlocked) report(await env.checkBlocked())
      },
    )
  }
  const onVisibility = () => {
    if (doc.visibilityState === 'visible') check()
  }
  doc.addEventListener('visibilitychange', onVisibility)
  check()
  const timer = every(check, env.intervalMs ?? UPDATE_CHECK_INTERVAL_MS)
  return () => {
    doc.removeEventListener('visibilitychange', onVisibility)
    stop(timer)
  }
}

/**
 * What the "Update ready" control is driven by: registers the worker once on mount, reports a
 * waiting new version, and activates it only when `update` is called.
 *
 * Finding an update does nothing on its own — no reload, no `skipWaiting` — because that is
 * exactly what would throw away the workout in progress.
 */
export function useServiceWorkerUpdate(): {
  needRefresh: boolean
  /** The update check is stuck behind an expired login; signing in again unblocks it. */
  signInToUpdate: boolean
  update(): Promise<void>
} {
  const [waiting, setWaiting] = useState<UpdateHandle | null>(null)
  const [signInToUpdate, setSignInToUpdate] = useState(false)
  const registered = useRef(false)

  useEffect(() => {
    // StrictMode invokes a mount effect twice. Registering twice would leave two handles and
    // a second update to find, so the first registration of this mount is the only one.
    if (registered.current) return
    registered.current = true
    registerServiceWorker({
      onNeedRefresh: (handle) => setWaiting(handle),
      onSignInNeeded: setSignInToUpdate,
    })
  }, [])

  const update = useCallback(async () => {
    // Reloading is the point: activating the waiting worker while the old code keeps running
    // would leave the trainee on the version they just asked to replace.
    if (waiting) await waiting.updateServiceWorker(true)
  }, [waiting])

  return { needRefresh: waiting !== null, signInToUpdate, update }
}
