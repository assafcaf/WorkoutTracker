import { recordsFor, recordsSetBy } from './records'
import type { RecordKind } from './records'
import type { Exercise, ExercisePlan, Session, SetEntry } from '../types'

/** What the PR toast says about a Set that set a record (Progress Dashboard S5a). */
export type PrMoment = {
  /** "New PR · Heaviest set", every record's label joined with a comma. */
  title: string
  /** "62.5 kg × 8 · +2.5 kg": the Set, then how far past the old record the first one went. */
  detail: string
  /** The first record's best per earlier Session, oldest first, ending on today's. */
  values: number[]
  /** What `values` are, for a screen reader: "Heaviest set history". */
  label: string
}

/** The latest earlier Sessions the sparkline reaches back over, today's excluded. */
const SPARK_SESSIONS = 7

const UNITS: Record<RecordKind, 'kg' | 'reps'> = {
  'heaviest-set': 'kg',
  'best-e1rm': 'kg',
  'most-reps-at-weight': 'reps',
  'most-reps-in-a-set': 'reps',
  'heaviest-load': 'kg',
  'most-reps-at-load': 'reps',
}

/** A number as the app writes a weight: no trailing zeros, at most one decimal place. */
function plain(value: number): string {
  return String(Math.round(value * 10) / 10)
}

/**
 * The PR moment for `entry`, just logged into `session`: null when it sets no record. The
 * records are `recordsSetBy`'s, so a first-ever Session of the Exercise has none.
 */
export function prMoment(
  exercise: Exercise,
  plan: ExercisePlan,
  earlier: Session[],
  session: Session,
  entry: SetEntry,
): PrMoment | null {
  const records = recordsSetBy(exercise, plan, earlier, session, entry)
  if (records.length === 0) return null
  const first = records[0]
  const prior = session.entries.filter((candidate) => candidate.loggedAt < entry.loggedAt)
  const before = recordsFor(exercise, plan, [...earlier, { ...session, entries: prior }]).find(
    (record) => record.kind === first.kind,
  )
  const unit = UNITS[first.kind]
  const delta = before === undefined ? null : first.value - before.value
  const load =
    entry.weightKg === null
      ? entry.loadKg
        ? `BW${entry.loadKg > 0 ? '+' : ''}${plain(entry.loadKg)} × ${entry.reps}`
        : `${entry.reps} reps`
      : `${plain(entry.weightKg)} kg × ${entry.reps}`
  const gain = delta === null || delta <= 0 ? '' : ` · +${plain(delta)} ${unit}`

  const values = [...earlier]
    .sort((a, b) => a.startedAt - b.startedAt)
    .map((candidate) => recordsFor(exercise, plan, [candidate]).find((record) => record.kind === first.kind))
    .filter((record) => record !== undefined)
    .map((record) => record.value)
    .slice(-SPARK_SESSIONS)

  return {
    title: `New PR · ${records.map((record) => record.label).join(', ')}`,
    detail: `${load}${gain}`,
    values: [...values, first.value],
    label: `${first.label} history`,
  }
}
