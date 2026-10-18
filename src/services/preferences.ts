import type { ServiceDeps } from './deps'
import type { BodyEntry, BodyLog, PlateInventory, VolumeBaseline } from '../types'
import { validatePlateInventory } from '../domain/plates'
import { upsertBodyEntry, removeBodyEntry as dropBodyEntry, validateBodyEntry } from '../domain/bodyLog'
import { callStorage, ServiceError } from './errors'
import {
  getBodyLog,
  getBodyweightOverrides,
  setBodyLog,
  getExerciseNotes,
  getGymEquipment,
  getLastExportedAt,
  getPlateInventory,
  getKeepScreenOnDuringRest,
  getTrackEffort,
  getDeloadWeek,
  getWeekStart,
  getVolumeBaseline,
  getWeightStep,
  setBodyweightOverrides,
  setExerciseNote as storeExerciseNote,
  setGymEquipment as storeGymEquipment,
  setPlateInventory as storePlateInventory,
  setKeepScreenOnDuringRest,
  setTrackEffort as storeTrackEffort,
  setDeloadWeek,
  setWeekStart,
  setVolumeBaseline as storeVolumeBaseline,
  setWeightStep as storeWeightStep,
} from '../storage/settingsStore'

/**
 * Reads and writes gym equipment, weight steps, the volume baseline and the last export
 * timestamp (E11-T6, O5). `lastExportedAt` has no setter here: `backup.export` stamps that row
 * itself (E11-T8).
 */
export type PreferenceService = {
  gymEquipment(): Promise<string[] | null>
  setGymEquipment(list: string[]): Promise<void>
  weightStep(exerciseId: string): Promise<number | null>
  setWeightStep(exerciseId: string, step: number): Promise<void>
  volumeBaseline(): Promise<VolumeBaseline>
  setVolumeBaseline(b: VolumeBaseline): Promise<void>
  lastExportedAt(): Promise<number | null>
  exerciseNote(exerciseId: string): Promise<string | null>
  setExerciseNote(exerciseId: string, text: string): Promise<void>
  /** Whether Track effort is on; `false` when unset (E14-T10). */
  trackEffort(): Promise<boolean>
  setTrackEffort(on: boolean): Promise<void>
  /** The trainee's bar and plates; the default when none is stored (E15-T3). */
  plateInventory(): Promise<PlateInventory>
  /** Stores a valid inventory; rejects with the validation message when it is not (E15-T3). */
  setPlateInventory(inventory: PlateInventory): Promise<void>
  /** Every Bodyweight override by Exercise id; `{}` when none is stored (E16-T1). */
  bodyweightOverrides(): Promise<Record<string, boolean>>
  /**
   * Stores `value` as `exerciseId`'s Bodyweight override, or removes the override when `value`
   * equals the Exercise's own `defaultValue` (E16-T1).
   */
  setBodyweight(exerciseId: string, value: boolean, defaultValue: boolean): Promise<void>
  /** The first day of the week, 0 = Sunday ... 6 = Saturday; 1 when unset or invalid (E19-T1). */
  weekStart(): Promise<number>
  setWeekStart(day: number): Promise<void>
  /** The deload week's epoch ms, or null when unset (E21-T4). */
  deloadWeek(): Promise<number | null>
  setDeloadWeek(ms: number | null): Promise<void>
  /** Whether the screen stays on during rest; `true` when unset (E19-T1). */
  keepScreenOnDuringRest(): Promise<boolean>
  setKeepScreenOnDuringRest(on: boolean): Promise<void>
  /** The body log, oldest day first; `[]` when none is stored (E22-T2). */
  bodyLog(): Promise<BodyLog>
  /** Upserts a valid entry; rejects with a ServiceError when the entry is refused (E22-T2). */
  saveBodyEntry(entry: BodyEntry): Promise<void>
  /** Drops the entry of `day` (E22-T2). */
  removeBodyEntry(day: string): Promise<void>
}

/**
 * Builds the `PreferenceService` over `src/storage/settingsStore.ts`, stamping every write with
 * `deps.now()` through `callStorage` and notifying the `'preferences'` topic on `deps.bus` once
 * each write lands (O7, O8).
 *
 * STUB (E11-T6 test-designer): not implemented yet.
 */
export function createPreferenceService(deps: ServiceDeps): PreferenceService {
  async function write(op: () => Promise<void>): Promise<void> {
    await callStorage(deps, op, 'preference write failed')
    deps.bus.emit('preferences')
  }

  return {
    gymEquipment: () => callStorage(deps, getGymEquipment, 'gymEquipment read failed'),
    setGymEquipment: (list) => write(() => storeGymEquipment(list, deps.now())),
    weightStep: (exerciseId) =>
      callStorage(deps, () => getWeightStep(exerciseId), 'weightStep read failed'),
    setWeightStep: (exerciseId, step) =>
      write(() => storeWeightStep(exerciseId, step, deps.now())),
    volumeBaseline: () => callStorage(deps, getVolumeBaseline, 'volumeBaseline read failed'),
    setVolumeBaseline: (baseline) => write(() => storeVolumeBaseline(baseline, deps.now())),
    lastExportedAt: () => callStorage(deps, getLastExportedAt, 'lastExportedAt read failed'),
    exerciseNote: (exerciseId) =>
      callStorage(
        deps,
        async () => (await getExerciseNotes())[exerciseId] ?? null,
        'exerciseNote read failed',
      ),
    setExerciseNote: (exerciseId, text) =>
      write(() => storeExerciseNote(exerciseId, text, deps.now())),
    trackEffort: () => callStorage(deps, getTrackEffort, 'trackEffort read failed'),
    setTrackEffort: (on) => write(() => storeTrackEffort(on, deps.now())),
    plateInventory: () => callStorage(deps, getPlateInventory, 'plateInventory read failed'),
    setPlateInventory: async (inventory) => {
      const verdict = validatePlateInventory(inventory)
      if (!verdict.ok) throw new Error(verdict.error)
      await write(() => storePlateInventory(verdict.inventory, deps.now()))
    },
    bodyweightOverrides: () =>
      callStorage(deps, getBodyweightOverrides, 'bodyweightOverrides read failed'),
    setBodyweight: (exerciseId, value, defaultValue) =>
      write(async () => {
        const overrides = await getBodyweightOverrides()
        if (value === defaultValue) delete overrides[exerciseId]
        else overrides[exerciseId] = value
        await setBodyweightOverrides(overrides, deps.now())
      }),
    weekStart: () => callStorage(deps, getWeekStart, 'weekStart read failed'),
    setWeekStart: (day) => write(() => setWeekStart(day, deps.now())),
    deloadWeek: () => callStorage(deps, getDeloadWeek, 'deloadWeek read failed'),
    setDeloadWeek: (ms) => write(() => setDeloadWeek(ms, deps.now())),
    keepScreenOnDuringRest: () =>
      callStorage(deps, getKeepScreenOnDuringRest, 'keepScreenOnDuringRest read failed'),
    setKeepScreenOnDuringRest: (on) => write(() => setKeepScreenOnDuringRest(on, deps.now())),
    bodyLog: () => callStorage(deps, getBodyLog, 'bodyLog read failed'),
    saveBodyEntry: async (entry) => {
      const valid = validateBodyEntry(entry, deps.now())
      if (!valid) throw new ServiceError('storage-failed', 'the body entry is not valid')
      await write(async () => setBodyLog(upsertBodyEntry(await getBodyLog(), valid), deps.now()))
    },
    removeBodyEntry: (day) =>
      write(async () => setBodyLog(dropBodyEntry(await getBodyLog(), day), deps.now())),
  }
}
