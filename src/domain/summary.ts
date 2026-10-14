import { recordsFor, type ExerciseRecord, type RecordKind } from './records'
import type { Resolve } from './muscles'
import type { Exercise, ExercisePlan, Session, SetEntry } from '../types'
import { exerciseVolume, type ExerciseVolume } from './exerciseVolume'
import { workingSets } from './setKind'
import { sessionVolume } from './volume'

export type SessionSummaryStats = {
  durationMs: number
  volumeKg: number
  bodyweightReps: number
  /** `before` is each Exercise's records as they stood before this Session (E17 S5b's gains). */
  records: Array<{ exerciseId: string; name: string; records: ExerciseRecord[]; before: ExerciseRecord[] }>
}

export function summarize(
  session: Session,
  earlier: Session[],
  resolve: Resolve,
  planFor: (exerciseId: string) => ExercisePlan | undefined,
): SessionSummaryStats {
  const { kg, bodyweightReps } = sessionVolume(session, resolve)
  const records: SessionSummaryStats['records'] = []
  const seen = new Set<string>()

  for (const entry of session.entries) {
    const id = entry.exerciseId
    if (seen.has(id)) continue
    seen.add(id)

    const exercise = resolve(id)
    const plan = planFor(id)
    if (!exercise || !plan) continue
    if (!earlier.some((s) => s.entries.some((e) => e.exerciseId === id))) continue

    const before = recordsFor(exercise, plan, earlier)
    const changed = recordsFor(exercise, plan, [...earlier, session]).filter((after) => {
      const prev = before.find((r) => r.kind === after.kind)
      return !prev || prev.value !== after.value || prev.weightKg !== after.weightKg
    })
    if (changed.length > 0) records.push({ exerciseId: id, name: exercise.name, records: changed, before })
  }

  return {
    durationMs: (session.finishedAt ?? session.startedAt) - session.startedAt,
    volumeKg: kg,
    bodyweightReps,
    records,
  }
}

/** How many records the Session set, over every Exercise: the summary's and the list's `PR` count. */
export function recordCount(stats: SessionSummaryStats): number {
  return stats.records.reduce((total, entry) => total + entry.records.length, 0)
}

/** The latest finished Session of `session`'s own Workout among `earlier`, if there is one. */
export function previousOfWorkout(session: Session, earlier: Session[]): Session | undefined {
  return earlier
    .filter(
      (other) =>
        other.id !== session.id &&
        other.finishedAt !== null &&
        other.programId === session.programId &&
        other.workoutId === session.workoutId &&
        other.startedAt < session.startedAt,
    )
    .sort((a, b) => b.startedAt - a.startedAt)[0]
}

/** `today` against `before` as a signed percentage to one decimal (`4.6`); null with no base. */
export function percentChange(today: number, before: number): number | null {
  if (before <= 0) return null
  return Math.round(((today - before) / before) * 1000) / 10
}

/**
 * How far `record` moved past the same kind in `before`: kg for a weight, load or e1RM record,
 * reps for a reps record. Null when there was no earlier record of that kind.
 */
export function recordGain(
  record: ExerciseRecord,
  before: ExerciseRecord[],
): { amount: number; unit: 'kg' | 'reps' } | null {
  const prev = before.find((candidate) => candidate.kind === record.kind)
  if (!prev) return null
  const reps = record.kind === 'most-reps-at-weight' || record.kind === 'most-reps-in-a-set' || record.kind === 'most-reps-at-load'
  return { amount: Math.round((record.value - prev.value) * 10) / 10, unit: reps ? 'reps' : 'kg' }
}

/**
 * The value `kind` reached in each Session holding `exercise`, oldest first, the last `limit`
 * of them: the points a record row's sparkline draws.
 */
export function recordTrend(
  exercise: Exercise,
  plan: ExercisePlan,
  kind: RecordKind,
  sessions: Session[],
  limit = 6,
): number[] {
  const values = [...sessions]
    .sort((a, b) => a.startedAt - b.startedAt)
    .map((session) => recordsFor(exercise, plan, [session]).find((record) => record.kind === kind)?.value)
    .filter((value): value is number => value !== undefined)
  return values.slice(-limit)
}

export type ExerciseRow = {
  exerciseId: string
  name: string
  /** The heaviest working Set (the most reps among equals); null with only warm-ups logged. */
  best: SetEntry | null
  volume: ExerciseVolume
  /** Volume against the latest earlier Session holding the Exercise, in `volume.unit`. */
  delta: number | null
}

/** A Set's load for ranking: its weight, else its signed Bodyweight load, else 0. */
function loadOf(entry: SetEntry): number {
  return entry.weightKg ?? entry.loadKg ?? 0
}

/**
 * One row per Exercise the Session logged, in the order first logged: its best Set, its volume
 * (`exerciseVolume`) and the change from the latest finished earlier Session that held it.
 * An id `resolve` does not answer is left out.
 */
export function exerciseRows(session: Session, earlier: Session[], resolve: Resolve): ExerciseRow[] {
  const order: string[] = []
  for (const entry of session.entries) {
    if (!order.includes(entry.exerciseId)) order.push(entry.exerciseId)
  }

  const rows: ExerciseRow[] = []
  for (const id of order) {
    const exercise = resolve(id)
    if (!exercise) continue
    const own = workingSets(session.entries).filter((entry) => entry.exerciseId === id)
    const best = own.reduce<SetEntry | null>((top, entry) => {
      if (!top) return entry
      const diff = loadOf(entry) - loadOf(top)
      return diff > 0 || (diff === 0 && entry.reps > top.reps) ? entry : top
    }, null)
    const volume = exerciseVolume(exercise, session.entries)
    const last = earlier
      .filter(
        (other) =>
          other.id !== session.id &&
          other.finishedAt !== null &&
          other.startedAt < session.startedAt &&
          workingSets(other.entries).some((entry) => entry.exerciseId === id),
      )
      .sort((a, b) => b.startedAt - a.startedAt)[0]
    const delta = last
      ? Math.round((volume.amount - exerciseVolume(exercise, last.entries).amount) * 10) / 10
      : null
    rows.push({ exerciseId: id, name: exercise.name, best, volume, delta })
  }
  return rows
}
