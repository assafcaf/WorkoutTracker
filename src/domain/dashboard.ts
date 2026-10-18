import type { Exercise, LibraryExercise, Muscle, Program, Session, SetEntry, Workout } from '../types'
import { muscleSets, type Resolve } from './muscles'
import { prescribedWeekly, TRACKED_MUSCLES } from './programVolume'
import { progression } from './progression'
import { seriesFor } from './series'
import { workingSets } from './setKind'
import { sessionVolume } from './volume'
import type { Weekday } from './stats/weeks'

const DAY_MS = 24 * 60 * 60 * 1000

/** Monday 00:00 local time of the calendar week holding `now`. */
export function startOfWeek(now: number, _weekStartsOn: Weekday = 1): number {
  const day = new Date(now)
  const sinceMonday = (day.getDay() + 6) % 7
  return new Date(day.getFullYear(), day.getMonth(), day.getDate() - sinceMonday).getTime()
}

/** One week's Sessions, working Sets and loaded volume. */
export type WeekTotals = { sessions: number; sets: number; volumeKg: number }

function totalsOf(sessions: Session[], resolve: Resolve): WeekTotals {
  return sessions.reduce<WeekTotals>(
    (acc, session) => ({
      sessions: acc.sessions + 1,
      sets: acc.sets + workingSets(session.entries).length,
      volumeKg: acc.volumeKg + sessionVolume(session, resolve).kg,
    }),
    { sessions: 0, sets: 0, volumeKg: 0 },
  )
}

/**
 * This calendar week's totals (Monday 00:00 up to `now`) against last calendar week's, over the
 * Sessions by their `startedAt`.
 */
export function weekVsLast(
  sessions: Session[],
  now: number,
  resolve: Resolve,
  _weekStartsOn: Weekday = 1,
): { thisWeek: WeekTotals; lastWeek: WeekTotals } {
  const thisStart = startOfWeek(now)
  const lastStart = startOfWeek(thisStart - DAY_MS)
  const inRange = (from: number, to: number): Session[] =>
    sessions.filter((session) => session.startedAt >= from && session.startedAt < to)
  return {
    thisWeek: totalsOf(inRange(thisStart, now + 1), resolve),
    lastWeek: totalsOf(inRange(lastStart, thisStart), resolve),
  }
}

/** The muscles the Dashboard's Muscle week card lists, in its reading order (two columns). */
export const MUSCLE_WEEK_ROWS: readonly Muscle[] = [
  'chest',
  'shoulders',
  'triceps',
  'lats',
  'biceps',
  'quadriceps',
  'lower back',
  'middle back',
  'hamstrings',
  'glutes',
  'calves',
  'abdominals',
]

export type MuscleWeekRow = { muscle: Muscle; done: number; planned: number }

/** `program`'s Plans' Exercises, as `prescribedWeekly`'s catalog. */
function planCatalog(program: Program, resolve: Resolve): Map<string, Exercise> {
  const catalog = new Map<string, Exercise>()
  for (const workout of program.workouts) {
    for (const plan of workout.exercises) {
      const exercise = resolve(plan.exerciseId)
      if (exercise) catalog.set(plan.exerciseId, exercise)
    }
  }
  return catalog
}

/** The tracked muscles no Plan of `program` names as a primary muscle. */
function directGaps(program: Program, resolve: Resolve, library: Map<string, LibraryExercise>): Muscle[] {
  const direct = new Set<Muscle>()
  for (const workout of program.workouts) {
    for (const plan of workout.exercises) {
      const exercise = resolve(plan.exerciseId)
      const entry = exercise && library.get(exercise.libraryId)
      for (const muscle of entry?.primaryMuscles ?? []) direct.add(muscle)
    }
  }
  return MUSCLE_WEEK_ROWS.filter((muscle) => TRACKED_MUSCLES.includes(muscle) && !direct.has(muscle))
}

/**
 * Per muscle of `MUSCLE_WEEK_ROWS`: the Sets done this calendar week (1 per primary, 0.5 per
 * secondary, as `muscleSets` counts) and the Sets `program` plans a week (`prescribedWeekly`).
 * `gaps` are the tracked muscles no Plan of the program works directly (as a primary muscle),
 * in `MUSCLE_WEEK_ROWS` order.
 */
export function muscleWeek(
  sessions: Session[],
  now: number,
  program: Program,
  resolve: Resolve,
  library: Map<string, LibraryExercise>,
  _weekStartsOn: Weekday = 1,
): { rows: MuscleWeekRow[]; gaps: Muscle[] } {
  const from = startOfWeek(now)
  const entries = sessions.flatMap((session) =>
    session.entries.filter((entry) => entry.loggedAt >= from && entry.loggedAt <= now),
  )
  const done = muscleSets(entries, resolve, library)
  const planned = prescribedWeekly(program, planCatalog(program, resolve), library)
  return {
    rows: MUSCLE_WEEK_ROWS.map((muscle) => ({
      muscle,
      done: done.get(muscle) ?? 0,
      planned: planned.get(muscle) ?? 0,
    })),
    gaps: directGaps(program, resolve, library),
  }
}

/**
 * `program`'s Exercise ids taking each workout's first Plan, then each one's second, and so on,
 * once each: so a short list leads with every workout's main lift.
 */
function interleavedExerciseIds(program: Program): string[] {
  const workouts = program.workouts.filter((workout) => !workout.hidden)
  const longest = Math.max(0, ...workouts.map((workout) => workout.exercises.length))
  const ids: string[] = []
  for (let i = 0; i < longest; i++) {
    for (const workout of workouts) {
      const id = workout.exercises[i]?.exerciseId
      if (id !== undefined && !ids.includes(id)) ids.push(id)
    }
  }
  return ids
}

export type LiftTrend = {
  exerciseId: string
  name: string
  /** The best e1RM of each Session in the window, oldest first. */
  values: number[]
  latest: number
  /** `latest` less the window's first value; null with only one Session in the window. */
  delta: number | null
}

/**
 * Up to `limit` loaded Exercises of `program` (each workout's first lift first) with their
 * e1RM per Session over the `days` up to `now`. An Exercise with no loaded Set in the window,
 * or a Bodyweight one, is left out.
 */
export function liftTrends(
  sessions: Session[],
  program: Program,
  resolve: Resolve,
  now: number,
  days = 21,
  limit = 3,
): LiftTrend[] {
  const from = now - days * DAY_MS
  const recent = sessions.filter((session) => session.startedAt >= from && session.startedAt <= now)
  const trends: LiftTrend[] = []
  for (const id of interleavedExerciseIds(program)) {
    if (trends.length >= limit) break
    const exercise = resolve(id)
    if (!exercise || exercise.bodyweight) continue
    const values = seriesFor(exercise, recent).points.map((point) => point.value)
    if (values.length === 0) continue
    const latest = values[values.length - 1]
    trends.push({
      exerciseId: id,
      name: exercise.name,
      values,
      latest,
      delta: values.length > 1 ? latest - values[0] : null,
    })
  }
  return trends
}

/** The working Sets of `exerciseId` in the newest Session holding one, or none. */
function lastEntriesOf(sessions: Session[], exerciseId: string): SetEntry[] {
  const newestFirst = [...sessions].sort((a, b) => b.startedAt - a.startedAt)
  for (const session of newestFirst) {
    const entries = workingSets(session.entries).filter((entry) => entry.exerciseId === exerciseId)
    if (entries.length > 0) return entries
  }
  return []
}

/**
 * The first loaded lift of `program` (in `liftTrends`' order) whose last Session filled its rep
 * range, with the weight `progression` suggests next; null when none did.
 */
export function progressionHint(
  sessions: Session[],
  program: Program,
  resolve: Resolve,
): { exerciseId: string; name: string; nextWeightKg: number } | null {
  const plans = new Map(
    program.workouts.flatMap((workout) => workout.exercises.map((plan) => [plan.exerciseId, plan] as const)),
  )
  for (const id of interleavedExerciseIds(program)) {
    const exercise = resolve(id)
    const plan = plans.get(id)
    if (!exercise || !plan || exercise.bodyweight) continue
    const suggestion = progression(exercise, plan, lastEntriesOf(sessions, id)).suggestion
    if (suggestion?.kind === 'add-weight' && suggestion.nextWeightKg !== undefined) {
      return { exerciseId: id, name: exercise.name, nextWeightKg: suggestion.nextWeightKg }
    }
  }
  return null
}

/**
 * The workout due next in `program`'s rotation: the visible workout after the one the newest
 * Session of this program did, or the first when none did. `lastDoneAt` is when the due workout
 * itself was last started, or null when never. Null when the program has no visible workout.
 */
export function dueWorkout(
  program: Program,
  sessions: Session[],
): { workout: Workout; lastDoneAt: number | null } | null {
  const workouts = program.workouts.filter((workout) => !workout.hidden)
  if (workouts.length === 0) return null
  const own = sessions
    .filter((session) => session.programId === program.id)
    .sort((a, b) => b.startedAt - a.startedAt)
  const lastIndex = own.length > 0 ? workouts.findIndex((w) => w.id === own[0].workoutId) : -1
  const workout = workouts[(lastIndex + 1) % workouts.length]
  const last = own.find((session) => session.workoutId === workout.id)
  return { workout, lastDoneAt: last ? last.startedAt : null }
}

/** Seconds one Set takes to lift, before its rest. */
const SET_WORK_SECONDS = 40

/**
 * A workout's size at a glance: its Exercises, its planned Sets, and an estimate of its minutes
 * (each Set's lifting time plus the rest after it, the last Set of the workout resting none).
 */
export function workoutEstimate(workout: Workout): { exercises: number; sets: number; minutes: number } {
  const sets = workout.exercises.reduce((total, plan) => total + plan.sets, 0)
  const rest = workout.exercises.reduce((total, plan) => total + plan.sets * plan.restSeconds, 0)
  const lastRest = workout.exercises.at(-1)?.restSeconds ?? 0
  const seconds = sets * SET_WORK_SECONDS + Math.max(0, rest - lastRest)
  return { exercises: workout.exercises.length, sets, minutes: Math.round(seconds / 60) }
}

/** "just now", "2 min ago", "3 h ago", "2 d ago": how long since `at`. */
export function timeAgo(at: number, now: number): string {
  const minutes = Math.floor((now - at) / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  return `${Math.floor(hours / 24)} d ago`
}
