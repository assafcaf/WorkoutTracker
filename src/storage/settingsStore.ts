import type { Program, UserProgram, VolumeBaseline } from '../types'
import { db, type SettingRow } from './db'

// --- whole rows for sync and backup (E11-T2) ------------------------------------------------

/** The stored row for `key`, as it stands, or undefined when there is none. */
export async function readRow(key: string): Promise<SettingRow | undefined> {
  return db.settings.get(key)
}

/** Writes each row as given, `updatedAt` included. */
export async function putRows(rows: SettingRow[]): Promise<void> {
  await db.settings.bulkPut(rows)
}

/** Deletes the rows stored under `keys`. */
export async function deleteKeys(keys: string[]): Promise<void> {
  await db.settings.bulkDelete(keys)
}

/**
 * The `settings` table key the active program id is stored under. Exported so the program
 * service can read the raw stored value itself to tell a genuine choice apart from a stale-id
 * fallback, which `getActiveProgramId` collapses to the same first-program id.
 */
export const ACTIVE_PROGRAM_ID_KEY = 'activeProgramId'

/**
 * The id of the program the trainee has chosen as active, read from the `settings` table, or
 * null when there is none yet (E9-T2).
 *
 * A stored id among `programs` is returned as is; a stored id no longer among them falls back
 * to the first program. With nothing stored the result is null: adopting the latest Session's
 * Program is the program service's job (E11-T15).
 */
export async function getActiveProgramId(programs: Program[]): Promise<string | null> {
  const row = await db.settings.get(ACTIVE_PROGRAM_ID_KEY)
  const stored = typeof row?.value === 'string' ? row.value : undefined
  if (stored === undefined) return null
  return programs.some((program) => program.id === stored) ? stored : programs[0].id
}

/**
 * Records `id` as the active program, so a later `getActiveProgramId` call — even after the
 * database is closed and reopened — returns it.
 */
export async function setActiveProgramId(id: string, now: number = Date.now()): Promise<void> {
  await db.settings.put({ key: ACTIVE_PROGRAM_ID_KEY, value: id, updatedAt: now })
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
export async function setLastExportedAt(at: number, now?: number): Promise<void> {
  // Unstamped when no `now` is given, as it always was: the row is device-local, never synced.
  await db.settings.put(
    now === undefined
      ? { key: LAST_EXPORTED_AT_KEY, value: at }
      : { key: LAST_EXPORTED_AT_KEY, value: at, updatedAt: now },
  )
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
export async function setGymEquipment(list: string[], now: number = Date.now()): Promise<void> {
  await db.settings.put({ key: GYM_EQUIPMENT_KEY, value: list, updatedAt: now })
}

/** The `settings` table key every Exercise's stored weight step is kept under, in one row (E8). */
export const WEIGHT_STEPS_KEY = 'weightSteps'

/** The stored weight step for `exerciseId`, or null when none has been stored. */
export async function getWeightStep(exerciseId: string): Promise<number | null> {
  const steps = await getWeightSteps()
  return Object.prototype.hasOwnProperty.call(steps, exerciseId) ? steps[exerciseId] : null
}

/** Stores `step` as `exerciseId`'s weight step, keeping every other Exercise's step. */
export async function setWeightStep(
  exerciseId: string,
  step: number,
  now: number = Date.now(),
): Promise<void> {
  await db.transaction('rw', db.settings, async () => {
    const steps = await getWeightSteps()
    await setWeightSteps({ ...steps, [exerciseId]: step }, now)
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
export async function setWeightSteps(
  steps: Record<string, number>,
  now: number = Date.now(),
): Promise<void> {
  await db.settings.put({ key: WEIGHT_STEPS_KEY, value: steps, updatedAt: now })
}

/** The `settings` table key every Exercise note is kept under, in one row (E14-T3). */
export const EXERCISE_NOTES_KEY = 'exerciseNotes'

/** The longest note kept; a longer one is cut to its first characters. */
export const MAX_EXERCISE_NOTE_LENGTH = 500

/** Every Exercise note by Exercise id; `{}` when none has been stored. */
export async function getExerciseNotes(): Promise<Record<string, string>> {
  const value = (await db.settings.get(EXERCISE_NOTES_KEY))?.value
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {}
  const notes: Record<string, string> = {}
  for (const [id, note] of Object.entries(value)) {
    if (typeof note === 'string') notes[id] = note
  }
  return notes
}

/**
 * Stores `text` as `exerciseId`'s note, keeping every other Exercise's note. An empty or
 * whitespace-only `text` removes the Exercise's key; a longer-than-500 one is cut to 500.
 */
export async function setExerciseNote(
  exerciseId: string,
  text: string,
  now: number = Date.now(),
): Promise<void> {
  await db.transaction('rw', db.settings, async () => {
    const notes = await getExerciseNotes()
    if (text.trim() === '') delete notes[exerciseId]
    else notes[exerciseId] = text.slice(0, MAX_EXERCISE_NOTE_LENGTH)
    await db.settings.put({ key: EXERCISE_NOTES_KEY, value: notes, updatedAt: now })
  })
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
export async function setVolumeBaseline(
  baseline: VolumeBaseline,
  now: number = Date.now(),
): Promise<void> {
  await db.settings.put({ key: VOLUME_BASELINE_KEY, value: baseline, updatedAt: now })
}

/** The `settings` table key every User Program is kept under, in one row (E9). */
export const USER_PROGRAMS_KEY = 'userPrograms'

/** Every stored User Program; `[]` when none has been stored. */
export async function getUserPrograms(): Promise<UserProgram[]> {
  const row = await db.settings.get(USER_PROGRAMS_KEY)
  return Array.isArray(row?.value) ? (row.value as UserProgram[]) : []
}

/**
 * Replaces every stored User Program with `programs`, in the one `userPrograms` row. Used by the
 * writers below and by a backup import, which restores the file's Programs as a whole.
 */
export async function setUserPrograms(
  programs: UserProgram[],
  now: number = Date.now(),
): Promise<void> {
  await db.settings.put({ key: USER_PROGRAMS_KEY, value: programs, updatedAt: now })
}

/** Reads the stored User Programs, and stores what `change` makes of them, in one transaction. */
async function updateUserPrograms(
  change: (programs: UserProgram[]) => UserProgram[],
  now: number,
): Promise<void> {
  await db.transaction('rw', db.settings, async () => {
    await setUserPrograms(change(await getUserPrograms()), now)
  })
}

/** Stores `p`, replacing the stored User Program with its id, else appending it. */
export async function saveUserProgram(p: UserProgram, now: number = Date.now()): Promise<void> {
  await updateUserPrograms(
    (programs) =>
      programs.some((stored) => stored.id === p.id)
        ? programs.map((stored) => (stored.id === p.id ? p : stored))
        : [...programs, p],
    now,
  )
}

/** Removes the User Program with `id`, so a bundled Program of that id shows again. */
export async function resetProgram(id: string, now: number = Date.now()): Promise<void> {
  await updateUserPrograms((programs) => programs.filter((stored) => stored.id !== id), now)
}

/** Marks the User Program with `id` hidden, keeping it. */
export async function deleteProgram(id: string, now: number = Date.now()): Promise<void> {
  await updateUserPrograms(
    (programs) => programs.map((stored) => (stored.id === id ? { ...stored, hidden: true } : stored)),
    now,
  )
}
