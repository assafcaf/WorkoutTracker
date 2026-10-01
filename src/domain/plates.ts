import type { LibraryExercise, PlateInventory } from '../types'

export const DEFAULT_PLATE_INVENTORY: PlateInventory = {
  barKg: 20,
  plates: [
    { kg: 25, pairs: 10 },
    { kg: 20, pairs: 10 },
    { kg: 15, pairs: 10 },
    { kg: 10, pairs: 10 },
    { kg: 5, pairs: 10 },
    { kg: 2.5, pairs: 10 },
    { kg: 1.25, pairs: 10 },
  ],
}

export type PlateLoading = { perSide: number[]; madeKg: number; exact: boolean }

export function platesFor(_totalKg: number, _inventory: PlateInventory): PlateLoading | null {
  return undefined as unknown as null
}

export function formatPlates(_loading: PlateLoading | null, _inventory: PlateInventory): string {
  return ''
}

export function isBarbell(_entry: LibraryExercise | undefined): boolean {
  return false
}
