import { Fragment, useState } from 'react'
import { buildLiftHistories, leverOf, straightSets } from '../domain/stats/liftHistory'
import type { LiftHistory, LiftPoint } from '../domain/stats/liftHistory'
import { changeSince, changeTextFor, liftRecordRows, measureOf, sessionLog, storyPoints } from '../domain/stats/liftStory'
import { liftPrs } from '../domain/stats/records'
import type { Measure } from '../domain/stats/liftStory'
import { liftStatus } from '../domain/stats/status'
import type { LiftStatus } from '../domain/stats/status'
import { dayMonth, humanDate, leverText, numberText } from '../domain/stats/words'
import { formatSetCompact } from '../domain/setText'
import type { Exercise, ExercisePlan, Session, SetEntry, SetKind } from '../types'
import { PrTag, SetFigure, StatusMark, statusTone } from './figures'
import { LiftChart } from './charts/LiftChart'
import type { LiftChartPoint } from './charts/LiftChart'
import './LiftView.css'

export type LiftViewProps = {
  exercise: Exercise
  /** The Plan the lift is done under; its rep range decides Ready. */
  plan: ExercisePlan | undefined
  /** Every Session the app knows; only finished, undeleted ones count. */
  sessions: Session[]
  now: number
  /** Opens a Session's summary from its log row or its chart readout; rows are plain without it. */
  onOpenSession?: (sessionId: string) => void
  /** Offers a variation when the status's action is a change of exercise. */
  onSwap?: () => void
}

type Range = '3M' | '1Y' | 'all'
type Show = 'est' | 'weight'

const RANGES: { value: Range; label: string }[] = [
  { value: '3M', label: '3M' },
  { value: '1Y', label: '1Y' },
  { value: 'all', label: 'All' },
]
const SHOWS: { value: Show; label: string }[] = [
  { value: 'est', label: 'Est. strength' },
  { value: 'weight', label: 'Top set' },
]
const RANGE_DAYS: Record<Exclude<Range, 'all'>, number> = { '3M': 92, '1Y': 366 }
/** The Progress ledger's window (12 weeks), which the 3M change line shares. */
const LEDGER_DAYS = 84
const DAY = 24 * 3600_000
/** Log rows before `Show all`. */
const LOG_PREVIEW = 4

const KIND_MARKERS: Record<SetKind, string> = { warmup: 'W', drop: 'D', failure: 'F', amrap: 'A' }
const KIND_NAMES: Record<SetKind, string> = { warmup: 'warm-up', drop: 'drop set', failure: 'to failure', amrap: 'AMRAP' }
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

type Real = LiftPoint & { top: { lever: number; reps: number } }

/** `Deload 21–25 Sep`. */
function deloadCaption(from: number, to: number): string {
  const a = new Date(from)
  const b = new Date(to)
  const end = `${b.getDate()} ${MONTHS[b.getMonth()]}`
  if (from === to || (a.getMonth() === b.getMonth() && a.getDate() === b.getDate())) return `Deload ${end}`
  return a.getMonth() === b.getMonth() ? `Deload ${a.getDate()}–${end}` : `Deload ${a.getDate()} ${MONTHS[a.getMonth()]}–${end}`
}

/** What the one number is, in one line (study §1.7: Fitbod's "Estimated Strength" with its meaning). */
function definitionOf(measure: Measure, history: LiftHistory): { name: string; text: string } {
  if (measure === 'est') return { name: 'Est. strength', text: 'Est. strength: the one-rep max your best set predicts' }
  if (measure === 'reps') return { name: 'Best set', text: 'Best set: the most reps you did in one set' }
  const assisted = history.points.every((p) => straightSets(p.workingSets).every((s) => leverOf(s, true) <= 0))
  return assisted
    ? { name: 'Top load', text: 'Top load: the assistance on your top set; less is stronger' }
    : { name: 'Top load', text: 'Top load: the weight you added on your top set' }
}

/**
 * The status's reason and one line that sets expectations (study §3 Copy voice): `Mon 12 Oct was
 * your first day at 70 kg; 7 reps on a new weight is normal. When every set reaches 10, go to
 * 72.5 kg.` Every other status gives its rule (`LiftStatus.why[0]`) and a sentence on what is
 * normal, so the reason is a sentence on the page rather than behind a Why?.
 */
export function reasonLine(status: LiftStatus, real: Real[], exercise: Exercise, plan: ExercisePlan | undefined, bw: boolean): string {
  const L = (lever: number) => leverText(lever, bw)
  const latest = real[real.length - 1]
  const previous = real[real.length - 2]
  const load = latest.top.lever
  const hi = plan?.repRange[1]
  const goTo = hi !== undefined && !bw ? ` When every set reaches ${hi}, go to ${L(Math.round((load + exercise.weightStep) * 100) / 100)}.` : ''
  switch (status.kind) {
    case 'moving': {
      if (previous && load > previous.top.lever) {
        const first = !real.slice(0, -1).some((p) => p.top.lever >= load)
        const day = `${humanDate(latest.startedAt)} was your ${first ? 'first day' : 'first day back'} at ${L(load)}`
        const normal = hi !== undefined && latest.top.reps < hi ? `; ${latest.top.reps} reps on a new weight is normal.` : '.'
        return `${day}${normal}${goTo}`
      }
      return `${status.why[0]}${goTo}`
    }
    case 'ready':
      return `${status.why[0]} The first session at a new weight usually costs a rep or two; that is normal.`
    case 'hold':
      return `${status.why[0]} Repeating a weight until it feels easier is normal.`
    case 'lowered':
      return `${status.why[0]} That is a choice, not a slide.`
    case 'slipping':
      return `${status.why[0]} One or two low days happen to everyone; sleep and food move reps too.`
    case 'stalled':
      return `${status.why[0]} A few flat weeks are normal; one change usually restarts a lift.`
    case 'break':
      return `${status.why[0]} Strength comes back fast; the first session back feels heavier than it is.`
    default:
      return `${status.why[0]} Until then, every session is a starting point.`
  }
}

/** `+9.6` (kg, one decimal), else the story's own words (`+2 reps`, `1.5 kg less assistance`). */
function changeWords(measure: Measure, history: LiftHistory, delta: number): string {
  if (measure !== 'est') return changeTextFor(history, delta)
  const size = Math.round(Math.abs(delta) * 10) / 10
  return size === 0 ? 'no change' : `${delta > 0 ? '+' : '−'}${size.toFixed(1)}`
}

/** One run of a Session's Sets written as one figure: one load, its reps, a kind or a PR after. */
type SetRun = { first: SetEntry; more: number[]; kind?: SetKind; pr: boolean }

/**
 * A Session's working Sets as runs (study §3 Numerals, `46.25 × 9 · 8 · 8`): consecutive straight
 * Sets at one load share a figure; a Set of another kind stands alone with its marker; the Set that
 * set a real record ends its run, so the PR tag follows the Set that earned it.
 */
export function setRuns(sets: SetEntry[], prSetIndex: number | null): SetRun[] {
  const runs: SetRun[] = []
  for (const s of sets) {
    const last = runs[runs.length - 1]
    const sameLoad = last !== undefined && last.first.weightKg === s.weightKg && (last.first.loadKg ?? null) === (s.loadKg ?? null)
    const pr = prSetIndex === s.setIndex
    if (last && sameLoad && !last.pr && last.kind === undefined && s.kind === undefined) {
      last.more.push(s.reps)
      last.pr = pr
    } else {
      runs.push({ first: s, more: [], kind: s.kind, pr })
    }
  }
  return runs
}

/**
 * The one Lift page (study §1.7 and §3, v7): reached from the Progress ledger and from the live
 * tools sheet's Lift history. Top to bottom:
 *   - the status as a glyph and word, its action as a sentence, and its reason with one line that
 *     sets expectations (no Why?), with Swap where the action is a change of exercise;
 *   - the one number: est. strength at 44 px (top load or best set on a Bodyweight lift), its
 *     change since the range's first Session, and what it means;
 *   - one chip row: Est. strength / Top set, then 3M 1Y All as text tabs;
 *   - one ink line, the standing record a gold ring, deloads a grey band, no point labels;
 *   - Records, then the Sessions as set rows with the PR tag on the Set that earned it.
 */
export function LiftView({ exercise, plan, sessions, now, onOpenSession, onSwap }: LiftViewProps): JSX.Element {
  const [range, setRange] = useState<Range>('3M')
  const [show, setShow] = useState<Show>('est')
  const [showAll, setShowAll] = useState(false)

  const live = sessions.filter((s) => s.deletedAt === undefined && s.finishedAt !== null)
  const history = buildLiftHistories(
    live,
    (id) => (id === exercise.id ? exercise : undefined),
    (id) => (id === exercise.id ? plan : undefined),
  ).get(exercise.id)
  const status = liftStatus(exercise, plan, sessions, now)
  const real = (history?.points.filter((p) => !p.deload && p.top !== null) ?? []) as Real[]

  if (!history || !status || real.length === 0) {
    return (
      <div className="lift-view">
        <p className="lift-empty">No sessions of this lift yet. Log a set and its history appears here.</p>
      </div>
    )
  }

  const bw = history.bodyweight
  const L = (lever: number) => leverText(lever, bw)
  const measure = measureOf(history)
  const tone = statusTone(status.kind)
  const story = storyPoints(history)
  const storyOf = new Map(story.map((p) => [p.sessionId, p.value]))
  const latestStory = story.filter((p) => !p.deload).at(-1)
  const definition = definitionOf(measure, history)

  const from = range === 'all' ? -Infinity : now - RANGE_DAYS[range] * DAY
  // On 3M the change runs over the same 12 weeks as the Progress ledger row, so the two agree.
  const change = changeSince(story, range === '3M' ? now - LEDGER_DAYS * DAY : from)
  const changeTone = !change ? 'flat' : changeWords(measure, history, change.delta) === 'no change' ? 'flat' : change.delta > 0 ? 'up' : 'down'
  const heroValue =
    latestStory === undefined
      ? ''
      : measure === 'est'
        ? latestStory.value.toFixed(1)
        : measure === 'load'
          ? L(Math.round(latestStory.value * 100) / 100)
          : String(Math.round(latestStory.value))
  const heroUnit = measure === 'est' ? 'kg' : measure === 'reps' ? 'reps' : ''

  const records = liftPrs(history)
  const shown = history.points.filter((p): p is Real => p.top !== null && p.startedAt >= from)
  const showing: Show = measure === 'est' ? show : 'weight'
  const valueOf = (p: Real): number =>
    showing === 'est' || measure === 'reps' ? (storyOf.get(p.sessionId) ?? 0) : p.top.lever
  const atTopLine = (p: Real): string =>
    `${L(p.top.lever)} × ${straightSets(p.workingSets)
      .filter((s) => leverOf(s, bw) === p.top.lever)
      .map((s) => s.reps)
      .join(', ')}`
  const chartPoints: LiftChartPoint[] = shown.map((p) => ({
    id: p.sessionId,
    at: p.startedAt,
    value: valueOf(p),
    deload: p.deload,
    record: records.has(p.sessionId),
    date: humanDate(p.startedAt),
    readout: showing === 'est' ? `${numberText(Math.round(valueOf(p) * 10) / 10)} kg est. strength · ${atTopLine(p)}` : atTopLine(p),
  }))
  const line = chartPoints.filter((p) => !p.deload)
  const tick =
    showing === 'est'
      ? (v: number) => String(Math.round(v * 10) / 10)
      : measure === 'reps'
        ? (v: number) => String(v)
        : (v: number) => (bw ? L(v) : numberText(v))
  const what = showing === 'est' ? 'Estimated strength' : measure === 'reps' ? 'Most reps in a set' : 'Top-set weight'
  const summary =
    line.length > 1
      ? `${what}, ${tick(line[0].value)} on ${dayMonth(line[0].at)} to ${tick(line[line.length - 1].value)} on ${dayMonth(line[line.length - 1].at)}`
      : `${what} in this range`
  const recordRows = liftRecordRows(history)
  const log = sessionLog(history)
  const notes = new Map(live.flatMap((s) => (s.note ? [[s.id, s.note] as const] : [])))
  const shownLog = showAll ? log : log.slice(0, LOG_PREVIEW)

  return (
    <div className="lift-view">
      <section className="lift-status" aria-label="Status">
        <StatusMark as="p" className="lift-status-label" tone={tone} glyph={status.glyph}>
          {status.label}
        </StatusMark>
        <p className="lift-status-action">{status.action}</p>
        <p className="lift-status-reason">{reasonLine(status, real, exercise, plan, bw)}</p>
        {status.swap && onSwap ? (
          <button type="button" className="btn-quiet lift-swap" onClick={onSwap}>
            Swap for a variation ›
          </button>
        ) : null}
      </section>

      <section className="lift-hero" aria-label={definition.name}>
        <p className="lift-hero-line">
          <span className="lift-hero-value">
            {heroValue}
            {heroUnit ? <span className="lift-hero-unit">{` ${heroUnit}`}</span> : null}
          </span>
          {change ? (
            <span className="lift-hero-change" data-tone={changeTone}>
              {`${changeTone === 'up' ? '↑ ' : changeTone === 'down' ? '↓ ' : ''}${changeWords(measure, history, change.delta)} since ${dayMonth(change.since)}`}
            </span>
          ) : null}
        </p>
        <p className="lift-hero-definition">{definition.text}</p>
      </section>

      <section className="lift-chart-section" aria-label="Chart">
        <div className="lift-controls">
          {measure === 'est' ? (
            <div role="radiogroup" aria-label="Show" className="lift-chips">
              {SHOWS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={show === option.value}
                  value={option.value}
                  className="chip lift-chip"
                  onClick={() => setShow(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          ) : null}
          <div role="radiogroup" aria-label="Range" className="lift-ranges">
            {RANGES.map((option) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={range === option.value}
                value={option.value}
                className="tab lift-range"
                onClick={() => setRange(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        {chartPoints.length > 1 ? (
          <LiftChart
            points={chartPoints}
            summary={summary}
            tickText={tick}
            step={showing === 'weight' && measure !== 'reps'}
            bandCaption={deloadCaption}
            onOpenSession={onOpenSession}
          />
        ) : (
          <p className="lift-chart-empty">
            {chartPoints.length === 1 ? `One session in this range: ${chartPoints[0].readout}.` : 'No sessions in this range.'}
          </p>
        )}
      </section>

      {recordRows.length > 0 ? (
        <section className="lift-records" aria-labelledby={`lift-records-${exercise.id}`}>
          <h3 id={`lift-records-${exercise.id}`} className="lift-section-title">
            Records
          </h3>
          <table className="lift-bests" aria-label="Records">
            <tbody>
              {recordRows.map((row) => (
                <tr key={row.label}>
                  <th scope="row" className="lift-td lift-record-label">
                    {row.label}
                  </th>
                  <td className="lift-td lift-num">
                    <span className="lift-best">{row.value}</span>
                    <span className="lift-date">{row.detail ? `${row.detail} · ${dayMonth(row.at)}` : dayMonth(row.at)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      <section className="lift-log" aria-labelledby={`lift-log-${exercise.id}`}>
        <h3 id={`lift-log-${exercise.id}`} className="lift-section-title">
          Sessions
        </h3>
        <ul className="lift-log-list" aria-label="Sessions">
          {shownLog.map((row) => {
            const note = notes.get(row.sessionId)
            const runs = setRuns(row.sets, row.record?.setIndex ?? null)
            const body = (
              <>
                <span className="lift-log-line">
                  <span className="lift-log-head">
                    <span className="lift-log-date">{humanDate(row.at)}</span>
                    {row.deload ? <span className="tag lift-log-deload">Deload</span> : null}
                  </span>
                  <span className="lift-log-sets">
                    {runs.map((run, i) => (
                      <Fragment key={run.first.setIndex}>
                        {i > 0 ? ' · ' : ''}
                        <SetFigure set={run.first} moreReps={run.more} />
                        {run.kind !== undefined ? (
                          <span className="set-kind-marker" title={KIND_NAMES[run.kind]}>
                            {` ${KIND_MARKERS[run.kind]}`}
                          </span>
                        ) : null}
                        {run.pr && row.record ? (
                          <>
                            {' '}
                            <PrTag label={`Personal record, ${row.record.kind.toLowerCase()}`} />
                          </>
                        ) : null}
                      </Fragment>
                    ))}
                  </span>
                </span>
                {row.warmups.length > 0 ? (
                  <span className="lift-warmups">{`W ${row.warmups.map(formatSetCompact).join(' · ')}`}</span>
                ) : null}
                {note ? <span className="lift-log-note">{`“${note}”`}</span> : null}
              </>
            )
            return (
              <li key={row.sessionId} className="lift-log-row">
                {onOpenSession ? (
                  <button type="button" className="btn-quiet lift-log-open" onClick={() => onOpenSession(row.sessionId)}>
                    {body}
                  </button>
                ) : (
                  <div className="lift-log-static">{body}</div>
                )}
              </li>
            )
          })}
        </ul>
        {log.length > shownLog.length ? (
          <button type="button" className="btn-quiet lift-log-more" onClick={() => setShowAll(true)}>
            {`Show all ${log.length} sessions`}
          </button>
        ) : null}
      </section>
    </div>
  )
}
