import { expect, test } from 'vitest'
import exercisesJson from './exercises.json'
import { loadLibrary } from './library'
import { resolveExercise } from './resolve'
import type { Exercise, LibraryExercise } from '../types'

// The catalog fixture, independent of loadCatalog() — per the fixture style already used in
// catalog.test.ts / library.test.ts.
const catalogSeed = exercisesJson as Exercise[]

function fixtureCatalog(): Map<string, Exercise> {
  return new Map(catalogSeed.map((exercise) => [exercise.id, exercise] as const))
}

function fixtureLibraryEntry(id: string, overrides: Partial<LibraryExercise> = {}): LibraryExercise {
  return {
    id,
    name: id,
    force: null,
    level: 'beginner',
    mechanic: null,
    equipment: null,
    primaryMuscles: ['chest'],
    secondaryMuscles: [],
    instructions: ['Do the exercise.'],
    category: 'strength',
    images: [],
    ...overrides,
  }
}

function fixtureLibrary(ids: string[]): Map<string, LibraryExercise> {
  return new Map(ids.map((id) => [id, fixtureLibraryEntry(id)] as const))
}

test('S5 resolveExercise returns the catalog Exercise for a catalog id', () => {
  const catalog = fixtureCatalog()
  const library = fixtureLibrary([])

  expect(resolveExercise('back-squat', catalog, library)).toEqual(catalog.get('back-squat'))
})

test('S5 resolveExercise builds an Exercise from a library entry, with id and libraryId equal to that library id', () => {
  const catalog = fixtureCatalog()
  const library = fixtureLibrary([]).set(
    'Hammer_Curls',
    fixtureLibraryEntry('Hammer_Curls', { name: 'Hammer Curls', equipment: 'dumbbell' }),
  )

  const resolved = resolveExercise('Hammer_Curls', catalog, library)

  expect(resolved).toEqual({
    id: 'Hammer_Curls',
    libraryId: 'Hammer_Curls',
    name: 'Hammer Curls',
    weightStep: 1,
    startWeight: 0,
    bodyweight: false,
    invertProgress: false,
  })
})

test('S5 resolveExercise returns undefined for an id in neither the catalog nor the library', () => {
  const catalog = fixtureCatalog()
  const library = fixtureLibrary(['Hammer_Curls'])

  expect(resolveExercise('Not_A_Real_Id', catalog, library)).toBeUndefined()
})

test('S5 no catalog id equals any library id', async () => {
  const catalogIds = catalogSeed.map((exercise) => exercise.id)
  const library = await loadLibrary()
  const libraryIds = [...library.keys()]

  const overlap = catalogIds.filter((id) => libraryIds.includes(id))

  expect(overlap).toEqual([])
})
