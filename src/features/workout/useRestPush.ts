import { useEffect, useRef } from 'react'
import { useServices } from '../ServicesProvider'

/**
 * Schedules the "Rest over" push for the Session's current rest and cancels it when the rest
 * is skipped, over or the Session ends (E24-T10, O27, O29). Only when push is `on`; never awaited
 * by the caller and never throws, so logging a Set is not delayed.
 */
export function useRestPush(restEndsAt: number | null, next: string | null): void {
  const { push } = useServices()
  const pending = useRef(false)

  useEffect(() => {
    const live = restEndsAt !== null && restEndsAt > Date.now()
    if (!live && restEndsAt === null && !pending.current) return
    let stale = false
    const wasPending = pending.current
    pending.current = live
    void (async () => {
      try {
        if ((await push.status()) !== 'on' || stale) return
        if (live) await push.scheduleRest(restEndsAt, (next ?? 'next set').replace(' · ', ', '))
        else if (restEndsAt !== null || wasPending) await push.cancelRest()
      } catch {
        // Push is best effort.
      }
    })()
    return () => {
      stale = true
    }
  }, [push, restEndsAt, next])
}
