import type { PlateInventory } from '../types'

/** The lightest working weight a Warm-up ramp is proposed for (E15-T7). */
export const WARMUP_MIN_WORKING_KG = 40

/** One proposed Warm-up of a Warm-up ramp. */
export type WarmupStep = { weightKg: number; reps: number }

/**
 * The Warm-up ramp for `workingKg` with `inventory` (E15-T7).
 *
 * STUB (E15-T7 test-designer): not implemented.
 */
export function warmupRamp(workingKg: number, inventory: PlateInventory): WarmupStep[] {
  void workingKg
  void inventory
  throw new Error('NotImplementedError: warmupRamp')
}
