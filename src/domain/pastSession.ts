import type { Exercise, LibraryExercise, Session, SetEntry, Workout } from '../types'
import { countsTowardStats } from './setKind'

const MINUTE = 60_000
/** When a missed Session is put on its day, until the trainee changes Start (18:00 local). */
const MISSED_START_HOUR = 18
/** How long a missed Session lasts, until the trainee changes End. */
const MISSED_LENGTH = 60 * MINUTE

export type PastSessionDraftInput = {
  id: string
  programId: string
  workout: Workout
  /** Any time on the calendar day the Session was missed on. */
  day: number
  /** Every Session the app knows; the last finished one before `day` presets each Plan. */
  sessions: Session[]
  resolve: (id: string) => Exercise | undefined
}

/**
 * The Session editor's draft for a missed Session (V6-13): `workout` performed on `day` at
 * 18:00 for an hour, finished. Each Plan's Sets are the working Sets of the last finished
 * Session before it that logged that Exercise; with none, the Plan's Set count at the
 * Exercise's start weight (no weight on a Bodyweight one) and the Plan's bottom rep count.
 */
export function pastSessionDraft({ id, programId, workout, day, sessions, resolve }: PastSessionDraftInput): Session {
  const start = new Date(day)
  start.setHours(MISSED_START_HOUR, 0, 0, 0)
  const startedAt = start.getTime()
  const finishedAt = startedAt + MISSED_LENGTH
  const earlier = sessions
    .filter((session) => session.finishedAt !== null && session.startedAt < startedAt)
    .sort((one, other) => other.startedAt - one.startedAt)

  const entries: SetEntry[] = []
  for (const plan of workout.exercises) {
    const last = earlier.find((session) =>
      session.entries.some((entry) => entry.exerciseId === plan.exerciseId && countsTowardStats(entry)),
    )
    const done = last
      ? last.entries
          .filter((entry) => entry.exerciseId === plan.exerciseId && countsTowardStats(entry))
          .sort((one, other) => one.setIndex - other.setIndex)
      : []
    const exercise = resolve(plan.exerciseId)
    const values: Pick<SetEntry, 'weightKg' | 'reps' | 'loadKg'>[] =
      done.length > 0
        ? done.map((entry) => ({ weightKg: entry.weightKg, reps: entry.reps, loadKg: entry.loadKg }))
        : Array.from({ length: plan.sets }, () => ({
            weightKg: exercise?.bodyweight ? null : exercise?.startWeight ?? 0,
            reps: plan.repRange[0],
            loadKg: undefined,
          }))
    values.forEach((value, index) => {
      const entry: SetEntry = {
        exerciseId: plan.exerciseId,
        setIndex: index + 1,
        weightKg: value.weightKg,
        reps: value.reps,
        loggedAt: Math.min(finishedAt, startedAt + (entries.length + 1) * 2 * MINUTE),
      }
      if (value.loadKg !== undefined) entry.loadKg = value.loadKg
      entries.push(entry)
    })
  }
  return { id, programId, workoutId: workout.id, startedAt, finishedAt, entries }
}

/**
 * What the Session editor's "Add exercise" offers (V6-13): every catalog Exercise under its own
 * id and name, in place of the library entry it is built on, then the rest of the library. So a
 * Set added to a past Session counts toward the same lift as the ones logged live.
 */
export function addableExercises(catalog: Map<string, Exercise>, library: LibraryExercise[]): LibraryExercise[] {
  const byId = new Map(library.map((entry) => [entry.id, entry] as const))
  const taken = new Set<string>()
  const fromCatalog: LibraryExercise[] = []
  for (const exercise of catalog.values()) {
    const entry = byId.get(exercise.libraryId)
    if (!entry || exercise.id === entry.id) continue
    taken.add(entry.id)
    fromCatalog.push({ ...entry, id: exercise.id, name: exercise.name })
  }
  return [...fromCatalog, ...library.filter((entry) => !taken.has(entry.id))]
}
