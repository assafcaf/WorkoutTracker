import type { Program } from '../types'

/**
 * The id of the program the trainee has chosen as active, read from the `settings` table.
 *
 * Defaults to the only program when there is one and nothing is stored, and otherwise to the
 * first program in `programs` — both when nothing is stored and when the stored id names a
 * program no longer among `programs`, in which case the fallback is also shown on screen.
 */
export async function getActiveProgramId(_programs: Program[]): Promise<string> {
  throw new Error('getActiveProgramId is not implemented')
}

/**
 * Records `id` as the active program, so a later `getActiveProgramId` call — even after the
 * database is closed and reopened — returns it.
 */
export async function setActiveProgramId(_id: string): Promise<void> {
  throw new Error('setActiveProgramId is not implemented')
}
