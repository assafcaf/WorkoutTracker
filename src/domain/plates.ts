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

const toGrams = (kg: number) => Math.round(kg * 1000)

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b)
}

export function platesFor(totalKg: number, inventory: PlateInventory): PlateLoading | null {
  const barG = toGrams(inventory.barKg)
  const totalG = toGrams(totalKg)
  if (totalG < barG) return null

  // Heaviest first; a plate with no pairs is never used.
  const plates = inventory.plates
    .filter((p) => p.pairs > 0 && p.kg > 0)
    .map((p) => ({ kg: p.kg, w: toGrams(p.kg), pairs: p.pairs }))
    .sort((a, b) => b.w - a.w)
  const unit = plates.reduce((g, p) => gcd(g, p.w), 0) || 1
  const sums = plates.map((p) => p.w / unit)
  const capacity = plates.reduce((n, p, i) => n + sums[i] * p.pairs, 0)
  const target = Math.min(Math.floor((totalG - barG) / 2 / unit), capacity)

  // feasible[i * width + s]: sum s can be made from plates i.. onward.
  const width = target + 1
  const feasible = new Uint8Array((plates.length + 1) * width)
  feasible[plates.length * width] = 1
  for (let i = plates.length - 1; i >= 0; i--) {
    const w = sums[i]
    const row = i * width
    const next = row + width
    for (let s = 0; s <= target; s++) {
      for (let k = 0; k <= plates[i].pairs && k * w <= s; k++) {
        if (feasible[next + s - k * w]) {
          feasible[row + s] = 1
          break
        }
      }
    }
  }

  let best = target
  while (!feasible[best]) best--

  const perSide: number[] = []
  let rest = best
  for (let i = 0; i < plates.length; i++) {
    for (let k = Math.min(plates[i].pairs, Math.floor(rest / sums[i])); k >= 0; k--) {
      if (feasible[(i + 1) * width + rest - k * sums[i]]) {
        for (let j = 0; j < k; j++) perSide.push(plates[i].kg)
        rest -= k * sums[i]
        break
      }
    }
  }

  const madeG = barG + 2 * best * unit
  return { perSide, madeKg: madeG / 1000, exact: madeG === totalG }
}

export function formatPlates(loading: PlateLoading | null, inventory: PlateInventory): string {
  if (!loading) return `Lighter than the ${inventory.barKg} kg bar`
  const list = loading.perSide.join(' · ')
  if (loading.exact) return loading.perSide.length ? `Per side: ${list}` : 'Bar only'
  return loading.perSide.length
    ? `Nearest ${loading.madeKg} kg · per side: ${list}`
    : `Nearest ${loading.madeKg} kg · bar only`
}

export function isBarbell(entry: LibraryExercise | undefined): boolean {
  return entry?.equipment === 'barbell'
}
