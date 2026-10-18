import { buildLadder } from './dial'
import { presetForSet } from './prefill'
import type { Exercise, ExercisePlan, SetEntry } from '../types'

/**
 * The dial values a swapped-in Exercise's Set opens on (E16-T12 O23): its own last time when it
 * has been logged before, else what the planned Exercise would have opened on today, snapped to
 * the chosen Exercise's Rungs, or `BW` when the chosen Exercise is Bodyweight.
 */
export function swapPreset(args: {
  planned: Exercise
  chosen: Exercise
  plan: ExercisePlan
  setIndex: number
  plannedLast: SetEntry[]
  chosenLast: SetEntry[]
  today: SetEntry[]
  deload?: boolean
}): { weightKg: number | null; reps: number; loadKg?: number; deloadFromKg?: number } {
  const { planned, chosen, plan, setIndex, plannedLast, chosenLast, today } = args
  if (chosenLast.length > 0) {
    return presetForSet({ exercise: chosen, plan, setIndex, lastEntries: chosenLast, today })
  }
  const wanted = presetForSet({ exercise: planned, plan, setIndex, lastEntries: plannedLast, today })
  if (chosen.bodyweight) return { weightKg: null, reps: wanted.reps }
  const value = wanted.weightKg ?? chosen.startWeight ?? 0
  const ladder = buildLadder(chosen)
  const rung = ladder.filter((candidate) => candidate <= value).pop() ?? ladder[0] ?? value
  return { weightKg: rung, reps: wanted.reps }
}
