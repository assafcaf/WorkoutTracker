// Test helpers for the set screen's steppers (Progress Dashboard S3/S4): while rest runs they are
// folded into one "Next: set 4 · 62.5 × 8" row, and a tap on it unfolds them.
import { fireEvent, screen } from '@testing-library/react'

const SETTLE = { timeout: 3000 }

/** The folded "Next: set …" row, or null while the steppers show. */
export function nextRow(): HTMLElement | null {
  return screen.queryByRole('button', { name: /^Next: set / })
}

/** Unfolds the steppers if rest has folded them; does nothing otherwise. */
export function unfoldSteppers(): void {
  const row = nextRow()
  if (row !== null) fireEvent.click(row)
}

/** Waits for the set screen -- its steppers, or the row they are folded into -- and unfolds them. */
export async function findSteppers(): Promise<HTMLElement> {
  await screen.findAllByRole('button', { name: /^(Weight$|Next: set )/ }, SETTLE)
  unfoldSteppers()
  return screen.getByRole('button', { name: 'Weight' })
}
