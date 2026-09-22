import { useEffect } from 'react'

type WakeLockSentinelLike = { release(): Promise<void> }
type NavigatorWithWakeLock = Navigator & {
  wakeLock?: { request(type: 'screen'): Promise<WakeLockSentinelLike> }
}

/**
 * Requests a screen wake lock while `active` is true, releases it on `false` or unmount; an
 * absent `navigator.wakeLock` or a rejected request is a silent no-op.
 */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active) return

    const wakeLock = (navigator as NavigatorWithWakeLock).wakeLock
    if (wakeLock === undefined) return

    let cancelled = false
    let sentinel: WakeLockSentinelLike | null = null

    wakeLock
      .request('screen')
      .then((lock) => {
        if (cancelled) {
          void lock.release()
          return
        }
        sentinel = lock
      })
      .catch(() => {
        // Silent no-op: a rejected request must not surface as an error.
      })

    return () => {
      cancelled = true
      if (sentinel !== null) void sentinel.release()
    }
  }, [active])
}
