import type { ServiceDeps } from './deps'
import type { Exercise, LibraryExercise, Program, Video } from '../types'

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
}

/**
 * Builds the `CatalogService` over `src/data/catalog.ts`, `src/data/library.ts` and
 * `src/data/resolve.ts`: `load` loads the catalog, validates `assertPlansAreInCatalog` the way
 * `App.tsx` does, and loads the library and videos; `resolve` answers `resolveExercise` against
 * what `load` resolved, once it has.
 *
 * STUB (E11-T6 test-designer): not implemented yet.
 */
export function createCatalogService(deps: ServiceDeps): CatalogService {
  void deps
  throw new Error('not implemented')
}
