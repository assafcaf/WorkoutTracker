import type { Resolve } from './muscles'
import { latestSet } from './rest'
import { epley } from './series'
import { buildLiftHistories } from './stats/liftHistory'
import { computeRecords, liftBests, recordCount } from './stats/records'
import { workingSets } from './setKind'
import { sessionVolume } from './volume'
import type { Exercise, ExercisePlan, Session, SetEntry, Workout } from '../types'

/**
 * The Live session's projection line (Progress Dashboard S2/S3): today's loaded volume against
 * what the last Session of the same Workout had lifted by the same point, and the Sets and PRs so
 * far.
 */
export type LiveProgress = {
  /** Today's loaded volume in kg, working Sets only (`sessionVolume`'s rule). */
  volumeKg: number
  /**
   * The last finished Session of this Workout, counted only as far as today has gone: for every
   * Exercise, as many of its working Sets (in Set order) as today holds. Null with no such Session.
   */
  lastVolumeKg: number | null
  /** Today's working Sets, and the Workout's planned Sets. */
  setsDone: number
  setsPlanned: number
  /** Today's Sets that set a record against the earlier Sessions. */
  prs: number
}

/** The id done for `plan` today: its swap, else itself. */
function doneIdOf(session: Session, plan: ExercisePlan): string {
  return session.swaps?.[plan.exerciseId] ?? plan.exerciseId
}

/** The Plan `exerciseId` sits under in `workout` today, a swap included. */
export function planFor(workout: Workout, session: Session, exerciseId: string): ExercisePlan | undefined {
  return workout.exercises.find((plan) => doneIdOf(session, plan) === exerciseId)
}

/** The latest finished Session of the same Program and Workout, started before `session`. */
export function lastSessionOf(session: Session, sessions: Session[]): Session | null {
  let last: Session | null = null
  for (const candidate of sessions) {
    if (candidate.id === session.id || candidate.finishedAt === null) continue
    if (candidate.programId !== session.programId || candidate.workoutId !== session.workoutId) continue
    if (candidate.startedAt >= session.startedAt) continue
    if (last === null || candidate.startedAt > last.startedAt) last = candidate
  }
  return last
}

function loadedKg(entries: SetEntry[], resolve: Resolve): number {
  let kg = 0
  for (const entry of entries) {
    const exercise = resolve(entry.exerciseId)
    if (exercise && !exercise.bodyweight && entry.weightKg !== null) kg += entry.weightKg * entry.reps
  }
  return kg
}

/** Every number the projection line shows; `earlier` is every finished Session, any order. */
export function liveProgress(args: {
  workout: Workout
  session: Session
  earlier: Session[]
  resolve: Resolve
}): LiveProgress {
  const { workout, session, earlier, resolve } = args
  const today = workingSets(session.entries)
  const last = lastSessionOf(session, earlier)

  let lastVolumeKg: number | null = null
  if (last !== null) {
    const counted: SetEntry[] = []
    const ids = new Set(today.map((entry) => entry.exerciseId))
    for (const id of ids) {
      const n = today.filter((entry) => entry.exerciseId === id).length
      const lastSets = workingSets(last.entries)
        .filter((entry) => entry.exerciseId === id)
        .sort((a, b) => a.setIndex - b.setIndex)
      counted.push(...lastSets.slice(0, n))
    }
    lastVolumeKg = loadedKg(counted, resolve)
  }

  const before = earlier.filter(
    (other) => other.id !== session.id && other.finishedAt !== null && other.startedAt < session.startedAt,
  )
  const prs = recordCount(
    computeRecords([...before, session], resolve, (id) => planFor(workout, session, id)),
    session.id,
  )

  return {
    volumeKg: sessionVolume(session, resolve).kg,
    lastVolumeKg,
    setsDone: today.length,
    setsPlanned: workout.exercises.reduce((sum, plan) => sum + plan.sets, 0),
    prs,
  }
}

/**
 * The Exercise the session is on: the latest Set's, while it still has planned Sets left; else
 * the first in plan order with planned Sets left; null when every planned Set is logged.
 */
export function currentExerciseId(workout: Workout, session: Session): string | null {
  const left = (plan: ExercisePlan): boolean =>
    workingSets(session.entries).filter((entry) => entry.exerciseId === doneIdOf(session, plan)).length <
    plan.sets
  const latest = latestSet(session.entries)
  if (latest !== null) {
    const plan = planFor(workout, session, latest.exerciseId)
    if (plan !== undefined && left(plan)) return latest.exerciseId
  }
  const next = workout.exercises.find(left)
  return next === undefined ? null : doneIdOf(session, next)
}

/** What the Set on the steppers would mean if logged: its e1RM, the record, and whether it sets one. */
export type SetProjection = { e1rm: number | null; record: number | null; isPr: boolean }

/**
 * The projection under the steppers (S3: "e1RM 75.0 · record 74.2 → PR if logged"). `session` is
 * today's Session as stored; `earlier` the finished Sessions before it. A Warm-up never sets a
 * record; a Bodyweight Exercise has no e1RM.
 */
export function projectSet(args: {
  exercise: Exercise
  plan: ExercisePlan
  earlier: Session[]
  session: Session
  set: Pick<SetEntry, 'weightKg' | 'reps' | 'loadKg' | 'kind'>
}): SetProjection {
  const { exercise, plan, earlier, session, set } = args
  const resolve: Resolve = (id) => (id === exercise.id ? exercise : undefined)
  const planOf = (id: string): ExercisePlan | undefined => (id === exercise.id ? plan : undefined)
  // R-E: only an e1RM lift (not Bodyweight, Plan top rep <= 10), from a straight set of <= 10 reps.
  const e1rmLift = !exercise.bodyweight && plan.repRange[1] <= 10
  const e1rm =
    !e1rmLift || set.kind === 'drop' || set.weightKg === null || set.reps <= 0 || set.reps > 10
      ? null
      : epley(set.weightKg, set.reps)
  const history = buildLiftHistories([...earlier, session], resolve, planOf).get(exercise.id)
  const record =
    e1rmLift && history
      ? (liftBests(history).find((row) => row.label === 'Best estimated 1RM')?.e1rm ?? null)
      : null
  const candidate: SetEntry = {
    exerciseId: exercise.id,
    setIndex: Number.MAX_SAFE_INTEGER,
    weightKg: set.weightKg,
    reps: set.reps,
    loggedAt: Number.MAX_SAFE_INTEGER,
    ...(set.loadKg ? { loadKg: set.loadKg } : {}),
    ...(set.kind ? { kind: set.kind } : {}),
  }
  const recordOf = (entries: SetEntry[]) =>
    computeRecords([...earlier, { ...session, entries }], resolve, planOf).find(
      (found) => found.sessionId === session.id && found.exerciseId === exercise.id,
    )
  const now = recordOf(session.entries)
  const next = recordOf([...session.entries, candidate])
  const isPr =
    set.kind !== 'warmup' &&
    set.kind !== 'drop' &&
    set.reps > 0 &&
    next !== undefined &&
    (now === undefined || now.kind !== next.kind || now.lever !== next.lever || now.reps !== next.reps)
  return { e1rm, record, isPr }
}

/** `1,530`: a kg figure rounded to whole kg with thousands separators. */
export function formatKg(kg: number): string {
  return Math.round(kg).toLocaleString('en-US')
}
