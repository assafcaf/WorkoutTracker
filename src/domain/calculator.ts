import type { PlateInventory } from '../types'
import type { PlateLoading } from './plates'

export type CalcRow = {
  reps?: number
  percent?: number
  rawKg: number
  loadKg: number
  loading: PlateLoading | null
}

/** Estimated one-rep strength from a set: weight x (1 + reps / 30). */
export function liftEstimate(_weightKg: number, _reps: number): number {
  throw new Error('NotImplementedError')
}

/** Reps 1..12 table: the loadable weight for n reps at estimate `est`. */
export function repMaxTable(_est: number, _inventory: PlateInventory): CalcRow[] {
  throw new Error('NotImplementedError')
}

/** 50..95 percent (step 5) of `est`, each as a loadable weight. */
export function percentTable(_est: number, _inventory: PlateInventory): CalcRow[] {
  throw new Error('NotImplementedError')
}
