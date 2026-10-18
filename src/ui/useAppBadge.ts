import { useEffect } from 'react'

type NavigatorWithBadging = Navigator & {
  setAppBadge?: (count: number) => Promise<void>
  clearAppBadge?: () => Promise<void>
}

/**
 * Badges the app icon with 1 while `active` (a Session in progress) and clears it when `active`
 * ends or the component unmounts. An absent Badging API or a rejected call is a silent no-op.
 */
export function useAppBadge(active: boolean): void {
  useEffect(() => {
    if (!active) return
    const nav = navigator as NavigatorWithBadging
    try {
      void nav.setAppBadge?.(1)?.catch(() => undefined)
    } catch {
      // Silent no-op.
    }
    return () => {
      try {
        void nav.clearAppBadge?.()?.catch(() => undefined)
      } catch {
        // Silent no-op.
      }
    }
  }, [active])
}
