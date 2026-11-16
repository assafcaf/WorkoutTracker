import { Fragment, useState } from 'react'
import { buildLiftHistories, leverOf, straightSets } from '../domain/stats/liftHistory'
import type { LiftPoint } from '../domain/stats/liftHistory'
import { EST_MAX_FORMULA, liftRecordRows, sessionLog, storyPoints } from '../domain/stats/liftStory'
import { liftPrs } from '../domain/stats/records'
import { liftStatus } from '../domain/stats/status'
import { dayMonth, humanDate, leverText, numberText, plural, topText } from '../domain/stats/words'
import { formatSetCompact } from '../domain/setText'
import type { Exercise, ExercisePlan, Session, SetKind } from '../types'
import { Segmented } from './controls'
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
type Show = 'weight' | 'est'

const RANGES: { value: Range; label: string }[] = [
  { value: '3M', label: '3M' },
  { value: '1Y', label: '1Y' },
  { value: 'all', label: 'All' },
]
const SHOWS: { value: Show; label: string }[] = [
  { value: 'weight', label: 'Weight' },
  { value: 'est', label: 'Est. strength' },
]
const RANGE_DAYS: Record<Exclude<Range, 'all'>, number> = { '3M': 92, '1Y': 366 }
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

/**
 * The one Lift page (v6 §6.3, V5-08, V6-09): reached from the dashboard's cards and rows and from
 * the live tools sheet's Lift history. Top to bottom:
 *   - the status block -- label, action and Why?, verbatim from `liftStatus`;
 *   - the hero: the latest top set, and how it moved (`Wed 14 Oct · up 2.5 kg`);
 *   - one chart: top-set weight as steps (or est. strength), points labelled by their reps, records
 *     filled, deloads hollow in a named band, ranges 3M / 1Y / All;
 *   - Records: heaviest set, best est. strength, most reps at the current load;
 *   - the session log, a PR tag only on the Set that set a real record, warm-ups on their own
 *     muted line, the Session note in quotes;
 *   - the est. strength formula, once, after the Est. strength view has been shown.
 */
export function LiftView({ exercise, plan, sessions, now, onOpenSession, onSwap }: LiftViewProps): JSX.Element {
  const [range, setRange] = useState<Range>('3M')
  const [show, setShow] = useState<Show>('weight')
  const [seenEst, setSeenEst] = useState(false)
  const [why, setWhy] = useState(false)
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
  const plain = bw && real.every((p) => p.top.lever === 0)
  const latest = real[real.length - 1]
  const previous = real[real.length - 2]
  const lastAny = history.points[history.points.length - 1]
  let move = ''
  if (lastAny.deload) move = 'deload'
  else if (previous) {
    const up = Math.round((latest.top.lever - previous.top.lever) * 100) / 100
    const reps = latest.top.reps - previous.top.reps
    move =
      up > 0
        ? `up ${numberText(up)} kg`
        : up < 0
          ? `down from ${L(previous.top.lever)}`
          : reps === 0
            ? 'same'
            : `${reps > 0 ? '+' : '−'}${plural(Math.abs(reps), 'rep')}`
  }

  const records = liftPrs(history)
  const est = new Map(storyPoints(history).map((p) => [p.sessionId, p.value]))
  const from = range === 'all' ? -Infinity : now - RANGE_DAYS[range] * DAY
  const shown = history.points.filter((p): p is Real => p.top !== null && p.startedAt >= from)
  const showing: Show = bw ? 'weight' : show
  const valueOf = (p: Real): number => (showing === 'est' ? (est.get(p.sessionId) ?? 0) : plain ? p.top.reps : p.top.lever)
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
    label: showing === 'est' ? `${numberText(p.top.lever)}×${p.top.reps}` : String(p.top.reps),
    date: humanDate(p.startedAt),
    readout: showing === 'est' ? `${numberText(Math.round(valueOf(p) * 10) / 10)} kg est. strength · ${atTopLine(p)}` : atTopLine(p),
  }))
  const line = chartPoints.filter((p) => !p.deload)
  const tick = showing === 'est' ? (v: number) => String(Math.round(v * 10) / 10) : plain ? (v: number) => String(v) : (v: number) => (bw ? L(v) : numberText(v))
  const what = showing === 'est' ? 'Estimated strength' : plain ? 'Top-set reps' : 'Top-set weight'
  const summary =
    line.length > 1
      ? `${what}, ${tick(line[0].value)} on ${dayMonth(line[0].at)} to ${tick(line[line.length - 1].value)} on ${dayMonth(line[line.length - 1].at)}`
      : `${what} in this range`
  const recordRows = liftRecordRows(history)
  const log = sessionLog(history)
  const notes = new Map(live.flatMap((s) => (s.note ? [[s.id, s.note] as const] : [])))
  const shownLog = showAll ? log : log.slice(0, LOG_PREVIEW)
  const pickShow = (next: Show) => {
    setShow(next)
    if (next === 'est') setSeenEst(true)
  }

  return (
    <div className="lift-view">
      <section className={`lift-status lift-status-${statusTone(status.kind)}`} aria-label="Status">
        <StatusMark as="p" className="lift-status-label" tone={statusTone(status.kind)} glyph={status.glyph}>
          {status.label}
        </StatusMark>
        <p className="lift-status-action">{status.action}</p>
        <div className="lift-status-foot">
          {status.swap && onSwap ? (
            <button type="button" className="btn-quiet lift-why" onClick={onSwap}>
              Swap ›
            </button>
          ) : (
            <span />
          )}
          <button type="button" className="btn-quiet lift-why" aria-expanded={why} onClick={() => setWhy((v) => !v)}>
            {why ? 'Hide' : 'Why?'}
          </button>
        </div>
        {why ? (
          <ul className="lift-why-lines">
            {status.why.map((text, i) => (
              <li key={i}>{text}</li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="lift-hero" aria-label="Latest top set">
        <p className="lift-hero-value">{topText(latest.top, bw)}</p>
        <p className="lift-hero-change">{move ? `${humanDate(lastAny.startedAt)} · ${move}` : humanDate(latest.startedAt)}</p>
      </section>

      <section className="lift-chart-section" aria-label="Chart">
        <div className="lift-tabs">
          {bw ? null : <Segmented name={`lift-show-${exercise.id}`} label="Show" value={show} options={SHOWS} onChange={pickShow} />}
          <Segmented name={`lift-range-${exercise.id}`} label="Range" value={range} options={RANGES} onChange={setRange} />
        </div>
        {chartPoints.length > 1 ? (
          <LiftChart
            points={chartPoints}
            summary={summary}
            tickText={tick}
            step={showing === 'weight'}
            axisLabel={showing === 'est' ? 'est. strength, kg' : undefined}
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
                    <span className="lift-date">{row.detail ? `${row.detail} · ${humanDate(row.at)}` : humanDate(row.at)}</span>
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
            const body = (
              <>
                <span className="lift-log-head">
                  <span className="lift-log-date">{humanDate(row.at)}</span>
                  {row.deload ? <span className="tag lift-log-deload">Deload</span> : null}
                </span>
                <span className="lift-log-sets">
                  {row.sets.map((s, i) => (
                    <Fragment key={s.setIndex}>
                      {i > 0 ? ' · ' : ''}
                      <SetFigure set={s} />
                      {s.kind !== undefined ? (
                        <span className="set-kind-marker" title={KIND_NAMES[s.kind]}>
                          {` ${KIND_MARKERS[s.kind]}`}
                        </span>
                      ) : null}
                      {row.record?.setIndex === s.setIndex ? (
                        <>
                          {' '}
                          <PrTag label={`Personal record, ${row.record.kind.toLowerCase()}`} />
                        </>
                      ) : null}
                    </Fragment>
                  ))}
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

      {seenEst ? <p className="lift-footnote">{EST_MAX_FORMULA}</p> : null}
    </div>
  )
}
