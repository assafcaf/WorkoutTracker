import { useEffect, useState } from 'react'
import { resolveExercise } from '../../data/resolve'
import type { Muscle } from '../../types'
import { HistoryList } from '../../ui/HistoryList'
import { HistoryStatsSwitch, type HistoryStatsView } from '../../ui/HistoryStatsSwitch'
import { SessionSummary } from '../../ui/SessionSummary'
import { Stats } from '../../ui/Stats'
import type { AppRoute } from '../routes'
import { useServiceData } from '../useServiceData'

export type HistoryFeatureProps = {
  navigate(to: AppRoute): void
  onInSession(inSession: boolean): void
}

/**
 * The History tab as its own container over services (E11-T13, O12): shows the History |
 * Stats switch, the finished sessions and their summary, refreshing itself whenever the
 * `'sessions'` topic fires (a local write or a pulled Session), without a reload.
 *
 * History never puts the trainee mid-session; `onInSession(false)` is reported once so the
 * tab bar the shell around this container draws never mistakes an open summary for one.
 */
export function HistoryFeature({ navigate, onInSession }: HistoryFeatureProps): JSX.Element {
  const [view, setView] = useState<HistoryStatsView>('history')
  const [summarySessionId, setSummarySessionId] = useState<string | null>(null)

  useEffect(() => {
    onInSession(false)
  }, [onInSession])

  const sessionsData = useServiceData((services) => services.sessions.list(), ['sessions'])
  const programsData = useServiceData(
    (services) => services.programs.load().then((loaded) => loaded.programs),
    ['programs'],
  )
  const catalogData = useServiceData((services) => services.catalog.load(), [])

  const ready =
    sessionsData.status === 'ready' && programsData.status === 'ready' && catalogData.status === 'ready'

  /** `SessionSummary.onBrowse`: closes the summary and sends the Exercises tab the muscles. */
  function handleBrowse(muscles: Muscle[]): void {
    setSummarySessionId(null)
    navigate({ tab: 'exercises', muscles })
  }

  return (
    <>
      <h1>{view === 'stats' ? 'Stats' : 'History'}</h1>
      <HistoryStatsSwitch current={view} onChange={setView} />
      {ready
        ? (() => {
            const sessions = sessionsData.data
            const programs = programsData.data
            const { catalog, library } = catalogData.data
            const libraryMap = new Map(library.map((entry) => [entry.id, entry] as const))
            const resolve = (id: string) => resolveExercise(id, catalog, libraryMap)
            const summarySession = summarySessionId
              ? sessions.find((session) => session.id === summarySessionId) ?? null
              : null

            return (
              <>
                {view === 'stats' ? (
                  <Stats sessions={sessions} resolve={resolve} programs={programs} />
                ) : (
                  <HistoryList
                    sessions={sessions}
                    programs={programs}
                    resolve={resolve}
                    onOpen={setSummarySessionId}
                  />
                )}
                {summarySession ? (
                  <SessionSummary
                    session={summarySession}
                    resolve={resolve}
                    library={libraryMap}
                    onClose={() => setSummarySessionId(null)}
                    onBrowse={handleBrowse}
                  />
                ) : null}
              </>
            )
          })()
        : null}
    </>
  )
}
