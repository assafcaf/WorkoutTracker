import type { ServiceDeps } from './deps'
import type { CustomExercise, Exercise, LibraryExercise, Program, Video } from '../types'
import { assertPlansAreInCatalog, loadCatalog, loadPrograms } from '../data/catalog'
import { loadLibrary, loadVideos } from '../data/library'
import { resolveExercise } from '../data/resolve'
import { mergeCustomExercises, validateCustomExercise } from '../domain/customExercises'
import { getCustomExercises, setCustomExercises } from '../storage/settingsStore'
import { ServiceError, callStorage } from './errors'

/** Everything `App.tsx` loads up front: the bundled catalog, programs, library and videos. */
export type CatalogData = {
  catalog: Map<string, Exercise>
  bundledPrograms: Program[]
  library: LibraryExercise[]
  videos: Map<string, Video>
}

/**
 * Loads the bundled catalog data, and resolves a catalog or library id to an `Exercise`
 * (E11-T6, O5).
 */
export type CatalogService = {
  load(): Promise<CatalogData>
  resolve(id: string): Exercise | null
  /** Validates and stores one custom Exercise, replacing the same id in place (E19-T10). */
  saveCustomExercise(exercise: CustomExercise): Promise<void>
}

/**
 * Builds the `CatalogService` over `src/data/catalog.ts`, `src/data/library.ts` and
 * `src/data/resolve.ts`: `load` loads the catalog, validates `assertPlansAreInCatalog` the way
 * `App.tsx` does, and loads the library and videos; `resolve` answers `resolveExercise` against
 * what `load` resolved, once it has.
 */
export function createCatalogService(deps: ServiceDeps): CatalogService {
  let catalog: Map<string, Exercise> | null = null
  let library: Map<string, LibraryExercise> | null = null

  return {
    async load(): Promise<CatalogData> {
      const bundledCatalog = loadCatalog()
      const bundledPrograms = loadPrograms(bundledCatalog)
      for (const program of bundledPrograms) assertPlansAreInCatalog(program, bundledCatalog)
      const bundledLibrary = await loadLibrary()
      const videos = await loadVideos()
      const custom = await callStorage(deps, getCustomExercises, 'custom exercises read failed')
      const { catalog: loadedCatalog, library: loadedLibrary } = mergeCustomExercises(
        custom,
        bundledCatalog,
        bundledLibrary,
      )

      catalog = loadedCatalog
      library = loadedLibrary

      return {
        catalog: loadedCatalog,
        bundledPrograms,
        library: [...loadedLibrary.values()],
        videos,
      }
    },
    resolve(id: string): Exercise | null {
      if (!catalog || !library) return null
      return resolveExercise(id, catalog, library) ?? null
    },
    async saveCustomExercise(exercise: CustomExercise): Promise<void> {
      const problem = validateCustomExercise(exercise, {
        catalog: loadCatalog(),
        library: await loadLibrary(),
      })
      if (problem !== null) throw new ServiceError('storage-failed', problem)
      await callStorage(
        deps,
        async () => {
          const stored = await getCustomExercises()
          const at = stored.findIndex((c) => c.id === exercise.id)
          const next = at === -1 ? [...stored, exercise] : stored.map((c, i) => (i === at ? exercise : c))
          await setCustomExercises(next, deps.now())
        },
        'custom exercise write failed',
      )
      deps.bus.emit('preferences')
    },
  }
}
