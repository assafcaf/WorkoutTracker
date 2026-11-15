import type { Muscle } from '../types'

/**
 * The one vocabulary a muscle is shown in (V2-13): the short names Progress › Muscles uses, so
 * every list that names a muscle says the same word. The stored value (`middle back`) is
 * unchanged; only what the trainee reads is.
 */
const SHORT: Partial<Record<Muscle, string>> = {
  quadriceps: 'Quads',
  abdominals: 'Abs',
  'middle back': 'Mid back',
}

/** A muscle's display name: `Quads`, `Mid back`, `Abs`, else the stored name capitalised. */
export function muscleLabel(muscle: Muscle): string {
  return SHORT[muscle] ?? muscle.charAt(0).toUpperCase() + muscle.slice(1)
}
