// V4-03: the Session summary's lines, worded once. "One win, one comparison, and what comes next":
//   prHeadline(records, resolve)                 -> the first PR as the headline, "+n more PR"
//   liftLine(exerciseId, session, all, ...)      -> "60×10 · 70×8 PR · 70×7 · 1 rep more than Mon 12 Oct"
//     (V5: its comparison is exerciseVerdict's `exerciseComparison`, the sentence the live
//     Session's done line ends with, so a lift reads the same on Rest and in the summary)
//   comparisonText(session, all, ...)            -> "vs Mon 12 Oct: volume +1.2 %", "5 of 23 sets"
//   workedToday(muscles)                         -> the non-zero muscles, most sets first
//   weekLine(session, all, program, weekStartsOn) -> "This week 3 of 3 · next up Workout A"
// Pure; imports only src/domain/** and src/types.ts.
import type { BodyLog, Muscle, Program, Session } from '../types'
import type { Resolve } from './muscles'
import { bodyweightOn } from './bodyLog'
import { formatDay } from './dates'
import { nextWorkout } from './shortSession'
import { exerciseComparison } from './exerciseVerdict'
import { workingSets } from './setKind'
import { formatSetCompact } from './setText'
import { humanDate, numberText, topText } from './stats/copy'
import { buildLiftHistories, leverOf } from './stats/liftHistory'
import type { PlanOf } from './stats/liftHistory'
import { STATS_MUSCLES } from './stats/muscles'
import type { SessionRecord } from './stats/records'
import { thisWeek } from './stats/weeks'
import type { Weekday } from './stats/weeks'
import { sessionVolume } from './volume'

const MINUS = '−'

const plural = (n: number, one: string, many: string): string => `${numberText(n)} ${n === 1 ? one : many}`

/** A record's gain in words: `+1 rep`, `+2 reps`, `+5 kg`, `−5 kg assistance`; '' when none. */
export function recordGainText(record: Pick<SessionRecord, 'kind' | 'gain'>): string {
  const amount = Math.round(record.gain * 10) / 10
  if (amount <= 0) return ''
  if (record.kind === 'Rep record') return `+${plural(amount, 'rep', 'reps')}`
  if (record.kind === 'Least assistance') return `${MINUS}${numberText(amount)} kg assistance`
  return `+${numberText(amount)} kg`
}

/**
 * The summary's one win: the Session's first PR, "Deadlift 70 kg × 8 · rep record, +1 rep", and
 * "+1 more PR" / "+2 more PRs" when there are others. Null with no PR.
 */
export function prHeadline(
  records: SessionRecord[],
  resolve: Resolve,
): { text: string; more: string | null } | null {
  const first = records[0]
  if (first === undefined) return null
  const exercise = resolve(first.exerciseId)
  const name = exercise?.name ?? first.exerciseId
  const set = topText({ lever: first.lever, reps: first.reps }, exercise?.bodyweight === true)
  const kind = first.kind.charAt(0).toLowerCase() + first.kind.slice(1)
  const gain = recordGainText(first)
  const others = records.length - 1
  return {
    text: `${name} ${set} · ${kind}${gain === '' ? '' : `, ${gain}`}`,
    more: others > 0 ? `+${others} more ${others === 1 ? 'PR' : 'PRs'}` : null,
  }
}

export type LiftLine = {
  /** The working Sets in order, compact: `70×8`; `pr` on the Set that set the lift's record. */
  sets: { text: string; pr: boolean }[]
  /** How the lift compares with last time (`exerciseComparison`): `1 rep more than Mon 12 Oct`, `2 of 4 sets`. */
  tail: string
}

/** A LiftLine as one plain sentence: `60×10 · 70×8 PR · 70×7 · 1 rep more than Mon 12 Oct`. */
export function liftLineText(line: LiftLine): string {
  return [...line.sets.map((set) => (set.pr ? `${set.text} PR` : set.text)), line.tail]
    .filter((part) => part !== '')
    .join(' · ')
}

/**
 * One lift's Lift by lift sentence: its working Sets, the PR tag on the Set that set its record,
 * then one comparison with the lift's last non-deload Session, worded by `exerciseComparison` as
 * the live Session words it: "1 rep more than Mon 12 Oct", never totals and never "record". A
 * lift with fewer working Sets than `plannedSets` makes no comparison: "2 of 4 sets".
 */
export function liftLine(
  exerciseId: string,
  session: Session,
  sessions: Session[],
  resolve: Resolve,
  planOf: PlanOf,
  records: SessionRecord[],
  plannedSets?: number,
): LiftLine {
  const exercise = resolve(exerciseId)
  const bodyweight = exercise?.bodyweight === true
  const working = workingSets(session.entries.filter((entry) => entry.exerciseId === exerciseId)).sort(
    (a, b) => a.setIndex - b.setIndex,
  )
  const record = records.find((found) => found.exerciseId === exerciseId && found.sessionId === session.id)
  const prIndex =
    record === undefined
      ? -1
      : working.findIndex(
          (set) => set.kind !== 'drop' && leverOf(set, bodyweight) === record.lever && set.reps === record.reps,
        )
  const sets = working.map((set, index) => ({ text: formatSetCompact(set), pr: index === prIndex }))
  if (working.length === 0) return { sets, tail: '' }
  if (plannedSets !== undefined && working.length < plannedSets) {
    return { sets, tail: exerciseComparison({ today: working, last: [], lastDay: '', plannedSets }) } // "2 of 4 sets"
  }
  const live = sessions.filter((other) => other.deletedAt === undefined && other.startedAt <= session.startedAt)
  const points = buildLiftHistories(live, resolve, planOf).get(exerciseId)?.points ?? []
  const index = points.findIndex((point) => point.sessionId === session.id)
  if (index < 0) return { sets, tail: '' }
  const previous = points
    .slice(0, index)
    .reverse()
    .find((point) => !point.deload && point.top !== null)
  const tail = exerciseComparison({
    today: working,
    last: previous === undefined ? [] : workingSets(previous.workingSets),
    lastDay: previous === undefined ? '' : formatDay(new Date(previous.startedAt), new Date(session.startedAt)),
    deload: points[index].deload,
  })
  return { sets, tail: plainFewer(tail) }
}

/** V6-18: "3 reps under Wed 7 Oct" said plainly in the summary: "3 fewer reps than Wed 7 Oct". */
function plainFewer(tail: string): string {
  return tail.replace(/^(\d+) (reps?) under (.+)$/, (_, n: string, word: string, day: string) => `${n} fewer ${word} than ${day}`)
}

/**
 * The comparison with the last Session of the same Workout: "vs Mon 12 Oct: volume +1.2 %". A
 * Session that logged fewer working Sets than its Workout plans (V2-10) is not compared:
 * "5 of 23 sets". Null when there is nothing to say.
 */
export function comparisonText(
  session: Session,
  sessions: Session[],
  resolve: Resolve,
  plannedSets: number,
  log: BodyLog = [],
): string | null {
  const working = workingSets(session.entries).length
  if (plannedSets > 0 && working < plannedSets) return `${working} of ${plannedSets} sets`
  const previous = sessions
    .filter(
      (other) =>
        other.deletedAt === undefined &&
        other.id !== session.id &&
        other.programId === session.programId &&
        other.workoutId === session.workoutId &&
        other.startedAt < session.startedAt,
    )
    .sort((a, b) => b.startedAt - a.startedAt)[0]
  if (previous === undefined) return null
  const volume = (of: Session): number =>
    sessionVolume(of, resolve, bodyweightOn(log, of.startedAt)?.kg ?? null).kg
  const before = volume(previous)
  if (before <= 0) return null
  const pct = Math.round(((volume(session) - before) / before) * 1000) / 10
  const change = pct === 0 ? 'same' : `${pct > 0 ? '+' : MINUS}${numberText(Math.abs(pct))} %`
  return `vs ${humanDate(previous.startedAt)}: volume ${change}`
}

/** Worked today as one line: the muscles with sets, most first, ties in the Progress order. */
export function workedToday(muscles: Map<Muscle, number>): { muscle: Muscle; count: number }[] {
  return STATS_MUSCLES.map((muscle) => ({ muscle, count: muscles.get(muscle) ?? 0 }))
    .filter((row) => row.count > 0)
    .sort((a, b) => b.count - a.count)
}

/**
 * "This week 3 of 3 · next up Workout A": the Sessions in the Session's week so far against the
 * Program's weekly frequency, and the Workout Train would put up next (`dueWorkout`). Weekly,
 * never a streak.
 */
export function weekLine(
  session: Session,
  sessions: Session[],
  program: Program,
  weekStartsOn: Weekday = 1,
): string {
  const upTo = sessions.filter((other) => other.deletedAt === undefined && other.startedAt <= session.startedAt)
  const week = thisWeek(upTo, session.startedAt, program.sessionsPerWeek, weekStartsOn)
  const tally = week.planned > 0 ? `${week.done} of ${week.planned}` : String(week.done)
  const next = nextWorkout(program, upTo)
  return `This week ${tally}${next ? ` · next up ${next.workout.name}` : ''}`
}
