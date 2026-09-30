import { epley } from './series'
import { countsTowardStats } from './setKind'
import type { Exercise, ExercisePlan, Session, SetEntry } from '../types'

export type RecordKind =
  | 'heaviest-set'
  | 'best-e1rm'
  | 'most-reps-at-weight'
  | 'lowest-assistance'
  | 'most-reps-in-a-set'
  | 'heaviest-load'
  | 'most-reps-at-load'

export type ExerciseRecord = {
  kind: RecordKind
  label: string
  value: number
  weightKg: number | null
  reps: number
  at: number
}

const LABELS: Record<RecordKind, string> = {
  'heaviest-set': 'Heaviest set',
  'best-e1rm': 'Best estimated 1RM',
  'most-reps-at-weight': 'Most reps at the heaviest weight',
  'lowest-assistance': 'Lowest assistance at target reps',
  'most-reps-in-a-set': 'Most reps in a set',
  'heaviest-load': 'Heaviest load',
  'most-reps-at-load': 'Most reps at the heaviest load',
}

type Candidate = { weightKg: number | null; reps: number; at: number; value: number }

/** The candidate with the highest `value`. Ties go to the earliest `at`. */
function best(candidates: Candidate[]): Candidate | null {
  if (candidates.length === 0) return null
  const sorted = [...candidates].sort((a, b) => a.at - b.at)
  return sorted.reduce((acc, c) => (c.value > acc.value ? c : acc))
}

function toRecord(kind: RecordKind, candidate: Candidate): ExerciseRecord {
  return {
    kind,
    label: LABELS[kind],
    value: candidate.value,
    weightKg: candidate.weightKg,
    reps: candidate.reps,
    at: candidate.at,
  }
}

export function recordsFor(
  exercise: Exercise,
  plan: ExercisePlan,
  sessions: Session[],
): ExerciseRecord[] {
  const sets = sessions.flatMap((session) =>
    session.entries
      .filter((entry) => entry.exerciseId === exercise.id && countsTowardStats(entry))
      .map((entry) => ({ weightKg: entry.weightKg, reps: entry.reps, at: session.startedAt })),
  )

  if (exercise.invertProgress) {
    const candidates: Candidate[] = sets
      .filter((set) => set.weightKg !== null && set.reps >= plan.repRange[1])
      .map((set) => ({ ...set, value: -(set.weightKg as number) }))
    const winner = best(candidates)
    if (!winner) return []
    return [toRecord('lowest-assistance', { ...winner, value: -winner.value })]
  }

  if (exercise.bodyweight) {
    const candidates: Candidate[] = sets.map((set) => ({ ...set, value: set.reps }))
    const winner = best(candidates)
    if (!winner) return []
    return [toRecord('most-reps-in-a-set', winner)]
  }

  const loadedSets = sets.filter((set) => set.weightKg !== null)
  const heaviest = best(loadedSets.map((set) => ({ ...set, value: set.weightKg as number })))
  if (!heaviest) return []

  const e1rm = best(
    loadedSets.map((set) => ({ ...set, value: epley(set.weightKg as number, set.reps) })),
  )
  const mostRepsAtWeight = best(
    loadedSets
      .filter((set) => set.weightKg === heaviest.weightKg)
      .map((set) => ({ ...set, value: set.reps })),
  )

  return [
    toRecord('heaviest-set', heaviest),
    toRecord('best-e1rm', e1rm as Candidate),
    toRecord('most-reps-at-weight', mostRepsAtWeight as Candidate),
  ]
}

/**
 * The records `entry` sets: those `recordsFor` changes when `entry` is added to everything
 * logged before it (earlier Sessions plus this Session's Sets with a smaller `loggedAt`).
 * Nothing when no earlier Session holds the Exercise.
 */
export function recordsSetBy(
  exercise: Exercise,
  plan: ExercisePlan,
  earlier: Session[],
  session: Session,
  entry: SetEntry,
): ExerciseRecord[] {
  if (!earlier.some((s) => s.entries.some((e) => e.exerciseId === exercise.id))) return []
  const prior = session.entries.filter((e) => e.loggedAt < entry.loggedAt)
  const before = recordsFor(exercise, plan, [...earlier, { ...session, entries: prior }])
  const after = recordsFor(exercise, plan, [...earlier, { ...session, entries: [...prior, entry] }])
  return after.filter((a) => {
    const b = before.find((r) => r.kind === a.kind)
    return !b || b.value !== a.value || b.weightKg !== a.weightKg || b.reps !== a.reps
  })
}
