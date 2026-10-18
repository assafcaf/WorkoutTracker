import { describe, expect, test } from 'vitest'
import { mergeCustomExercises, validateCustomExercise } from './customExercises'
import { muscleSets } from './muscles'
import type { CustomExercise, Exercise, LibraryExercise, SetEntry } from '../types'

// O16/O17: the merge adds each valid custom Exercise to new catalog and library maps; O17: a
// custom id equal to a bundled one is dropped; validation refuses a blank name, no primary
// muscle, a weight step <= 0 and a taken id. O18: Sets of a custom quadriceps Exercise count for
// quadriceps through the merged library.

function bundledLibrary(id: string): LibraryExercise {
  return {
    id,
    name: 'Bundled ' + id,
    force: 'push',
    level: 'intermediate',
    mechanic: 'compound',
    equipment: 'barbell',
    primaryMuscles: ['chest'],
    secondaryMuscles: [],
    instructions: ['do it'],
    category: 'strength',
    images: ['a.jpg'],
  }
}

function bundledExercise(id: string, libraryId: string): Exercise {
  return { id, name: 'Bundled ' + id, weightStep: 2.5, startWeight: 20, bodyweight: false, libraryId }
}

function custom(overrides: Partial<CustomExercise> = {}): CustomExercise {
  return {
    id: 'custom-leg-sled',
    name: 'Leg sled',
    primaryMuscles: ['quadriceps'],
    secondaryMuscles: ['glutes'],
    equipment: 'machine',
    bodyweight: false,
    weightStep: 5,
    createdAt: 1000,
    ...overrides,
  }
}

function bundled() {
  const catalog = new Map([['bench', bundledExercise('bench', 'Bench_Lib')]])
  const library = new Map([
    ['Bench_Lib', bundledLibrary('Bench_Lib')],
    ['Lib_Only', bundledLibrary('Lib_Only')],
  ])
  return { catalog, library }
}

describe('O17 validateCustomExercise', () => {
  test('answers null for a valid Exercise', () => {
    expect(validateCustomExercise(custom(), bundled())).toBeNull()
  })

  test.each([
    ['an empty name', { name: '' }],
    ['a blank name', { name: '   ' }],
    ['no primary muscle', { primaryMuscles: [] }],
    ['a weight step of 0', { weightStep: 0 }],
    ['a negative weight step', { weightStep: -2.5 }],
    ['a weight step of NaN', { weightStep: Number.NaN }],
    ['an infinite weight step', { weightStep: Number.POSITIVE_INFINITY }],
    ['an id equal to a catalog id', { id: 'bench' }],
    ['an id equal to a library id', { id: 'Lib_Only' }],
  ] as [string, Partial<CustomExercise>][])('answers a message for %s', (_n, overrides) => {
    const message = validateCustomExercise(custom(overrides), bundled())

    expect(typeof message).toBe('string')
    expect((message as string).length).toBeGreaterThan(0)
  })
})

describe('O16 mergeCustomExercises', () => {
  test('adds a custom Exercise to the library with no images or instructions', () => {
    const { library } = mergeCustomExercises([custom()], bundled().catalog, bundled().library)

    expect(library.get('custom-leg-sled')).toEqual({
      id: 'custom-leg-sled',
      name: 'Leg sled',
      force: null,
      level: 'beginner',
      mechanic: null,
      equipment: 'machine',
      primaryMuscles: ['quadriceps'],
      secondaryMuscles: ['glutes'],
      instructions: [],
      category: 'strength',
      images: [],
    })
  })

  test('adds a custom Exercise to the catalog with its weight step, Bodyweight flag, startWeight null and libraryId equal to its id', () => {
    const { catalog } = mergeCustomExercises(
      [custom({ bodyweight: true, weightStep: 1.25 })],
      bundled().catalog,
      bundled().library,
    )

    expect(catalog.get('custom-leg-sled')).toEqual({
      id: 'custom-leg-sled',
      name: 'Leg sled',
      weightStep: 1.25,
      startWeight: null,
      bodyweight: true,
      libraryId: 'custom-leg-sled',
    })
  })

  test('keeps every bundled entry and returns new maps, leaving the inputs untouched', () => {
    const { catalog, library } = bundled()

    const merged = mergeCustomExercises([custom()], catalog, library)

    expect(merged.catalog).not.toBe(catalog)
    expect(merged.library).not.toBe(library)
    expect(merged.catalog.get('bench')).toBe(catalog.get('bench'))
    expect(merged.library.get('Lib_Only')).toBe(library.get('Lib_Only'))
    expect(catalog.size).toBe(1)
    expect(library.size).toBe(2)
  })

  test('merges nothing when there are no custom Exercises', () => {
    const { catalog, library } = bundled()

    const merged = mergeCustomExercises([], catalog, library)

    expect([...merged.catalog.keys()]).toEqual(['bench'])
    expect([...merged.library.keys()]).toEqual(['Bench_Lib', 'Lib_Only'])
  })
})

describe('O17 mergeCustomExercises drops invalid Exercises', () => {
  test('a custom id equal to a catalog id is dropped and the bundled entry stands', () => {
    const { catalog, library } = bundled()

    const merged = mergeCustomExercises([custom({ id: 'bench', name: 'Mine' })], catalog, library)

    expect(merged.catalog.get('bench')).toBe(catalog.get('bench'))
    expect(merged.library.has('bench')).toBe(false)
  })

  test('a custom id equal to a library id is dropped and the bundled entry stands', () => {
    const { catalog, library } = bundled()

    const merged = mergeCustomExercises([custom({ id: 'Lib_Only', name: 'Mine' })], catalog, library)

    expect(merged.library.get('Lib_Only')).toBe(library.get('Lib_Only'))
    expect(merged.catalog.has('Lib_Only')).toBe(false)
  })

  test('an invalid Exercise is dropped while a valid one beside it is merged', () => {
    const merged = mergeCustomExercises(
      [custom({ id: 'bad', name: ' ' }), custom({ id: 'good' }), custom({ id: 'zero', weightStep: 0 })],
      bundled().catalog,
      bundled().library,
    )

    expect(merged.catalog.has('good')).toBe(true)
    expect(merged.library.has('good')).toBe(true)
    expect(merged.catalog.has('bad')).toBe(false)
    expect(merged.library.has('bad')).toBe(false)
    expect(merged.catalog.has('zero')).toBe(false)
  })
})

describe('O18 muscle counts through the merged library', () => {
  const entry = (overrides: Partial<SetEntry>): SetEntry => ({
    exerciseId: 'custom-leg-sled',
    setIndex: 1,
    weightKg: 100,
    reps: 10,
    loggedAt: 0,
    ...overrides,
  })

  test('Sets of a custom quadriceps Exercise count 1 each for quadriceps and 0.5 for its secondary', () => {
    const merged = mergeCustomExercises([custom()], bundled().catalog, bundled().library)
    const sets = [entry({ setIndex: 1 }), entry({ setIndex: 2 }), entry({ setIndex: 3 })]

    const counts = muscleSets(sets, (id) => merged.catalog.get(id), merged.library)

    expect(counts.get('quadriceps')).toBe(3)
    expect(counts.get('glutes')).toBe(1.5)
  })
})
