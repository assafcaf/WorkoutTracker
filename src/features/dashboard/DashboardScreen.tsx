import { useEffect, useState, type ReactNode } from 'react'
import { resolveExercise } from '../../data/resolve'
import { applyBodyweight } from '../../domain/bodyweight'
import {
  dueWorkout,
  timeAgo,
  workoutEstimate,
} from '../../domain/dashboard'
import { formatDay } from '../../domain/dates'
import type { Resolve } from '../../domain/muscles'
import { visiblePrograms } from '../../domain/programs'
import { buildLiftHistories } from '../../domain/stats/liftHistory'
import { dueWorkoutCard } from '../../domain/stats/train'
import { thisWeek } from '../../domain/stats/weeks'
import { ServiceError, type Services, type SyncView } from '../../services'
import type { Exercise, ExercisePlan, Program, Session, Workout } from '../../types'
import { useServices, useSyncControls } from '../ServicesProvider'
import { useServiceData } from '../useServiceData'
import {
  DashboardView,
  type DashboardData,
  type DashboardResume,
  type DashboardSync,
  type DockWorkout,
  type ProgramOption,
} from './DashboardView'
import { trainCardOf } from './trainCard'

export type DashboardScreenProps = {
  /** Starts (or resumes) `workoutId` of the active Program. */
  onStartWorkout(workoutId: string): void
  onOpenSettings(): void
  /** The clock; `Date.now` unless a test fixes it. */
  now?: () => number
  /** Notes drawn under the header (storage unavailable, a backup due). */
  notices?: ReactNode
  /** A Session in progress: the dock resumes it rather than starting another. */
  resume?: DashboardResume | null
}

type Loaded = {
  programs: Program[]
  activeProgramId: string | null
  storageAvailable: boolean
  sessions: Session[]
  resolve: Resolve
}

async function load(s: Services): Promise<Loaded> {
  const { catalog, library, bundledPrograms } = await s.catalog.load()
  const libraryMap = new Map(library.map((entry) => [entry.id, entry] as const))
  const overrides = await s.preferences.bodyweightOverrides().catch(() => ({}))
  const resolve = (id: string): Exercise | undefined => {
    const exercise = resolveExercise(id, catalog, libraryMap)
    return exercise && applyBodyweight(exercise, overrides)
  }
  const sessions = await s.sessions.list().catch((): Session[] => [])
  try {
    const loaded = await s.programs.load()
    return {
      programs: loaded.programs,
      activeProgramId: loaded.activeProgramId,
      storageAvailable: true,
      sessions,
      resolve,
    }
  } catch (error) {
    if (!(error instanceof ServiceError) || error.code !== 'storage-unavailable') throw error
    // Nothing can be stored: the bundled Programs are offered, and none can be taken up.
    return { programs: bundledPrograms, activeProgramId: null, storageAvailable: false, sessions, resolve }
  }
}

/** `3× per week · 2 workouts · 14 exercises`. */
function programSummary(program: Program): string {
  const exercises = new Set(program.workouts.flatMap((w) => w.exercises.map((plan) => plan.exerciseId)))
  const workouts = program.workouts.length
  return `${program.sessionsPerWeek}× per week · ${workouts} workout${workouts === 1 ? '' : 's'} · ${exercises.size} exercises`
}

/** `7 exercises · 23 sets · ~53 min`. */
function workoutSummary(workout: Workout, loggedMinutes?: number): string {
  const { exercises, sets, minutes } = workoutEstimate(workout)
  return `${exercises} exercises · ${sets} sets · ~${loggedMinutes ?? minutes} min`
}

function syncOf(view: SyncView, now: number): DashboardSync {
  const offline = view.status === 'offline' || (typeof navigator !== 'undefined' && navigator.onLine === false)
  if (offline) return { kind: 'offline' }
  if (view.status === 'syncing') return { kind: 'syncing' }
  if (view.status === 'error' || view.status === 'account-mismatch') return { kind: 'failed' }
  if (view.lastSyncedAt !== null) return { kind: 'synced', ago: timeAgo(view.lastSyncedAt, now) }
  return { kind: 'local' }
}

/**
 * The Train tab's container (E18 O24): reads the Programs, the finished Sessions, the catalog and
 * the sync state through the services, works the due workout's next steps out with the pure
 * functions in `src/domain/stats/`, and renders `DashboardView`. Picking a Program
 * here (a new trainee) makes it the active one through `programs.setActive`.
 */
export function DashboardScreen({
  onStartWorkout,
  onOpenSettings,
  now = Date.now,
  notices,
  resume,
}: DashboardScreenProps): JSX.Element {
  const services = useServices()
  const { sync, syncNow } = useSyncControls()
  const loaded = useServiceData(load, ['programs', 'sessions', 'preferences'])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [, setTick] = useState(0)

  // "Synced 2 min ago" keeps counting while the screen stays up.
  useEffect(() => {
    const timer = window.setInterval(() => setTick((tick) => tick + 1), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  const at = now()
  const today = formatDay(new Date(at), new Date(at))
  let data: DashboardData = { kind: 'loading' }

  if (loaded.status === 'ready') {
    const { programs, activeProgramId, storageAvailable, sessions, resolve } = loaded.data
    const active = programs.find((program) => program.id === activeProgramId)
    if (!active) {
      const offered = visiblePrograms(programs)
      const options: ProgramOption[] = offered.map((program) => ({
        id: program.id,
        name: program.name,
        summary: programSummary(program),
        workouts: program.workouts.map((workout) => ({ name: workout.name, summary: workoutSummary(workout) })),
      }))
      data = {
        kind: 'no-program',
        options,
        selectedId: selectedId ?? options[0]?.id ?? null,
        canUse: storageAvailable,
        onSelect: setSelectedId,
        onUse: (id) => {
          void services.programs.setActive(id).catch(() => undefined)
        },
      }
    } else {
      const program = visiblePrograms([active])[0] ?? active
      const due = dueWorkout(program, sessions)
      const plans = new Map<string, ExercisePlan>()
      for (const workout of program.workouts) for (const plan of workout.exercises) plans.set(plan.exerciseId, plan)
      const histories = buildLiftHistories(sessions, resolve, (id) => plans.get(id))
      const week = thisWeek(sessions, at, program.sessionsPerWeek)
      const dueCard =dueWorkoutCard(program, sessions, resolve, histories)
      const dockWorkout = (workout: Workout): DockWorkout => {
        const done = sessions
          .filter((session) => session.programId === program.id && session.workoutId === workout.id)
          .map((session) => session.startedAt)
        const last = done.length > 0 ? Math.max(...done) : null
        return {
          workoutId: workout.id,
          name: workout.name,
          last: last === null ? null : formatDay(new Date(last), new Date(at)),
          summary: workoutSummary(workout, workout.id === due?.workout.id ? dueCard?.minutes : undefined),
        }
      }
      data = {
        kind: 'ready',
        card: dueCard ? trainCardOf(dueCard, histories, Math.max(0, week.planned - week.done - 1)) : null,
        due: due
          ? {
              workoutId: due.workout.id,
              name: due.workout.name,
              last: due.lastDoneAt === null ? null : formatDay(new Date(due.lastDoneAt), new Date(at)),
              summary: workoutSummary(due.workout, dueCard?.minutes),
            }
          : null,
        workouts: program.workouts.filter((workout) => !workout.hidden).map(dockWorkout),
      }
    }
  }

  return (
    <DashboardView
      today={today}
      sync={syncOf(sync, at)}
      data={data}
      onSync={() => void syncNow()}
      onOpenSettings={onOpenSettings}
      onStartWorkout={onStartWorkout}
      notices={notices}
      resume={resume}
    />
  )
}
