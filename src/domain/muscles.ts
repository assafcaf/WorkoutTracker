import type { Exercise, LibraryExercise, Muscle, Session, SetEntry } from '../types'

/** The body regions the drawing has (E5-T10+, see `.work/specs/2026-09-23-see-what-you-train.md`). */
export type Region =
  | 'trapezius'
  | 'upper-back'
  | 'lower-back'
  | 'chest'
  | 'biceps'
  | 'triceps'
  | 'forearm'
  | 'back-deltoids'
  | 'front-deltoids'
  | 'abs'
  | 'obliques'
  | 'adductor'
  | 'abductors'
  | 'hamstring'
  | 'quadriceps'
  | 'calves'
  | 'gluteal'
  | 'neck'

/** Resolves an id to the `Exercise` a set entry belongs to, or `undefined` when it does not. */
export type Resolve = (id: string) => Exercise | undefined

/**
 * The body region(s) that `muscle` maps to for drawing. Every one of the library's 17 muscles
 * maps to at least one region; `lats` and `middle back` both map to `upper-back`, `shoulders`
 * maps to `front-deltoids` and `back-deltoids`, and `abdominals` maps to `abs` and `obliques`.
 *
 * E5-T10 stub -- not yet implemented.
 */
export function regionsFor(_muscle: Muscle): Region[] {
  throw new Error('not implemented')
}

/**
 * Counts sets per muscle: each set in `entries` adds 1 to its exercise's primary muscle(s) and
 * 0.5 to each secondary muscle, resolving `exerciseId` through `resolve` and `library`. An
 * entry whose id does not resolve to a library-linked exercise is skipped.
 *
 * E5-T10 stub -- not yet implemented.
 */
export function muscleSets(
  _entries: SetEntry[],
  _resolve: Resolve,
  _library: Map<string, LibraryExercise>,
): Map<Muscle, number> {
  throw new Error('not implemented')
}

/**
 * Like `muscleSets`, but only for sets logged in the 7 days up to `now` (`loggedAt >= now -
 * 7*24h`), across every session including one still in progress (`finishedAt: null`).
 *
 * E5-T10 stub -- not yet implemented.
 */
export function weekSets(
  _sessions: Session[],
  _now: number,
  _resolve: Resolve,
  _library: Map<string, LibraryExercise>,
): Map<Muscle, number> {
  throw new Error('not implemented')
}

/**
 * Turns per-muscle counts into per-region counts: a region's count is the sum, over every
 * muscle that `regionsFor` maps to it, of that muscle's count.
 *
 * E5-T10 stub -- not yet implemented.
 */
export function toRegionCounts(_counts: Map<Muscle, number>): Map<Region, number> {
  throw new Error('not implemented')
}
