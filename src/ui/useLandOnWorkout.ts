import { useEffect, useRef } from 'react'

/**
 * Calls `onVisible` each time the document becomes visible again (E8-T7), e.g. when iOS resumes
 * a suspended app. The caller decides what that does.
 */
export function useLandOnWorkout(onVisible: () => void): void {
  const latest = useRef(onVisible)
  latest.current = onVisible

  useEffect(() => {
    function handleVisibilityChange(): void {
      if (document.visibilityState === 'visible') latest.current()
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])
}
