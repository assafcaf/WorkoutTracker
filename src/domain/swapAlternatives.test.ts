import { expect, test } from 'vitest'
import { swapAlternatives } from './alternatives'
import type { LibraryExercise } from '../types'

// V6-10: the swap list when the platform is taken: lifts with history first, then the same
// primary muscle on the same equipment, then the lift's own family (a Romanian deadlift for a
// deadlift), then the rest; band and chain variants last.

function exercise(overrides: Partial<LibraryExercise> & { id: string; name: string }): LibraryExercise {
  return {
    force: null,
    level: 'beginner',
    mechanic: 'compound',
    equipment: 'barbell',
    primaryMuscles: ['lower back'],
    secondaryMuscles: [],
    instructions: [],
    category: 'strength',
    images: [],
    ...overrides,
  }
}

const DEADLIFT = exercise({ id: 'Barbell_Deadlift', name: 'Barbell Deadlift' })
const BANDS = exercise({ id: 'Deadlift_with_Bands', name: 'Deadlift with Bands', category: 'powerlifting' })
const CHAINS = exercise({ id: 'Deadlift_with_Chains', name: 'Deadlift with Chains', category: 'powerlifting' })
const REVERSE_BAND = exercise({ id: 'Reverse_Band_Deadlift', name: 'Reverse Band Deadlift', category: 'powerlifting' })
const DEFICIT = exercise({ id: 'Deficit_Deadlift', name: 'Deficit Deadlift', category: 'powerlifting' })
const HYPER = exercise({ id: 'Hyperextensions', name: 'Hyperextensions (Back Extensions)', equipment: 'other', mechanic: 'isolation' })
const ROMANIAN = exercise({ id: 'Romanian_Deadlift', name: 'Romanian Deadlift', primaryMuscles: ['hamstrings'] })
const DB_ROMANIAN = exercise({ id: 'DB_RDL', name: 'Stiff-Legged Dumbbell Deadlift', primaryMuscles: ['hamstrings'], equipment: 'dumbbell' })
const LEG_CURL = exercise({ id: 'Leg_Curl', name: 'Lying Leg Curls', primaryMuscles: ['hamstrings'], equipment: 'machine' })
const CABLE = exercise({ id: 'Cable_Back', name: 'Cable Back Extension', equipment: 'cable', mechanic: 'isolation' })

const library = new Map(
  [DEADLIFT, BANDS, CHAINS, REVERSE_BAND, DEFICIT, HYPER, ROMANIAN, DB_ROMANIAN, LEG_CURL, CABLE].map((e) => [e.id, e] as const),
)
const ids = (list: LibraryExercise[]): string[] => list.map((e) => e.id)

test('V6-10 a Deadlift reaches its Romanian deadlift, and band and chain variants come last', () => {
  const list = ids(swapAlternatives(DEADLIFT, library, null))
  expect(list).toContain('Romanian_Deadlift')
  expect(list.indexOf('Romanian_Deadlift')).toBeLessThan(list.indexOf('Hyperextensions'))
  expect(list.slice(-3).sort()).toEqual(['Deadlift_with_Bands', 'Deadlift_with_Chains', 'Reverse_Band_Deadlift'])
  // A lift of another family and muscle (the leg curl) is not offered.
  expect(list).not.toContain('Leg_Curl')
})

test('V6-10 the same primary muscle on the same equipment comes first among lifts with no history', () => {
  const list = ids(swapAlternatives(DEADLIFT, library, null))
  expect(list[0]).toBe('Deficit_Deadlift')
})

test('V6-10 a lift the lifter has logged comes first', () => {
  const list = ids(swapAlternatives(DEADLIFT, library, null, new Set(['Hyperextensions'])))
  expect(list[0]).toBe('Hyperextensions')
})

test("V6-10 My gym's equipment filters the list, the lift's family included", () => {
  const list = ids(swapAlternatives(DEADLIFT, library, ['barbell']))
  expect(list).not.toContain('Cable_Back')
  expect(list).not.toContain('DB_RDL')
  expect(list).toContain('Romanian_Deadlift')
  // HYPER's "other" is not in the list either.
  expect(list).not.toContain('Hyperextensions')
})

test('V6-10 a gym with bands ranks the band variants with the rest; chains stay last', () => {
  const list = ids(swapAlternatives(DEADLIFT, library, ['barbell', 'bands']))
  expect(list.at(-1)).toBe('Deadlift_with_Chains')
  expect(list.indexOf('Deadlift_with_Bands')).toBeLessThan(list.indexOf('Romanian_Deadlift'))
})

test('V6-10 an expert-level lift goes last in its tier', () => {
  const sideDeadlift = exercise({ id: 'Side_DL', name: 'One-Arm Side Deadlift', primaryMuscles: ['quadriceps'], level: 'expert' })
  const withSide = new Map([...library, [sideDeadlift.id, sideDeadlift] as const])
  const list = ids(swapAlternatives(DEADLIFT, withSide, null))
  expect(list.indexOf('Romanian_Deadlift')).toBeLessThan(list.indexOf('Side_DL'))
})
