import { resolveExercise } from '../../data/resolve'
import { applyBodyweight } from '../../domain/bodyweight'
import type { Resolve } from '../../domain/muscles'
import type { Weekday } from '../../domain/stats/weeks'
import type { ExercisePlan, Program, Session } from '../../types'
import { AppShell } from '../../ui/AppShell'
import { LiftView } from '../../ui/LiftView'
import type { AppRoute } from '../routes'
import { useServiceData } from '../useServiceData'
import { useProgramSwap } from './useProgramSwap'
import type { ProgressPageProps } from './pages'

export type LiftPageViewProps = {
  exerciseId: string
  sessions: Session[]
  program: Program | undefined
  resolve: Resolve
  now: number
  /** Kept for callers from before v6; the one Lift page no longer draws week gaps. */
  weekStart?: Weekday
  /** Opens a Session's summary (a log row, a chart readout). */
  onOpenSession?: (sessionId: string) => void
  /** Offers a variation (Swap ›) when the lift's status asks for one. */
  onSwap?: () => void
}

function planFor(program: Program | undefined, exerciseId: string): ExercisePlan | undefined {
  for (const workout of program?.workouts ?? []) {
    const plan = workout.exercises.find((e) => e.exerciseId === exerciseId)
    if (plan) return plan
  }
  return undefined
}

/**
 * The lift page inside Progress (v6): the one `LiftView`, the same page the live tools sheet's
 * Lift history opens, for the lift under the active Program's Plan.
 */
export function LiftPageView({ exerciseId, sessions, program, resolve, now, onOpenSession, onSwap }: LiftPageViewProps): JSX.Element {
  const exercise = resolve(exerciseId)
  if (!exercise) {
    return <p className="lift-empty">No sessions of this lift yet. Log a set and its history appears here.</p>
  }
  return (
    <LiftView
      exercise={exercise}
      plan={planFor(program, exerciseId)}
      sessions={sessions}
      now={now}
      onOpenSession={onOpenSession}
      onSwap={onSwap}
    />
  )
}

export type LiftPageProps = ProgressPageProps<'lift'> & {
  /** Sends the app to a route (a Session's summary, Exercises for a Swap); passed down by the group. */
  navigate?: (to: AppRoute) => void
  /** The clock; `Date.now` unless a test fixes it. */
  now?: () => number
}

/** The lift page as a Progress page: loads once, draws its own shell, Back to the page below. */
export function LiftPage({ page, onBack, navigate, now = Date.now }: LiftPageProps): JSX.Element {
  const sessionsData = useServiceData((services) => services.sessions.list(), ['sessions'])
  const programsData = useServiceData((services) => services.programs.load(), ['programs'])
  const catalogData = useServiceData((services) => services.catalog.load(), [])
  const overridesData = useServiceData(
    (services) => services.preferences.bodyweightOverrides().catch((): Record<string, boolean> => ({})),
    ['preferences'],
  )

  const { canSwap, openSwap, swapUi } = useProgramSwap()

  let body: JSX.Element | null = null
  let title = 'Lift'
  if (sessionsData.status === 'ready' && programsData.status === 'ready' && catalogData.status === 'ready') {
    const { catalog, library } = catalogData.data
    const libraryMap = new Map(library.map((entry) => [entry.id, entry] as const))
    const overrides = overridesData.status === 'ready' ? overridesData.data : {}
    const resolve: Resolve = (id) => {
      const exercise = resolveExercise(id, catalog, libraryMap)
      return exercise && applyBodyweight(exercise, overrides)
    }
    const { programs, activeProgramId } = programsData.data
    const exercise = resolve(page.exerciseId)
    title = exercise?.name ?? 'Lift'
    body = (
      <LiftPageView
        exerciseId={page.exerciseId}
        sessions={sessionsData.data}
        program={programs.find((p) => p.id === activeProgramId)}
        resolve={resolve}
        now={now()}
        onOpenSession={navigate ? (sessionId) => navigate({ tab: 'history', sessionId }) : undefined}
        // V6R-02: the short swap list, replacing the lift in the Program, with Undo.
        onSwap={canSwap(page.exerciseId) ? () => openSwap(page.exerciseId) : undefined}
      />
    )
  }
  return (
    <AppShell title={title} onBack={onBack}>
      {body}
      {swapUi}
    </AppShell>
  )
}
