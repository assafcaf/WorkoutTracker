import { useState } from 'react'
import { formatDay } from '../domain/dates'
import { formatSet } from '../domain/setText'
import {
  exerciseRows,
  percentChange,
  previousOfWorkout,
  recordCount,
  recordGain,
  recordTrend,
  summarize,
} from '../domain/summary'
import { contributors, muscleSets, toRegionCounts } from '../domain/muscles'
import { heatRowsFor } from '../domain/sessionsView'
import { sessionVolume } from '../domain/volume'
import { workingSets } from '../domain/setKind'
import type { ExerciseRecord } from '../domain/records'
import type { Region, Resolve } from '../domain/muscles'
import type { ExercisePlan, LibraryExercise, Muscle, Session } from '../types'
import { RecordSpark } from './charts/RecordSpark'
import { Icon } from './icons'
import { HeatLegend, RegionHeatList } from './RegionHeat'
import { RegionPanel } from './RegionPanel'
import { musclesForRegion } from './regionMuscles'
import './SessionSummary.css'

export type SessionSummaryProps = {
  session: Session
  resolve: Resolve
  library: Map<string, LibraryExercise>
  /** Finished Sessions started before this one (E13-T7): what its PRs are measured against. */
  earlierSessions?: Session[]
  /** The Plan for an Exercise in this Session's Workout, if it has one (E13-T7). */
  planFor?(exerciseId: string): ExercisePlan | undefined
  /** The Session's Workout name, the summary's heading (`Workout A`). */
  workoutName?: string
  onClose(): void
  /** A region panel's "Browse exercises" (M9), carried up to whoever can switch tabs. */
  onBrowse?(muscles: Muscle[]): void
  /** Opens the Session's editor; omitted means no Edit control (the finish summary). */
  onEdit?(): void
}

/** The duration KPI's value and unit: `52` `min`, or `1 h 05` `min` from an hour up. */
function durationParts(ms: number): [string, string] {
  const minutes = Math.round(ms / 60_000)
  if (minutes < 60) return [String(minutes), 'min']
  return [`${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}`, 'min']
}

const kg = (value: number): string => value.toLocaleString('en-US', { maximumFractionDigits: 1 })
const signed = (value: number): string => (value > 0 ? `+${kg(value)}` : value < 0 ? `−${kg(-value)}` : '0')

/** A record's value: `85 kg × 5`, `75 kg` for an e1RM, `BW−27 × 8` for a Load, `12 reps` bodyweight. */
function recordValue(record: ExerciseRecord): string {
  if (record.kind === 'heaviest-load' || record.kind === 'most-reps-at-load') {
    return formatSet({ weightKg: null, loadKg: record.value, reps: record.reps })
  }
  if (record.kind === 'best-e1rm') return `${kg(record.value)} kg`
  return record.weightKg === null ? `${record.reps} reps` : `${record.weightKg} kg × ${record.reps}`
}

/** The short name `vs last …` reads: `A` for `Workout A`, the whole name otherwise. */
function shortName(name: string): string {
  return name.replace(/^Workout\s+/i, '')
}

type Contributor = { exerciseId: string; name: string; sets: number }

/**
 * The exercises contributing to `region` within `session`: `contributors` over every muscle the
 * region is drawn for, merged by exercise so one exercise training two of them is listed once.
 */
function regionContributors(
  session: Session,
  region: Region,
  resolve: Resolve,
  library: Map<string, LibraryExercise>,
): Contributor[] {
  const byExercise = new Map<string, Contributor>()
  for (const muscle of musclesForRegion(region)) {
    for (const contributor of contributors(session.entries, muscle, resolve, library)) {
      const existing = byExercise.get(contributor.exerciseId)
      if (existing) existing.sets += contributor.sets
      else byExercise.set(contributor.exerciseId, { ...contributor })
    }
  }
  return [...byExercise.values()]
}

/**
 * One session's summary (Progress Dashboard S5b): the Workout and day, a KPI strip (duration,
 * volume against the last Session of the same Workout, sets, PRs), the records set with their
 * trend, the regions worked as heat squares (each tappable into a `RegionPanel`), and a table of
 * the Exercises. Shown on Finish and when a Session is opened from the Sessions tab.
 */
export function SessionSummary({
  session,
  resolve,
  library,
  earlierSessions = [],
  planFor = () => undefined,
  workoutName,
  onClose,
  onBrowse,
  onEdit,
}: SessionSummaryProps): JSX.Element {
  const [openRegion, setOpenRegion] = useState<Region | null>(null)
  const counts = toRegionCounts(muscleSets(session.entries, resolve, library))
  const stats = summarize(session, earlierSessions, resolve, planFor)
  const [durationValue, durationUnit] = durationParts(stats.durationMs)
  const previous = previousOfWorkout(session, earlierSessions)
  const change = previous ? percentChange(stats.volumeKg, sessionVolume(previous, resolve).kg) : null
  const prs = recordCount(stats)
  const rows = exerciseRows(session, earlierSessions, resolve)
  const recordIds = new Set(stats.records.map((entry) => entry.exerciseId))
  const records = stats.records.flatMap((entry) => {
    const exercise = resolve(entry.exerciseId)
    const plan = planFor(entry.exerciseId)
    return entry.records.map((record) => {
      const gain = recordGain(record, entry.before)
      return {
        key: `${entry.exerciseId}-${record.kind}`,
        label: record.label,
        text:
          `${entry.name} · ${recordValue(record)}` +
          (gain && gain.amount > 0 ? ` · +${kg(gain.amount)} ${gain.unit}` : ''),
        trend:
          exercise && plan ? recordTrend(exercise, plan, record.kind, [...earlierSessions, session]) : [],
      }
    })
  })

  async function share(): Promise<void> {
    const text = [
      `${workoutName ?? 'Workout'} · ${formatDay(new Date(session.startedAt), new Date())}`,
      `${durationValue} ${durationUnit} · ${kg(stats.volumeKg)} kg · ${workingSets(session.entries).length} sets · ${prs} PR`,
      ...rows.map((row) => `${row.name}: ${row.best ? formatSet(row.best) : '—'}`),
    ].join('\n')
    try {
      if (navigator.share) await navigator.share({ title: workoutName ?? 'Workout', text })
      else await navigator.clipboard?.writeText(text)
    } catch {
      // The share sheet dismissed, or no clipboard: nothing to tell the trainee.
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Session summary"
      className="session-summary overlay-panel"
    >
      <div className="session-summary-body">
        <header className="session-summary-head">
          <h2 className="session-summary-heading">{workoutName ?? 'Workout'}</h2>
          <span className="session-summary-date">{formatDay(new Date(session.startedAt), new Date())}</span>
          {onEdit ? (
            <button type="button" className="session-summary-edit icon-btn" aria-label="Edit session" onClick={onEdit}>
              <Icon name="Pencil" size={20} />
            </button>
          ) : null}
        </header>

        <div className="session-summary-kpis card">
          <div className="session-summary-kpi" data-kpi="duration">
            <span className="session-summary-kpi-label">Duration</span>
            <span className="session-summary-kpi-value">
              <span className="session-summary-kpi-number">{durationValue}</span>{' '}
              <span className="session-summary-kpi-unit">{durationUnit}</span>
            </span>
          </div>
          <div className="session-summary-kpi" data-kpi="volume">
            <span className="session-summary-kpi-label">Volume</span>
            <span className="session-summary-kpi-value">
              <span className="session-summary-kpi-number">{kg(Math.round(stats.volumeKg))}</span>{' '}
              <span className="session-summary-kpi-unit">kg</span>
            </span>
            {change !== null ? (
              <span className="session-summary-kpi-note">
                {`${change > 0 ? '+' : change < 0 ? '−' : ''}${Math.abs(change)}% vs last ${shortName(workoutName ?? 'time')}`}
              </span>
            ) : null}
            {stats.bodyweightReps > 0 ? (
              <span className="session-summary-kpi-note">{`· ${stats.bodyweightReps} bodyweight reps`}</span>
            ) : null}
          </div>
          <div className="session-summary-kpi" data-kpi="sets">
            <span className="session-summary-kpi-label">Sets</span>
            <span className="session-summary-kpi-value">
              <span className="session-summary-kpi-number">{workingSets(session.entries).length}</span>
            </span>
          </div>
          <div className="session-summary-kpi" data-kpi="prs">
            <span className="session-summary-kpi-label">PRs</span>
            <span className="session-summary-kpi-value">
              <span className="session-summary-kpi-number">{prs}</span>
            </span>
          </div>
        </div>

        {records.length > 0 ? (
          <section className="session-summary-section" aria-label="Records">
            <h3 className="session-summary-caption">Records</h3>
            <ul className="session-summary-prs card">
              {records.map((record) => (
                <li key={record.key} className="session-summary-record">
                  <span className="tag tag-pr" aria-label="Personal record">
                    PR
                  </span>
                  <span className="session-summary-record-text">
                    <span className="session-summary-record-label">{record.label}</span>
                    <span className="session-summary-record-detail">{record.text}</span>
                  </span>
                  <RecordSpark values={record.trend} label={`${record.label} trend`} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="session-summary-worked card" aria-label="Worked today">
          <div className="session-summary-card-head">
            <h3 className="session-summary-card-title">Worked today</h3>
            <span className="session-summary-card-note">sets per region</span>
          </div>
          <RegionHeatList rows={heatRowsFor([counts])} counts={counts} scale="session" onRegionTap={setOpenRegion} />
          <HeatLegend scale="session" />
        </section>

        {rows.length > 0 ? (
          <div className="session-summary-table-card card">
            <table className="session-summary-table">
              <thead>
                <tr>
                  <th scope="col">Exercise</th>
                  <th scope="col">Best set</th>
                  <th scope="col">Volume, kg</th>
                  <th scope="col">Δ vs last</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const reps = row.volume.unit === 'reps' ? ' reps' : ''
                  return (
                    <tr key={row.exerciseId}>
                      <td>{row.name}</td>
                      <td className="session-summary-best">
                        {row.best ? formatSet(row.best) : '—'}
                        {recordIds.has(row.exerciseId) ? (
                          <>
                            {' '}
                            <span className="tag tag-pr">PR</span>
                          </>
                        ) : null}
                      </td>
                      <td>{`${kg(row.volume.amount)}${reps}`}</td>
                      <td className="session-summary-delta">{row.delta === null ? '—' : `${signed(row.delta)}${reps}`}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>

      <div className="session-summary-dock">
        <button type="button" className="session-summary-share btn-secondary" onClick={() => void share()}>
          <Icon name="Share" size={20} />
          Share
        </button>
        <button type="button" className="session-summary-done btn-primary" onClick={onClose}>
          Done
        </button>
      </div>

      {openRegion !== null ? (
        <RegionPanel
          region={openRegion}
          count={counts.get(openRegion) ?? 0}
          contributors={regionContributors(session, openRegion, resolve, library)}
          onBrowse={(muscles) => {
            setOpenRegion(null)
            onBrowse?.(muscles)
          }}
          onClose={() => setOpenRegion(null)}
        />
      ) : null}
    </div>
  )
}
