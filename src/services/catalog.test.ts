import { beforeEach, describe, expect, test, vi } from 'vitest'
import exercisesJson from '../data/exercises.json'
import { db } from '../storage/db'
import { getCustomExercises, setCustomExercises } from '../storage/settingsStore'
import { createChangeBus } from './changes'
import { ServiceError } from './errors'
import { assertPlansAreInCatalog } from '../data/catalog'
import { createCatalogService } from './catalog'
import type { CustomExercise, Exercise } from '../types'
import type { ServiceDeps } from './deps'

// O5: createCatalogService(deps) has exactly `load` and `resolve`. `load` returns what
// `App.tsx` loads (catalog, bundled programs already validated against it, library, videos);
// `resolve` answers `resolveExercise` once `load` has resolved.

const seeded = exercisesJson as Exercise[]

function deps(): ServiceDeps {
  return { now: () => 0, bus: createChangeBus(), storageAvailable: true }
}

test('O5 createCatalogService exposes exactly load and resolve', () => {
  const service = createCatalogService(deps())

  expect(Object.keys(service).sort()).toEqual(['load', 'resolve', 'saveCustomExercise'])
})

test('O5 load resolves the fourteen seeded catalog exercises keyed by id', async () => {
  const service = createCatalogService(deps())

  const { catalog } = await service.load()

  expect(catalog.size).toBe(14)
  expect(catalog.get('deadlift')?.name).toBe(seeded.find((e) => e.id === 'deadlift')?.name)
  expect(catalog.get('no-such-id')).toBeUndefined()
})

test('O5 load resolves both bundled programs, already validated against the catalog', async () => {
  const service = createCatalogService(deps())

  const { bundledPrograms, catalog } = await service.load()

  expect(bundledPrograms.map((p) => p.id).sort()).toEqual(['assaf-ab-2026', 'full-body-starter'])
  for (const program of bundledPrograms) {
    expect(() => assertPlansAreInCatalog(program, catalog)).not.toThrow()
  }
})

test('O5 load resolves the bundled library as an array, keyed the way loadLibrary hands it out', async () => {
  const service = createCatalogService(deps())

  const { library } = await service.load()

  expect(Array.isArray(library)).toBe(true)
  expect(library.some((entry) => entry.id === 'Barbell_Deadlift')).toBe(true)
})

test('O5 load resolves the harvested videos keyed by library id', async () => {
  const service = createCatalogService(deps())

  const { videos } = await service.load()

  expect(videos.get('Barbell_Deadlift')?.provider).toBe('youtube')
})

test('O5 resolve answers a catalog id with that catalog Exercise, once load has resolved', async () => {
  const service = createCatalogService(deps())
  await service.load()

  expect(service.resolve('deadlift')?.name).toBe(seeded.find((e) => e.id === 'deadlift')?.name)
})

test('O5 resolve answers a library-only id by building an Exercise from the library entry, keyed by that id', async () => {
  const service = createCatalogService(deps())
  await service.load()

  // '3_4_Sit-Up' is in src/data/library/exercises.json but no catalog exercise's libraryId
  // points at it (hand-checked against src/data/exercises.json).
  const resolved = service.resolve('3_4_Sit-Up')

  expect(resolved?.id).toBe('3_4_Sit-Up')
  expect(resolved?.libraryId).toBe('3_4_Sit-Up')
  expect(resolved?.name).toBe('3/4 Sit-Up')
})

test('O5 resolve answers null for an id in neither the catalog nor the library, once load has resolved', async () => {
  const service = createCatalogService(deps())
  await service.load()

  expect(service.resolve('no-such-id-anywhere')).toBeNull()
})

// O16/O17 (E19-T10): stored custom Exercises are merged by load; saveCustomExercise validates
// and writes the whole list once on the Preferences topic.

function mine(overrides: Partial<CustomExercise> = {}): CustomExercise {
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

describe('custom Exercises', () => {
  beforeEach(async () => {
    await db.open()
    await db.settings.clear()
  })

  test('O16 load lists a stored custom Exercise in library and catalog, and resolve answers it', async () => {
    await setCustomExercises([mine({ bodyweight: true, weightStep: 1.25 })], 1)
    const service = createCatalogService(deps())

    const { catalog, library } = await service.load()

    const entry = library.find((e) => e.id === 'custom-leg-sled')
    expect(entry?.name).toBe('Leg sled')
    expect(entry?.images).toEqual([])
    expect(entry?.instructions).toEqual([])
    expect(catalog.get('custom-leg-sled')).toEqual({
      id: 'custom-leg-sled',
      name: 'Leg sled',
      weightStep: 1.25,
      startWeight: null,
      bodyweight: true,
      libraryId: 'custom-leg-sled',
    })
    expect(service.resolve('custom-leg-sled')?.libraryId).toBe('custom-leg-sled')
  })

  test('O16 load without custom Exercises still answers the bundled catalog alone', async () => {
    const { catalog } = await createCatalogService(deps()).load()

    expect(catalog.size).toBe(14)
  })

  test('O17 load drops a stored custom Exercise whose id is a bundled catalog id', async () => {
    await setCustomExercises([mine({ id: 'deadlift', name: 'Mine' })], 1)
    const service = createCatalogService(deps())

    const { catalog } = await service.load()

    expect(catalog.get('deadlift')?.name).toBe(seeded.find((e) => e.id === 'deadlift')?.name)
  })

  test('O16 saveCustomExercise stores the Exercise and the next load lists it', async () => {
    const service = createCatalogService(deps())

    await service.saveCustomExercise(mine())

    expect(await getCustomExercises()).toEqual([mine()])
    const { catalog } = await createCatalogService(deps()).load()
    expect(catalog.has('custom-leg-sled')).toBe(true)
  })

  test('O17 a valid save is one write, announced once on the Preferences topic', async () => {
    const bus = createChangeBus()
    const fn = vi.fn()
    bus.subscribe('preferences', fn)
    const service = createCatalogService({ ...deps(), bus })

    await service.saveCustomExercise(mine())

    expect(fn).toHaveBeenCalledTimes(1)
  })

  test('O17 saving an existing id replaces it in place, keeping the order', async () => {
    const service = createCatalogService(deps())
    await service.saveCustomExercise(mine({ id: 'a', name: 'A' }))
    await service.saveCustomExercise(mine({ id: 'b', name: 'B' }))
    await service.saveCustomExercise(mine({ id: 'c', name: 'C' }))

    await service.saveCustomExercise(mine({ id: 'b', name: 'B renamed' }))

    expect((await getCustomExercises()).map((e) => [e.id, e.name])).toEqual([
      ['a', 'A'],
      ['b', 'B renamed'],
      ['c', 'C'],
    ])
  })

  test.each([
    ['an empty name', { name: '' }],
    ['no primary muscle', { primaryMuscles: [] }],
    ['a weight step of 0', { weightStep: 0 }],
    ['a negative weight step', { weightStep: -1 }],
    ['an id equal to a bundled catalog id', { id: 'deadlift' }],
    ['an id equal to a bundled library id', { id: '3_4_Sit-Up' }],
  ] as [string, Partial<CustomExercise>][])(
    'O17 saveCustomExercise refuses %s with a ServiceError, writing and announcing nothing',
    async (_n, overrides) => {
      const bus = createChangeBus()
      const fn = vi.fn()
      bus.subscribe('preferences', fn)
      const service = createCatalogService({ ...deps(), bus })

      await expect(service.saveCustomExercise(mine(overrides))).rejects.toBeInstanceOf(ServiceError)

      expect(await getCustomExercises()).toEqual([])
      expect(fn).not.toHaveBeenCalled()
    },
  )
})
