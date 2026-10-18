import { useEffect } from 'react'

type WakeLockSentinelLike = { release(): Promise<void> }
type NavigatorWithWakeLock = Navigator & {
  wakeLock?: { request(type: 'screen'): Promise<WakeLockSentinelLike> }
}

/**
 * Requests a screen wake lock while `active` is true, releases it on `false` or unmount, and
 * requests it again when the page becomes visible again (the browser drops the lock when the page
 * is hidden); an absent `navigator.wakeLock` or a rejected request is a silent no-op.
 */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active) return

    const wakeLock = (navigator as NavigatorWithWakeLock).wakeLock
    if (wakeLock === undefined) return

    let cancelled = false
    let sentinel: WakeLockSentinelLike | null = null

    const acquire = (): void => {
      wakeLock
        .request('screen')
        .then((lock) => {
          if (cancelled) {
            void lock.release()
            return
          }
          const previous = sentinel
          sentinel = lock
          if (previous !== null) void previous.release().catch(() => undefined)
        })
        .catch(() => {
          // Silent no-op: a rejected request must not surface as an error.
        })
    }

    const onVisibilityChange = (): void => {
      if (document.visibilityState === 'visible') acquire()
    }

    acquire()
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisibilityChange)
      if (sentinel !== null) void sentinel.release()
    }
  }, [active])
}
