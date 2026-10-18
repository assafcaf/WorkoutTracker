import type { Exercise, ExercisePlan, Session, SetEntry } from '../types'
import { presetForSet } from './prefill'
import { progression } from './progression'
import { loadText } from './setText'
import { workingSets } from './setKind'

/**
 * The working Sets of `exerciseId` in the newest non-deload Session holding one, else in the
 * newest deload one, or none.
 */
function lastEntriesOf(sessions: Session[], exerciseId: string): SetEntry[] {
  const newestFirst = [...sessions].sort((a, b) => b.startedAt - a.startedAt)
  let deloaded: SetEntry[] = []
  for (const session of newestFirst) {
    const entries = workingSets(session.entries).filter((entry) => entry.exerciseId === exerciseId)
    if (entries.length === 0) continue
    if (!session.deload) return entries
    if (deloaded.length === 0) deloaded = entries
  }
  return deloaded
}

/**
 * The load the next Session of `plan` opens on: the weight (or, on a Bodyweight Exercise, the
 * signed Load, `0` being plain bodyweight) that `progression` suggests after the last Session
 * when it filled the rep range, else the one the first Set's dial opens on (`presetForSet`:
 * last time's first working Set, else the Plan's or the Exercise's start). Null when a loaded
 * Exercise has no weight to go on.
 */
export function nextLoad(exercise: Exercise, plan: ExercisePlan, sessions: Session[]): number | null {
  const last = lastEntriesOf(sessions, plan.exerciseId)
  const suggestion = progression(exercise, plan, last).suggestion
  if (suggestion?.kind === 'hold') {
    const held = suggestion.nextWeightKg ?? suggestion.nextLoadKg
    if (held !== undefined) return held
  }
  if (suggestion?.kind === 'add-weight' && suggestion.nextWeightKg !== undefined) {
    return suggestion.nextWeightKg
  }
  if (suggestion?.kind === 'add-load' && suggestion.nextLoadKg !== undefined) {
    return suggestion.nextLoadKg
  }
  const preset = presetForSet({ exercise, plan, setIndex: 1, lastEntries: last })
  return exercise.bodyweight ? (preset.loadKg ?? 0) : preset.weightKg
}

/**
 * `nextLoad` as the Program tab's kg column reads it: `62.5`, `BW`, `BW+5`, `BW−27`, or `–` when
 * a loaded Exercise has no weight to go on.
 */
export function nextLoadText(exercise: Exercise, plan: ExercisePlan, sessions: Session[]): string {
  const value = nextLoad(exercise, plan, sessions)
  if (exercise.bodyweight) return loadText({ weightKg: null, loadKg: value ?? 0 })
  return value === null ? '–' : String(value)
}
