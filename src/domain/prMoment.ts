import { buildLiftHistories } from './stats/liftHistory'
import type { LiftPoint } from './stats/liftHistory'
import { computeRecords } from './stats/records'
import type { RecordKindName, SessionRecord } from './stats/records'
import type { Exercise, ExercisePlan, Session, SetEntry } from '../types'

/** What the PR toast says about a Set that set a record (Progress Dashboard S5a). */
export type PrMoment = {
  /** "New PR · Heaviest weight": the Session's one record, named by its R-R kind. */
  title: string
  /** "62.5 kg × 8 · +2.5 kg": the Set, then how far past the old record it went. */
  detail: string
  /** The record's measure per earlier Session, oldest first, ending on today's. */
  values: number[]
  /** What `values` are, for a screen reader: "Heaviest weight history". */
  label: string
}

/** The latest earlier Sessions the sparkline reaches back over, today's excluded. */
const SPARK_SESSIONS = 7

const UNITS: Record<RecordKindName, 'kg' | 'reps'> = {
  'Heaviest weight': 'kg',
  'Least assistance': 'kg',
  'First added load': 'kg',
  'Rep record': 'reps',
  'Estimated 1RM': 'kg',
}

/** A number as the app writes a weight: no trailing zeros, at most one decimal place. */
function plain(value: number): string {
  return String(Math.round(value * 10) / 10)
}

/** The lift's R-R record in `session`, counting only the Sets whose time `until` accepts. */
function recordAt(
  exercise: Exercise,
  plan: ExercisePlan,
  earlier: Session[],
  session: Session,
  until: (loggedAt: number) => boolean,
): SessionRecord | undefined {
  const entries = session.entries.filter((candidate) => until(candidate.loggedAt))
  return computeRecords(
    [...earlier, { ...session, entries }],
    (id) => (id === exercise.id ? exercise : undefined),
    (id) => (id === exercise.id ? plan : undefined),
  ).find((record) => record.sessionId === session.id && record.exerciseId === exercise.id)
}

/**
 * The PR moment for `entry`, just logged into `session`: null unless the Set changes the lift's
 * record for the Session (R-R: one per lift per Session, named by its kind). A rep drop after a
 * weight bump leaves the record as it was, so it has no moment.
 */
export function prMoment(
  exercise: Exercise,
  plan: ExercisePlan,
  earlier: Session[],
  session: Session,
  entry: SetEntry,
): PrMoment | null {
  const after = recordAt(exercise, plan, earlier, session, (at) => at <= entry.loggedAt)
  if (after === undefined) return null
  const before = recordAt(exercise, plan, earlier, session, (at) => at < entry.loggedAt)
  if (
    before !== undefined &&
    before.kind === after.kind &&
    before.lever === after.lever &&
    before.reps === after.reps
  ) {
    return null
  }
  const unit = UNITS[after.kind]
  const load =
    entry.weightKg === null
      ? entry.loadKg
        ? `BW${entry.loadKg > 0 ? '+' : ''}${plain(entry.loadKg)} × ${entry.reps}`
        : `${entry.reps} reps`
      : `${plain(entry.weightKg)} kg × ${entry.reps}`
  const amount = plain(after.gain)
  const gain =
    after.gain <= 0
      ? ''
      : unit === 'reps'
        ? ` · +${amount} ${after.gain === 1 ? 'rep' : 'reps'}`
        : ` · +${amount} kg`

  const history = buildLiftHistories(
    earlier,
    (id) => (id === exercise.id ? exercise : undefined),
    (id) => (id === exercise.id ? plan : undefined),
  ).get(exercise.id)
  const measure = (point: LiftPoint): number | null =>
    after.kind === 'Rep record'
      ? (point.top?.reps ?? null)
      : after.kind === 'Estimated 1RM'
        ? point.e1rm
        : (point.top?.lever ?? null)
  const values = (history?.points ?? [])
    .filter((point) => !point.deload)
    .map(measure)
    .filter((value): value is number => value !== null)
    .slice(-SPARK_SESSIONS)
  const current =
    after.kind === 'Rep record'
      ? after.reps
      : after.kind === 'Estimated 1RM'
        ? (after.e1rm ?? after.lever)
        : after.lever

  return {
    title: `New PR · ${after.kind}`,
    detail: `${load}${gain}`,
    values: [...values, current],
    label: `${after.kind} history`,
  }
}
