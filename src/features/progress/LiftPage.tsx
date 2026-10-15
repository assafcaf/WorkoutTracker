import { useState } from 'react'
import { resolveExercise } from '../../data/resolve'
import { applyBodyweight } from '../../domain/bodyweight'
import type { Resolve } from '../../domain/muscles'
import { buildLadder, compareAgo, cutLadder } from '../../domain/stats/ladder'
import type { LadderRange } from '../../domain/stats/ladder'
import { humanDate, leverText, nextStepText, numberText, suggestionText, topText, verdictLabel, compareText } from '../../domain/stats/copy'
import { buildLiftHistories, leverOf } from '../../domain/stats/liftHistory'
import type { LiftHistory, LiftPoint } from '../../domain/stats/liftHistory'
import { computeRecords, liftBests } from '../../domain/stats/records'
import type { BestRow, SessionRecord } from '../../domain/stats/records'
import { sessionMoves } from '../../domain/stats/moves'
import { nextStep, verdictOf } from '../../domain/stats/verdict'
import type { Verdict } from '../../domain/stats/verdict'
import type { ExercisePlan, Program, Session, SetEntry } from '../../types'
import { Ladder } from '../../ui/charts/Ladder'
import type { LadderPoint, LadderView } from '../../ui/charts/ladderView'
import { AppShell } from '../../ui/AppShell'
import { Segmented } from '../../ui/controls'
import type { AppRoute } from '../routes'
import { useServiceData } from '../useServiceData'
import './LiftPage.css'
import type { ProgressPageProps } from './pages'

export type LiftPageViewProps = {
  exerciseId: string
  sessions: Session[]
  program: Program | undefined
  resolve: Resolve
  now: number
  /** Opens a Session's summary (the ladder readout, `Last moved ›`). */
  onOpenSession?: (sessionId: string) => void
}

const EMPTY_PROGRAM: Program = { id: '', name: '', units: 'kg', workouts: [], sessionsPerWeek: 0 }

const RANGES: { value: LadderRange; label: string }[] = [
  { value: 'step', label: 'Step' },
  { value: '3M', label: '3M' },
  { value: '1Y', label: '1Y' },
  { value: 'all', label: 'All' },
]

/** `14 Oct`: the date without its weekday, for axis labels. */
const dayMonth = (ms: number): string => humanDate(ms).slice(4)

const oneDecimal = (n: number): string => (Math.round(n * 10) / 10).toFixed(1)

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

function setText(set: SetEntry, bodyweight: boolean): string {
  const lever = leverOf(set, bodyweight)
  return `${bodyweight ? leverText(lever, true) : numberText(lever)} × ${set.reps}`
}

function planFor(program: Program | undefined, exerciseId: string): { plan: ExercisePlan; workout: string } | undefined {
  for (const workout of program?.workouts ?? []) {
    const plan = workout.exercises.find((e) => e.exerciseId === exerciseId)
    if (plan) return { plan, workout: workout.name }
  }
  return undefined
}

type Real = LiftPoint & { top: NonNullable<LiftPoint['top']> }

function realPoints(history: LiftHistory): Real[] {
  return history.points.filter((p): p is Real => !p.deload && p.top !== null)
}

/** The sentence under the verdict word: every number comes from the engine's verdict. */
function bannerFacts(
  verdict: Verdict,
  history: LiftHistory,
  records: SessionRecord[],
): string {
  switch (verdict.kind) {
    case 'moving': {
      const recorded = new Set(records.map((r) => r.sessionId))
      const count = realPoints(history)
        .slice(-4)
        .filter((p) => recorded.has(p.sessionId)).length
      return `${plural(count, 'record')} in the last 4 sessions`
    }
    case 'stalled':
      return `${plural(Math.round(verdict.weeks ?? 0), 'week')}, ${plural(verdict.sessionsSince ?? 0, 'session')} without a record since ${humanDate(verdict.since ?? 0)}`
    case 'slipping': {
      const best = verdict.bestBefore!
      return `the last 2 sessions are below ${topText(best, history.bodyweight)} on ${humanDate(best.startedAt)}`
    }
    case 'too new':
      return `${verdict.more} more ${verdict.more === 1 ? 'session' : 'sessions'} to a verdict`
  }
}

function bestValue(row: BestRow, bodyweight: boolean): string {
  if (row.e1rm !== undefined) return `${oneDecimal(row.e1rm)} kg`
  const lever = row.lever ?? 0
  const reps = row.reps ?? 0
  if (row.label.startsWith('Most reps')) return `${reps} reps`
  if (row.label === 'Least assistance' || row.label === 'Heaviest added load') return leverText(lever, bodyweight)
  return topText({ lever, reps }, bodyweight)
}

/** Maps the engine's ladder onto the chart's view model (E18-T8 ladderView.ts). */
function ladderView(
  history: LiftHistory,
  records: SessionRecord[],
  sessions: Session[],
  program: Program | undefined,
  range: LadderRange,
  now: number,
): LadderView {
  const full = buildLadder(history, { sessions, program })
  const cut = cutLadder(full, range, now)
  const bw = history.bodyweight
  const byId = new Map(history.points.map((p) => [p.sessionId, p]))
  const sessionById = new Map(sessions.map((s) => [s.id, s]))
  const recordOf = new Map(records.map((r) => [r.sessionId, r]))
  const workoutName = (session: Session | undefined): string =>
    program?.workouts.find((w) => w.id === session?.workoutId)?.name ?? ''

  const points: LadderPoint[] = cut.points.map((p) => {
    const hist = byId.get(p.sessionId)!
    const session = sessionById.get(p.sessionId)
    const record = recordOf.get(p.sessionId)
    const name = workoutName(session)
    return {
      id: p.sessionId,
      at: p.startedAt,
      lever: p.lever,
      reps: p.reps,
      target: p.target,
      deload: p.deload,
      record: record !== undefined,
      readout: {
        sessionId: p.sessionId,
        title: name ? `${humanDate(p.startedAt)} · ${name}` : humanDate(p.startedAt),
        workingSets: hist.workingSets.map((s) => setText(s, bw)),
        record: record ? `${record.kind} ${gainText(record)}` : null,
        e1rm: hist.e1rm !== null ? `${oneDecimal(hist.e1rm)} kg` : null,
        warmups: hist.warmups.length > 0 ? hist.warmups.map((s) => setText(s, bw)).join(' · ') : null,
        note: session?.note ?? null,
      },
    }
  })

  const startOf = (id: string) => byId.get(id)!.startedAt
  const treads = cut.treads.map((t, index) => ({
    lever: t.lever,
    from: startOf(t.sessionIds[0]),
    to: startOf(t.sessionIds[t.sessionIds.length - 1]),
    current: index === cut.treads.length - 1,
  }))
  const levers = [...new Set(points.map((p) => p.lever))].sort((a, b) => a - b)
  const stride = Math.max(1, Math.ceil(levers.length / 6))
  const ticks = levers
    .filter((_, i) => i % stride === 0 || i === levers.length - 1)
    .map((lever) => ({ lever, label: leverText(lever, bw) }))
  const gaps = cut.gaps.map((g) => {
    const d = new Date(g.weekStart)
    return { from: g.weekStart, to: new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7).getTime(), label: g.label }
  })
  const first = points.length > 0 ? points[0].at : now
  const from = Math.min(first, ...gaps.map((g) => g.from))
  const to = Math.max(now, points.length > 0 ? points[points.length - 1].at : now)
  const dates = [0, 1, 2, 3].map((i) => {
    const at = from + ((to - from) * i) / 3
    return { at, label: dayMonth(at) }
  })
  return {
    from,
    to,
    axisLabel: bw && levers.some((l) => l < 0) ? 'assistance · less is better' : null,
    ticks,
    treads,
    points,
    gaps,
    dates,
  }
}

function gainText(record: SessionRecord): string {
  if (record.kind === 'Rep record') return `+${record.gain} ${record.gain === 1 ? 'rep' : 'reps'}`
  if (record.kind === 'Estimated 1RM') return `+${oneDecimal(record.gain)} kg`
  if (record.kind === 'First added load') return `+${numberText(record.gain)} kg`
  if (record.kind === 'Least assistance') return `−${numberText(record.gain)} kg assistance`
  return `+${numberText(record.gain)} kg`
}

/**
 * The lift page (E18-T11, O21): verdict banner, the latest top set, the ladder with its range
 * presets, the next step, the e1RM (e1RM lifts only), the bests table and the warm-ups that are
 * not counted; a stalled lift adds its bracket and `Last moved ›`, and `4 weeks ago` draws a
 * reference tick. Every sentence comes from src/domain/stats.
 */
export function LiftPageView({ exerciseId, sessions, program, resolve, now, onOpenSession }: LiftPageViewProps): JSX.Element {
  const [range, setRange] = useState<LadderRange>('step')
  const [compare, setCompare] = useState(false)

  const live = sessions.filter((s) => s.deletedAt === undefined)
  const plans = new Map<string, ExercisePlan>()
  for (const w of program?.workouts ?? []) for (const e of w.exercises) plans.set(e.exerciseId, e)
  const histories = buildLiftHistories(live, resolve, (id) => plans.get(id))
  const history = histories.get(exerciseId)
  const name = resolve(exerciseId)?.name ?? exerciseId

  if (!history || history.points.length === 0) {
    return <p className="lift-empty">No sessions of this lift yet. Log a set and its ladder appears here.</p>
  }

  const records = computeRecords(live, resolve, (id) => plans.get(id)).filter((r) => r.exerciseId === exerciseId)
  const verdict = verdictOf(history, records, now)
  const plan = planFor(program, exerciseId)
  const exercise = resolve(exerciseId)
  const step = exercise ? nextStep(history, plans.get(exerciseId), exercise) : null
  const bw = history.bodyweight
  const latest = [...history.points].reverse().find((p) => p.top !== null)
  const bests = liftBests(history)
  const cmp = compareAgo(history, now)
  const view = ladderView(history, records, live, program, range, now)

  const stallTo = history.points[history.points.length - 1].startedAt
  const lastMoved =
    verdict.kind === 'stalled' ? history.points.find((p) => p.startedAt === verdict.since)?.sessionId : undefined
  const chart: LadderView = {
    ...view,
    reference: compare && cmp ? { at: cmp.then.startedAt, lever: cmp.then.lever, label: '4 weeks ago' } : null,
    bracket:
      verdict.kind === 'stalled' && verdict.since !== undefined
        ? { from: verdict.since, to: stallTo, label: `Stalled ${plural(Math.round(verdict.weeks ?? 0), 'week')}` }
        : null,
  }
  const move = latest ? sessionMoves(latest.sessionId, live, resolve, program ?? EMPTY_PROGRAM).find((m) => m.exerciseId === exerciseId) : undefined
  const treadLevers = view.treads.map((t) => leverText(t.lever, bw))
  const rangeCaption =
    treadLevers.length > 1
      ? `${plural(treadLevers.length - 1, 'step')} up in this range: ${treadLevers.join(' → ')}.${view.points.some((p) => p.deload) ? ' Hollow = deload, never a loss.' : ''}`
      : null
  const suggestion = step ? suggestionText(step, bw) : null

  return (
    <div className="lift-page">
      <section className={`lift-banner lift-banner-${verdict.kind.replace(' ', '-')}`} aria-label="Verdict">
        <strong className="lift-verdict">{verdictLabel(verdict.kind)}</strong>
        <span className="lift-facts">
          {plan ? `${plan.workout} · ${plan.plan.sets} × ${plan.plan.repRange[0]}–${plan.plan.repRange[1]} · ` : ''}
          {bannerFacts(verdict, history, records)}
        </span>
      </section>

      {latest?.top ? (
        <section className="lift-hero" aria-label="Latest top set">
          <p className="lift-hero-value">{topText(latest.top, bw)}</p>
          <p className="lift-hero-caption">
            {`Latest top set · ${humanDate(latest.startedAt)}`}
          </p>
          {latest.warmups.length > 0 ? (
            <p className="lift-warmups">{`Warm-ups ${latest.warmups.map((s) => setText(s, bw)).join(' · ')} · not counted`}</p>
          ) : null}
          {move ? <p className="lift-move">{move.text}</p> : null}
        </section>
      ) : null}

      <section className="lift-chart" aria-label="Ladder">
        <Ladder view={chart} title={name} onOpenSession={onOpenSession} />
        <div className="lift-presets">
          <Segmented name="lift-range" label="Range" value={range} options={RANGES} onChange={setRange} />
          {cmp ? (
            <button
              type="button"
              className="chip lift-compare"
              aria-pressed={compare}
              onClick={() => setCompare((on) => !on)}
            >
              4 weeks ago
            </button>
          ) : null}
        </div>
        {rangeCaption ? <p className="lift-range-caption">{rangeCaption}</p> : null}
        {compare && cmp ? <p className="lift-compare-text">{compareText(cmp, bw)}</p> : null}
        {lastMoved ? (
          <button type="button" className="btn-quiet lift-last-moved" onClick={() => onOpenSession?.(lastMoved)}>
            {`Last moved: ${humanDate(verdict.since ?? 0)} ›`}
          </button>
        ) : null}
      </section>

      {step ? (
        <section className="lift-next" aria-label="Next step">
          <p className="lift-next-text">{`Next: ${nextStepText(step, bw)}`}</p>
          <div
            className="lift-next-bar"
            role="progressbar"
            aria-label="Reps toward the target"
            aria-valuemin={0}
            aria-valuemax={step.target}
            aria-valuenow={Math.min(step.repsAtTop, step.target)}
          >
            <span className="lift-next-fill" style={{ width: `${step.target > 0 ? Math.min(100, (step.repsAtTop / step.target) * 100) : 0}%` }} />
          </div>
          {suggestion ? <p className="lift-next-suggestion">{suggestion}</p> : null}
        </section>
      ) : null}

      {history.e1rmLift && latest?.e1rm != null ? (
        <p className="lift-e1rm">
          <span>{`e1RM ${oneDecimal(latest.e1rm)} kg`}</span> <span className="lift-e1rm-note">estimated · latest session</span>
        </p>
      ) : null}

      {bests.length > 0 ? (
        <table className="lift-bests" aria-label="Bests">
          <thead>
            <tr>
              <th className="lift-th">Bests</th>
              <th className="lift-th lift-num">Best</th>
              <th className="lift-th lift-num">Date</th>
            </tr>
          </thead>
          <tbody>
            {bests.map((row) => (
              <tr key={row.label}>
                <td className="lift-td">{row.label}</td>
                <td className="lift-td lift-num lift-best">{bestValue(row, bw)}</td>
                <td className="lift-td lift-num lift-date">{humanDate(row.at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </div>
  )
}

export type LiftPageProps = ProgressPageProps<'lift'> & {
  /** Sends the app to a route (a Session's summary); passed down by the Progress group. */
  navigate?: (to: AppRoute) => void
  /** The clock; `Date.now` unless a test fixes it. */
  now?: () => number
}

/** The lift page as a Progress page: loads once, draws its own shell, Back to the page below. */
export function LiftPage({ page, onBack, navigate, now = Date.now }: LiftPageProps): JSX.Element {
  const sessionsData = useServiceData((services) => services.sessions.list(), ['sessions'])
  const programsData = useServiceData((services) => services.programs.load(), ['programs'])
  const catalogData = useServiceData((services) => services.catalog.load(), [])
  const overridesData = useServiceData(
    (services) => services.preferences.bodyweightOverrides().catch((): Record<string, boolean> => ({})),
    ['preferences'],
  )

  let body: JSX.Element | null = null
  let title = 'Lift'
  if (sessionsData.status === 'ready' && programsData.status === 'ready' && catalogData.status === 'ready') {
    const { catalog, library } = catalogData.data
    const libraryMap = new Map(library.map((entry) => [entry.id, entry] as const))
    const overrides = overridesData.status === 'ready' ? overridesData.data : {}
    const resolve: Resolve = (id) => {
      const exercise = resolveExercise(id, catalog, libraryMap)
      return exercise && applyBodyweight(exercise, overrides)
    }
    const { programs, activeProgramId } = programsData.data
    title = resolve(page.exerciseId)?.name ?? 'Lift'
    body = (
      <LiftPageView
        exerciseId={page.exerciseId}
        sessions={sessionsData.data}
        program={programs.find((p) => p.id === activeProgramId)}
        resolve={resolve}
        now={now()}
        onOpenSession={navigate ? (sessionId) => navigate({ tab: 'history', sessionId }) : undefined}
      />
    )
  }
  return (
    <AppShell title={title} onBack={onBack}>
      {body}
    </AppShell>
  )
}
