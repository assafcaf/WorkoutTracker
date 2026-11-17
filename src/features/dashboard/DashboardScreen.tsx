import { useEffect, useState, type ReactNode } from 'react'
import { resolveExercise } from '../../data/resolve'
import { applyBodyweight } from '../../domain/bodyweight'
import { timeAgo, workoutEstimate } from '../../domain/dashboard'
import { formatDay } from '../../domain/dates'
import type { Resolve } from '../../domain/muscles'
import { visiblePrograms } from '../../domain/programs'
import { buildLiftHistories } from '../../domain/stats/liftHistory'
import { nextWorkout, workoutNote } from '../../domain/shortSession'
import { dueWorkoutCard, workoutCard, workoutMinutes } from '../../domain/stats/train'
import { isDeloadWeek } from '../../domain/deload'
import { thisWeek, type Weekday } from '../../domain/stats/weeks'
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
import { finishText, noteText, trainCardOf, weekStripOf, type TrainCard } from './trainCard'

export type DashboardScreenProps = {
  /** Starts (or resumes) `workoutId` of the active Program. */
  onStartWorkout(workoutId: string): void
  onOpenSettings(): void
  /** The workout to open on instead of the one due (Home's arrows picked it). */
  initialWorkoutId?: string
  /** The clock; `Date.now` unless a test fixes it. */
  now?: () => number
  /** Notes drawn under the header (storage unavailable, a backup due). */
  notices?: ReactNode
  /** A Session in progress: the dock resumes it rather than starting another. */
  resume?: DashboardResume | null
  /** Opens the Sessions tab, from the week strip (V3-09). */
  onOpenSessions?(): void
  /** V5-14: opens a past Session's summary, from its day on the week strip. */
  onOpenSession?(sessionId: string): void
  /** V6-03: opens the one Lift page from a lift's name. */
  onOpenLift?(exerciseId: string): void
  /** v7: the workout page's Back, to Home. */
  onBack?(): void
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

const LONG_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/** v7: when a Workout was last done, as the headline says it: `Monday` this past week, else the day. */
function sameAsText(last: number, now: number): string {
  const day = (ms: number): number => {
    const d = new Date(ms)
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  }
  const days = Math.round((day(now) - day(last)) / 86_400_000)
  return days >= 1 && days < 7 ? LONG_DAYS[new Date(last).getDay()] : formatDay(new Date(last), new Date(now))
}

function syncOf(view: SyncView, now: number): DashboardSync {
  const offline = view.status === 'offline' || (typeof navigator !== 'undefined' && navigator.onLine === false)
  if (offline) return { kind: 'offline' }
  if (view.status === 'syncing') return { kind: 'syncing' }
  if (view.status === 'update-required') return { kind: 'failed' }
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
  onOpenSessions,
  onOpenSession,
  onOpenLift,
  onBack,
  initialWorkoutId,
}: DashboardScreenProps): JSX.Element {
  const services = useServices()
  const { sync, syncNow } = useSyncControls()
  const loaded = useServiceData(load, ['programs', 'sessions', 'preferences'])
  const weekStartData = useServiceData(
    (s) => s.preferences.weekStart().then((day): Weekday => day as Weekday).catch((): Weekday => 1),
    ['preferences'],
  )
  const weekStartsOn: Weekday = weekStartData.status === 'ready' ? weekStartData.data : 1
  const deloadData = useServiceData((s) => s.preferences.deloadWeek().catch((): null => null), ['preferences'])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [, setTick] = useState(0)

  // "Synced 2 min ago" keeps counting while the screen stays up.
  useEffect(() => {
    const timer = window.setInterval(() => setTick((tick) => tick + 1), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  const at = now()
  const today = formatDay(new Date(at), new Date(at))
  const deloadOn = deloadData.status === 'ready' && isDeloadWeek(deloadData.data, at, weekStartsOn)
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
      // V6-11: after a short Session the same Workout is next.
      const due = nextWorkout(program, sessions)
      const plans = new Map<string, ExercisePlan>()
      for (const workout of program.workouts) for (const plan of workout.exercises) plans.set(plan.exerciseId, plan)
      const histories = buildLiftHistories(sessions, resolve, (id) => plans.get(id))
      const week = thisWeek(sessions, at, program.sessionsPerWeek, weekStartsOn)
      const dueCard = dueWorkoutCard(program, sessions, resolve, histories)
      const more = Math.max(0, week.planned - week.done - 1)
      const visible = program.workouts.filter((workout) => !workout.hidden)
      // V6-08: each Workout's last Session note, under the date.
      const noteOf = (workoutId: string): { note?: string } => {
        const note = workoutNote(
          workoutId,
          sessions.filter((session) => session.programId === program.id),
        )
        return note === null ? {} : { note: noteText(note, at) }
      }
      const dockWorkout = (workout: Workout): DockWorkout => {
        const done = sessions
          .filter((session) => session.programId === program.id && session.workoutId === workout.id)
          .map((session) => session.startedAt)
        const last = done.length > 0 ? Math.max(...done) : null
        return {
          workoutId: workout.id,
          name: workout.name,
          last: last === null ? null : formatDay(new Date(last), new Date(at)),
          sameAs: last === null ? null : sameAsText(last, at),
          // V6-15: one estimate for every Workout, the one the Program tab shows too.
          minutes: workoutMinutes(program, workout, sessions).minutes,
          ...noteOf(workout.id),
          ...(workout.id === due?.workout.id && due.short ? { finish: finishText(due.short, at) } : {}),
        }
      }
      // Each other workout's card, so "Change" redraws the card for the one picked (V1-21).
      const cards: Record<string, TrainCard> = {}
      for (const workout of visible) {
        if (workout.id === due?.workout.id) continue
        const done = sessions
          .filter((session) => session.programId === program.id && session.workoutId === workout.id)
          .map((session) => session.startedAt)
        const card = workoutCard(program, workout, done.length > 0 ? Math.max(...done) : null, sessions, resolve, histories)
        cards[workout.id] = trainCardOf(card, histories, more, deloadOn, sessions, resolve, at)
      }
      data = {
        kind: 'ready',
        card: dueCard ? trainCardOf(dueCard, histories, more, deloadOn, sessions, resolve, at) : null,
        week: weekStripOf(sessions, program, at, weekStartsOn),
        cards,
        due: due ? { ...dockWorkout(due.workout), last: due.lastDoneAt === null ? null : formatDay(new Date(due.lastDoneAt), new Date(at)) } : null,
        workouts: visible.map(dockWorkout),
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
      onOpenSessions={onOpenSessions}
      onOpenSession={onOpenSession}
      onOpenLift={onOpenLift}
      onBack={onBack}
      initialWorkoutId={initialWorkoutId}
    />
  )
}
