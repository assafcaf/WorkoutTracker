import { expect, test } from 'vitest'
import exercisesJson from './exercises.json'
import { assertCatalogInLibrary } from './catalog'
import { loadLibrary } from './library'
import type { Exercise, LibraryExercise, Muscle } from '../types'

// Hand-checked against E5-T1's Interfaces section (the Muscle union), not computed from the
// library data or from library.ts's own MUSCLES export.
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

// The catalog fixture, independent of loadCatalog(); every entry now carries a libraryId
// (E5-T1), per the mapping table in .work/plans/exercise-library.md.
const catalogSeed = exercisesJson as Exercise[]

function fixtureCatalog(overrides: Record<string, Partial<Exercise>> = {}): Map<string, Exercise> {
  return new Map(
    catalogSeed.map(
      (exercise) => [exercise.id, { ...exercise, ...overrides[exercise.id] }] as const,
    ),
  )
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

// Every one of the 14 catalog exercises' libraryId, per the mapping table.
const CATALOG_LIBRARY_IDS = catalogSeed.map((exercise) => exercise.libraryId)

test('L1 loadLibrary returns exactly 876 entries', async () => {
  const library = await loadLibrary()

  expect(library.size).toBe(876)
})

test('L1 loadLibrary keys each entry by its free-exercise-db id', async () => {
  const library = await loadLibrary()

  const squat = library.get('Barbell_Squat')
  expect(squat).toBeDefined()
  expect(squat?.id).toBe('Barbell_Squat')
  expect(squat?.name).toBe('Barbell Squat')
})

test('L1 loadLibrary gives every entry a name', async () => {
  const library = await loadLibrary()

  const missingName = [...library.values()].filter((e) => !e.name || e.name.trim() === '')
  expect(missingName.map((e) => e.id)).toEqual([])
})

test('L1 loadLibrary gives every entry a non-empty primaryMuscles', async () => {
  const library = await loadLibrary()

  const emptyPrimary = [...library.values()].filter((e) => e.primaryMuscles.length === 0)
  expect(emptyPrimary.map((e) => e.id)).toEqual([])
})

test('L1 loadLibrary gives every entry an instructions list', async () => {
  const library = await loadLibrary()

  const notAList = [...library.values()].filter((e) => !Array.isArray(e.instructions))
  expect(notAList.map((e) => e.id)).toEqual([])
})

test('L1 loadLibrary gives every entry zero to two photo paths', async () => {
  const library = await loadLibrary()

  const outOfRange = [...library.values()].filter(
    (e) => e.images.length < 0 || e.images.length > 2,
  )
  expect(outOfRange.map((e) => e.id)).toEqual([])
})

test('L1 loadLibrary keeps every primaryMuscles and secondaryMuscles value one of the 17 muscle names', async () => {
  const library = await loadLibrary()

  const offList = [...library.values()].flatMap((e) =>
    [...e.primaryMuscles, ...e.secondaryMuscles].filter(
      (muscle) => !SEVENTEEN_MUSCLES.includes(muscle),
    ),
  )
  expect(offList).toEqual([])
})

test('L1 loadLibrary gives Barbell_Squat quadriceps as its primary muscle', async () => {
  const library = await loadLibrary()

  expect(library.get('Barbell_Squat')?.primaryMuscles).toEqual(['quadriceps'])
})

test('L3 assertCatalogInLibrary throws naming the exercise id and the missing libraryId', () => {
  const catalog = fixtureCatalog({ 'back-squat': { libraryId: 'Not_A_Real_Library_Id' } })
  const library = fixtureLibrary(
    CATALOG_LIBRARY_IDS.filter((id) => id !== 'Not_A_Real_Library_Id'),
  )

  let thrown: unknown
  try {
    assertCatalogInLibrary(catalog, library)
  } catch (error) {
    thrown = error
  }

  expect(thrown).toBeInstanceOf(Error)
  expect((thrown as Error).message).toContain('back-squat')
  expect((thrown as Error).message).toContain('Not_A_Real_Library_Id')
})

test('L3 assertCatalogInLibrary throws naming the id and libraryId when the library is empty', () => {
  const catalog = fixtureCatalog()
  const library = new Map<string, LibraryExercise>()

  let thrown: unknown
  try {
    assertCatalogInLibrary(catalog, library)
  } catch (error) {
    thrown = error
  }

  expect(thrown).toBeInstanceOf(Error)
  expect((thrown as Error).message).toContain('back-squat')
  expect((thrown as Error).message).toContain('Barbell_Squat')
})

test('L3 assertCatalogInLibrary does not throw when every catalog libraryId is in the library', () => {
  const catalog = fixtureCatalog()
  const library = fixtureLibrary(CATALOG_LIBRARY_IDS)

  expect(() => assertCatalogInLibrary(catalog, library)).not.toThrow()
})
