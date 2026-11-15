import type { Exercise, Session, SetEntry } from '../types'
import { countsTowardStats } from './setKind'

/** One row of the Exercises tab's "My lifts" (V6-03). */
export type MyLift = {
  exerciseId: string
  name: string
  /** When the latest finished Session that logged it started; null when it never was. */
  lastAt: number | null
  /** That Session's top working Set (heaviest, then most reps); null when never logged. */
  top: SetEntry | null
}

/** What a Set lifted, for picking the top one: the weight, else a Bodyweight Set's Load. */
function heft(entry: SetEntry): number {
  return entry.weightKg ?? entry.loadKg ?? 0
}

function topSet(entries: SetEntry[]): SetEntry | null {
  const working = entries.filter(countsTowardStats)
  const pool = working.length > 0 ? working : entries
  let best: SetEntry | null = null
  for (const entry of pool) {
    if (best === null || heft(entry) > heft(best) || (heft(entry) === heft(best) && entry.reps > best.reps)) {
      best = entry
    }
  }
  return best
}

/**
 * The lifter's own lifts (V6-03 step 3): every Exercise in `planIds` (the active Program's) and
 * every Exercise a finished Session logged, that `resolve` answers. Logged ones come first, the
 * most recently logged first; never-logged Program Exercises follow in `planIds` order.
 */
export function myLifts(
  planIds: string[],
  sessions: Session[],
  resolve: (id: string) => Exercise | undefined,
): MyLift[] {
  const latest = new Map<string, Session>()
  for (const session of sessions) {
    if (session.finishedAt === null) continue
    for (const entry of session.entries) {
      const held = latest.get(entry.exerciseId)
      if (!held || session.startedAt > held.startedAt) latest.set(entry.exerciseId, session)
    }
  }

  const logged: MyLift[] = []
  for (const [exerciseId, session] of latest) {
    const exercise = resolve(exerciseId)
    if (!exercise) continue
    logged.push({
      exerciseId,
      name: exercise.name,
      lastAt: session.startedAt,
      top: topSet(session.entries.filter((entry) => entry.exerciseId === exerciseId)),
    })
  }
  logged.sort((one, other) => (other.lastAt ?? 0) - (one.lastAt ?? 0))

  const never: MyLift[] = []
  for (const exerciseId of planIds) {
    if (latest.has(exerciseId) || never.some((lift) => lift.exerciseId === exerciseId)) continue
    const exercise = resolve(exerciseId)
    if (exercise) never.push({ exerciseId, name: exercise.name, lastAt: null, top: null })
  }
  return [...logged, ...never]
}
