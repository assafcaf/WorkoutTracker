import { useState } from 'react'
import type { ReactNode } from 'react'
import { formatDay } from '../domain/dates'
import { buildShareCard } from '../domain/shareCard'
import { sessionChanges } from '../domain/sessionChanges'
import { bodyweightOn } from '../domain/bodyLog'
import { sessionVolume } from '../domain/volume'
import { countsTowardStats, workingSets } from '../domain/setKind'
import { humanDate, numberText } from '../domain/stats/copy'
import { volumeLine } from '../domain/stats/moves'
import type { Weekday } from '../domain/stats/weeks'
import { computeRecords, sessionPrs } from '../domain/stats/records'
import type { SessionRecord } from '../domain/stats/records'
import { liftLineText, nextLine, sessionLifts, summaryVerdict } from '../domain/summaryLines'
import type { LiftVerdict } from '../domain/summaryLines'
import type { Resolve } from '../domain/muscles'
import type { SessionChange } from '../domain/sessionChanges'
import type { BodyLog, ExercisePlan, LibraryExercise, Muscle, Program, Session, Workout } from '../types'
import { Icon } from './icons'
import { healthShortcutUrl, readHealthReady } from './healthShortcut'
import { PrTag, SetFigure, StatusMark } from './figures'
import { Sheet } from './Sheet'
import { shareCardImage } from './ShareCard'
import './SessionSummary.css'

export type SessionSummaryProps = {
  session: Session
  resolve: Resolve
  /**
   * Unused since v7: the muscles left the summary for Progress › Muscles (study §1.6, §4). Kept
   * so callers still type-check.
   */
  library: Map<string, LibraryExercise>
  /** Finished Sessions started before this one (E13-T7): what its PRs are measured against. */
  earlierSessions?: Session[]
  /** The Plan for an Exercise in this Session's Workout, if it has one (E13-T7). */
  planFor?(exerciseId: string): ExercisePlan | undefined
  /** The Session's Workout name, the summary's heading (`Workout A`). */
  workoutName?: string
  onClose(): void
  /** Unused since v7 (see `library`): no muscle on the summary opens a region panel any more. */
  onBrowse?(muscles: Muscle[]): void
  /** V6-03: opens the one Lift page: each Lift by lift name is a button to it. */
  onOpenLift?(exerciseId: string): void
  /**
   * Opens the Session's editor; omitted means no Edit control (the finish summary). Given, the
   * summary is Session detail (DX-14 / Sessions): "Edit" as text in its header, no Done bar.
   */
  onEdit?(): void
  /**
   * No longer drawn (Session detail, DX-14): a Session is deleted from its editor only, with
   * Undo. Kept so callers still type-check; given, it still marks the summary as Session detail.
   */
  onDelete?(): void
  /**
   * Session detail drawn inside the caller's own page (the Shell, with its own ‹ back): no
   * overlay panel and no back control of its own. Omitted, Session detail is a full-screen panel
   * with a ‹ Back in its header that calls `onClose`.
   */
  embedded?: boolean
  /**
   * The Program the Session ran under: the moves and the finish summary's "Next: <Workout>" read
   * it (E18-T15, V4-03, v7). Omitted means no Next line.
   */
  program?: Program
  /**
   * Unused since V2-10: the `Deload session` switch moved to the Session editor, which saves it
   * with the Session. Kept so an older caller still type-checks.
   */
  onDeloadChange?(on: boolean): void
  /** Unused since v7: the week line left the summary (Train and Sessions own the week). */
  weekStartsOn?: Weekday
  /** The Workout the Session ran: its changes are offered for saving when `onSaveChanges` is given (E19-T15). */
  workout?: Workout
  /** Save the listed changes to the Program; omitted means no offer. */
  onSaveChanges?(changes: SessionChange[]): void | Promise<void>
  /** The Body log: the Session's volume counts Bodyweight Sets at its bodyweight (E22-T11). */
  bodyLog?: BodyLog
  /** Opens a URL (the Apple Health Shortcut, E24-T11); defaults to navigating the page to it. */
  openUrl?(url: string): void
  /**
   * Photos2: the Session day's progress photos, one line under the totals (the caller draws it:
   * the "Add progress photos" action on Finish, the day's thumbnails on a past workout).
   */
  photos?: ReactNode
}

/**
 * The duration's value and unit: `52` `min`, or `1 h 05` `min` from an hour up. DX-14: a Session
 * shorter than a minute reads `1 min`, never `0 min`.
 */
function durationParts(ms: number): [string, string] {
  const minutes = Math.max(1, Math.round(ms / 60_000))
  if (minutes < 60) return [String(minutes), 'min']
  return [`${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}`, 'min']
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** A local YYYY-MM-DD day as `1 Oct`. */
function dayMonth(day: string): string {
  const [, month, date] = day.split('-').map(Number)
  return `${date} ${MONTHS[month - 1]}`
}

/** A record's kind in the summary's words: `heaviest`, `est. strength`, `least assistance`. */
const RECORD_WORDS: Record<SessionRecord['kind'], string> = {
  'Heaviest weight': 'heaviest',
  'Estimated 1RM': 'est. strength',
  'Least assistance': 'least assistance',
  'First added load': 'first added load',
  'Rep record': 'rep record',
}

/** A record's figure: the Set that set it (`70 kg × 7`, `BW−15 × 6`), or its est. strength (`97.5 kg`). */
function recordFigure(record: SessionRecord, bodyweight: boolean): JSX.Element {
  if (record.kind === 'Estimated 1RM' && record.e1rm !== undefined) {
    return <SetFigure set={{ weightKg: Math.round(record.e1rm * 10) / 10 }} />
  }
  const set = bodyweight
    ? { weightKg: null, ...(record.lever === 0 ? {} : { loadKg: record.lever }), reps: record.reps }
    : { weightKg: record.lever, reps: record.reps }
  return <SetFigure set={set} unit={!bodyweight} />
}

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`

/** A lift's verdict on the right: `↑ +2.5 kg` in the status colour, or a quiet `First time`. */
function Verdict({ verdict }: { verdict: LiftVerdict }): JSX.Element {
  if (verdict.glyph === '') {
    return (
      <span className="session-summary-verdict status-mark" data-tone="flat" data-kind={verdict.kind}>
        {verdict.text}
      </span>
    )
  }
  const tone = verdict.kind === 'up' ? 'up' : verdict.kind === 'down' ? 'down' : 'flat'
  return (
    <StatusMark className="session-summary-verdict" tone={tone} glyph={verdict.glyph}>
      {verdict.text}
    </StatusMark>
  )
}

/**
 * One session's summary (study §1.6, "Was that a good session?"; v7 build-plan step 8): the day
 * and duration, the Workout, one verdict sentence ("5 of 7 lifts beat Wednesday. Two records."),
 * the PR rows in gold, Lift by lift (each lift's Sets in the repeated-reps form and one ↑ / = / ↓
 * against last time on the right), one totals line, "Next: Workout A" with Share as a text link,
 * and Done as the one primary. No muscles (Progress › Muscles has them) and no week line. Shown on
 * Finish and when a Session is opened from Sessions, which adds Edit (the pencil) and Delete.
 */
export function SessionSummary({
  session,
  resolve,
  earlierSessions = [],
  planFor = () => undefined,
  workoutName,
  onClose,
  onOpenLift,
  onEdit,
  onDelete,
  embedded = false,
  program,
  workout,
  onSaveChanges,
  bodyLog = [],
  photos = null,
  openUrl = (url: string): void => {
    window.location.href = url
  },
}: SessionSummaryProps): JSX.Element {
  const [offerOpen, setOfferOpen] = useState(true)
  const [shareOpen, setShareOpen] = useState(false)
  const [healthReady] = useState(readHealthReady)
  const changes = workout && onSaveChanges ? sessionChanges(session, workout) : []
  // Opened from Sessions (it has Edit or Delete) it is a past workout: no "Next" line.
  const past = onEdit !== undefined || onDelete !== undefined
  const all = [...earlierSessions.filter((other) => other.id !== session.id), session]
  const stats = program ?? programOf(session, workoutName, planFor)
  // V6 (V5-06): the Session's PRs under the one rule; rep bests are neither listed nor counted.
  const records = sessionPrs(computeRecords(all, resolve, planFor), session.id)
  const working = workingSets(session.entries).length
  const warmups = session.entries.filter((entry) => !countsTowardStats(entry)).length
  const [durationValue, durationUnit] = durationParts((session.finishedAt ?? session.startedAt) - session.startedAt)
  const weighed = bodyweightOn(bodyLog, session.startedAt)
  const bodyweightReps = sessionVolume(session, resolve, weighed?.kg ?? null).bodyweightReps
  const hasBodyweightSets = sessionVolume(session, resolve).bodyweightReps > 0
  // V2-10: a Session that logged fewer working Sets than its Workout plans says "5 of 23 sets".
  const plannedWorkout =
    program?.workouts.find((w) => w.id === session.workoutId) ??
    workout ??
    stats.workouts.find((w) => w.id === session.workoutId)
  const plannedSets = (plannedWorkout?.exercises ?? []).reduce((sum, plan) => sum + plan.sets, 0)
  const partial = plannedSets > 0 && working < plannedSets
  const short = plannedSets > 0 && working * 2 < plannedSets
  // V3-02 / V4-03: a partial Exercise makes no comparison, "2 of 4 sets" (`sessionLifts`).
  const planOf = (id: string): ExercisePlan | undefined =>
    planFor(id) ?? stats.workouts.flatMap((w) => w.exercises).find((plan) => plan.exerciseId === id)
  // V7R-02: the one lift-by-lift reading Home's Last time row counts from too.
  const lifts = sessionLifts(session, all, resolve, stats, planOf, records, plannedWorkout)
  const verdict = summaryVerdict(
    lifts.map((lift) => ({ name: lift.name, verdict: lift.line.verdict })),
    records.length,
    session.startedAt,
  )
  // "vs Wed 7 Oct" over Lift by lift when every compared lift was last done that day.
  const comparedDays = [
    ...new Set(
      lifts
        .filter((lift) => ['up', 'same', 'down'].includes(lift.line.verdict.kind))
        .map((lift) => lift.line.verdict.lastAt),
    ),
  ]
  const versus =
    comparedDays.length === 0
      ? null
      : comparedDays.length === 1 && comparedDays[0] !== null
        ? `vs ${humanDate(comparedDays[0])}`
        : 'vs last time'
  const next = program && !past ? nextLine(session, all, program) : null
  // The volume is one small number in the totals line (study §1.6): the kilos alone.
  const volumeText = volumeLine(session.id, all, resolve, bodyLog).split(' · ')[0]
  const dayText = formatDay(new Date(session.startedAt), new Date())

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
  const sentence = [verdict.lead, verdict.rest].filter((part) => part !== '').join(' ')
  // DX-14: the Summary leads with its comparison line; a short Session says so first, "Short
  // Session: 2 of 23 sets", since its few lifts make no comparison of their own.
  const shortLead = short ? `Short Session: ${working} of ${plannedSets} sets` : ''

  async function share(): Promise<void> {
    const text = [
      `${workoutName ?? 'Workout'} · ${dayText} · ${durationValue} ${durationUnit}`,
      ...(sentence === '' ? [] : [sentence]),
      ...lifts.map((lift) => `${lift.name}: ${liftLineText(lift.line)}`),
      `${setsText} · ${volumeText}`,
      ...(next ? [next] : []),
    ].join('\n')
    try {
      if (navigator.share) await navigator.share({ title: workoutName ?? 'Workout', text })
      else await navigator.clipboard?.writeText(text)
    } catch {
      // The share sheet dismissed, or no clipboard: nothing to tell the trainee.
    }
  }

  async function shareImage(): Promise<void> {
    try {
      await shareCardImage(buildShareCard(session, earlierSessions, resolve, planOf, workoutName))
    } catch {
      // The share sheet dismissed: nothing to tell the trainee.
    }
  }

  const shareSheet = shareOpen ? (
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
            void shareImage()
          }}
        >
          <Icon name="Share" size={20} />
          Share as image
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
  ) : null

  const body = (
    <div className="session-summary-body">
      {past ? (
        // Session detail (DX-14): ‹ Back (unless the caller's page has its own) and Edit as text.
        <div className="session-summary-bar">
          {embedded ? (
            <span />
          ) : (
            <button type="button" className="session-summary-back icon-btn" aria-label="Back" onClick={onClose}>
              <Icon name="ChevronLeft" size={24} />
            </button>
          )}
          {onEdit ? (
            <button type="button" className="session-summary-edit btn-quiet"
              aria-label="Edit session" onClick={onEdit}>
              Edit
            </button>
          ) : null}
        </div>
      ) : null}
      <header className="session-summary-head">
        <div className="session-summary-head-row">
          <p className="session-summary-label">
            <span className="session-summary-date">{dayText}</span>
            {' · '}
            <span data-kpi="duration">
              <span className="session-summary-kpi-value">{`${durationValue} ${durationUnit}`}</span>
            </span>
          </p>
        </div>
        <h2 className="session-summary-heading">{workoutName ?? 'Workout'}</h2>
      </header>

      {shortLead !== '' || sentence !== '' ? (
        <p className="session-summary-sentence">
          {shortLead !== '' ? (
            <strong className="session-summary-sentence-lead" data-kpi="short">{shortLead}</strong>
          ) : null}
          {shortLead !== '' && sentence !== '' ? '. ' : null}
          {verdict.lead !== '' ? (
            shortLead === '' ? (
              <strong className="session-summary-sentence-lead">{verdict.lead}</strong>
            ) : (
              <span className="session-summary-sentence-rest">{verdict.lead}</span>
            )
          ) : null}
          {verdict.lead !== '' && verdict.rest !== '' ? ' ' : null}
          {verdict.rest !== '' ? <span className="session-summary-sentence-rest">{verdict.rest}</span> : null}
        </p>
      ) : null}

      {records.length > 0 ? (
        <section className="session-summary-records" aria-label="Records">
          <ul className="session-summary-prs">
            {records.map((record) => {
              const exercise = resolve(record.exerciseId)
              return (
                <li key={`${record.exerciseId}-${record.kind}`} className="session-summary-record">
                  <PrTag />
                  <span className="session-summary-record-text">
                    <span className="session-summary-record-detail">{exercise?.name ?? record.exerciseId}</span>
                    <span className="session-summary-record-label">{` · ${RECORD_WORDS[record.kind]}`}</span>
                  </span>
                  <span className="session-summary-record-figure">
                    {recordFigure(record, exercise?.bodyweight === true)}
                  </span>
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}

      {lifts.length > 0 ? (
        <section className="session-summary-section" aria-label="Lift by lift">
          <div className="session-summary-caption-row">
            <h3 className="session-summary-caption">Lift by lift</h3>
            {versus ? <span className="session-summary-caption session-summary-versus">{versus}</span> : null}
          </div>
          <div className="session-summary-moves">
            {lifts.map((lift) => (
              <div key={lift.exerciseId} className="session-summary-move">
                <div className="session-summary-move-main">
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
                    {lift.line.groups.map((group, index) => (
                      <span key={index} className="session-summary-move-set">
                        {index > 0 ? ' · ' : ''}
                        <SetFigure set={group.set} moreReps={group.moreReps} />
                      </span>
                    ))}
                  </span>
                </div>
                <Verdict verdict={lift.line.verdict} />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <p className="session-summary-totals">
        {/* V6-11, DX-14: under half the planned Sets the lead line says so, with its Sets; Train
            keeps this Workout next. */}
        {short ? null : (
          <>
            <span data-kpi="sets">
              <span className="session-summary-kpi-value">{working}</span>
              {partial ? ` of ${plannedSets} sets` : working === 1 ? ' set' : ' sets'}
            </span>
            {' · '}
          </>
        )}
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
        {warmups > 0 ? (
          <>
            {' · '}
            <span className="session-summary-warmups">{`${plural(warmups, 'warm-up', 'warm-ups')} not counted`}</span>
          </>
        ) : null}
      </p>

      {photos}

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

      <div className="session-summary-foot">
        {next ? <p className="session-summary-next">{next}</p> : <span />}
        <button
          type="button"
          className="session-summary-share btn-quiet"
          aria-haspopup="dialog"
          onClick={() => setShareOpen(true)}
        >
          Share
        </button>
      </div>
    </div>
  )

  if (past && embedded) {
    return (
      <section aria-label="Session summary" className="session-summary session-summary--embedded">
        {body}
        {shareSheet}
      </section>
    )
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Session summary"
      className="session-summary overlay-panel"
    >
      {body}

      {/* The finish summary's one primary; Session detail has none (DX-14). */}
      {past ? null : (
        <div className="session-summary-dock">
          <button type="button" className="session-summary-done btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      )}

      {shareSheet}
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
