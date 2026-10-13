import type { MuscleFamily } from '../../domain/muscles'
import type { ExercisePlan } from '../../types'

/** A muscle family's name as the Program tab writes it. */
export const FAMILY_LABELS: Record<MuscleFamily, string> = {
  push: 'Push',
  pull: 'Pull',
  legs: 'Legs',
  core: 'Core',
}

/** A Plan's rep range: `8–10`, or `5` when both ends are the same. */
export function repRangeText([low, high]: ExercisePlan['repRange']): string {
  return low === high ? String(low) : `${low}–${high}`
}

/** A Plan's sets and reps: `4 × 8–10`. */
export function setsRepsText(plan: Pick<ExercisePlan, 'sets' | 'repRange'>): string {
  return `${plan.sets} × ${repRangeText(plan.repRange)}`
}

/** A count for display: whole numbers as they are, anything else rounded to the nearest one. */
export function wholeCount(value: number): number {
  return Math.round(value)
}

/**
 * `values` rounded to whole numbers that still add up to their rounded sum: each is floored,
 * then the ones with the largest remainders (the earlier on a tie) take the units left over --
 * so a legend's counts agree with the total beside it (28.5 + 10.5 + ... reads 29 + 10, not
 * 29 + 11).
 */
export function wholeCounts(values: number[]): number[] {
  const floors = values.map((value) => Math.floor(value))
  let left = Math.round(values.reduce((sum, value) => sum + value, 0)) - floors.reduce((a, b) => a + b, 0)
  const byRemainder = values
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index)
  for (const { index } of byRemainder) {
    if (left <= 0) break
    floors[index] += 1
    left -= 1
  }
  return floors
}

/** `1 workout`, `2 workouts`. */
export function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`
}
