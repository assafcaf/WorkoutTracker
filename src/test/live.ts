// Test helpers for the Live session (Progress Dashboard S2/S3). It opens on Now (UX review
// V1-01), so a test about the exercise list taps All first; and Finish asks first while planned
// Sets are left (V1-06), so a test that only wants the Session over confirms it.
import { screen, within } from '@testing-library/react'
import type userEvent from '@testing-library/user-event'

type User = ReturnType<typeof userEvent.setup>

const SETTLE = { timeout: 3000 }

/**
 * Taps "All exercises" in the Live session's header (V3-07: one button, reading "Now" once All
 * is shown), once the header is up.
 */
export async function showAll(user: User): Promise<void> {
  // DX-19: the header's Set | All control.
  const all = await screen.findByRole('radio', { name: 'All' }, SETTLE)
  if (!(all as HTMLInputElement).checked) await user.click(all)
}

/** Taps Finish in the live header and, if it asks about Sets not logged, Finish Session (DX-14). */
export async function finishWorkout(user: User): Promise<void> {
  await user.click(await screen.findByRole('button', { name: 'Finish' }, SETTLE))
  const sheet = screen.queryByRole('dialog', { name: 'Finish Session?' })
  if (sheet !== null) await user.click(within(sheet).getByRole('button', { name: 'Finish Session' }))
}
