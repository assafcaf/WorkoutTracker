import { buildLadder } from './dial'
import { presetForSet } from './prefill'
import type { Exercise, ExercisePlan, SetEntry } from '../types'

/**
 * The dial values a swapped-in Exercise's Set opens on (E16-T12 O23): its own last time when it
 * has been logged before, else what the planned Exercise would have opened on today, snapped to
 * the chosen Exercise's Rungs, or `BW` when the chosen Exercise is Bodyweight.
 *
 * V6 (V5-02): the planned load carries over only onto the same equipment (`sameEquipment`,
 * default true). On other equipment a never-logged Exercise opens on its first Rung with
 * `askStartWeight`, so the screen asks "Set a starting weight" instead of offering 0 kg.
 */
export function swapPreset(args: {
  planned: Exercise
  chosen: Exercise
  plan: ExercisePlan
  setIndex: number
  plannedLast: SetEntry[]
  chosenLast: SetEntry[]
  /** The planned Exercise's Sets today; omitted, Set `setIndex` is read as working Set N. */
  today?: SetEntry[]
  deload?: boolean
  sameEquipment?: boolean
}): {
  weightKg: number | null
  reps: number
  loadKg?: number
  deloadFromKg?: number
  askStartWeight?: true
} {
  const { planned, chosen, plan, setIndex, plannedLast, chosenLast, today, deload, sameEquipment = true } = args
  if (chosenLast.length > 0) {
    return presetForSet({ exercise: chosen, plan, setIndex, lastEntries: chosenLast, today, deload })
  }
  const wanted = presetForSet({ exercise: planned, plan, setIndex, lastEntries: plannedLast, today, deload })
  if (chosen.bodyweight) return { weightKg: null, reps: wanted.reps }
  const ladder = buildLadder(chosen)
  if (!sameEquipment) {
    const start = chosen.startWeight ?? 0
    const rung = ladder.find((candidate) => candidate >= start) ?? ladder[0] ?? start
    return { weightKg: rung, reps: wanted.reps, askStartWeight: true }
  }
  const value = wanted.weightKg ?? chosen.startWeight ?? 0
  const rung = ladder.filter((candidate) => candidate <= value).pop() ?? ladder[0] ?? value
  return wanted.deloadFromKg === undefined
    ? { weightKg: rung, reps: wanted.reps }
    : { weightKg: rung, reps: wanted.reps, deloadFromKg: wanted.deloadFromKg }
}

/**
 * V6 (V5-02): what a swapped-in Exercise presets from as "last time" while it has none of its
 * own: `swapPreset` at every planned Set, as Sets of the chosen Exercise. One derivation for
 * Now, All and the All view's Log button, so they cannot disagree. Not deloaded here: the
 * screens deload the Preset they build from it. Null once the chosen Exercise has a history,
 * which is then the one to preset from.
 */
export function swapSeed(args: {
  planned: Exercise
  chosen: Exercise
  plan: ExercisePlan
  plannedLast: SetEntry[]
  chosenLast: SetEntry[]
  today: SetEntry[]
  sameEquipment?: boolean
}): { entries: SetEntry[]; askStartWeight: boolean } | null {
  if (args.chosenLast.length > 0) return null
  const entries: SetEntry[] = []
  let askStartWeight = false
  // With nothing of the planned Exercise logged today, Set N follows its last time's Set N (the
  // ramp kept); after some, every Set follows the latest of today's, as the planned one would.
  const today = args.today.length > 0 ? args.today : undefined
  for (let position = 1; position <= Math.max(1, args.plan.sets); position += 1) {
    const { askStartWeight: ask, deloadFromKg: _from, ...preset } = swapPreset({
      ...args,
      today,
      setIndex: args.today.length + position,
    })
    void _from
    if (ask) askStartWeight = true
    entries.push({ exerciseId: args.chosen.id, setIndex: position, ...preset, loggedAt: 0 })
  }
  return { entries, askStartWeight }
}
