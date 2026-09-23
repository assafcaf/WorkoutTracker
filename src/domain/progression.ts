import type { Exercise, ExercisePlan, SetEntry } from '../types'

export type SuggestionKind = 'add-weight' | 'reduce-assistance' | 'add-set'
export type Suggestion = { kind: SuggestionKind; nextWeightKg?: number }
export type Progression = {
  workingWeightKg: number | null
  achievedReps: number
  targetReps: number
  isFull: boolean
  suggestion: Suggestion | null
}

function loggedWeights(entries: SetEntry[]): number[] {
  return entries.flatMap((entry) => (entry.weightKg === null ? [] : [entry.weightKg]))
}

/** The highest non-null `weightKg` among `entries`, or `null` when none carries a weight. */
export function workingWeight(entries: SetEntry[]): number | null {
  const weights = loggedWeights(entries)
  return weights.length > 0 ? Math.max(...weights) : null
}

/** The lowest non-null `weightKg` among `entries` (least assistance), or `null` when none. */
export function workingAssistance(entries: SetEntry[]): number | null {
  const weights = loggedWeights(entries)
  return weights.length > 0 ? Math.min(...weights) : null
}

const sumReps = (entries: SetEntry[]): number =>
  entries.reduce((total, entry) => total + entry.reps, 0)

/**
 * How close the last session of an exercise came to the top of its rep range, and what should
 * change next time. Pure: the caller supplies the last session's entries for this exercise.
 *
 * - Loaded: only the sets at the working (highest) weight count; full when each reached the
 *   top of the range -> add one `weightStep`.
 * - Inverted (`invertProgress`): the same, at the working (lowest) assistance -> reduce it by
 *   one `weightStep`, never below 0.
 * - Bodyweight: every entry counts against `plan.sets` x top of range -> add a set.
 *
 * `nextWeightKg` is exact arithmetic, not snapped to a rung.
 */
export function progression(
  exercise: Exercise,
  plan: ExercisePlan,
  lastEntries: SetEntry[],
): Progression {
  const topReps = plan.repRange[1]

  if (lastEntries.length === 0) {
    return {
      workingWeightKg: null,
      achievedReps: 0,
      targetReps: plan.sets * topReps,
      isFull: false,
      suggestion: null,
    }
  }

  if (exercise.bodyweight) {
    const targetReps = plan.sets * topReps
    const achievedReps = sumReps(lastEntries)
    const isFull = achievedReps >= targetReps
    return {
      workingWeightKg: null,
      achievedReps,
      targetReps,
      isFull,
      suggestion: isFull ? { kind: 'add-set' } : null,
    }
  }

  const working = exercise.invertProgress
    ? workingAssistance(lastEntries)
    : workingWeight(lastEntries)
  const workingSets = lastEntries.filter((entry) => entry.weightKg === working)
  const isFull = workingSets.every((entry) => entry.reps >= topReps)

  let suggestion: Suggestion | null = null
  if (isFull && working !== null) {
    suggestion = exercise.invertProgress
      ? { kind: 'reduce-assistance', nextWeightKg: Math.max(0, working - exercise.weightStep) }
      : { kind: 'add-weight', nextWeightKg: working + exercise.weightStep }
  }

  return {
    workingWeightKg: working,
    achievedReps: sumReps(workingSets),
    targetReps: workingSets.length * topReps,
    isFull,
    suggestion,
  }
}
