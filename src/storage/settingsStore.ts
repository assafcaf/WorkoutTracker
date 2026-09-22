import type { Program } from '../types'
import { db } from './db'

/**
 * The `settings` table key the active program id is stored under. Exported so `App` can read
 * the raw stored value itself to tell a genuine default apart from a stale-id fallback —
 * `getActiveProgramId` collapses both to the same first-program id.
 */
export const ACTIVE_PROGRAM_ID_KEY = 'activeProgramId'

/**
 * The id of the program the trainee has chosen as active, read from the `settings` table.
 *
 * Defaults to the only program when there is one and nothing is stored, and otherwise to the
 * first program in `programs` — both when nothing is stored and when the stored id names a
 * program no longer among `programs`, in which case the fallback is also shown on screen.
 */
export async function getActiveProgramId(programs: Program[]): Promise<string> {
  const row = await db.settings.get(ACTIVE_PROGRAM_ID_KEY)
  const stored = typeof row?.value === 'string' ? row.value : undefined
  if (stored !== undefined && programs.some((program) => program.id === stored)) return stored
  return programs[0].id
}

/**
 * Records `id` as the active program, so a later `getActiveProgramId` call — even after the
 * database is closed and reopened — returns it.
 */
export async function setActiveProgramId(id: string): Promise<void> {
  await db.settings.put({ key: ACTIVE_PROGRAM_ID_KEY, value: id })
}
