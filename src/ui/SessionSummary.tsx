import { useState } from 'react'
import { band } from '../domain/band'
import { formatDay } from '../domain/dates'
import { contributors, muscleSets, regionsFor, toRegionCounts } from '../domain/muscles'
import { muscleLabel } from '../domain/muscleLabels'
import { sessionChanges } from '../domain/sessionChanges'
import { bodyweightOn } from '../domain/bodyLog'
import { sessionVolume } from '../domain/volume'
import { countsTowardStats, workingSets } from '../domain/setKind'
import { numberText, topText } from '../domain/stats/copy'
import { sessionMoves, volumeLine } from '../domain/stats/moves'
import type { Weekday } from '../domain/stats/weeks'
import { computeRecords, sessionPrs } from '../domain/stats/records'
import type { SessionRecord } from '../domain/stats/records'
import {
  comparisonText,
  liftLine,
  liftLineText,
  prHeadline,
  recordGainText,
  weekLine,
  workedToday,
} from '../domain/summaryLines'
import type { Region, Resolve } from '../domain/muscles'
import type { SessionChange } from '../domain/sessionChanges'
import type { BodyLog, ExercisePlan,LibraryExercise, Muscle, Program, Session, Workout } from '../types'
import { Icon } from './icons'
import { healthShortcutUrl, readHealthReady } from './healthShortcut'
import { RegionPanel } from './RegionPanel'
import { PrTag, SetFigure } from './figures'
import { Sheet } from './Sheet'
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
  /** V6-03: opens the one Lift page: each Lift by lift name is a button to it. */
  onOpenLift?(exerciseId: string): void
  /** Opens the Session's editor; omitted means no Edit control (the finish summary). */
  onEdit?(): void
  /**
   * V5: deletes the Session straight from its summary, no edit mode first; the caller offers
   * Undo. Omitted means no Delete control (the finish summary).
   */
  onDelete?(): void
  /**
   * The Program the Session ran under: the moves and the "This week n of N · next up <Workout>"
   * line read it (E18-T15, V4-03). Omitted means no week line.
   */
  program?: Program
  /**
   * Unused since V2-10: the `Deload session` switch moved to the Session editor, which saves it
   * with the Session. Kept so an older caller still type-checks.
   */
  onDeloadChange?(on: boolean): void
  /** The weekday the week starts on, 0 = Sunday ... 6 = Saturday; Monday by default (E19-T5). */
  weekStartsOn?: Weekday
  /** The Workout the Session ran: its changes are offered for saving when `onSaveChanges` is given (E19-T15). */
  workout?: Workout
  /** Save the listed changes to the Program; omitted means no offer. */
  onSaveChanges?(changes: SessionChange[]): void | Promise<void>
  /** The Body log: the Session's volume counts Bodyweight Sets at its bodyweight (E22-T11). */
  bodyLog?: BodyLog
  /** Opens a URL (the Apple Health Shortcut, E24-T11); defaults to navigating the page to it. */
  openUrl?(url: string): void
}

/** The duration KPI's value and unit: `52` `min`, or `1 h 05` `min` from an hour up. */
function durationParts(ms: number): [string, string] {
  const minutes = Math.round(ms / 60_000)
  if (minutes < 60) return [String(minutes), 'min']
  return [`${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}`, 'min']
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** A local YYYY-MM-DD day as `1 Oct`. */
function dayMonth(day: string): string {
  const [, month, date] = day.split('-').map(Number)
  return `${date} ${MONTHS[month - 1]}`
}

/** A record row's detail: `Bench press · 85 kg × 5 · +5 kg`, `Pull-up · BW × 12 · +2 reps`. */
function recordDetail(record: SessionRecord, name: string, bodyweight: boolean): string {
  const set =
    record.kind === 'Estimated 1RM' && record.e1rm !== undefined
      ? `${numberText(Math.round(record.e1rm * 10) / 10)} kg`
      : topText({ lever: record.lever, reps: record.reps }, bodyweight)
  const gain = recordGainText(record)
  return `${name} · ${set}${gain === '' ? '' : ` · ${gain}`}`
}

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`

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
 * One session's summary (E18 O26, V2-10, V4-03): one win, one comparison, and what comes next.
 * The headline is the first PR ("+n more PR" when there are others), then the figures with the
 * comparison against the last same Workout, one plain sentence per lift, the Records list only
 * when there are 2 or more, Worked today as one sorted line of the muscles trained (each tappable
 * into its region's `RegionPanel`), "This week n of N · next up <Workout>", and the volume as the
 * last quiet line. The dock is `Share…` (text, or Apple Health) and `Done`. Shown on Finish and
 * when a Session is opened.
 *
 * V6 (V5-05): opened from Sessions (given `onEdit` or `onDelete`) it is a past workout: no
 * headline, the PR count in the figures line, each PR tagged once in Lift by lift, no Records
 * list, no week line, "Muscles worked (sets)" in whole Sets, and the labelled volume line.
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
  onOpenLift,
  onEdit,
  onDelete,
  program,
  weekStartsOn = 1,
  workout,
  onSaveChanges,
  bodyLog = [],
  openUrl = (url: string): void => {
    window.location.href = url
  },
}: SessionSummaryProps): JSX.Element {
  const [openRegion, setOpenRegion] = useState<Region | null>(null)
  const [offerOpen, setOfferOpen] = useState(true)
  const [shareOpen, setShareOpen] = useState(false)
  const [healthReady] = useState(readHealthReady)
  const changes = workout && onSaveChanges ? sessionChanges(session, workout) : []
  const counts = toRegionCounts(muscleSets(session.entries, resolve, library))
  // V6 (V5-05): opened from Sessions (it has Edit or Delete) it is a past workout: its header says
  // the PR count, each PR is tagged once in Lift by lift, and the lines about today go.
  const past = onEdit !== undefined || onDelete !== undefined
  const worked = workedToday(muscleSets(session.entries, resolve, library))
  // A past workout's muscles in whole Sets (a secondary half rounds), none left at 0.
  const shownWorked = past
    ? worked.map((row) => ({ ...row, count: Math.round(row.count) })).filter((row) => row.count > 0)
    : worked
  const all = [...earlierSessions.filter((other) => other.id !== session.id), session]
  const stats = program ?? programOf(session, workoutName, planFor)
  // V6 (V5-06): the Session's PRs under the one rule; rep bests are neither listed nor counted.
  const records = sessionPrs(computeRecords(all, resolve, planFor), session.id)
  const headline = past ? null : prHeadline(records, resolve)
  const week = program && !past ? weekLine(session, all, program, weekStartsOn) : null
  const working = workingSets(session.entries).length
  const warmups = session.entries.filter((entry) => !countsTowardStats(entry)).length
  const [durationValue, durationUnit] = durationParts((session.finishedAt ?? session.startedAt) - session.startedAt)
  const weighed = bodyweightOn(bodyLog, session.startedAt)
  const bodyweightReps = sessionVolume(session, resolve, weighed?.kg ?? null).bodyweightReps
  const hasBodyweightSets = sessionVolume(session, resolve).bodyweightReps > 0
  // V2-10: a Session that logged fewer working Sets than its Workout plans is not compared with
  // a full one: its figures read "5 of 23 sets" and no %.
  const plannedWorkout =
    program?.workouts.find((w) => w.id === session.workoutId) ??
    workout ??
    stats.workouts.find((w) => w.id === session.workoutId)
  const plannedSets = (plannedWorkout?.exercises ?? []).reduce(
    (sum, plan) => sum + plan.sets,
    0,
  )
  const partial = plannedSets > 0 && working < plannedSets
  const short = plannedSets > 0 && working * 2 < plannedSets
  const comparison = partial ? null : comparisonText(session, all, resolve, plannedSets, bodyLog)
  // V3-02 / V4-03: a partial Exercise makes no comparison, "2 of 4 sets".
  const plannedSetsOf = (exerciseId: string): number | undefined =>
    (plannedWorkout?.exercises ?? []).find(
      (plan) => (session.swaps?.[plan.exerciseId] ?? plan.exerciseId) === exerciseId,
    )?.sets
  const planOf = (id: string): ExercisePlan | undefined =>
    planFor(id) ?? stats.workouts.flatMap((w) => w.exercises).find((plan) => plan.exerciseId === id)
  const lifts = sessionMoves(session.id, all, resolve, stats).map((move) => ({
    exerciseId: move.exerciseId,
    name: move.name,
    line: liftLine(move.exerciseId, session, all, resolve, planOf, records, plannedSetsOf(move.exerciseId)),
  }))
  // The volume's comparison moved up to the figures line (V4-03); this line is the kilos alone.
  const volumeText = volumeLine(session.id, all, resolve, bodyLog).split(' · ')[0]

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

  const setsText = `${short ? 'Short session · ' : ''}${partial ? `${working} of ${plannedSets} sets` : plural(working, 'set', 'sets')}`

  async function share(): Promise<void> {
    const text = [
      `${workoutName ?? 'Workout'} · ${formatDay(new Date(session.startedAt), new Date())}`,
      ...(headline ? [`PR ${headline.text}${headline.more ? ` · ${headline.more}` : ''}`] : []),
      [`${durationValue} ${durationUnit}`, setsText, ...(comparison ? [comparison] : [])].join(' · '),
      ...lifts.map((lift) => `${lift.name}: ${liftLineText(lift.line)}`),
      ...(week ? [week] : []),
      `Volume ${volumeText}`,
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

        {headline ? (
          <p className="session-summary-win">
            <PrTag />
            <span className="session-summary-win-text">{headline.text}</span>
            {headline.more ? <span className="session-summary-win-more">{headline.more}</span> : null}
          </p>
        ) : null}

        <div className="session-summary-lead">
          <p className="session-summary-figures">
            <span data-kpi="duration">
              <span className="session-summary-kpi-value">{`${durationValue} ${durationUnit}`}</span>
            </span>
            {' · '}
            {/* V6-11: under half the planned Sets, it says so; Train keeps this Workout next. */}
            {short ? (
              <>
                <span data-kpi="short">Short session</span>
                {' · '}
              </>
            ) : null}
            <span data-kpi="sets">
              <span className="session-summary-kpi-value">{working}</span>
              {partial ? ` of ${plannedSets} sets` : working === 1 ? ' set' : ' sets'}
            </span>
            {past && records.length > 0 ? (
              <>
                {' · '}
                <span data-kpi="prs">{plural(records.length, 'PR', 'PRs')}</span>
              </>
            ) : null}
            {comparison ? (
              <>
                {' · '}
                <span data-kpi="comparison">{comparison}</span>
              </>
            ) : null}
          </p>
          {warmups > 0 ? (
            <p className="session-summary-warmups">{`${plural(warmups, 'warm-up', 'warm-ups')} not counted`}</p>
          ) : null}
        </div>

        {lifts.length > 0 ? (
          <section className="session-summary-section" aria-label="Lift by lift">
            <h3 className="session-summary-caption">Lift by lift</h3>
            <div className="session-summary-moves card">
              {lifts.map((lift) => (
                <div key={lift.exerciseId} className="session-summary-move">
                  {onOpenLift ? (
                    <button
                      type="button"
                      className="session-summary-move-name lift-door btn-quiet"
                      onClick={() => onOpenLift(lift.exerciseId)}
                    >
                      {lift.name}
                    </button>
                  ) : (
                    <span className="session-summary-move-name">{lift.name}</span>
                  )}
                  <span className="session-summary-move-text">
                    {lift.line.sets.map((set, index) => (
                      <span key={index} className="session-summary-move-set">
                        {index > 0 ? ' · ' : ''}
                        <SetFigure set={set.set} />
                        {set.pr ? (
                          <>
                            {' '}
                            <PrTag />
                          </>
                        ) : null}
                      </span>
                    ))}
                    {lift.line.tail !== '' ? (
                      <span className="session-summary-move-tail">
                        {lift.line.sets.length > 0 ? ' · ' : ''}
                        {lift.line.tail}
                      </span>
                    ) : null}
                  </span>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {!past && records.length >= 2 ? (
          <section className="session-summary-section" aria-label="Records">
            <h3 className="session-summary-caption">Records</h3>
            <ul className="session-summary-prs card">
              {records.map((record) => (
                <li key={`${record.exerciseId}-${record.kind}`} className="session-summary-record">
                  <PrTag />
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
          </section>
        ) : null}

        {worked.length > 0 ? (
          <section className="session-summary-worked" aria-label={past ? 'Muscles worked' : 'Worked today'}>
            <p className="session-summary-muscles">
              <span className="session-summary-worked-label">
                {past ? 'Muscles worked (sets): ' : 'Worked today: '}
              </span>
              {shownWorked.map(({ muscle, count }, index) => {
                const name = muscleLabel(muscle)
                return (
                  <span key={muscle}>
                    {index > 0 ? <span aria-hidden="true">{' · '}</span> : null}
                    <button
                      type="button"
                      className="session-summary-muscle cell"
                      data-muscle={muscle}
                      data-band={band(count, 'session')}
                      aria-label={`${name}, ${numberText(count)} sets`}
                      onClick={() => setOpenRegion(regionsFor(muscle)[0])}
                    >
                      {`${name} ${numberText(count)}`}
                    </button>
                  </span>
                )
              })}
            </p>
          </section>
        ) : null}

        {week ? <p className="session-summary-week">{week}</p> : null}

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

        {/* V6 (V5-05): the volume line is labelled, so "6,815 kg" says what it is. */}
        <p className="session-summary-volume">
          <span className="session-summary-volume-label">Volume </span>
          <span data-kpi="volume">
            <span className="session-summary-kpi-value">{volumeText}</span>
            {bodyweightReps > 0 ? (
              <span className="session-summary-kpi-note">{` · ${bodyweightReps} bodyweight reps`}</span>
            ) : null}
            {weighed && hasBodyweightSets ? (
              <span className="session-summary-kpi-note">
                {` · bodyweight ${numberText(weighed.kg)} kg (${dayMonth(weighed.day)})`}
              </span>
            ) : null}
          </span>
        </p>

        {onDelete ? (
          <button type="button" className="session-summary-delete btn-danger" onClick={onDelete}>
            <Icon name="Trash" size={20} />
            Delete workout
          </button>
        ) : null}
      </div>

      <div className="session-summary-dock">
        <button
          type="button"
          className="session-summary-share btn-secondary"
          aria-haspopup="dialog"
          onClick={() => setShareOpen(true)}
        >
          <Icon name="Share" size={20} />
          Share…
        </button>
        <button type="button" className="session-summary-done btn-primary" onClick={onClose}>
          Done
        </button>
      </div>

      {shareOpen ? (
        <Sheet label="Share session" onClose={() => setShareOpen(false)}>
          <div className="session-summary-share-sheet">
            <h3 className="session-summary-caption">Share session</h3>
            <button
              type="button"
              className="session-summary-share-option btn-secondary"
              onClick={() => {
                setShareOpen(false)
                void share()
              }}
            >
              <Icon name="Share" size={20} />
              Share as text
            </button>
            <button
              type="button"
              className="session-summary-share-option btn-secondary"
              onClick={() => {
                setShareOpen(false)
                openUrl(healthShortcutUrl(session, workoutName ?? 'Workout'))
              }}
            >
              Send to Apple Health
            </button>
            {healthReady ? null : (
              <p className="session-summary-quiet">
                If iOS says it can&apos;t find the shortcut, set it up first in Settings › Apple Health.
              </p>
            )}
          </div>
        </Sheet>
      ) : null}

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
