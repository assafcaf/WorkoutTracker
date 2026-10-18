// E18-T7 [O18 O25 O26]: a finished Session in words: each lift's move, `Next time`, the volume
// line and the week heading. Pure; imports only src/domain/** and src/types.ts.
//
// Every function reads `sessions` up to and including the Session named by `sessionId`
// ("as of that Session"); later Sessions are ignored.
//   sessionMoves(sessionId, sessions, resolve, program) -> LiftMove[]
//   nextTime(sessionId, sessions, resolve, program)     -> string[]
//   volumeLine(sessionId, sessions, resolve, log?)      -> string
//   summaryWeek(sessionId, sessions, program)           -> { heading, line }
import type { BodyLog, ExercisePlan, Program, Session } from '../../types'
import type { Resolve } from '../muscles'
import { workingSets } from '../setKind'
import { bodyweightOn } from '../bodyLog'
import { sessionVolume } from '../volume'
import { humanDate, leverText, nextStepText, numberText, topText, weekdayName } from './copy'
import { buildLiftHistories, leverOf, straightSets } from './liftHistory'
import type { LiftHistory, LiftPoint } from './liftHistory'
import { computeRecords } from './records'
import type { SessionRecord } from './records'
import { nextStep, verdictOf } from './verdict'
import { weekStart } from './weeks'
import type { Weekday } from './weeks'

export type LiftMove = {
  exerciseId: string
  name: string
  /** The lift's top set that Session: `62.5 kg × 8`, `BW × 15`. */
  top: string
  /** The move in words: `Stepped up to 62.5 kg · +2.5 kg · record`. */
  text: string
}

const MINUS = '−'
const CLIMB_KINDS: ReadonlySet<SessionRecord['kind']> = new Set([
  'Heaviest weight',
  'Least assistance',
  'First added load',
])

type Scope = {
  target: Session
  upTo: Session[]
  plans: Map<string, ExercisePlan>
  histories: Map<string, LiftHistory>
}

function scopeOf(sessionId: string, sessions: Session[], resolve: Resolve, program: Program): Scope | null {
  const live = sessions.filter((s) => s.deletedAt === undefined)
  const target = live.find((s) => s.id === sessionId)
  if (!target) return null
  const upTo = live.filter((s) => s.startedAt <= target.startedAt)
  const plans = new Map<string, ExercisePlan>()
  for (const w of program.workouts) for (const e of w.exercises) plans.set(e.exerciseId, e)
  const histories = buildLiftHistories(upTo, resolve, (id) => plans.get(id))
  return { target, upTo, plans, histories }
}

/** Lifts done in the Session: the Workout's Plan order first, then any other in entry order. */
function liftIds(target: Session, program: Program): string[] {
  const done: string[] = []
  for (const e of target.entries) if (!done.includes(e.exerciseId)) done.push(e.exerciseId)
  const workout = program.workouts.find((w) => w.id === target.workoutId)
  const order = (workout?.exercises ?? []).map((e) => e.exerciseId)
  const rank = (id: string) => {
    const i = order.indexOf(id)
    return i < 0 ? order.length + done.indexOf(id) : i
  }
  return [...done].sort((a, b) => rank(a) - rank(b))
}

function repsAtLever(point: LiftPoint, lever: number, bodyweight: boolean): number {
  return straightSets(point.workingSets)
    .filter((s) => leverOf(s, bodyweight) === lever)
    .reduce((n, s) => n + s.reps, 0)
}

function moveText(
  history: LiftHistory,
  index: number,
  records: SessionRecord[],
  plan: ExercisePlan | undefined,
): string {
  const point = history.points[index]
  if (point.deload) return 'Deload'
  const cur = point.top!
  const prevPoint = history.points
    .slice(0, index)
    .reverse()
    .find((p) => !p.deload && p.top)
  if (!prevPoint) return 'First session'
  const prev = prevPoint.top!
  const bw = history.bodyweight
  const rec = records.find((r) => r.exerciseId === history.exerciseId && r.sessionId === point.sessionId)
  const isClimb = rec !== undefined && CLIMB_KINDS.has(rec.kind)

  if (cur.lever > prev.lever) {
    const diff = numberText(cur.lever - prev.lever)
    const gain = bw && cur.lever < 0 ? `${MINUS}${diff} kg assistance` : `+${diff} kg`
    return `Stepped up to ${leverText(cur.lever, bw)} · ${gain}${isClimb ? ' · record' : ''}`
  }
  if (cur.lever < prev.lever) {
    return `Stepped down to ${leverText(cur.lever, bw)} · ${MINUS}${numberText(prev.lever - cur.lever)} kg`
  }
  const now = repsAtLever(point, cur.lever, bw)
  const before = repsAtLever(prevPoint, cur.lever, bw)
  if (now < before) return `Fewer reps · ${now} vs ${before}`
  if (now === before) return 'Same'
  if (rec) return `More reps · ${now} vs ${before} · record`
  const upto: LiftHistory = { ...history, points: history.points.slice(0, index + 1) }
  const v = verdictOf(upto, records, point.startedAt)
  if (v.kind === 'stalled' && plan) {
    const target = straightSets(point.workingSets).filter((s) => leverOf(s, bw) === cur.lever).length * plan.repRange[1]
    return `Held ${leverText(cur.lever, bw)} · ${now} of ${target} · stalled ${v.sessionsSince} sessions`
  }
  return `More reps · ${now} vs ${before}`
}

export function sessionMoves(
  sessionId: string,
  sessions: Session[],
  resolve: Resolve,
  program: Program,
): LiftMove[] {
  const scope = scopeOf(sessionId, sessions, resolve, program)
  if (!scope) return []
  const records = computeRecords(scope.upTo, resolve, (id) => scope.plans.get(id))
  const out: LiftMove[] = []
  for (const id of liftIds(scope.target, program)) {
    const history = scope.histories.get(id)
    const exercise = resolve(id)
    if (!history || !exercise) continue
    const index = history.points.findIndex((p) => p.sessionId === sessionId)
    if (index < 0 || !history.points[index].top) continue
    out.push({
      exerciseId: id,
      name: exercise.name,
      top: topText(history.points[index].top!, history.bodyweight),
      text: moveText(history, index, records, scope.plans.get(id)),
    })
  }
  return out
}

export function nextTime(
  sessionId: string,
  sessions: Session[],
  resolve: Resolve,
  program: Program,
): string[] {
  const scope = scopeOf(sessionId, sessions, resolve, program)
  if (!scope) return []
  const lines: string[] = []
  const inSession = new Set(liftIds(scope.target, program))
  for (const id of inSession) {
    const history = scope.histories.get(id)
    const exercise = resolve(id)
    if (!history || !exercise) continue
    const step = nextStep(history, scope.plans.get(id), exercise)
    if (step) lines.push(`${exercise.name} · ${nextStepText(step, history.bodyweight)}`)
  }
  for (const w of program.workouts) {
    for (const plan of w.exercises) {
      const id = plan.exerciseId
      const history = scope.histories.get(id)
      const exercise = resolve(id)
      if (inSession.has(id) || !history || !exercise) continue
      const step = nextStep(history, plan, exercise)
      if (!step?.ready || !step.suggest) continue
      lines.push(
        step.suggest.kind === 'set'
          ? `${exercise.name} is ready for one more set`
          : `${exercise.name} is ready for ${leverText(step.suggest.lever, history.bodyweight)}`,
      )
    }
  }
  return lines
}

const thousands = (n: number) => Math.round(n).toLocaleString('en-US')

export function volumeLine(
  sessionId: string,
  sessions: Session[],
  resolve: Resolve,
  log: BodyLog = [],
): string {
  const live = sessions.filter((s) => s.deletedAt === undefined)
  const target = live.find((s) => s.id === sessionId)
  if (!target) return ''
  const kg = sessionVolume(target, resolve, bodyweightOn(log, target.startedAt)?.kg ?? null).kg
  const head = `${thousands(kg)} kg`
  const prev = live
    .filter(
      (s) =>
        s.id !== target.id &&
        s.programId === target.programId &&
        s.workoutId === target.workoutId &&
        s.startedAt < target.startedAt,
    )
    .sort((a, b) => b.startedAt - a.startedAt)[0]
  if (!prev) return head
  const before = sessionVolume(prev, resolve, bodyweightOn(log, prev.startedAt)?.kg ?? null).kg
  if (before <= 0) return head
  const pct = Math.round(((kg - before) / before) * 100)
  const on = humanDate(prev.startedAt)
  if (pct === 0) return `${head} · same as ${on}`
  return `${head} · ${pct > 0 ? 'up' : 'down'} ${Math.abs(pct)} % on ${on}`
}

export function summaryWeek(
  sessionId: string,
  sessions: Session[],
  program: Program,
  weekStartsOn: Weekday = 1,
): { heading: string; line: string } {
  const live = sessions.filter((s) => s.deletedAt === undefined)
  const target = live.find((s) => s.id === sessionId)
  if (!target) return { heading: '', line: '' }
  const start = weekStart(target.startedAt, weekStartsOn)
  const inWeek = live.filter((s) => weekStart(s.startedAt, weekStartsOn) === start && s.startedAt <= target.startedAt)
  const done = inWeek.reduce((n, s) => n + workingSets(s.entries).length, 0)
  const workoutSets = program.workouts.map((w) => w.exercises.reduce((n, e) => n + e.sets, 0))
  const average = workoutSets.length ? workoutSets.reduce((a, b) => a + b, 0) / workoutSets.length : 0
  const planned = Math.round(average * program.sessionsPerWeek)
  return {
    heading: `What ${weekdayName(target.startedAt)} did for your week`,
    line: `${inWeek.length} of ${program.sessionsPerWeek} sessions · ${done} of ${planned} sets`,
  }
}
