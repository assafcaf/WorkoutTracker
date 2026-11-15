// V6-11: a short Session keeps its Workout. When the latest finished Session of a Program logged
// fewer than half its Workout's planned working Sets, the rotation does not move on: the same
// Workout is next, and Train says how many of its lifts are left. The week still counts the
// Session (honest, no guilt).
// V6-08: a Workout's latest Session note, which Train shows under the date.
// Pure; imports only src/domain/** and src/types.ts.
import type { Program, Session, Workout } from '../types'
import { dueWorkout } from './dashboard'
import { workingSets } from './setKind'

export type ShortSession = {
  session: Session
  workout: Workout
  /** Working Sets logged. */
  logged: number
  /** Working Sets the Workout plans. */
  planned: number
  /** The Workout's lifts with no working Set logged (a swap counts under what was done). */
  liftsLeft: number
}

const live = (session: Session): boolean => session.deletedAt === undefined

/** The Program's latest finished Session when it logged fewer than half its planned Sets. */
export function shortSessionOf(program: Program, sessions: Session[]): ShortSession | null {
  const latest = sessions
    .filter((session) => session.programId === program.id && live(session))
    .sort((a, b) => b.startedAt - a.startedAt)[0]
  if (latest === undefined || latest.finishedAt == null) return null
  const workout = program.workouts.find((candidate) => candidate.id === latest.workoutId && !candidate.hidden)
  if (workout === undefined) return null
  const planned = workout.exercises.reduce((sum, plan) => sum + plan.sets, 0)
  const working = workingSets(latest.entries)
  if (planned === 0 || working.length * 2 >= planned) return null
  const liftsLeft = workout.exercises.filter((plan) => {
    const done = latest.swaps?.[plan.exerciseId] ?? plan.exerciseId
    return !working.some((entry) => entry.exerciseId === done || entry.exerciseId === plan.exerciseId)
  }).length
  return { session: latest, workout, logged: working.length, planned, liftsLeft }
}

/**
 * The Workout Train puts up next: after a short Session, the same Workout again (V6-11);
 * otherwise the one `dueWorkout` picks.
 */
export function nextWorkout(
  program: Program,
  sessions: Session[],
): { workout: Workout; lastDoneAt: number | null; short: ShortSession | null } | null {
  const short = shortSessionOf(program, sessions)
  if (short !== null) return { workout: short.workout, lastDoneAt: short.session.startedAt, short }
  const due = dueWorkout(program, sessions)
  return due === null ? null : { ...due, short: null }
}

/** The latest Session note written on `workoutId`, with when; null when none. */
export function workoutNote(workoutId: string, sessions: Session[]): { at: number; text: string } | null {
  const noted = sessions
    .filter((session) => session.workoutId === workoutId && live(session) && (session.note ?? '').trim() !== '')
    .sort((a, b) => b.startedAt - a.startedAt)[0]
  return noted === undefined ? null : { at: noted.startedAt, text: (noted.note ?? '').trim() }
}
