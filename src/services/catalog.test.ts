import { expect, test } from 'vitest'
import exercisesJson from '../data/exercises.json'
import { createChangeBus } from './changes'
import { assertPlansAreInCatalog } from '../data/catalog'
import { createCatalogService } from './catalog'
import type { Exercise } from '../types'
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

  expect(Object.keys(service).sort()).toEqual(['load', 'resolve'])
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
