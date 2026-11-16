// V4-03: the Session summary's lines, worded once. "One win, one comparison, and what comes next":
//   prHeadline(records, resolve)                 -> the first PR as the headline, "+n more PR"
//   liftLine(exerciseId, session, all, ...)      -> "60×10 · 70×8 PR · 70×7 · 1 rep more than Mon 12 Oct"
//     (V5: its comparison is exerciseVerdict's `exerciseComparison`, the sentence the live
//     Session's done line ends with, so a lift reads the same on Rest and in the summary)
//   comparisonText(session, all, ...)            -> "vs Mon 12 Oct: volume +1.2 %", "5 of 23 sets"
//   workedToday(muscles)                         -> the non-zero muscles, most sets first
//   weekLine(session, all, program, weekStartsOn) -> "This week 3 of 3 · next up Workout A"
// Pure; imports only src/domain/** and src/types.ts.
import type { BodyLog, Muscle, Program, Session, SetEntry, Workout } from '../types'
import type { Resolve } from './muscles'
import { bodyweightOn } from './bodyLog'
import { formatDay } from './dates'
import { nextWorkout } from './shortSession'
import { exerciseComparison } from './exerciseVerdict'
import { workingSets } from './setKind'
import { formatSetCompact } from './setText'
import { humanDate, numberText, topText } from './stats/copy'
import { buildLiftHistories, leverOf, straightSets } from './stats/liftHistory'
import type { PlanOf } from './stats/liftHistory'
import { sessionMoves } from './stats/moves'
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

/** A Set's load and reps, as a SetFigure writes them. */
export type FigureSet = { weightKg: number | null; loadKg?: number; reps: number }

export type LiftLine = {
  /**
   * The working Sets in order, compact: `70×8`; `pr` on the Set that set the lift's record;
   * `set` its load and reps, for a SetFigure to write.
   */
  sets: { text: string; pr: boolean; set: FigureSet }[]
  /** How the lift compares with last time (`exerciseComparison`): `1 rep more than Mon 12 Oct`, `2 of 4 sets`. */
  tail: string
  /**
   * v7 (study §3 Numerals): the working Sets with the following Sets at the same load folded
   * into one figure, `46.25 × 9 · 8 · 8`: each group's first Set and the reps of the rest.
   */
  groups: { set: FigureSet; moreReps: number[] }[]
  /** v7 (study §1.6): the one ↑ / = / ↓ against last time (`liftVerdict`). */
  verdict: LiftVerdict
}

/**
 * v7 (study §1.6): a lift's one verdict against last time, a glyph and a few words:
 *   up      `↑ +2.5 kg`, `↑ +3 reps`, `↑ −5 kg assistance`
 *   same    `= same`
 *   down    `↓ −3 reps`, `↓ −2.5 kg`, `↓ +5 kg assistance`
 *   first   no last time (`First time`)
 *   partial fewer Sets than planned (`2 of 4 sets`): no comparison with a full lift
 *   deload  a deload Session (`Deload`)
 * The rule is `exerciseComparison`'s: the same load at every Set compares the reps; else the
 * top load, and with the same top load, the reps. `lastAt` is last time's start, null with none.
 */
export type LiftVerdict = {
  kind: 'up' | 'same' | 'down' | 'first' | 'partial' | 'deload'
  /** `↑`, `=`, `↓`; '' for first, partial and deload. */
  glyph: string
  text: string
  lastAt: number | null
}

type Compared = Pick<SetEntry, 'weightKg' | 'loadKg' | 'reps' | 'setIndex'>

const loadOfSet = (set: Pick<SetEntry, 'weightKg' | 'loadKg'>): number => set.weightKg ?? set.loadKg ?? 0
const kgText = (kg: number): string => numberText(Math.round(kg * 100) / 100)
const repsText = (n: number): string => `${numberText(n)} ${n === 1 ? 'rep' : 'reps'}`

export function liftVerdict(args: {
  today: Compared[]
  last: Compared[]
  lastAt: number | null
  plannedSets?: number
  deload?: boolean
}): LiftVerdict {
  const today = [...args.today].sort((a, b) => a.setIndex - b.setIndex)
  const last = [...args.last].sort((a, b) => a.setIndex - b.setIndex)
  const { lastAt } = args
  const quiet = (kind: 'first' | 'partial' | 'deload', text: string): LiftVerdict => ({ kind, glyph: '', text, lastAt })
  if (args.plannedSets !== undefined && today.length < args.plannedSets) {
    return quiet('partial', `${today.length} of ${args.plannedSets} sets`)
  }
  if (args.deload === true) return quiet('deload', 'Deload')
  if (last.length === 0 || today.length === 0) return quiet('first', 'First time')
  const reps = (sets: Compared[]): number => sets.reduce((sum, set) => sum + set.reps, 0)
  const byReps = (): LiftVerdict => {
    const diff = reps(today) - reps(last)
    if (diff === 0) return { kind: 'same', glyph: '=', text: 'same', lastAt }
    return diff > 0
      ? { kind: 'up', glyph: '↑', text: `+${repsText(diff)}`, lastAt }
      : { kind: 'down', glyph: '↓', text: `${MINUS}${repsText(-diff)}`, lastAt }
  }
  const sameLoads =
    today.length === last.length && today.every((set, at) => loadOfSet(set) === loadOfSet(last[at] as Compared))
  if (sameLoads) return byReps()
  const top = (sets: Compared[]): number => Math.max(...sets.map(loadOfSet))
  const kg = Math.round((top(today) - top(last)) * 1000) / 1000
  if (kg === 0) return byReps()
  const assisted =
    [...today, ...last].every((set) => set.weightKg === null && (set.loadKg ?? 0) <= 0) &&
    [...today, ...last].some((set) => (set.loadKg ?? 0) < 0)
  if (assisted) {
    return kg > 0
      ? { kind: 'up', glyph: '↑', text: `${MINUS}${kgText(kg)} kg assistance`, lastAt }
      : { kind: 'down', glyph: '↓', text: `+${kgText(-kg)} kg assistance`, lastAt }
  }
  return kg > 0
    ? { kind: 'up', glyph: '↑', text: `+${kgText(kg)} kg`, lastAt }
    : { kind: 'down', glyph: '↓', text: `${MINUS}${kgText(-kg)} kg`, lastAt }
}

/** Working Sets with the following Sets at the same load folded in: `46.25 × 9 · 8 · 8`. */
export function setGroups(sets: FigureSet[]): { set: FigureSet; moreReps: number[] }[] {
  const groups: { set: FigureSet; moreReps: number[] }[] = []
  for (const set of sets) {
    const open = groups[groups.length - 1]
    if (open !== undefined && open.set.weightKg === set.weightKg && open.set.loadKg === set.loadKg) {
      open.moreReps.push(set.reps)
    } else {
      groups.push({ set, moreReps: [] })
    }
  }
  return groups
}

const FULL_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const COUNT_WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten']

/** `Both lifts`, `All 7 lifts`. */
const allOf = (n: number): string => (n === 2 ? 'Both lifts' : `All ${n} lifts`)

/** `Wednesday` for a day 1 to 6 days before `at`; else `Wed 7 Oct`. */
export function referenceDay(lastAt: number, at: number): string {
  const startOf = (ms: number): number => {
    const d = new Date(ms)
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  }
  const days = Math.round((startOf(at) - startOf(lastAt)) / 86_400_000)
  return days >= 1 && days <= 6 ? FULL_DAYS[new Date(lastAt).getDay()] : humanDate(lastAt)
}

/**
 * v7 (study §1.6): the summary's verdict in one or two sentences, numbers first, no exclamation
 * marks. `lead` is the comparison ("5 of 7 lifts beat Wednesday.", "All 3 lifts beat Mon 5 Oct.",
 * "Deadlift beat Wednesday."), '' when no lift compares; `rest` the records ("Two records.") and
 * what dipped ("Narrow-grip pull-down dipped."). Lifts compared with different days say "last time".
 */
export function summaryVerdict(
  lifts: { name: string; verdict: LiftVerdict }[],
  records: number,
  at: number,
): { lead: string; rest: string } {
  const compared = lifts.filter((lift) => ['up', 'same', 'down'].includes(lift.verdict.kind))
  const days = [...new Set(compared.map((lift) => lift.verdict.lastAt))]
  const ref = days.length === 1 && days[0] !== null ? referenceDay(days[0], at) : 'last time'
  const up = compared.filter((lift) => lift.verdict.kind === 'up')
  const down = compared.filter((lift) => lift.verdict.kind === 'down')
  let lead = ''
  if (compared.length === 1) {
    const [only] = compared
    const verb = only.verdict.kind === 'up' ? 'beat' : only.verdict.kind === 'down' ? 'dipped from' : 'matched'
    lead = `${only.name} ${verb} ${ref}.`
  } else if (compared.length > 1) {
    lead =
      up.length === compared.length
        ? `${allOf(compared.length)} beat ${ref}.`
        : up.length === 0 && down.length === 0
          ? `${allOf(compared.length)} matched ${ref}.`
          : `${up.length} of ${compared.length} lifts beat ${ref}.`
  } else if (lifts.length > 0 && lifts.every((lift) => lift.verdict.kind === 'first')) {
    lead = 'First time for every lift.'
  } else if (lifts.length > 0 && lifts.every((lift) => lift.verdict.kind === 'deload')) {
    lead = 'A deload session.'
  }
  const parts: string[] = []
  if (records > 0) {
    const count = records < COUNT_WORDS.length ? COUNT_WORDS[records] : String(records)
    parts.push(`${count} ${records === 1 ? 'record' : 'records'}.`)
  }
  if (compared.length > 1 && down.length > 0) {
    parts.push(
      down.length <= 2 ? `${down.map((lift) => lift.name).join(' and ')} dipped.` : `${down.length} lifts dipped.`,
    )
  }
  return { lead, rest: parts.join(' ') }
}

/** V7R-02: the lifts that compare with last time, and how many of them beat it. */
export function liftsBeat(lifts: { verdict: LiftVerdict }[]): { up: number; of: number } {
  const compared = lifts.filter((lift) => ['up', 'same', 'down'].includes(lift.verdict.kind))
  return { up: compared.filter((lift) => lift.verdict.kind === 'up').length, of: compared.length }
}

export type SessionLift = { exerciseId: string; name: string; line: LiftLine }

/**
 * V7R-02: a finished Session lift by lift -- the one source of "n of m lifts beat last time" for
 * Home's Last time row and the Session summary. Each lift's `liftLine`, in the Workout's order;
 * a lift short of its planned Sets (following the Session's swaps) makes no comparison.
 * `sessions` holds the Session; later ones are ignored.
 */
export function sessionLifts(
  session: Session,
  sessions: Session[],
  resolve: Resolve,
  program: Program,
  planOf: PlanOf,
  records: SessionRecord[],
  workout?: Workout,
): SessionLift[] {
  const planned = workout ?? program.workouts.find((w) => w.id === session.workoutId)
  const plannedSetsOf = (exerciseId: string): number | undefined =>
    (planned?.exercises ?? []).find((plan) => (session.swaps?.[plan.exerciseId] ?? plan.exerciseId) === exerciseId)
      ?.sets
  return sessionMoves(session.id, sessions, resolve, program).map((move) => ({
    exerciseId: move.exerciseId,
    name: move.name,
    line: liftLine(move.exerciseId, session, sessions, resolve, planOf, records, plannedSetsOf(move.exerciseId)),
  }))
}

/** v7: what comes next, `Next: Workout A`; null with nothing due. */
export function nextLine(session: Session, sessions: Session[], program: Program): string | null {
  const upTo = sessions.filter((other) => other.deletedAt === undefined && other.startedAt <= session.startedAt)
  const next = nextWorkout(program, upTo)
  return next ? `Next: ${next.workout.name}` : null
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
  const sets = working.map((set, index) => ({
    text: formatSetCompact(set),
    pr: index === prIndex,
    set: { weightKg: set.weightKg, reps: set.reps, ...(set.loadKg === undefined ? {} : { loadKg: set.loadKg }) },
  }))
  const groups = setGroups(sets.map((entry) => entry.set))
  // V7R-02: a drop Set is shown but never compared (decision 0017: drop Sets set no records or
  // top sets), so "beat last time" reads the same on Home and in the summary.
  const compared = straightSets(working)
  if (working.length === 0) return { sets, tail: '', groups, verdict: liftVerdict({ today: [], last: [], lastAt: null }) }
  if (plannedSets !== undefined && compared.length < plannedSets) {
    return {
      sets,
      tail: exerciseComparison({ today: compared, last: [], lastDay: '', plannedSets }), // "2 of 4 sets"
      groups,
      verdict: liftVerdict({ today: compared, last: [], lastAt: null, plannedSets }),
    }
  }
  const live = sessions.filter((other) => other.deletedAt === undefined && other.startedAt <= session.startedAt)
  const points = buildLiftHistories(live, resolve, planOf).get(exerciseId)?.points ?? []
  const index = points.findIndex((point) => point.sessionId === session.id)
  if (index < 0) return { sets, tail: '', groups, verdict: liftVerdict({ today: compared, last: [], lastAt: null }) }
  const previous = points
    .slice(0, index)
    .reverse()
    .find((point) => !point.deload && point.top !== null)
  const lastCompared = previous === undefined ? [] : straightSets(workingSets(previous.workingSets))
  const tail = exerciseComparison({
    today: compared,
    last: lastCompared,
    lastDay: previous === undefined ? '' : formatDay(new Date(previous.startedAt), new Date(session.startedAt)),
    deload: points[index].deload,
  })
  const verdict = liftVerdict({
    today: compared,
    last: lastCompared,
    lastAt: previous === undefined ? null : previous.startedAt,
    deload: points[index].deload,
  })
  // V6-18: "3 fewer reps than Wed 7 Oct", from the one comparison sentence the Rest beat uses too.
  return { sets, tail, groups, verdict }
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
