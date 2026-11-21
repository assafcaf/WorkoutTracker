import type { ReactNode } from 'react'
import { resolveExercise } from '../../data/resolve'
import { applyBodyweight } from '../../domain/bodyweight'
import { formatDay } from '../../domain/dates'
import type { Resolve } from '../../domain/muscles'
import { visiblePrograms } from '../../domain/programs'
import { buildLiftHistories } from '../../domain/stats/liftHistory'
import { nextWorkout, workoutNote } from '../../domain/shortSession'
import { dueWorkoutCard, workoutCard, workoutMinutes } from '../../domain/stats/train'
import { isDeloadWeek } from '../../domain/deload'
import { thisWeek, type Weekday } from '../../domain/stats/weeks'
import { ServiceError, type Services } from '../../services'
import type { Exercise, ExercisePlan, Program, Session, Workout } from '../../types'
import { useServices } from '../ServicesProvider'
import { useServiceData } from '../useServiceData'
import { DashboardView, type DashboardData, type DashboardResume, type DockWorkout, type ProgramOption } from './DashboardView'
import { finishText, noteText, trainCardOf, type TrainCard } from './trainCard'
import { trainDayOf } from './trainDay'

export type DashboardScreenProps = {
  /** Starts `workoutId` of the active Program. */
  onStartWorkout(workoutId: string): void
  /** The clock; `Date.now` unless a test fixes it. */
  now?: () => number
  /** Notes drawn under the header (storage unavailable, a stale active Program). */
  notices?: ReactNode
  /** A Session in progress: Train shows its Plans and no Start (DX-09). */
  resume?: DashboardResume | null
  /** V6-03: opens the one Lift page from a lift's name. */
  onOpenLift?(exerciseId: string): void
}

type Loaded = {
  programs: Program[]
  activeProgramId: string | null
  storageAvailable: boolean
  sessions: Session[]
  resolve: Resolve
  reminders: number[] | null
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
  const reminders = await Promise.resolve()
    .then(() => s.push.reminders())
    .then((r) => r?.days ?? null)
    .catch((): null => null)
  try {
    const loaded = await s.programs.load()
    return {
      programs: loaded.programs,
      activeProgramId: loaded.activeProgramId,
      storageAvailable: true,
      sessions,
      resolve,
      reminders,
    }
  } catch (error) {
    if (!(error instanceof ServiceError) || error.code !== 'storage-unavailable') throw error
    // Nothing can be stored: the bundled Programs are offered, and none can be taken up.
    return { programs: bundledPrograms, activeProgramId: null, storageAvailable: false, sessions, resolve, reminders }
  }
}

/** DX-04: a Program as the first-run rows say it, `3× a week · 2 workouts`. */
export function programChoiceSummary(program: Program): string {
  const workouts = program.workouts.filter((workout) => !workout.hidden).length
  return `${program.sessionsPerWeek}× a week · ${workouts} workout${workouts === 1 ? '' : 's'}`
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

/**
 * The Train tab's container (E18 O24, DX-01): reads the Programs, the finished Sessions, the
 * catalog and the Reminders through the services, works the due workout's next steps and the
 * day's meta line out with the pure functions in `src/domain/stats/` and `trainDay`, and renders
 * `DashboardView`. Choosing a Program here (a new trainee) makes it the active one through
 * `programs.setActive`.
 */
export function DashboardScreen({ onStartWorkout, now = Date.now, notices, resume, onOpenLift }: DashboardScreenProps): JSX.Element {
  const services = useServices()
  const loaded = useServiceData(load, ['programs', 'sessions', 'preferences'])
  const weekStartData = useServiceData(
    (s) => s.preferences.weekStart().then((day): Weekday => day as Weekday).catch((): Weekday => 1),
    ['preferences'],
  )
  const weekStartsOn: Weekday = weekStartData.status === 'ready' ? weekStartData.data : 1
  const deloadData = useServiceData((s) => s.preferences.deloadWeek().catch((): null => null), ['preferences'])

  const at = now()
  const deloadOn = deloadData.status === 'ready' && isDeloadWeek(deloadData.data, at, weekStartsOn)
  let data: DashboardData = { kind: 'loading' }

  if (loaded.status === 'ready') {
    const { programs, activeProgramId, storageAvailable, sessions, resolve, reminders } = loaded.data
    const active = programs.find((program) => program.id === activeProgramId)
    if (!active) {
      const options: ProgramOption[] = visiblePrograms(programs).map((program) => ({
        id: program.id,
        name: program.name,
        summary: programChoiceSummary(program),
      }))
      data = {
        kind: 'no-program',
        options,
        canUse: storageAvailable,
        onChoose: (id) => {
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
      // Each other workout's card: a Session in progress may be on one of them (DX-09).
      const cards: Record<string, TrainCard> = {}
      for (const workout of visible) {
        if (workout.id === due?.workout.id) continue
        const done = sessions
          .filter((session) => session.programId === program.id && session.workoutId === workout.id)
          .map((session) => session.startedAt)
        const card = workoutCard(program, workout, done.length > 0 ? Math.max(...done) : null, sessions, resolve, histories)
        cards[workout.id] = trainCardOf(card, histories, more, deloadOn, sessions, resolve, at)
      }
      const day = trainDayOf({
        sessions,
        now: at,
        sessionsPerWeek: program.sessionsPerWeek,
        weekStartsOn,
        reminders,
        dueName: due?.workout.name ?? null,
      })
      data = {
        kind: 'ready',
        card: dueCard ? trainCardOf(dueCard, histories, more, deloadOn, sessions, resolve, at) : null,
        cards,
        due: due ? { ...dockWorkout(due.workout), last: due.lastDoneAt === null ? null : formatDay(new Date(due.lastDoneAt), new Date(at)) } : null,
        meta: day.meta,
        rest: day.rest,
      }
    }
  }

  return (
    <DashboardView data={data} onStartWorkout={onStartWorkout} notices={notices} resume={resume} onOpenLift={onOpenLift} />
  )
}
