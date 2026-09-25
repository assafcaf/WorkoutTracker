import type { Program, Session } from '../types'
import type { Resolve } from './muscles'

export type VolumePoint = { at: number; workoutName: string; kg: number; bodyweightReps: number }

/**
 * One `VolumePoint` per session, ascending by `at` (`session.startedAt`). `kg` sums
 * `reps * weightKg` over sets whose resolved exercise is loaded (`bodyweight: false`,
 * `invertProgress: false`, non-null `weightKg`); `bodyweightReps` sums `reps` over every other
 * set that resolves (bodyweight and assisted sets). A set `resolve` does not answer counts in
 * neither total. `workoutName` falls back to `session.workoutId` when the program or workout is
 * gone, as `summarise` in `src/ui/HistoryList.tsx` does.
 */
export function volumeSeries(sessions: Session[], resolve: Resolve, programs: Program[]): VolumePoint[] {
  return [...sessions]
    .sort((a, b) => a.startedAt - b.startedAt)
    .map((session) => {
      let kg = 0
      let bodyweightReps = 0

      for (const entry of session.entries) {
        const exercise = resolve(entry.exerciseId)
        if (!exercise) continue

        if (!exercise.bodyweight && !exercise.invertProgress && entry.weightKg !== null) {
          kg += entry.reps * entry.weightKg
        } else {
          bodyweightReps += entry.reps
        }
      }

      const program = programs.find((candidate) => candidate.id === session.programId)
      const workout = program?.workouts.find((candidate) => candidate.id === session.workoutId)

      return {
        at: session.startedAt,
        workoutName: workout?.name ?? session.workoutId,
        kg,
        bodyweightReps,
      }
    })
}
