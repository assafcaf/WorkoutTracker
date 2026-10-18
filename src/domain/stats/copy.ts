// E18-T7 [O11 O18 R-C]: every generated sentence of the stats screens, from engine values only.
// Pure; imports only src/domain/** and src/types.ts.
//
//   leverText(lever, bodyweight)      -> '62.5 kg' | 'BW' | 'BW+5' | 'BW−19' (U+2212)
//   topText(top, bodyweight)          -> '13 kg × 9' | 'BW × 15'
//   humanDate(ms)                     -> 'Wed 14 Oct' (local time, no year)
//   verdictLabel(kind)                -> '▲ Moving' | '■ Stalled' | '▼ Slipping' | '○ Too new'
//   nextStepText(step, bodyweight)    -> '15 of 20 reps at 62.5 kg'
//   suggestionText(step, bodyweight)  -> 'Try 15 kg next' | 'Try one more set next' | null
//   compareText(compare, bodyweight)  -> '13 × 9 → 13 × 9 · no change' | null
//   homeCopy(program, sessions, resolve, now) -> HomeCopy
import type { Exercise, ExercisePlan, Program, Session } from '../../types'
import type { Resolve } from '../muscles'
import type { Compare } from './ladder'
import { deloadWeight } from '../deload'
import { buildLiftHistories, leverOf, straightSets } from './liftHistory'
import type { LiftHistory, LiftPoint } from './liftHistory'
import { computeRecords } from './records'
import { nextStep, stepsClimbed, verdicts } from './verdict'
import type { NextStep, Verdict, VerdictKind } from './verdict'
import { thisWeek } from './weeks'
import type { Weekday } from './weeks'

export type HomeStage = 'empty' | 'starting' | 'early' | 'full'

export type AttentionCard = {
  exerciseId: string
  kind: 'slipping' | 'stalled' | 'ready'
  sentence: string
  suggestion: string
  /** The `Why?` lines: the rule, the last 4 non-deload Sessions' top sets, the bar to clear. */
  why: string[]
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
  /** `11 of 14 lifts moving.` ('Too early to call' when stage is 'early'; '' otherwise). */
  sentence: string
  /** `▲ 11 moving · ■ 2 stalled · ▼ 1 slipping · ↑ 1 ready`; '' unless stage is 'full'. */
  counts: string
  /** `12 of 14 lifts stepped up since Fri 18 Sep.`; '' unless stage is 'full'. */
  climbed: string
  /** `2 of 3 this week`; '' unless stage is 'full'. */
  adherence: string
  cards: AttentionCard[]
  /** Stage 'empty' only: what to expect, one line each. */
  expectations: string[]
  /** Stages 'starting' and 'early': every lift of the Program, in Plan order. */
  startingPoints: StartingPoint[]
}

const MINUS = '−'
const TIMES = '×'
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const LIGHTER = 'Consider a lighter week or a variation'

/** A number with at most 2 decimals, no trailing zeros. */
export function numberText(n: number): string {
  return String(Math.round(n * 100) / 100)
}

/** `Wed` for a timestamp, local time. */
export function weekdayName(ms: number): string {
  return DAYS[new Date(ms).getDay()]
}

export function leverText(lever: number, bodyweight: boolean): string {
  if (!bodyweight) return `${numberText(lever)} kg`
  if (lever === 0) return 'BW'
  return lever > 0 ? `BW+${numberText(lever)}` : `BW${MINUS}${numberText(-lever)}`
}

export function topText(top: { lever: number; reps: number }, bodyweight: boolean): string {
  return `${leverText(top.lever, bodyweight)} ${TIMES} ${top.reps}`
}

export function humanDate(ms: number): string {
  const d = new Date(ms)
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`
}

const VERDICT_LABELS: Record<VerdictKind, string> = {
  moving: '▲ Moving',
  stalled: '■ Stalled',
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
  'After 4 sessions of a lift, it gets a verdict: moving, stalled or slipping.',
  'A lift with no record in its last 4 sessions is called stalled.',
  'Records are weight, reps or estimated 1RM, never volume.',
]

function threeWords(note: string): string {
  const words = note.trim().split(/\s+/)
  return words.length <= 3 ? words.join(' ') : `${words.slice(0, 3).join(' ')}…`
}

type Top = { lever: number; reps: number }
type RealPoint = LiftPoint & { top: Top }

const realPoints = (h: LiftHistory): RealPoint[] =>
  h.points.filter((p): p is RealPoint => !p.deload && p.top !== null)

function lastFourLines(h: LiftHistory): string[] {
  return realPoints(h)
    .slice(-4)
    .map((p) => `${humanDate(p.startedAt)} · ${topText(p.top, h.bodyweight)}`)
}

function maxRepsAt(h: LiftHistory, lever: number): number {
  let best = 0
  for (const p of h.points) {
    for (const s of straightSets(p.workingSets)) {
      if (leverOf(s, h.bodyweight) === lever && s.reps > best) best = s.reps
    }
  }
  return best
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

export function homeCopy(
  program: Program,
  sessions: Session[],
  resolve: Resolve,
  now: number,
  weekStartsOn: Weekday = 1,
): HomeCopy {
  const live = sessions.filter((s) => s.deletedAt === undefined)
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
  const noteOf = new Map(live.map((s) => [s.id, s.note]))

  const base: HomeCopy = {
    stage: 'empty',
    sentence: '',
    counts: '',
    climbed: '',
    adherence: '',
    cards: [],
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

  const count = (k: VerdictKind) => [...vs.values()].filter((v) => v.kind === k).length
  const steps = new Map<string, NextStep>()
  for (const [id, h] of histories) {
    const ex = resolve(id)
    const step = ex ? nextStep(h, plans.get(id), ex) : null
    if (step) steps.set(id, step)
  }
  const ready = [...steps.entries()].filter(([, st]) => st.ready)
  const parts = [
    `▲ ${count('moving')} moving`,
    `■ ${count('stalled')} stalled`,
    `▼ ${count('slipping')} slipping`,
    `↑ ${ready.length} ready`,
  ]
  if (count('too new') > 0) parts.push(`○ ${count('too new')} too new`)
  const climbed = stepsClimbed(histories, records, now)
  const week = thisWeek(live, now, program.sessionsPerWeek, weekStartsOn)

  const cards: AttentionCard[] = []
  const verdictOf = (id: string): Verdict => vs.get(id)!
  for (const id of [...vs.keys()].filter((i) => verdictOf(i).kind === 'slipping')) {
    const h = histories.get(id)!
    const best = verdictOf(id).bestBefore!
    const real = realPoints(h)
    const latest = real[real.length - 1]
    const note = noteOf.get(real[real.length - 2].sessionId)
    const lead = `${nameOf(id)}: slipping, ${topText(latest.top, h.bodyweight)} on ${humanDate(latest.startedAt)}, below ${topText(best, h.bodyweight)} on ${humanDate(best.startedAt)}`
    cards.push({
      exerciseId: id,
      kind: 'slipping',
      sentence: note ? `${lead}, after '${threeWords(note)}'` : `${lead}.`,
      suggestion: LIGHTER,
      why: [
        'Slipping: the last 2 sessions are both below the best of the sessions before them.',
        ...lastFourLines(h),
        `Back to ${topText(best, h.bodyweight)} to stop slipping.`,
      ],
    })
  }
  const stalled = [...vs.keys()]
    .filter((i) => verdictOf(i).kind === 'stalled')
    .sort((a, b) => (verdictOf(b).weeks ?? 0) - (verdictOf(a).weeks ?? 0))
  for (const id of stalled) {
    const h = histories.get(id)!
    const v = verdictOf(id)
    const ex = resolve(id)
    const top = realPoints(h).pop()!.top
    const need = maxRepsAt(h, top.lever) + 1
    const bar = h.bodyweight
      ? top.lever === 0
        ? `A record needs ${need} reps in one set.`
        : `A record needs ${need} reps at ${leverText(top.lever, true)}, or less assistance.`
      : `A record needs ${leverText(top.lever, false)} ${TIMES} ${need}, or more weight.`
    cards.push({
      exerciseId: id,
      kind: 'stalled',
      sentence: `${nameOf(id)}: stalled for ${plural(Math.round(v.weeks ?? 0), 'week')}, ${plural(v.sessionsSince ?? 0, 'session')} without a record since ${humanDate(v.since ?? 0)}.`,
      suggestion: ex ? stallSuggestion(h, ex) : LIGHTER,
      why: ['Stalled: none of the last 4 sessions of this lift set a record.', ...lastFourLines(h), bar],
    })
  }
  for (const [id, st] of ready) {
    const h = histories.get(id)!
    const suggestion = suggestionText(st, h.bodyweight) ?? ''
    cards.push({
      exerciseId: id,
      kind: 'ready',
      sentence: `${nameOf(id)}: ready, ${nextStepText(st, h.bodyweight)}.`,
      suggestion,
      why: ['Ready: every set of the last session reached the top of the rep range.', ...lastFourLines(h), suggestion],
    })
  }

  return {
    ...base,
    stage: 'full',
    sentence: `${count('moving')} of ${histories.size} lifts moving.`,
    counts: parts.join(' · '),
    climbed: `${climbed.climbed} of ${climbed.of} lifts stepped up since ${humanDate(climbed.since)}.`,
    adherence: `${week.done} of ${week.planned} this week`,
    cards,
  }
}
