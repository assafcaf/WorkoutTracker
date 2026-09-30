import type { SetEntry } from '../types'

type SetTextInput = Pick<SetEntry, 'weightKg' | 'reps' | 'loadKg'>

/** A Set as text: `80 × 8`, `BW × 8`, `BW+10 × 8`, `BW−20 × 8` (true minus sign). */
export function formatSet(_entry: SetTextInput): string {
  return ''
}

/** `formatSet` without the spaces: `BW+10×8`. */
export function formatSetCompact(_entry: SetTextInput): string {
  return ''
}
