// V2-04: the PR target on the Set screen, "PR at 9 reps": the fewest reps at the weight on the
// Dials that would set a Record if logged. The Record rule is `projectSet`'s (and through it the
// stats Records'); this only asks it rep count by rep count. Pure.
import { projectSet } from './liveProgress'
import type { Exercise, ExercisePlan, Session, SetEntry } from '../types'

/**
 * The fewest reps, from 1 to `maxReps` (the Plan's top rep, or more), at `set`'s weight and Load
 * that `projectSet` says would set a Record in `session` against `earlier`; null when none does,
 * or for a Warm-up or Drop set, which never set one.
 */
export function prTargetReps(args: {
  exercise: Exercise
  plan: ExercisePlan
  earlier: Session[]
  session: Session
  set: Pick<SetEntry, 'weightKg' | 'loadKg' | 'kind'>
  maxReps?: number
}): number | null {
  const { exercise, plan, earlier, session, set } = args
  if (earlier.length === 0 || set.kind === 'warmup' || set.kind === 'drop') return null
  const top = Math.max(plan.repRange[1], args.maxReps ?? 0)
  for (let reps = 1; reps <= top; reps += 1) {
    if (projectSet({ exercise, plan, earlier, session, set: { ...set, reps } }).isPr) return reps
  }
  return null
}

/** "PR at 9 reps" / "PR at 1 rep". */
export function prTargetText(reps: number): string {
  return `PR at ${reps} ${reps === 1 ? 'rep' : 'reps'}`
}
