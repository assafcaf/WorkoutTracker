import type { PlateInventory } from '../types'
import { platesFor, type PlateLoading } from './plates'
import { estimatedMax } from './stats/liftStory'

export type CalcRow = {
  reps?: number
  percent?: number
  rawKg: number
  loadKg: number
  loading: PlateLoading | null
}

/** Estimated one-rep strength from a set: weight x (1 + reps / 30). */
export function liftEstimate(weightKg: number, reps: number): number {
  return estimatedMax(weightKg, reps)
}

function row(rawKg: number, inventory: PlateInventory): Pick<CalcRow, 'rawKg' | 'loadKg' | 'loading'> {
  const loading = platesFor(rawKg, inventory)
  return { rawKg, loadKg: loading ? loading.madeKg : rawKg, loading }
}

/** Reps 1..12 table: the loadable weight for n reps at estimate est. */
export function repMaxTable(est: number, inventory: PlateInventory): CalcRow[] {
  return Array.from({ length: 12 }, (_, i) => {
    const reps = i + 1
    return { reps, ...row(reps === 1 ? est : est / (1 + reps / 30), inventory) }
  })
}

/** 50..95 percent (step 5) of est, each as a loadable weight. */
export function percentTable(est: number, inventory: PlateInventory): CalcRow[] {
  return Array.from({ length: 10 }, (_, i) => {
    const percent = 50 + i * 5
    return { percent, ...row((est * percent) / 100, inventory) }
  })
}
