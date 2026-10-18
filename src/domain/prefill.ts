import { deloadWeight } from './deload'
import { workingSets } from './setKind'
import type { Exercise, ExercisePlan, SetEntry } from '../types'

/** A Preset: the dial values a Set opens with. */
type Preset = { weightKg: number | null; reps: number; loadKg?: number; deloadFromKg?: number }

/** The bounds a Preset's value is kept within: a weight, or a Bodyweight Exercise's signed Load. */
const WEIGHT_BOUNDS = { min: 0, max: 500 }
const LOAD_BOUNDS = { min: -60, max: 100 }

/** `entries` in `setIndex` order, without mutating them. */
function bySetIndex(entries: SetEntry[]): SetEntry[] {
  return [...entries].sort((a, b) => a.setIndex - b.setIndex)
}

/** The weight a loaded Exercise starts at with no history to go on. */
function startWeightOf(exercise: Exercise, plan: ExercisePlan): number | null {
  return plan.startWeightKg ?? exercise.startWeight
}

/** The Preset of `value` (a weight, or the signed Load on a Bodyweight Exercise) and `reps`. */
function presetOf(exercise: Exercise, value: number | null, reps: number): Preset {
  if (!exercise.bodyweight) return { weightKg: value, reps }
  return value === null || value === 0
    ? { weightKg: null, reps }
    : { weightKg: null, reps, loadKg: value }
}

/** A Preset's value: its weight, or its signed Load on a Bodyweight Exercise (`BW` = 0). */
function valueOf(exercise: Exercise, preset: Preset): number | null {
  return exercise.bodyweight ? (preset.loadKg ?? 0) : preset.weightKg
}

function clamp(exercise: Exercise, value: number): number {
  const { min, max } = exercise.bodyweight ? LOAD_BOUNDS : WEIGHT_BOUNDS
  return Math.min(max, Math.max(min, value))
}

/** Whether today's Set can anchor the next one: neither a Warm-up nor a drop Set. */
function isAnchor(entry: SetEntry): boolean {
  return entry.kind !== 'warmup' && entry.kind !== 'drop'
}

/**
 * The dial values a set should open with (E16-T6 O11), from last time's working Sets `L` and
 * today's Sets so far.
 *
 * `setIndex` is 1-based and numbers every Set, warm-ups included. The Set at `setIndex` is working
 * Set N, N being 1 + today's working Sets below it (or `setIndex` when `today` is omitted).
 * Warm-ups are skipped on both sides. The caller supplies `lastEntries` (E1-T3's
 * `getLastEntriesFor`), so this function stays pure and does no storage access.
 *
 * The anchor is today's latest working Set below `setIndex` that is not a drop Set, at working
 * position p. Rules, in order:
 * - an anchor, `L[p]` and `L[N]`: `L[N]`'s value shifted by anchor − `L[p]`, with `L[N]`'s reps;
 * - an anchor alone: the anchor's value and reps;
 * - no anchor: `L[N]`, else `L`'s last, else `plan.startWeightKg ?? exercise.startWeight` (on a
 *   Bodyweight Exercise, `exercise.startLoadKg`, absent `BW`) and `plan.repRange[0]`.
 *
 * Value is `weightKg`, or the signed Load on a Bodyweight Exercise (`BW` = 0), kept within 0–500
 * kg or −60 to +100 kg. Every Set is read in the Exercise's current mode (`presetFromSet`).
 */
export function presetForSet(args: {
  exercise: Exercise
  plan: ExercisePlan
  setIndex: number
  lastEntries: SetEntry[]
  /** This Session's Sets for the Exercise so far (E16-T6), passed apart from last time's. */
  today?: SetEntry[]
  /** Open a deload Session's loaded Sets 10 % lighter (E21). */
  deload?: boolean
}): Preset {
  const { exercise, plan, setIndex, lastEntries, today, deload } = args
  const asPreset = (set: SetEntry): Preset => presetFromSet({ exercise, plan, set })
  // A last-time Set as a Preset; on a deload Session a loaded weight is deloaded and remembered.
  const asLastPreset = (set: SetEntry): Preset => {
    const preset = asPreset(set)
    if (!deload || exercise.bodyweight || set.weightKg === null) return preset
    return { ...preset, weightKg: deloadWeight(set.weightKg, exercise.weightStep), deloadFromKg: set.weightKg }
  }

  const before = bySetIndex(workingSets(today ?? [])).filter(
    (entry) => entry.setIndex < setIndex,
  )
  const position = today === undefined ? setIndex : 1 + before.length
  const sequence = bySetIndex(workingSets(lastEntries))

  const anchorAt = before.map(isAnchor).lastIndexOf(true)
  if (anchorAt >= 0) {
    const anchor = asPreset(before[anchorAt])
    const lastAtAnchor = sequence[anchorAt]
    const lastAtNext = sequence[position - 1]
    if (lastAtAnchor === undefined || lastAtNext === undefined) return anchor
    const next = asLastPreset(lastAtNext)
    const from = valueOf(exercise, asLastPreset(lastAtAnchor))
    const to = valueOf(exercise, anchor)
    const value = valueOf(exercise, next)
    if (from === null || to === null || value === null) return anchor
    const shifted = presetOf(exercise, clamp(exercise, value + (to - from)), next.reps)
    return next.deloadFromKg === undefined ? shifted : { ...shifted, deloadFromKg: next.deloadFromKg }
  }

  const match = sequence[position - 1] ?? sequence[sequence.length - 1]
  if (match !== undefined) return asLastPreset(match)

  return presetOf(
    exercise,
    exercise.bodyweight ? (exercise.startLoadKg ?? 0) : startWeightOf(exercise, plan),
    plan.repRange[0],
  )
}

/**
 * A Set translated into the Exercise's current mode, as a Preset (E16-T6 O12): a loaded Set on a
 * Bodyweight Exercise opens on that signed Load (`20 kg` -> `BW+20`, `0 kg` -> `BW`), and a
 * Bodyweight Set on a loaded Exercise opens on the start weight. A Set already in the current
 * mode comes back as its Preset. The Set itself is never changed.
 */
export function presetFromSet(args: {
  exercise: Exercise
  plan: ExercisePlan
  set: Pick<SetEntry, 'weightKg' | 'reps' | 'loadKg'>
}): Preset {
  const { exercise, plan, set } = args
  const value = exercise.bodyweight
    ? (set.weightKg ?? set.loadKg ?? 0)
    : (set.weightKg ?? startWeightOf(exercise, plan))
  return presetOf(exercise, value, set.reps)
}
