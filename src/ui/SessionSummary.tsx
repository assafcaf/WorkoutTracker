import { useState } from 'react'
import { band } from '../domain/band'
import { formatDay } from '../domain/dates'
import { contributors, muscleSets, toRegionCounts } from '../domain/muscles'
import { sessionChanges } from '../domain/sessionChanges'
import { heatRowsFor } from '../domain/sessionsView'
import { sessionVolume } from '../domain/volume'
import { countsTowardStats, workingSets } from '../domain/setKind'
import { numberText, topText } from '../domain/stats/copy'
import { nextTime, sessionMoves, summaryWeek, volumeLine } from '../domain/stats/moves'
import type { Weekday } from '../domain/stats/weeks'
import { STATS_MUSCLES } from '../domain/stats/muscles'
import { computeRecords, recordCount } from '../domain/stats/records'
import type { SessionRecord } from '../domain/stats/records'
import type { Region, Resolve } from '../domain/muscles'
import type { SessionChange } from '../domain/sessionChanges'
import type { BodyLog, ExercisePlan,LibraryExercise, Muscle, Program, Session, Workout } from '../types'
import { Switch } from './controls'
import { Icon } from './icons'
import { HeatCell, HeatLegend, RegionHeatList } from './RegionHeat'
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
  /** The Program the Session ran under: the moves, `Next time` and the week line read it (E18-T15). */
  program?: Program
  /** The `Deload session` switch was flipped (E18-T15); the caller stores it. */
  onDeloadChange?(on: boolean): void
  /** The weekday the week starts on, 0 = Sunday ... 6 = Saturday; Monday by default (E19-T5). */
  weekStartsOn?: Weekday
  /** The Workout the Session ran: its changes are offered for saving when `onSaveChanges` is given (E19-T15). */
  workout?: Workout
  /** Save the listed changes to the Program; omitted means no offer. */
  onSaveChanges?(changes: SessionChange[]): void | Promise<void>
  /** The Body log: the Session's volume counts Bodyweight Sets at its bodyweight (E22-T11). */
  bodyLog?: BodyLog
}

/** The duration KPI's value and unit: `52` `min`, or `1 h 05` `min` from an hour up. */
function durationParts(ms: number): [string, string] {
  const minutes = Math.round(ms / 60_000)
  if (minutes < 60) return [String(minutes), 'min']
  return [`${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}`, 'min']
}

const MINUS = '−'

/** A record row's detail: `Bench press · 85 kg × 5 · +5 kg`, `Pull-up · BW × 12 · +2 reps`. */
function recordDetail(record: SessionRecord, name: string, bodyweight: boolean): string {
  const set =
    record.kind === 'Estimated 1RM' && record.e1rm !== undefined
      ? `${numberText(Math.round(record.e1rm * 10) / 10)} kg`
      : topText({ lever: record.lever, reps: record.reps }, bodyweight)
  const amount = numberText(Math.round(record.gain * 10) / 10)
  const gain =
    record.kind === 'Rep record'
      ? `+${amount} reps`
      : record.kind === 'Least assistance'
        ? `${MINUS}${amount} kg assistance`
        : `+${amount} kg`
  return `${name} · ${set} · ${gain}`
}

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`
const capital = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1)

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
 * One session's summary (E18 O26): "What <day> did for your week", the figures (duration apart
 * from the week's), each lift's move in words beside its top set, the records, `Next time`, Worked
 * today in the 12 muscles (and by region, tappable into a `RegionPanel`), a `Deload session`
 * switch, and the volume as the last quiet line. Shown on Finish and when a Session is opened.
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
  program,
  onDeloadChange,
  weekStartsOn = 1,
  workout,
  onSaveChanges,
}: SessionSummaryProps): JSX.Element {
  const [openRegion, setOpenRegion] = useState<Region | null>(null)
  const [deload, setDeload] = useState(session.deload === true)
  const [offerOpen, setOfferOpen] = useState(true)
  const changes = workout && onSaveChanges ? sessionChanges(session, workout) : []
  const counts = toRegionCounts(muscleSets(session.entries, resolve, library))
  const muscles = muscleSets(session.entries, resolve, library)
  const all = [...earlierSessions.filter((other) => other.id !== session.id), session]
  const stats = program ?? programOf(session, workoutName, planFor)
  const records = computeRecords(all, resolve, planFor).filter((entry) => entry.sessionId === session.id)
  const prs = recordCount(records, session.id)
  const moves = sessionMoves(session.id, all, resolve, stats)
  const next = nextTime(session.id, all, resolve, stats)
  const week = program ? summaryWeek(session.id, all, program, weekStartsOn) : null
  const working = workingSets(session.entries).length
  const warmups = session.entries.filter((entry) => !countsTowardStats(entry)).length
  const [durationValue, durationUnit] = durationParts((session.finishedAt ?? session.startedAt) - session.startedAt)
  const bodyweightReps = sessionVolume(session, resolve).bodyweightReps

  async function saveChanges(): Promise<void> {
    setOfferOpen(false)
    await onSaveChanges?.(changes)
  }

  function changeLine(change: SessionChange): string {
    const name = (id: string): string => resolve(id)?.name ?? id
    if (change.kind === 'swap') return `${name(change.from)} swapped for ${name(change.to)}`
    if (change.kind === 'add') return `${name(change.plan.exerciseId)} added, ${plural(change.plan.sets, 'set', 'sets')}`
    return `${name(change.exerciseId)}: ${change.from} to ${change.to} sets`
  }

  function toggleDeload(on: boolean): void {
    setDeload(on)
    onDeloadChange?.(on)
  }

  async function share(): Promise<void> {
    const text = [
      `${workoutName ?? 'Workout'} · ${formatDay(new Date(session.startedAt), new Date())}`,
      `${durationValue} ${durationUnit} · ${plural(working, 'working set', 'working sets')} · ${plural(prs, 'record', 'records')}`,
      ...moves.map((move) => `${move.name}: ${move.top} · ${move.text}`),
      volumeLine(session.id, all, resolve),
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

        {week ? (
          <section className="session-summary-week" aria-label="This week">
            <h3 className="session-summary-week-heading">{week.heading}</h3>
            <p className="session-summary-week-line">{week.line}</p>
          </section>
        ) : null}

        <div className="session-summary-lead">
          <p className="session-summary-figures">
            <span data-kpi="duration">
              <span className="session-summary-kpi-value">{`${durationValue} ${durationUnit}`}</span>
            </span>
            {' · '}
            <span data-kpi="sets">
              <span className="session-summary-kpi-value">{working}</span>
              {working === 1 ? ' working set' : ' working sets'}
            </span>
            {' · '}
            <span data-kpi="prs">
              <span className="session-summary-kpi-value">{prs}</span>
              {prs === 1 ? ' record' : ' records'}
            </span>
          </p>
          {warmups > 0 ? (
            <p className="session-summary-warmups">{`${plural(warmups, 'warm-up', 'warm-ups')} not counted`}</p>
          ) : null}
        </div>

        {moves.length > 0 ? (
          <section className="session-summary-section" aria-label="Lift by lift">
            <h3 className="session-summary-caption">Lift by lift</h3>
            <div className="session-summary-moves card">
              {moves.map((move) => (
                <div key={move.exerciseId} className="session-summary-move">
                  <span className="session-summary-move-name">{move.name}</span>
                  <span className="session-summary-move-top">{move.top}</span>
                  <span className="session-summary-move-text">{move.text}</span>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section className="session-summary-section" aria-label="Records">
          <h3 className="session-summary-caption">Records</h3>
          {records.length > 0 ? (
            <ul className="session-summary-prs card">
              {records.map((record) => (
                <li key={`${record.exerciseId}-${record.kind}`} className="session-summary-record">
                  <span className="tag tag-pr" aria-label="Personal record">
                    PR
                  </span>
                  <span className="session-summary-record-text">
                    <span className="session-summary-record-label">{record.kind}</span>
                    <span className="session-summary-record-detail">
                      {recordDetail(
                        record,
                        resolve(record.exerciseId)?.name ?? record.exerciseId,
                        resolve(record.exerciseId)?.bodyweight === true,
                      )}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="session-summary-quiet">No records</p>
          )}
        </section>

        {next.length > 0 ? (
          <section className="session-summary-next" aria-label="Next time">
            <h3 className="session-summary-caption">Next time</h3>
            {next.map((line) => (
              <p key={line} className="session-summary-next-line">
                {line}
              </p>
            ))}
          </section>
        ) : null}

        <section className="session-summary-worked card" aria-label="Worked today">
          <div className="session-summary-card-head">
            <h3 className="session-summary-card-title">Worked today</h3>
            <span className="session-summary-card-note">working sets</span>
          </div>
          <div className="session-summary-muscles">
            {STATS_MUSCLES.map((muscle) => {
              const count = muscles.get(muscle) ?? 0
              return (
                <div key={muscle} className="session-summary-muscle" data-muscle={muscle} data-band={band(count, 'session')}>
                  <span className="session-summary-muscle-name">{capital(muscle)}</span>
                  <HeatCell count={count} scale="session" />
                </div>
              )
            })}
          </div>
          <RegionHeatList rows={heatRowsFor([counts])} counts={counts} scale="session" onRegionTap={setOpenRegion} />
          <HeatLegend scale="session" />
        </section>

        {offerOpen && changes.length > 0 ? (
          <section className="session-summary-save card" aria-label="Save changes to program">
            <h3 className="session-summary-caption">Save changes to program</h3>
            <ul className="session-summary-save-list">
              {changes.map((change) => (
                <li key={changeLine(change)}>{changeLine(change)}</li>
              ))}
            </ul>
            <div className="session-summary-save-actions">
              <button type="button" className="btn-primary" onClick={() => void saveChanges()}>
                Save
              </button>
              <button type="button" className="btn-secondary" onClick={() => setOfferOpen(false)}>
                Not now
              </button>
            </div>
          </section>
        ) : null}

        <div className="session-summary-deload">
          <Switch label="Deload session" checked={deload} onChange={toggleDeload} />
        </div>

        <p className="session-summary-volume">
          <span data-kpi="volume">
            <span className="session-summary-kpi-value">{volumeLine(session.id, all, resolve)}</span>
            {bodyweightReps > 0 ? (
              <span className="session-summary-kpi-note">{` · ${bodyweightReps} bodyweight reps`}</span>
            ) : null}
          </span>
        </p>
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
          onBrowse={(muscleList) => {
            setOpenRegion(null)
            onBrowse?.(muscleList)
          }}
          onClose={() => setOpenRegion(null)}
        />
      ) : null}
    </div>
  )
}

/** A Program of just the Session's Workout, for a caller that gave none: Plans through `planFor`. */
function programOf(
  session: Session,
  workoutName: string | undefined,
  planFor: (exerciseId: string) => ExercisePlan | undefined,
): Program {
  const ids = [...new Set(session.entries.map((entry) => entry.exerciseId))]
  const exercises = ids.flatMap((id) => {
    const plan = planFor(id)
    return plan ? [plan] : []
  })
  return {
    id: session.programId,
    name: workoutName ?? session.workoutId,
    units: 'kg',
    sessionsPerWeek: 0,
    workouts: [{ id: session.workoutId, name: workoutName ?? session.workoutId, exercises }],
  }
}
