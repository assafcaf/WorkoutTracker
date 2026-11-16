import { buildLiftHistories } from './stats/liftHistory'
import type { LiftPoint } from './stats/liftHistory'
import { asPr, computeRecords, isRealRecord, REP_BEST } from './stats/records'
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

/** The same record: kind, Set and (for an e1RM PR) the estimate. */
function sameRecord(a: SessionRecord | null | undefined, b: SessionRecord): boolean {
  return (
    a !== null &&
    a !== undefined &&
    a.kind === b.kind &&
    a.lever === b.lever &&
    a.reps === b.reps &&
    a.e1rm === b.e1rm
  )
}

/**
 * The PR moment for `entry`, just logged into `session`: null unless the Set changes the lift's
 * PR for the Session (R-R: one per lift per Session; V6 `asPr`: a heavier weight or a better
 * estimated 1RM, named by its kind). A rep drop after a weight bump leaves the PR as it was, so it
 * has no moment; a rep best is `repBestMoment`'s.
 */
export function prMoment(
  exercise: Exercise,
  plan: ExercisePlan,
  earlier: Session[],
  session: Session,
  entry: SetEntry,
): PrMoment | null {
  const found = recordAt(exercise, plan, earlier, session, (at) => at <= entry.loggedAt)
  const after = found === undefined ? null : asPr(found)
  if (after === null) return null
  const prior = recordAt(exercise, plan, earlier, session, (at) => at < entry.loggedAt)
  if (sameRecord(prior === undefined ? null : asPr(prior), after)) return null
  return momentOf(exercise, plan, earlier, entry, after, `New PR · ${after.kind}`)
}

/**
 * V6 (V5-06): the quieter moment of a rep best: `entry` sets more reps at a weight already lifted
 * and is no PR. Title `Rep best`, detail `25 kg × 14 · +1 rep`. Null otherwise.
 */
export function repBestMoment(
  exercise: Exercise,
  plan: ExercisePlan,
  earlier: Session[],
  session: Session,
  entry: SetEntry,
): PrMoment | null {
  const after = recordAt(exercise, plan, earlier, session, (at) => at <= entry.loggedAt)
  if (after === undefined || isRealRecord(after)) return null
  const prior = recordAt(exercise, plan, earlier, session, (at) => at < entry.loggedAt)
  if (sameRecord(prior, after)) return null
  return momentOf(exercise, plan, earlier, entry, after, REP_BEST)
}

/** True when `entry` sets a PR (the one rule, `asPr`): the PR tag, sound and counts read this. */
export function isPrSet(
  exercise: Exercise,
  plan: ExercisePlan,
  earlier: Session[],
  session: Session,
  entry: SetEntry,
): boolean {
  return prMoment(exercise, plan, earlier, session, entry) !== null
}

/**
 * V7R-13: whether `entry` is the lift's one PR of the Session (decision 0017: one record per lift
 * per Session) -- the last of its Sets that set a PR when logged, which beats every earlier one.
 * 72.5 × 7 then 72.5 × 8 is one PR, on the 72.5 × 8; the live tags and counts read this, as the
 * summary's `sessionPrs` does.
 */
export function isSessionPrSet(
  exercise: Exercise,
  plan: ExercisePlan,
  earlier: Session[],
  session: Session,
  entry: SetEntry,
): boolean {
  if (!isPrSet(exercise, plan, earlier, session, entry)) return false
  return !session.entries.some(
    (other) =>
      other.exerciseId === entry.exerciseId &&
      other.setIndex !== entry.setIndex &&
      (other.loggedAt > entry.loggedAt || (other.loggedAt === entry.loggedAt && other.setIndex > entry.setIndex)) &&
      isPrSet(exercise, plan, earlier, session, other),
  )
}

function momentOf(
  exercise: Exercise,
  plan: ExercisePlan,
  earlier: Session[],
  entry: SetEntry,
  after: SessionRecord,
  title: string,
): PrMoment {
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
    title,
    detail: `${load}${gain}`,
    values: [...values, current],
    label: `${after.kind} history`,
  }
}
