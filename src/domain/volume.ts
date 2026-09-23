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
  throw new Error('not implemented')
}
