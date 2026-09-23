import type { Exercise, LibraryExercise, Muscle, Session, SetEntry } from '../types'

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

/** `regionsFor`'s mapping, a clean bijection covering every `Region` value exactly once. */
const MUSCLE_REGIONS: Record<Muscle, Region[]> = {
  abdominals: ['abs', 'obliques'],
  abductors: ['abductors'],
  adductors: ['adductor'],
  biceps: ['biceps'],
  calves: ['calves'],
  chest: ['chest'],
  forearms: ['forearm'],
  glutes: ['gluteal'],
  hamstrings: ['hamstring'],
  lats: ['upper-back'],
  'lower back': ['lower-back'],
  'middle back': ['upper-back'],
  neck: ['neck'],
  quadriceps: ['quadriceps'],
  shoulders: ['front-deltoids', 'back-deltoids'],
  traps: ['trapezius'],
  triceps: ['triceps'],
}

/** Resolves a set entry's exercise and its library entry, or `undefined` when either is missing. */
function resolveLibraryExercise(
  entry: SetEntry,
  resolve: Resolve,
  library: Map<string, LibraryExercise>,
): { exercise: Exercise; libraryExercise: LibraryExercise } | undefined {
  const exercise = resolve(entry.exerciseId)
  if (!exercise) return undefined
  const libraryExercise = library.get(exercise.libraryId)
  if (!libraryExercise) return undefined
  return { exercise, libraryExercise }
}

/** Adds one set's muscle contribution (1 primary, 0.5 secondary) into `counts`. */
function accumulate(counts: Map<Muscle, number>, libraryExercise: LibraryExercise): void {
  for (const muscle of libraryExercise.primaryMuscles) {
    counts.set(muscle, (counts.get(muscle) ?? 0) + 1)
  }
  for (const muscle of libraryExercise.secondaryMuscles) {
    counts.set(muscle, (counts.get(muscle) ?? 0) + 0.5)
  }
}

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
 */
export function regionsFor(muscle: Muscle): Region[] {
  return MUSCLE_REGIONS[muscle]
}

/**
 * Counts sets per muscle: each set in `entries` adds 1 to its exercise's primary muscle(s) and
 * 0.5 to each secondary muscle, resolving `exerciseId` through `resolve` and `library`. An
 * entry whose id does not resolve to a library-linked exercise is skipped.
 */
export function muscleSets(
  entries: SetEntry[],
  resolve: Resolve,
  library: Map<string, LibraryExercise>,
): Map<Muscle, number> {
  const counts = new Map<Muscle, number>()
  for (const entry of entries) {
    const resolved = resolveLibraryExercise(entry, resolve, library)
    if (!resolved) continue
    accumulate(counts, resolved.libraryExercise)
  }
  return counts
}

/**
 * Like `muscleSets`, but only for sets logged in the 7 days up to `now` (`loggedAt >= now -
 * 7*24h`), across every session including one still in progress (`finishedAt: null`).
 */
export function weekSets(
  sessions: Session[],
  now: number,
  resolve: Resolve,
  library: Map<string, LibraryExercise>,
): Map<Muscle, number> {
  const windowStart = now - SEVEN_DAYS_MS
  const entries = sessions.flatMap((session) =>
    session.entries.filter((entry) => entry.loggedAt >= windowStart),
  )
  return muscleSets(entries, resolve, library)
}

/**
 * Turns per-muscle counts into per-region counts: a region's count is the sum, over every
 * muscle that `regionsFor` maps to it, of that muscle's count.
 */
export function toRegionCounts(counts: Map<Muscle, number>): Map<Region, number> {
  const regionCounts = new Map<Region, number>()
  for (const [muscle, count] of counts) {
    for (const region of regionsFor(muscle)) {
      regionCounts.set(region, (regionCounts.get(region) ?? 0) + count)
    }
  }
  return regionCounts
}

/**
 * The exercises contributing to `muscle`'s count within `entries`: one entry per resolved
 * exercise (via its library entry), with `sets` the same fractional 1/0.5 contribution toward
 * `muscle` specifically. Entries that do not resolve to a library-linked exercise are skipped.
 */
export function contributors(
  entries: SetEntry[],
  muscle: Muscle,
  resolve: Resolve,
  library: Map<string, LibraryExercise>,
): { exerciseId: string; name: string; sets: number }[] {
  const byExercise = new Map<string, { exerciseId: string; name: string; sets: number }>()
  for (const entry of entries) {
    const resolved = resolveLibraryExercise(entry, resolve, library)
    if (!resolved) continue
    const { exercise, libraryExercise } = resolved
    let contribution = 0
    if (libraryExercise.primaryMuscles.includes(muscle)) contribution += 1
    if (libraryExercise.secondaryMuscles.includes(muscle)) contribution += 0.5
    if (contribution === 0) continue

    const existing = byExercise.get(exercise.id)
    if (existing) {
      existing.sets += contribution
    } else {
      byExercise.set(exercise.id, { exerciseId: exercise.id, name: exercise.name, sets: contribution })
    }
  }
  return [...byExercise.values()]
}
