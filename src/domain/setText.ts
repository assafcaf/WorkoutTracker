import type { SetEntry } from '../types'

type SetTextInput = Pick<SetEntry, 'weightKg' | 'reps' | 'loadKg'>

function loadText({ weightKg, loadKg }: SetTextInput): string {
  if (weightKg !== null) return String(weightKg)
  if (!loadKg) return 'BW'
  return loadKg > 0 ? `BW+${loadKg}` : `BW−${Math.abs(loadKg)}`
}

/** A Set as text: `80 × 8`, `BW × 8`, `BW+10 × 8`, `BW−20 × 8` (true minus sign). */
export function formatSet(entry: SetTextInput): string {
  return `${loadText(entry)} × ${entry.reps}`
}

/** `formatSet` without the spaces: `BW+10×8`. */
export function formatSetCompact(entry: SetTextInput): string {
  return `${loadText(entry)}×${entry.reps}`
}
