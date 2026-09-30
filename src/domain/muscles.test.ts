import { expect, test } from 'vitest'
import { muscleSets, weekSets, regionsFor, toRegionCounts, familyOf } from './muscles'
import type { Resolve, MuscleFamily, Region } from './muscles'
import { musclesForRegion } from '../ui/regionMuscles'
import type { Exercise, LibraryExercise, Muscle, Session, SetEntry } from '../types'

// Hand-rolled free-exercise-db-shaped fixtures, matching alternatives.test.ts's convention --
// muscleSets/weekSets/regionsFor have no dependency on the bundled catalog or library.
function libraryExercise(
  overrides: Partial<LibraryExercise> & { id: string; name: string },
): LibraryExercise {
  return {
    force: null,
    level: 'beginner',
    mechanic: 'compound',
    equipment: null,
    primaryMuscles: [],
    secondaryMuscles: [],
    instructions: [],
    category: 'strength',
    images: [],
    ...overrides,
  }
}

function exercise(overrides: Partial<Exercise> & { id: string; libraryId: string }): Exercise {
  return {
    name: 'Fixture Exercise',
    weightStep: 2.5,
    startWeight: 20,
    bodyweight: false,
    invertProgress: false,
    ...overrides,
  }
}

function setEntry(overrides: Partial<SetEntry> & { exerciseId: string }): SetEntry {
  return {
    setIndex: 1,
    weightKg: 20,
    reps: 8,
    loggedAt: 0,
    ...overrides,
  }
}

function session(overrides: Partial<Session> & { id: string; entries: SetEntry[] }): Session {
  return {
    programId: 'fixture-program',
    workoutId: 'fixture-workout',
    startedAt: 0,
    finishedAt: 0,
    ...overrides,
  }
}

// M1: muscleSets --------------------------------------------------------------------------

const squatLibrary = libraryExercise({
  id: 'squat-lib',
  name: 'Squat',
  primaryMuscles: ['quadriceps'],
  secondaryMuscles: ['glutes', 'hamstrings'],
})
const squatExercise = exercise({ id: 'back-squat', libraryId: 'squat-lib' })
const squatResolve: Resolve = (id) => (id === 'back-squat' ? squatExercise : undefined)
const squatLibraryMap = new Map([[squatLibrary.id, squatLibrary]])

test('M1 a set adds 1 to its exercise primary muscle', () => {
  const entries: SetEntry[] = [setEntry({ exerciseId: 'back-squat' })]

  const result = muscleSets(entries, squatResolve, squatLibraryMap)

  expect(result.get('quadriceps')).toBe(1)
})

test('M1 a set adds 0.5 to each of its exercise secondary muscles', () => {
  const entries: SetEntry[] = [setEntry({ exerciseId: 'back-squat' })]

  const result = muscleSets(entries, squatResolve, squatLibraryMap)

  expect(result.get('glutes')).toBe(0.5)
  expect(result.get('hamstrings')).toBe(0.5)
})

test('M1 two sets of the same exercise accumulate on the same muscle', () => {
  const entries: SetEntry[] = [
    setEntry({ exerciseId: 'back-squat', setIndex: 1 }),
    setEntry({ exerciseId: 'back-squat', setIndex: 2 }),
  ]

  const result = muscleSets(entries, squatResolve, squatLibraryMap)

  expect(result.get('quadriceps')).toBe(2)
})

test('M1 a bodyweight set counts the same as a weighted set', () => {
  const pushUpLibrary = libraryExercise({
    id: 'push-up-lib',
    name: 'Push Up',
    primaryMuscles: ['chest'],
    secondaryMuscles: ['triceps'],
  })
  const pushUpExercise = exercise({
    id: 'push-ups',
    libraryId: 'push-up-lib',
    bodyweight: true,
    startWeight: null,
  })
  const resolve: Resolve = (id) => (id === 'push-ups' ? pushUpExercise : undefined)
  const library = new Map([[pushUpLibrary.id, pushUpLibrary]])
  const entries: SetEntry[] = [setEntry({ exerciseId: 'push-ups', weightKg: null })]

  const result = muscleSets(entries, resolve, library)

  expect(result.get('chest')).toBe(1)
})

test('M1 an entry whose exercise id does not resolve is skipped', () => {
  const resolve: Resolve = () => undefined
  const entries: SetEntry[] = [setEntry({ exerciseId: 'unknown-exercise' })]

  const result = muscleSets(entries, resolve, squatLibraryMap)

  expect(result.size).toBe(0)
})

// M2: weekSets ------------------------------------------------------------------------------

const now = Date.UTC(2026, 0, 8)
const daysAgo = (days: number) => now - days * 24 * 60 * 60 * 1000

test('M2 sets logged 1 and 6 days before now count, but a set logged 8 days before does not', () => {
  const sessions: Session[] = [
    session({ id: 's1', entries: [setEntry({ exerciseId: 'back-squat', loggedAt: daysAgo(1) })] }),
    session({ id: 's2', entries: [setEntry({ exerciseId: 'back-squat', loggedAt: daysAgo(6) })] }),
    session({ id: 's3', entries: [setEntry({ exerciseId: 'back-squat', loggedAt: daysAgo(8) })] }),
  ]

  const result = weekSets(sessions, now, squatResolve, squatLibraryMap)

  expect(result.get('quadriceps')).toBe(2)
})

test('M2 a set logged exactly 7 times 24 hours before now is inside the window', () => {
  const sessions: Session[] = [
    session({ id: 's1', entries: [setEntry({ exerciseId: 'back-squat', loggedAt: daysAgo(7) })] }),
  ]

  const result = weekSets(sessions, now, squatResolve, squatLibraryMap)

  expect(result.get('quadriceps')).toBe(1)
})

test('M2 an unfinished session in progress is included', () => {
  const sessions: Session[] = [
    session({
      id: 's1',
      finishedAt: null,
      entries: [setEntry({ exerciseId: 'back-squat', loggedAt: daysAgo(1) })],
    }),
  ]

  const result = weekSets(sessions, now, squatResolve, squatLibraryMap)

  expect(result.get('quadriceps')).toBe(1)
})

// M6: regionsFor / toRegionCounts -----------------------------------------------------------

// Hand-checked against E5-T1's Interfaces section (the Muscle union), not computed from
// library.ts's MUSCLES export, per library.test.ts's SEVENTEEN_MUSCLES convention.
const SEVENTEEN_MUSCLES: readonly Muscle[] = [
  'abdominals',
  'abductors',
  'adductors',
  'biceps',
  'calves',
  'chest',
  'forearms',
  'glutes',
  'hamstrings',
  'lats',
  'lower back',
  'middle back',
  'neck',
  'quadriceps',
  'shoulders',
  'traps',
  'triceps',
]

test('M6 every one of the library 17 muscles maps to at least one body region', () => {
  for (const muscle of SEVENTEEN_MUSCLES) {
    expect(regionsFor(muscle).length).toBeGreaterThan(0)
  }
})

test('M6 lats and middle back both map to the upper-back region', () => {
  expect(regionsFor('lats')).toEqual(['upper-back'])
  expect(regionsFor('middle back')).toEqual(['upper-back'])
})

test('M6 shoulders maps to both the front-deltoids and back-deltoids regions', () => {
  expect([...regionsFor('shoulders')].sort()).toEqual(['back-deltoids', 'front-deltoids'])
})

test('M6 abdominals maps to both the abs and obliques regions', () => {
  expect([...regionsFor('abdominals')].sort()).toEqual(['abs', 'obliques'])
})

test('M6 toRegionCounts sums the counts of every muscle that maps to the same region', () => {
  const counts = new Map<Muscle, number>([
    ['lats', 3],
    ['middle back', 2],
  ])

  const regionCounts = toRegionCounts(counts)

  expect(regionCounts.get('upper-back')).toBe(5)
})

test('M6 toRegionCounts gives a muscle that maps to two regions its full count in each region', () => {
  const counts = new Map<Muscle, number>([['abdominals', 4]])

  const regionCounts = toRegionCounts(counts)

  expect(regionCounts.get('abs')).toBe(4)
  expect(regionCounts.get('obliques')).toBe(4)
})

// O6: familyOf / every Region's musclesForRegion sharing one family -------------------------

// Hand-checked against the ticket's family table (E10-T3), not computed from familyOf itself.
const EXPECTED_FAMILIES: Record<Muscle, MuscleFamily> = {
  chest: 'push',
  shoulders: 'push',
  triceps: 'push',
  lats: 'pull',
  'middle back': 'pull',
  traps: 'pull',
  biceps: 'pull',
  forearms: 'pull',
  neck: 'pull',
  quadriceps: 'legs',
  hamstrings: 'legs',
  glutes: 'legs',
  calves: 'legs',
  abductors: 'legs',
  adductors: 'legs',
  abdominals: 'core',
  'lower back': 'core',
}

test('O6 familyOf returns the spec family for each of the 17 Muscle values', () => {
  for (const muscle of SEVENTEEN_MUSCLES) {
    expect(familyOf(muscle)).toBe(EXPECTED_FAMILIES[muscle])
  }
})

// Every Region regionsFor names (M6's SEVENTEEN_MUSCLES cover all 18 -- see muscles.ts's Region
// union), so musclesForRegion(region) is never empty for a real region.
const EIGHTEEN_REGIONS: readonly Region[] = [
  'trapezius',
  'upper-back',
  'lower-back',
  'chest',
  'biceps',
  'triceps',
  'forearm',
  'back-deltoids',
  'front-deltoids',
  'abs',
  'obliques',
  'adductor',
  'abductors',
  'hamstring',
  'quadriceps',
  'calves',
  'gluteal',
  'neck',
]

test('O3 muscleSets answers what it answers with the warm-up Sets removed', () => {
  const entries: SetEntry[] = [
    setEntry({ exerciseId: 'back-squat', kind: 'warmup' }),
    setEntry({ exerciseId: 'back-squat' }),
  ]

  const result = muscleSets(entries, squatResolve, squatLibraryMap)

  expect(result.get('quadriceps')).toBe(1)
  expect(result.get('glutes')).toBe(0.5)
})

test('O3 weekSets answers what it answers with the warm-up Sets removed', () => {
  const now = 10 * 24 * 60 * 60 * 1000
  const sessions = [
    session({
      id: 'week',
      entries: [
        setEntry({ exerciseId: 'back-squat', loggedAt: now - 1000, kind: 'warmup' }),
        setEntry({ exerciseId: 'back-squat', loggedAt: now - 2000 }),
      ],
    }),
  ]

  const result = weekSets(sessions, now, squatResolve, squatLibraryMap)

  expect(result.get('quadriceps')).toBe(1)
  expect(result.get('glutes')).toBe(0.5)
})

test('O6 every Region musclesForRegion returns muscles that all share one family', () => {
  for (const region of EIGHTEEN_REGIONS) {
    const muscles = musclesForRegion(region)
    expect(muscles.length, `${region} must map back to at least one muscle`).toBeGreaterThan(0)
    const families = new Set(muscles.map((muscle) => familyOf(muscle)))
    expect(families.size, `${region}'s muscles must all share one family, got ${[...families]}`).toBe(1)
  }
})
