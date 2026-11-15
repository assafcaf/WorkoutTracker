import { useState } from 'react'
import { exerciseTrend, trendLabel, trendSummary, trendValueText } from '../domain/exerciseTrend'
import type { ExerciseTrend } from '../domain/exerciseTrend'
import { shortDay } from '../domain/lifts'
import { recordsSetBy } from '../domain/records'
import { formatSet, formatSetCompact } from '../domain/setText'
import type { Exercise, ExercisePlan, Session, SetEntry, SetKind } from '../types'
import { TrendChart } from './charts/TrendChart'
import type { TrendChartPoint } from './charts/TrendChart'
import './ExerciseHistoryOverlay.css'

export type ExerciseHistoryOverlayProps = {
  exercise: Exercise
  /** Every Session the app knows; the overlay lists the finished ones that logged `exercise`. */
  sessions: Session[]
  plan: ExercisePlan
  onClose(): void
}

const KIND_MARKERS: Record<SetKind, string> = { warmup: 'W', drop: 'D', failure: 'F', amrap: 'A' }

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Sessions the log shows before `Show all`. */
const LOG_PREVIEW = 4

/** `Tue 6 Oct`, in the device's local time. */
function dateText(at: number): string {
  const d = new Date(at)
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`
}

/** What the chart's number is, under the headline. */
function trendCaption(trend: ExerciseTrend): string {
  if (trend.kind === 'e1rm') return 'Estimated max (Epley) from the best set, per session'
  if (trend.kind === 'reps') return 'Working reps added up, per session'
  if (trendLabel(trend) === 'Assistance') return 'Least assistance of any set, per session · less is better'
  return 'Heaviest added load of any set, per session'
}

/**
 * The History overlay (E16-T7), read-only. It leads with the lift's trend -- one number per
 * finished Session that folds weight and reps together (`exerciseTrend`: e1RM on a loaded lift,
 * signed Load or total reps on a Bodyweight one) -- headed by the latest value and the Set
 * behind it, then a chart whose larger dots are new bests. The log follows, compact: the latest
 * few Sessions, newest first, and `Show all` for the rest.
 */
export function ExerciseHistoryOverlay({
  exercise,
  sessions,
  plan,
  onClose,
}: ExerciseHistoryOverlayProps): JSX.Element {
  const [showAll, setShowAll] = useState(false)
  const logged = sessions
    .filter((s) => s.finishedAt !== null && s.entries.some((e) => e.exerciseId === exercise.id))
    .sort((a, b) => b.startedAt - a.startedAt)
  const trend = exerciseTrend(exercise, logged)
  const now = new Date()
  const chartPoints: TrendChartPoint[] = trend.points.map((p) => ({
    id: p.sessionId,
    at: p.at,
    value: p.value,
    record: p.record,
    date: shortDay(p.at, now),
    valueText: trendValueText(trend, p.value),
    detail: `Best set ${formatSet(p.best)}${p.record ? ' · New best' : ''}`,
  }))
  const latest = trend.points[trend.points.length - 1]
  const best = trend.points.reduce<(typeof trend.points)[number] | undefined>(
    (top, p) => (top === undefined || p.value >= top.value ? p : top),
    undefined,
  )
  const summary = trendSummary(trend)
  const shown = showAll ? logged : logged.slice(0, LOG_PREVIEW)

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="exercise-history-heading"
      className="overlay-panel exercise-history-overlay"
    >
      <div className="exercise-history-header">
        <h2 id="exercise-history-heading" className="exercise-history-heading">
          History · {exercise.name}
        </h2>
        <button type="button" className="exercise-history-close btn-quiet" onClick={onClose}>
          Close
        </button>
      </div>
      {logged.length === 0 ? (
        <p className="exercise-history-empty">No earlier Sessions</p>
      ) : (
        <>
          {latest ? (
            <section className="exercise-history-trend" aria-label="Trend">
              <p className="exercise-history-headline">
                <span className="exercise-history-value">{trendValueText(trend, latest.value)}</span>{' '}
                <span className="exercise-history-best">{`${formatSet(latest.best)} · ${dateText(latest.at)}`}</span>
              </p>
              <p className="exercise-history-caption">{trendCaption(trend)}</p>
              {chartPoints.length > 1 ? (
                <>
                  <p className="exercise-history-summary">{summary}</p>
                  {best && best !== latest ? (
                    <p className="exercise-history-caption">
                      {`Best ${trendValueText(trend, best.value)} · ${formatSet(best.best)} · ${shortDay(best.at, now)}`}
                    </p>
                  ) : null}
                  <TrendChart
                    points={chartPoints}
                    summary={summary}
                    tickText={trendLabel(trend) === 'Assistance' ? (v) => String(Math.abs(v)) : undefined}
                  />
                  <p className="exercise-history-legend">Big dots are new bests · tap a point for its set</p>
                </>
              ) : (
                <p className="exercise-history-summary">One session so far: the trend starts with the next.</p>
              )}
            </section>
          ) : null}
          <h3 className="exercise-history-log-heading">Sessions</h3>
          <ul className="exercise-history-list" aria-label="Sessions">
            {shown.map((s) => {
              const entries = s.entries
                .filter((e) => e.exerciseId === exercise.id)
                .sort((a, b) => a.setIndex - b.setIndex)
              const earlier = logged.filter((o) => o.startedAt < s.startedAt)
              const isRecord = (entry: SetEntry): boolean =>
                recordsSetBy(exercise, plan, earlier, s, entry).length > 0
              return (
                <li key={s.id} className="exercise-history-session">
                  <span className="exercise-history-date">{dateText(s.startedAt)}</span>
                  <span className="exercise-history-sets">
                    {entries.map(formatSetCompact).join(' · ')}
                  </span>
                  {entries.map((entry) =>
                    entry.kind === undefined ? null : (
                      <span key={`k${entry.setIndex}`} className="set-kind-marker">
                        {KIND_MARKERS[entry.kind]}
                      </span>
                    ),
                  )}
                  {entries.some(isRecord) ? (
                    <span className="tag tag-pr" aria-label="Personal record">
                      PR
                    </span>
                  ) : null}
                </li>
              )
            })}
          </ul>
          {logged.length > shown.length ? (
            <button type="button" className="exercise-history-more btn-quiet" onClick={() => setShowAll(true)}>
              {`Show all ${logged.length} sessions`}
            </button>
          ) : null}
        </>
      )}
    </div>
  )
}
