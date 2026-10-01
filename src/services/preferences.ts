import type { ServiceDeps } from './deps'
import type { PlateInventory, VolumeBaseline } from '../types'
import { validatePlateInventory } from '../domain/plates'
import { callStorage } from './errors'
import {
  getExerciseNotes,
  getGymEquipment,
  getLastExportedAt,
  getPlateInventory,
  getTrackEffort,
  getVolumeBaseline,
  getWeightStep,
  setExerciseNote as storeExerciseNote,
  setGymEquipment as storeGymEquipment,
  setPlateInventory as storePlateInventory,
  setTrackEffort as storeTrackEffort,
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
  }
}
