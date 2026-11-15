// Test helpers for the set screen's steppers (Progress Dashboard S3/S4): while rest runs they are
// folded into the Get ready card (V2-02), and a tap on its "Change" unfolds them.
import { fireEvent, screen } from '@testing-library/react'

const SETTLE = { timeout: 3000 }

/** The Get ready card's "Change" (V2-02), or null while the steppers show. */
export function nextRow(): HTMLElement | null {
  return screen.queryByRole('button', { name: 'Change next set' })
}

/** Unfolds the steppers if rest has folded them; does nothing otherwise. */
export function unfoldSteppers(): void {
  const row = nextRow()
  if (row !== null) fireEvent.click(row)
}

/** Waits for the set screen -- its steppers, or the card they are folded into -- and unfolds them. */
export async function findSteppers(): Promise<HTMLElement> {
  await screen.findAllByRole('button', { name: /^(Weight, |Change next set$)/ }, SETTLE)
  unfoldSteppers()
  return screen.getByRole('button', { name: /^Weight, / })
}
