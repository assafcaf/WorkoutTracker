import type { ServiceDeps } from './deps'
import type { VolumeBaseline } from '../types'

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
}

/**
 * Builds the `PreferenceService` over `src/storage/settingsStore.ts`, stamping every write with
 * `deps.now()` through `callStorage` and notifying the `'preferences'` topic on `deps.bus` once
 * each write lands (O7, O8).
 *
 * STUB (E11-T6 test-designer): not implemented yet.
 */
export function createPreferenceService(deps: ServiceDeps): PreferenceService {
  void deps
  throw new Error('not implemented')
}
