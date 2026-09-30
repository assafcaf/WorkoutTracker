import { useEffect, useState } from 'react'
import { resolveExercise } from '../../data/resolve'
import type { Muscle } from '../../types'
import { AppShell } from '../../ui/AppShell'
import { HistoryList, summarise } from '../../ui/HistoryList'
import { HistoryStatsSwitch, type HistoryStatsView } from '../../ui/HistoryStatsSwitch'
import { SessionEditor } from '../../ui/SessionEditor'
import { SessionSummary } from '../../ui/SessionSummary'
import { Stats } from '../../ui/Stats'
import type { AppRoute } from '../routes'
import { useServices } from '../ServicesProvider'
import { useServiceData } from '../useServiceData'

/** The History editor open over one finished Session (E12-T6), at an Exercise when given. */
export type SessionEditView = { view: 'session-edit'; sessionId: string; exerciseId?: string }

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
  const [editing, setEditing] = useState<SessionEditView | null>(null)
  const services = useServices()

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

  function handleEdit(sessionId: string, exerciseId?: string): void {
    setEditing({ view: 'session-edit', sessionId, exerciseId })
  }

  // The shell's own header carries the tab's one heading; the summary sits over the shell.
  return (
    <AppShell title={view === 'stats' ? 'Stats' : 'History'}>
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

            const editSession = editing
              ? sessions.find((session) => session.id === editing.sessionId) ?? null
              : null
            if (editing && editSession) {
              return (
                <SessionEditor
                  key={editSession.id}
                  session={editSession}
                  workoutName={summarise(editSession, programs).workoutName}
                  resolve={resolve}
                  focusExerciseId={editing.exerciseId}
                  onSave={async (draft) => {
                    await services.sessions.save(draft)
                    setEditing(null)
                  }}
                  onCancel={() => setEditing(null)}
                  onDelete={() => {
                    void services.sessions.discard(editSession.id).then(() => setEditing(null))
                  }}
                />
              )
            }

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
                    onEdit={handleEdit}
                  />
                )}
                {summarySession ? (
                  <SessionSummary
                    session={summarySession}
                    resolve={resolve}
                    library={libraryMap}
                    earlierSessions={sessions.filter(
                      (other) =>
                        other.id !== summarySession.id &&
                        other.finishedAt !== undefined &&
                        other.startedAt < summarySession.startedAt,
                    )}
                    planFor={(exerciseId) =>
                      programs
                        .find((program) => program.id === summarySession.programId)
                        ?.workouts.find((workout) => workout.id === summarySession.workoutId)
                        ?.exercises.find((plan) => plan.exerciseId === exerciseId)
                    }
                    onClose={() => setSummarySessionId(null)}
                    onBrowse={handleBrowse}
                  />
                ) : null}
              </>
            )
          })()
        : null}
    </AppShell>
  )
}
