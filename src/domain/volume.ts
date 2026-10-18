import type { BodyLog, Program, Session } from '../types'
import type { Resolve } from './muscles'
import { bodyweightOn } from './bodyLog'
import { workingSets } from './setKind'

/** One Session's loaded volume and bodyweight reps, by the rule `volumeSeries` uses. */
export function sessionVolume(
  session: Session,
  resolve: Resolve,
  bodyweightKg: number | null = null,
): { kg: number; bodyweightReps: number; bodyweightKg?: number } {
  let kg = 0
  let bodyweightReps = 0

  for (const entry of workingSets(session.entries)) {
    const exercise = resolve(entry.exerciseId)
    if (!exercise) continue

    if (!exercise.bodyweight && entry.weightKg !== null) {
      kg += entry.reps * entry.weightKg
    } else if (exercise.bodyweight && bodyweightKg !== null) {
      // Bodyweight plus the signed Load (assistance is negative), never below 0.
      kg += entry.reps * Math.max(0, bodyweightKg + (entry.loadKg ?? 0))
    } else {
      bodyweightReps += entry.reps
    }
  }

  return bodyweightKg === null ? { kg, bodyweightReps } : { kg, bodyweightReps, bodyweightKg }
}

export type VolumePoint = {
  at: number
  workoutName: string
  kg: number
  bodyweightReps: number
  bodyweight?: { kg: number; day: string }
}

/**
 * One `VolumePoint` per session, ascending by `at` (`session.startedAt`). `kg` sums
 * `reps * weightKg` over sets whose resolved exercise is loaded (`bodyweight: false`, non-null
 * `weightKg`); `bodyweightReps` sums `reps` over every other set that resolves (Bodyweight Sets,
 * assisted ones included). A set `resolve` does not answer counts in
 * neither total. `workoutName` falls back to `session.workoutId` when the program or workout is
 * gone, as `summarise` in `src/ui/HistoryList.tsx` does.
 */
export function volumeSeries(
  sessions: Session[],
  resolve: Resolve,
  programs: Program[],
  log: BodyLog = [],
): VolumePoint[] {
  return [...sessions]
    .sort((a, b) => a.startedAt - b.startedAt)
    .map((session) => {
      const weighed = bodyweightOn(log, session.startedAt)
      const { kg, bodyweightReps } = sessionVolume(session, resolve, weighed?.kg ?? null)

      const program = programs.find((candidate) => candidate.id === session.programId)
      const workout = program?.workouts.find((candidate) => candidate.id === session.workoutId)

      return {
        at: session.startedAt,
        workoutName: workout?.name ?? session.workoutId,
        kg,
        bodyweightReps,
        ...(weighed ? { bodyweight: weighed } : {}),
      }
    })
}
