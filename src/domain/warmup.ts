import { platesFor } from './plates'
import type { PlateInventory } from '../types'

/** The lightest working weight a Warm-up ramp is proposed for (E15-T7). */
export const WARMUP_MIN_WORKING_KG = 40

/** One proposed Warm-up of a Warm-up ramp. */
export type WarmupStep = { weightKg: number; reps: number }

/** The share of the working weight each Warm-up is taken at, and its reps. */
const RAMP: ReadonlyArray<{ share: number; reps: number }> = [
  { share: 0.5, reps: 5 },
  { share: 0.7, reps: 3 },
  { share: 0.85, reps: 2 },
]

/**
 * The Warm-up ramp for `workingKg` with `inventory` (E15-T7): 50%, 70% and 85% of it for 5, 3
 * and 2 reps, each at the weight `platesFor` can make. A share under the bar is taken with the
 * bar alone, and a step no heavier than the one before it is dropped. Under
 * `WARMUP_MIN_WORKING_KG` there is no ramp.
 */
export function warmupRamp(workingKg: number, inventory: PlateInventory): WarmupStep[] {
  if (!(workingKg >= WARMUP_MIN_WORKING_KG)) return []
  const steps: WarmupStep[] = []
  for (const { share, reps } of RAMP) {
    const weightKg = platesFor(workingKg * share, inventory)?.madeKg ?? inventory.barKg
    // A bar as heavy as the working weight leaves nothing to warm up with.
    if (weightKg >= workingKg) continue
    const before = steps[steps.length - 1]
    if (before !== undefined && weightKg <= before.weightKg) continue
    steps.push({ weightKg, reps })
  }
  return steps
}
