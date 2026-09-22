import type { Exercise, Program } from '../types'

/**
 * The exercise catalog, keyed by exercise id, read from `src/data/exercises.json`.
 */
export function loadCatalog(): Map<string, Exercise> {
  throw new Error('loadCatalog is not implemented')
}

/**
 * Every program under `src/data/programs/`, validated against the catalog.
 *
 * Throws an Error naming the program id and the missing exerciseId when a plan references an
 * exercise the catalog does not define. Defaults to `loadCatalog()` when no catalog is given.
 */
export function loadPrograms(_catalog?: Map<string, Exercise>): Program[] {
  throw new Error('loadPrograms is not implemented')
}
