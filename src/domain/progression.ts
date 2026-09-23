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

export function workingWeight(_entries: SetEntry[]): number | null {
  throw new Error('not implemented')
}

export function workingAssistance(_entries: SetEntry[]): number | null {
  throw new Error('not implemented')
}

export function progression(
  _exercise: Exercise,
  _plan: ExercisePlan,
  _lastEntries: SetEntry[],
): Progression {
  throw new Error('not implemented')
}
