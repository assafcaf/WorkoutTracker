// v6 (§6.1 of the iteration-6 report; V5-03, V6-02, V6-04, V6-05): a lift's ONE status. Every
// status word, evidence line, action sentence, Why? line and Next value the app shows for a lift
// comes from `liftStatus` -- the dashboard's cards and rows, the Lift page, and (later) Train and
// Now through `next`. No screen writes its own advice. Pure; imports only src/domain/** and
// src/types.ts.
//
// Evaluated in this order, first match wins ("load" is the top-set lever; "straight sets" as in
// `straightSets`; records are the lift page's real records, `realRecord.ts`):
//   1 Too new  < 4 non-deload Sessions             -> "Log 2 more sessions for a verdict."
//   2 Break    last Session >= 21 days before now  -> "Ease back in: 12.5 kg next time."
//   3 Ready    (a) every straight set at the load in the last Session reached the top of the
//              range, or (b) the first straight set did in each of the last 3 Sessions at the
//              same load                           -> "Next time: 15 kg." / Bodyweight at BW:
//                                                     "Add load or a harder variation." (Swap)
//   3b Hold    (a) with every set at RIR 0         -> "Next time: 14 kg again, with a rep to spare."
//   4 Lowered  the load is below the highest of the 6 Sessions before, after a load drop between
//              two non-deload Sessions             -> "Stay at 46.25 kg until all 3 sets reach 12."
//   5 Slipping at the same load as the best of the 4 Sessions before the last 2, both of the last
//              2 have fewer top-set reps           -> "Next time: stay at 47.5 kg and aim for 10."
//   6 Stalled  no record, no step up and no extra straight reps at a load in the last 4 Sessions
//              -> "Deload once: 12 kg × 10, then back to 13 kg." / a deload already inside the
//                 stall: "Try a variation for 4 weeks." (Swap)
//   7 Moving   anything else                       -> "Next time: 62.5 kg × 9."
// Every status but Too new and Moving needs a decision.
import type { Exercise, ExercisePlan, Program, Session, SetEntry } from '../../types'
import { deloadWeight } from '../deload'
import { effortSteps } from '../effortStep'
import type { Resolve } from '../muscles'
import { buildLiftHistories, leverOf, straightSets } from './liftHistory'
import type { LiftHistory, LiftPoint } from './liftHistory'
import { realRecords } from './realRecord'
import { humanDate, leverText, numberText, plural, topText } from './words'

export type LiftStatusKind = 'too new' | 'break' | 'ready' | 'hold' | 'lowered' | 'slipping' | 'stalled' | 'moving'

export const STATUS_LABELS: Record<LiftStatusKind, string> = {
  'too new': 'Too new',
  break: 'Break',
  ready: 'Ready',
  hold: 'Hold',
  lowered: 'Lowered',
  slipping: 'Slipping',
  stalled: 'Stalled',
  moving: 'Moving',
}

export const STATUS_GLYPHS: Record<LiftStatusKind, string> = {
  'too new': '○',
  break: '‖',
  ready: '↑',
  hold: '=',
  lowered: '↓',
  slipping: '▼',
  stalled: '■',
  moving: '▲',
}

/** Days without the lift after which it is on a Break. */
export const BREAK_DAYS = 21

export type LiftStatus = {
  exerciseId: string
  kind: LiftStatusKind
  /** `Ready`, `Lowered`, … */
  label: string
  /** `↑`, `↓`, … */
  glyph: string
  /** The card's evidence line: `46.25 kg × 9 · down from 47.5 kg on Wed 7 Oct · note: "Right elbow…"`. */
  evidence: string
  /** The one action sentence, the same on the card, the list, the Lift page and the Why?'s end. */
  action: string
  /** The Why?: the rule in plain words, the last 4 Sessions, then the action. */
  why: string[]
  /**
   * The next Session's suggested load (a lever: kg, or a Bodyweight lift's signed Load) and reps,
   * for Train and Now to offer; null with nothing to suggest.
   */
  next: { lever: number; reps: number | null } | null
  /** Needs a decision: every status but Too new and Moving. */
  decision: boolean
  /** The action is a change of exercise: the screen offers a Swap link. */
  swap: boolean
}

export type LiftStatusInput = {
  exercise: Exercise
  plan: ExercisePlan | undefined
  history: LiftHistory
  /** Session notes by session id. */
  notes: Map<string, string>
  now: number
}

type Top = { lever: number; reps: number }
type Real = LiftPoint & { top: Top }

const DAY = 24 * 3600_000
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function realPoints(history: LiftHistory): Real[] {
  return history.points.filter((p): p is Real => !p.deload && p.top !== null)
}

/** The straight sets at the Session's top load. */
function atTop(point: Real, bodyweight: boolean): SetEntry[] {
  return straightSets(point.workingSets).filter((s) => leverOf(s, bodyweight) === point.top.lever)
}

const totalAt = (point: Real, bodyweight: boolean): number => atTop(point, bodyweight).reduce((sum, s) => sum + s.reps, 0)

/** `13 kg × 9·8·8·7`: the straight sets at the top load. */
export function loadLine(point: Real, bodyweight: boolean): string {
  return `${leverText(point.top.lever, bodyweight)} × ${atTop(point, bodyweight).map((s) => s.reps).join('·')}`
}

/** `Wed 7 Oct · 46.25 kg × 10·9·9`. */
function sessionLine(point: Real, bodyweight: boolean): string {
  return `${humanDate(point.startedAt)} · ${loadLine(point, bodyweight)}`
}

/** `21–25 Sep`, or `28 Sep–2 Oct`. */
function spanText(from: number, to: number): string {
  const a = new Date(from)
  const b = new Date(to)
  const end = `${b.getDate()} ${MONTHS[b.getMonth()]}`
  if (a.getMonth() === b.getMonth()) return a.getDate() === b.getDate() ? end : `${a.getDate()}–${end}`
  return `${a.getDate()} ${MONTHS[a.getMonth()]}–${end}`
}

/** Whole local calendar days from `from`'s day to `to`'s day. */
export function calendarDays(from: number, to: number): number {
  const a = new Date(from)
  const b = new Date(to)
  const dayA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())
  const dayB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate())
  return Math.round((dayB - dayA) / DAY)
}

function firstWords(note: string, n: number): string {
  const words = note.trim().split(/\s+/)
  return words.length <= n ? words.join(' ') : `${words.slice(0, n).join(' ')}…`
}

/**
 * Whether Session `i` of `real` moved the lift: a real record, a load step up on the Session
 * before, or more straight reps at its load than any earlier Session at that load.
 */
function movedAt(real: Real[], i: number, bodyweight: boolean, records: Map<string, unknown>): boolean {
  if (i === 0) return false
  const p = real[i]
  if (records.has(p.sessionId)) return true
  if (p.top.lever > real[i - 1].top.lever) return true
  const earlier = real.slice(0, i).filter((q) => q.top.lever === p.top.lever)
  return earlier.length > 0 && totalAt(p, bodyweight) > Math.max(...earlier.map((q) => totalAt(q, bodyweight)))
}

export function liftStatusOf({ exercise, plan, history, notes, now }: LiftStatusInput): LiftStatus | null {
  const id = history.exerciseId
  const bw = history.bodyweight
  const real = realPoints(history)
  const latest = real[real.length - 1]
  if (!latest) return null
  const n = real.length
  const load = latest.top.lever
  const L = (lever: number) => leverText(lever, bw)
  const lastFour = real.slice(-4).map((p) => sessionLine(p, bw))
  const make = (
    kind: LiftStatusKind,
    evidence: string,
    action: string,
    rule: string,
    next: LiftStatus['next'],
    swap = false,
  ): LiftStatus => ({
    exerciseId: id,
    kind,
    label: STATUS_LABELS[kind],
    glyph: STATUS_GLYPHS[kind],
    evidence,
    action,
    why: [rule, ...lastFour, action],
    next,
    decision: kind !== 'too new' && kind !== 'moving',
    swap,
  })

  // 1 Too new
  if (n < 4) {
    const more = 4 - n
    return make(
      'too new',
      `${topText(latest.top, bw)} · ${n} of 4 sessions`,
      `Log ${plural(more, 'more session')} for a verdict.`,
      `A verdict needs 4 sessions of this lift. You have ${n}.`,
      { lever: load, reps: null },
    )
  }

  // 2 Break: the last Session of this lift, deload or not.
  const lastAny = history.points[history.points.length - 1]
  const days = calendarDays(lastAny.startedAt, now)
  if (days >= BREAK_DAYS) {
    const eased = bw ? load : deloadWeight(load, exercise.weightStep)
    return make(
      'break',
      `Last done ${humanDate(lastAny.startedAt)} · ${days} days ago`,
      bw ? 'Ease back in: fewer reps next time.' : `Ease back in: ${L(eased)} next time.`,
      `You last did this lift ${days} days ago. After a break, start about 10 % lighter for one session, then return to ${L(load)}.`,
      { lever: eased, reps: plan ? plan.repRange[1] : null },
    )
  }

  // 3 Ready / 3b Hold
  if (plan) {
    const [lo, hi] = plan.repRange
    const sets = atTop(latest, bw)
    const allTop = sets.length > 0 && sets.every((s) => s.reps >= hi)
    const lastThree = real.slice(-3)
    const firstTop =
      lastThree.length === 3 &&
      lastThree.every((p) => p.top.lever === load && (straightSets(p.workingSets).find((s) => leverOf(s, bw) === load)?.reps ?? 0) >= hi)
    if (allTop || firstTop) {
      const effort = allTop ? effortSteps(sets) : 1
      if (allTop && effort === 0) {
        return make(
          'hold',
          `${loadLine(latest, bw)} on ${humanDate(latest.startedAt)}`,
          `Next time: ${L(load)} again, with a rep to spare.`,
          'All sets reached the top, but every set ended with 0 reps left. Repeat the weight until one set has a rep to spare.',
          { lever: load, reps: hi },
        )
      }
      const rule = allTop
        ? `All ${sets.length} sets reached ${hi}, the top of your ${lo}–${hi} range, on ${humanDate(latest.startedAt)}. When every set hits the top, the next step is more weight.`
        : `Your first set reached ${hi} or more, the top of your ${lo}–${hi} range, in each of your last 3 sessions. Reps above the range mean the weight is too light.`
      const firsts = lastThree.map((p) => straightSets(p.workingSets).find((s) => leverOf(s, bw) === load)?.reps ?? 0)
      const evidence = allTop
        ? `${loadLine(latest, bw)} on ${humanDate(latest.startedAt)}`
        : `${L(load)} × ${firsts.join('·')} in the first set of the last 3 sessions`
      const to = Math.round((load + Math.max(1, effort) * exercise.weightStep) * 100) / 100
      if (bw && load === 0) {
        return make('ready', evidence, 'Add load or a harder variation.', rule, { lever: to, reps: lo }, true)
      }
      return make('ready', evidence, `Next time: ${L(to)}.`, rule, { lever: to, reps: lo })
    }
  }

  // 4 Lowered: below the highest load of the 6 Sessions before, after a load drop.
  const before = real.slice(Math.max(0, n - 7), n - 1)
  const highest = Math.max(...before.map((p) => p.top.lever))
  if (load < highest) {
    let drop = -1
    for (let i = n - 1; i >= 1; i -= 1) {
      if (real[i].top.lever < real[i - 1].top.lever) {
        drop = i
        break
      }
    }
    if (drop >= 1) {
      const from = real[drop - 1].top.lever
      const at = real[drop]
      const note = notes.get(at.sessionId)?.trim()
      const sets = plan?.sets ?? atTop(latest, bw).length
      const hi = plan?.repRange[1] ?? latest.top.reps
      return make(
        'lowered',
        `${topText(latest.top, bw)} · down from ${L(from)} on ${humanDate(at.startedAt)}${note ? ` · note: “${firstWords(note, 6)}”` : ''}`,
        `Stay at ${L(load)} until all ${sets} sets reach ${hi}.`,
        `You lowered the weight from ${L(from)} to ${L(load)} on ${humanDate(at.startedAt)}${note ? `, with the note “${note.replace(/[.!?]+$/, '')}”` : ''}. A lower weight you chose is not a loss. When all ${sets} sets reach ${hi} at ${L(load)}, the app moves you back up to ${L(from)}.`,
        { lever: load, reps: hi },
      )
    }
  }

  // 5 Slipping: at the same load, the last 2 below the best of the 4 Sessions before them.
  const previous = real[n - 2]
  const window = real.slice(Math.max(0, n - 6), n - 2).filter((p) => p.top.lever === load)
  if (window.length > 0 && previous.top.lever === load) {
    const best = window.reduce((a, b) => (b.top.reps > a.top.reps ? b : a))
    if (latest.top.reps < best.top.reps && previous.top.reps < best.top.reps) {
      return make(
        'slipping',
        `${L(load)} × ${latest.top.reps} · was × ${best.top.reps} on ${humanDate(best.startedAt)}`,
        `Next time: stay at ${L(load)} and aim for ${best.top.reps}.`,
        `At ${L(load)} you did ${best.top.reps} on ${humanDate(best.startedAt)}. The last 2 sessions at the same weight were lower: ${previous.top.reps}, then ${latest.top.reps}. Two sessions below your best at the same weight is a slip. If the next one is lower again, this becomes Stalled.`,
        { lever: load, reps: best.top.reps },
      )
    }
  }

  // 6 Stalled / 7 Moving
  const records = realRecords(history)
  const moved = real.map((_, i) => movedAt(real, i, bw, records))
  const lastMove = moved.lastIndexOf(true)
  const hi = plan?.repRange[1] ?? latest.top.reps + 1
  if (lastMove < n - 4) {
    const since = real[Math.max(0, lastMove)].startedAt
    const deloads = history.points.filter((p) => p.deload && p.startedAt > since && p.startedAt < latest.startedAt)
    const evidence = `${topText(latest.top, bw)} · no new best since ${humanDate(since)}`
    if (deloads.length > 0) {
      // The latest run of deload Sessions inside the stall names the deload week.
      const lastDeload = deloads[deloads.length - 1]
      const run = deloads.filter((p) => lastDeload.startedAt - p.startedAt <= 7 * DAY)
      const most = Math.max(...real.filter((p) => p.top.lever === load).flatMap((p) => atTop(p, bw).map((s) => s.reps)))
      return make(
        'stalled',
        evidence,
        'Try a variation for 4 weeks.',
        `No new best at ${L(load)} since ${humanDate(since)}. Your deload week of ${spanText(run[0].startedAt, lastDeload.startedAt)} came back to the same reps, so another deload is unlikely to help. A new best needs ${L(load)} × ${most + 1}.`,
        { lever: load, reps: null },
        true,
      )
    }
    const lighter = bw ? load : deloadWeight(load, exercise.weightStep)
    return make(
      'stalled',
      evidence,
      bw ? `Deload once: an easier session, then back to ${L(load)}.` : `Deload once: ${L(lighter)} × ${hi}, then back to ${L(load)}.`,
      `No new best and no extra reps at ${L(load)} in your last 4 sessions. One lighter session usually lets the next one move.`,
      { lever: lighter, reps: hi },
    )
  }

  const moveAt = real[lastMove]
  const prior = real[lastMove - 1]
  const up = moveAt.top.lever - prior.top.lever
  const priorAtLoad = real.slice(0, lastMove).filter((q) => q.top.lever === moveAt.top.lever)
  const moreReps = priorAtLoad.length > 0 ? totalAt(moveAt, bw) - Math.max(...priorAtLoad.map((q) => totalAt(q, bw))) : 0
  const moveWords =
    up > 0 ? `up ${numberText(up)} kg` : moreReps > 0 ? `+${plural(moreReps, 'rep')}` : 'a new best'
  const reps = Math.min(hi, latest.top.reps + 1)
  return make(
    'moving',
    `${topText(latest.top, bw)} · ${moveWords} on ${humanDate(moveAt.startedAt)}`,
    `Next time: ${L(load)} × ${reps}.`,
    `${up > 0 ? `Up ${numberText(up)} kg` : moreReps > 0 ? `${plural(moreReps, 'more rep')}` : 'A new best'} vs ${humanDate(prior.startedAt)}. Moving means a heavier weight or more reps at the same weight in your last 4 sessions.`,
    { lever: load, reps },
  )
}

/** One lift's status straight from the Sessions (the Lift page, the tools sheet, Train later). */
export function liftStatus(
  exercise: Exercise,
  plan: ExercisePlan | undefined,
  sessions: Session[],
  now: number,
): LiftStatus | null {
  const live = sessions.filter((s) => s.deletedAt === undefined && s.finishedAt !== null)
  const history = buildLiftHistories(
    live,
    (id) => (id === exercise.id ? exercise : undefined),
    (id) => (id === exercise.id ? plan : undefined),
  ).get(exercise.id)
  if (!history) return null
  return liftStatusOf({ exercise, plan, history, notes: notesOf(live), now })
}

function notesOf(sessions: Session[]): Map<string, string> {
  return new Map(sessions.flatMap((s) => (s.note ? [[s.id, s.note] as const] : [])))
}

/** Every lift's status, keyed by exercise id only: one status per lift. */
export function liftStatuses(program: Program, sessions: Session[], resolve: Resolve, now: number): Map<string, LiftStatus> {
  const live = sessions.filter((s) => s.deletedAt === undefined && s.finishedAt !== null)
  const plans = new Map<string, ExercisePlan>()
  for (const w of program.workouts) for (const e of w.exercises) plans.set(e.exerciseId, e)
  const histories = buildLiftHistories(live, resolve, (id) => plans.get(id))
  const notes = notesOf(live)
  const out = new Map<string, LiftStatus>()
  for (const [id, history] of histories) {
    const exercise = resolve(id)
    if (!exercise) continue
    const status = liftStatusOf({ exercise, plan: plans.get(id), history, notes, now })
    if (status) out.set(id, status)
  }
  return out
}
