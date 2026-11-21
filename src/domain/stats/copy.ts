// E18-T7 [O11 O18 R-C], v6 [V5-03]: every generated sentence of the stats screens, from engine
// values only. Pure; imports only src/domain/** and src/types.ts.
//
//   leverText / topText / humanDate / numberText -> re-exported from words.ts
//   verdictLabel(kind)                -> '▲ Moving' | '■ Flat' | '▼ Slipping' | '○ Too new' (the
//                                        engine's verdict; the screens show status.ts labels)
//   nextStepText(step, bodyweight)    -> '15 of 20 reps at 62.5 kg'
//   suggestionText(step, bodyweight)  -> 'Try 15 kg next' | 'Try one more set next' | null
//   compareText(compare, bodyweight)  -> '13 × 9 → 13 × 9 · no change' | null
//   homeCopy(program, sessions, resolve, now) -> HomeCopy (v6: every status from status.ts)
import type { Exercise, ExercisePlan, Program, Session } from '../../types'
import type { Resolve } from '../muscles'
import type { Compare } from './ladder'
import { deloadWeight } from '../deload'
import { buildLiftHistories } from './liftHistory'
import type { LiftHistory, LiftPoint } from './liftHistory'
import { STATUS_GLYPHS, STATUS_LABELS, calendarDays, liftStatuses } from './status'
import type { LiftStatus, LiftStatusKind } from './status'
import { computeRecords } from './records'
import { stepsClimbed, verdicts } from './verdict'
import type { NextStep, VerdictKind } from './verdict'
import { thisWeek } from './weeks'
import type { Weekday } from './weeks'
import { humanDate, leverText, numberText, plural, topText } from './words'

export { humanDate, leverText, numberText, topText, weekdayName } from './words'

export type HomeStage = 'empty' | 'starting' | 'early' | 'full'

/** A "Needs a decision" card: one lift's status, exactly as `liftStatus` words it. */
export type AttentionCard = {
  exerciseId: string
  kind: LiftStatusKind
  /** `Ready`, `Lowered`, … */
  label: string
  /** `↑`, `↓`, … */
  glyph: string
  /** The visible evidence line, with the Session note when there is one. */
  evidence: string
  /** The status's one action sentence. */
  suggestion: string
  /** The `Why?` lines: the rule, the last 4 Sessions, the action. */
  why: string[]
  /** The action is a change of exercise: offer Swap. */
  swap: boolean
}

export type StartingPoint = {
  exerciseId: string
  name: string
  /** The lift's latest top set when logged, else its prescription (`4 × 8–10`). */
  value: string
  /** `Too new · 2 more` for a logged lift in a sparse state, else ''. */
  note: string
}

export type HomeCopy = {
  stage: HomeStage
  /** `10 of 14 lifts going up.` ('Too early to call' when stage is 'early'; '' otherwise). */
  sentence: string
  /** `2 add load · 1 same · 1 lowered on purpose · 10 going up`; '' unless stage is 'full'. */
  counts: string
  /** `12 of 14 lifts stepped up since Fri 18 Sep.`; '' unless stage is 'full'. */
  climbed: string
  /**
   * The Progress home's one headline (v6): `This week 2 of 3 sessions · 3 lifts need a decision`;
   * '' unless stage is 'full'.
   */
  lead: string
  /** `2 of 3 this week`; '' unless stage is 'full'. */
  adherence: string
  /** At most 3 "Needs a decision" cards: below your best, then the longest same, then ready. */
  cards: AttentionCard[]
  /** Decisions beyond the 3 cards (All lifts lists them). */
  moreDecisions: number
  /** Every lift's one status (stage 'full'; empty otherwise). */
  statuses: Map<string, LiftStatus>
  /** Stage 'empty' only: what to expect, one line each. */
  expectations: string[]
  /** Stages 'starting' and 'early': every lift of the Program, in Plan order. */
  startingPoints: StartingPoint[]
}

const TIMES = '×'
const LIGHTER = 'Consider a lighter week or a variation'
/** "Needs a decision" shows at most this many cards. */
export const MAX_CARDS = 4

const VERDICT_LABELS: Record<VerdictKind, string> = {
  moving: '▲ Moving',
  stalled: '■ Flat',
  slipping: '▼ Slipping',
  'too new': '○ Too new',
}

export function verdictLabel(kind: VerdictKind): string {
  return VERDICT_LABELS[kind]
}

export function nextStepText(step: NextStep, bodyweight: boolean): string {
  return `${step.repsAtTop} of ${step.target} reps at ${leverText(step.lever, bodyweight)}`
}

export function suggestionText(step: NextStep, bodyweight: boolean): string | null {
  if (step.hold) return `Stay at ${leverText(step.lever, bodyweight)}: every set at RIR 0`
  if (!step.ready || !step.suggest) return null
  if (step.suggest.kind === 'set') return 'Try one more set next'
  const text = `Try ${leverText(step.suggest.lever, bodyweight)} next`
  return step.steps === 2 ? `${text} · 2 steps` : text
}

/** A stalled loaded lift: its deload weight for one session; a Bodyweight lift: a lighter week. */
export function stallSuggestion(history: LiftHistory, exercise: Exercise): string {
  const latest = history.points.filter((p) => !p.deload && p.top !== null).at(-1)
  if (history.bodyweight || !latest || !latest.top) return LIGHTER
  return `Try a deload: ${leverText(deloadWeight(latest.top.lever, exercise.weightStep), false)} for one session`
}

export function compareText(compare: Compare | null, bodyweight: boolean): string | null {
  if (!compare) return null
  const side = (s: { lever: number; reps: number }) =>
    `${bodyweight ? leverText(s.lever, true) : numberText(s.lever)} ${TIMES} ${s.reps}`
  const word = compare.change === 'same' ? 'no change' : compare.change
  return `${side(compare.then)} → ${side(compare.now)} · ${word}`
}

const EXPECTATIONS = [
  'Log your first workout and your lifts appear here.',
  'After 4 sessions a lift gets a status: going up, the same for a while, or below your best.',
  'When every set reaches the top of its rep range, the lift is ready for more load.',
  'Records are a heavier set or a better estimated strength, never volume.',
]

type Top = { lever: number; reps: number }
type RealPoint = LiftPoint & { top: Top }

const realPoints = (h: LiftHistory): RealPoint[] =>
  h.points.filter((p): p is RealPoint => !p.deload && p.top !== null)

/** The order the status counts are told in. */
const COUNT_ORDER: LiftStatusKind[] = ['break', 'slipping', 'stalled', 'lowered', 'ready', 'hold', 'moving', 'too new']

/** The order of the "Needs a decision" cards (§6.2): Break > Slipping > Stalled > Lowered > Ready > Hold. */
const CARD_ORDER: Record<LiftStatusKind, number> = {
  break: 0,
  slipping: 1,
  stalled: 2,
  lowered: 3,
  ready: 4,
  hold: 5,
  moving: 6,
  'too new': 7,
}


/**
 * `This week 2 of 3 sessions · 3 lifts need a decision` (`· every lift on track` with none); after
 * a break (any lift on Break), `Last session 34 days ago · ease back in`.
 */
export function headline(done: number, planned: number, decisions: number, breakDays: number | null = null): string {
  if (breakDays !== null) return `Last session ${breakDays} days ago · ease back in`
  const need =
    decisions === 0 ? 'every lift on track' : `${plural(decisions, 'lift')} ${decisions === 1 ? 'needs' : 'need'} a decision`
  return `This week ${done} of ${planned} sessions · ${need}`
}

export function homeCopy(
  program: Program,
  sessions: Session[],
  resolve: Resolve,
  now: number,
  weekStartsOn: Weekday = 1,
): HomeCopy {
  const live = sessions.filter((s) => s.deletedAt === undefined && s.finishedAt !== null)
  const plans = new Map<string, ExercisePlan>()
  const planOrder: string[] = []
  for (const w of program.workouts) {
    for (const e of w.exercises) {
      if (!plans.has(e.exerciseId)) planOrder.push(e.exerciseId)
      plans.set(e.exerciseId, e)
    }
  }
  const planOf = (id: string) => plans.get(id)
  const histories = buildLiftHistories(live, resolve, planOf)
  const records = computeRecords(live, resolve, planOf)
  const vs = verdicts(histories, records, now)
  const nameOf = (id: string) => resolve(id)?.name ?? id

  const base: HomeCopy = {
    stage: 'empty',
    sentence: '',
    counts: '',
    climbed: '',
    lead: '',
    adherence: '',
    cards: [],
    moreDecisions: 0,
    statuses: new Map(),
    expectations: [],
    startingPoints: [],
  }
  if (live.length === 0) return { ...base, expectations: EXPECTATIONS }

  if (live.length === 1 || [...vs.values()].every((v) => v.kind === 'too new')) {
    const startingPoints: StartingPoint[] = planOrder.map((id) => {
      const plan = plans.get(id)!
      const h = histories.get(id)
      const v = vs.get(id)
      const top = h ? [...realPoints(h)].pop()?.top : undefined
      return {
        exerciseId: id,
        name: nameOf(id),
        value: h && top ? topText(top, h.bodyweight) : `${plan.sets} ${TIMES} ${plan.repRange[0]}–${plan.repRange[1]}`,
        note: v && v.kind === 'too new' ? `Too new · ${v.more} more` : '',
      }
    })
    return {
      ...base,
      stage: live.length === 1 ? 'starting' : 'early',
      sentence: live.length === 1 ? '' : 'Too early to call',
      startingPoints,
    }
  }

  const statuses = liftStatuses(program, live, resolve, now)
  const all = [...statuses.values()]
  const count = (k: LiftStatusKind) => all.filter((s) => s.kind === k).length
  const counts = COUNT_ORDER.filter((k) => count(k) > 0).map((k) => `${STATUS_GLYPHS[k]} ${count(k)} ${STATUS_LABELS[k].toLowerCase()}`)
  const climbed = stepsClimbed(histories, records, now)
  const week = thisWeek(live, now, program.sessionsPerWeek, weekStartsOn)
  const rank = (id: string) => {
    const at = planOrder.indexOf(id)
    return at === -1 ? planOrder.length : at
  }
  const decisions = all
    .filter((s) => s.decision)
    .sort((a, b) => CARD_ORDER[a.kind] - CARD_ORDER[b.kind] || rank(a.exerciseId) - rank(b.exerciseId))
  // Keyed by lift: one status, so one card, per lift.
  const cards: AttentionCard[] = decisions.slice(0, MAX_CARDS).map((s) => ({
    exerciseId: s.exerciseId,
    kind: s.kind,
    label: s.label,
    glyph: s.glyph,
    evidence: s.evidence,
    suggestion: s.action,
    why: s.why,
    swap: s.swap,
  }))
  const lastAt = Math.max(...live.map((s) => s.startedAt))
  const breakDays = count('break') > 0 ? calendarDays(lastAt, now) : null

  return {
    ...base,
    stage: 'full',
    sentence: `${count('moving')} of ${statuses.size} lifts moving.`,
    counts: counts.join(' · '),
    climbed: `${climbed.climbed} of ${climbed.of} lifts stepped up since ${humanDate(climbed.since)}.`,
    lead: headline(week.done, week.planned, decisions.length, breakDays),
    adherence: `${week.done} of ${week.planned} this week`,
    cards,
    moreDecisions: decisions.length - cards.length,
    statuses,
  }
}
