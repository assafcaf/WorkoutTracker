import { workingSets } from './setKind'
import type { Exercise, ExercisePlan, SetEntry } from '../types'

/** `entries` in `setIndex` order, without mutating them. */
function bySetIndex(entries: SetEntry[]): SetEntry[] {
  return [...entries].sort((a, b) => a.setIndex - b.setIndex)
}

/**
 * What the Sets of an Exercise open preset from, once today's are known (E14-T8): today's working
 * Sets stand in for last time's at the same working positions, so the next Set opens on last
 * time's at its position, or, past last time's, on the one before it as it was actually lifted.
 * Warm-ups are dropped, and the answer is renumbered 1..n by working position, which is what
 * `presetForSet` reads it by.
 */
export function layTodayOver(lastTime: SetEntry[], today: SetEntry[]): SetEntry[] {
  const todays = bySetIndex(workingSets(today))
  const lastTimes = bySetIndex(workingSets(lastTime))
  return [...todays, ...lastTimes.slice(todays.length)].map((entry, at) => ({
    ...entry,
    setIndex: at + 1,
  }))
}

/**
 * The dial values a set should open with, derived from the last finished session that
 * contained this exercise.
 *
 * `setIndex` is 1-based and numbers every Set, warm-ups included. `lastEntries` are the entries
 * for this exercise from the last finished session that contained it -- the caller supplies them
 * (E1-T3's `getLastEntriesFor`), so this function stays pure and does no storage access.
 *
 * Presets match working Sets by position (E14-T8): the Set at `setIndex` is working Set N, N
 * being 1 + the working Sets in `logged` below it (or `setIndex` when `logged` is omitted), and
 * it opens on working Set N of `lastEntries` in `setIndex` order. Warm-ups are skipped on both
 * sides. `logged` only places the Set; its values come from `lastEntries` alone.
 *
 * Rules, in order:
 * - working Set N of `lastEntries` wins;
 * - otherwise its last working Set;
 * - no working Sets -> `plan.startWeightKg ?? exercise.startWeight` and `plan.repRange[0]`.
 *
 * A bodyweight exercise always yields `weightKg: null`.
 */
export function presetForSet(args: {
  exercise: Exercise
  plan: ExercisePlan
  setIndex: number
  lastEntries: SetEntry[]
  /**
   * This Session's Sets for the Exercise already logged (E14-T8), from which the working
   * position of the Set at `setIndex` is counted. Omitted: every Set before it was working.
   */
  logged?: SetEntry[]
}): { weightKg: number | null; reps: number; loadKg?: number } {
  const { exercise, plan, setIndex, lastEntries, logged } = args

  const position =
    logged === undefined
      ? setIndex
      : 1 + workingSets(logged).filter((entry) => entry.setIndex < setIndex).length
  const sequence = bySetIndex(workingSets(lastEntries))

  const match = sequence[position - 1] ?? sequence[sequence.length - 1]
  if (match !== undefined) {
    return {
      weightKg: exercise.bodyweight ? null : match.weightKg,
      reps: match.reps,
      ...(match.loadKg ? { loadKg: match.loadKg } : {}),
    }
  }

  return {
    weightKg: exercise.bodyweight ? null : (plan.startWeightKg ?? exercise.startWeight),
    reps: plan.repRange[0],
  }
}
