import type { Program, UserProgram, VolumeBaseline } from '../types'
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
  await db.settings.put({ key: ACTIVE_PROGRAM_ID_KEY, value: id, updatedAt: Date.now() })
}

/**
 * The `settings` table key the last successful export's timestamp is stored under. Exported so
 * `backup.ts` can read and write it, and so E2-T6's 14-day badge can read it directly.
 */
export const LAST_EXPORTED_AT_KEY = 'lastExportedAt'

/**
 * When the database was last exported, or null when it never has been.
 */
export async function getLastExportedAt(): Promise<number | null> {
  const row = await db.settings.get(LAST_EXPORTED_AT_KEY)
  return typeof row?.value === 'number' ? row.value : null
}

/**
 * Records `at` as the time of the most recent successful export, so a later
 * `getLastExportedAt` call — even after the database is closed and reopened — returns it.
 */
export async function setLastExportedAt(at: number): Promise<void> {
  await db.settings.put({ key: LAST_EXPORTED_AT_KEY, value: at })
}

/**
 * The `settings` table key the gym's saved equipment list is stored under (E5-T11).
 */
export const GYM_EQUIPMENT_KEY = 'gymEquipment'

/**
 * The gym's saved equipment list, or null when it has never been set — meaning everything is
 * available.
 */
export async function getGymEquipment(): Promise<string[] | null> {
  const row = await db.settings.get(GYM_EQUIPMENT_KEY)
  return Array.isArray(row?.value) ? (row.value as string[]) : null
}

/**
 * Records `list` as the gym's equipment, so a later `getGymEquipment` call — even after the
 * database is closed and reopened — returns it.
 */
export async function setGymEquipment(list: string[]): Promise<void> {
  await db.settings.put({ key: GYM_EQUIPMENT_KEY, value: list, updatedAt: Date.now() })
}

/** The `settings` table key every Exercise's stored weight step is kept under, in one row (E8). */
export const WEIGHT_STEPS_KEY = 'weightSteps'

/** The stored weight step for `exerciseId`, or null when none has been stored. */
export async function getWeightStep(exerciseId: string): Promise<number | null> {
  const steps = await getWeightSteps()
  return Object.prototype.hasOwnProperty.call(steps, exerciseId) ? steps[exerciseId] : null
}

/** Stores `step` as `exerciseId`'s weight step, keeping every other Exercise's step. */
export async function setWeightStep(exerciseId: string, step: number): Promise<void> {
  await db.transaction('rw', db.settings, async () => {
    const steps = await getWeightSteps()
    await setWeightSteps({ ...steps, [exerciseId]: step })
  })
}

/** Every stored weight step, by Exercise id; `{}` when none has been stored. */
export async function getWeightSteps(): Promise<Record<string, number>> {
  const row = await db.settings.get(WEIGHT_STEPS_KEY)
  const value = row?.value
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {}
  const steps: Record<string, number> = {}
  for (const [id, step] of Object.entries(value)) {
    if (typeof step === 'number') steps[id] = step
  }
  return steps
}

/**
 * Replaces every stored weight step with `steps`, in the one `weightSteps` row. Used by
 * `setWeightStep` and by a backup import, which restores the file's steps as a whole.
 */
export async function setWeightSteps(steps: Record<string, number>): Promise<void> {
  await db.settings.put({ key: WEIGHT_STEPS_KEY, value: steps, updatedAt: Date.now() })
}

/** The `settings` table key the volume baseline choice is stored under (E8). */
export const VOLUME_BASELINE_KEY = 'volumeBaseline'

const DEFAULT_VOLUME_BASELINE: VolumeBaseline = { period: 'last' }

/** The stored volume baseline, or `{ period: 'last' }` when none has been chosen. */
export async function getVolumeBaseline(): Promise<VolumeBaseline> {
  const row = await db.settings.get(VOLUME_BASELINE_KEY)
  const value = row?.value as { period?: unknown } | undefined
  return typeof value === 'object' && value !== null && typeof value.period === 'string'
    ? (value as VolumeBaseline)
    : DEFAULT_VOLUME_BASELINE
}

/** Records `baseline` as the volume baseline. */
export async function setVolumeBaseline(baseline: VolumeBaseline): Promise<void> {
  await db.settings.put({ key: VOLUME_BASELINE_KEY, value: baseline, updatedAt: Date.now() })
}

/** The `settings` table key every User Program is kept under, in one row (E9). */
export const USER_PROGRAMS_KEY = 'userPrograms'

/** Every stored User Program; `[]` when none has been stored. */
export async function getUserPrograms(): Promise<UserProgram[]> {
  throw new Error('not implemented')
}

/** Stores `p`, replacing the stored User Program with its id, else appending it. */
export async function saveUserProgram(_p: UserProgram): Promise<void> {
  throw new Error('not implemented')
}

/** Removes the User Program with `id`, so a bundled Program of that id shows again. */
export async function resetProgram(_id: string): Promise<void> {
  throw new Error('not implemented')
}

/** Marks the User Program with `id` hidden, keeping it. */
export async function deleteProgram(_id: string): Promise<void> {
  throw new Error('not implemented')
}
