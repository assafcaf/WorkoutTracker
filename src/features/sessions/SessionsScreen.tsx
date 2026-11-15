import { useEffect, useState } from 'react'
import { resolveExercise } from '../../data/resolve'
import { applyBodyweight } from '../../domain/bodyweight'
import { formatDay } from '../../domain/dates'
import type { Resolve } from '../../domain/muscles'
import {
  calendarWeeks,
  dayMonth,
  sessionsByWeek,
  sessionsInWeeks,
  startOfDay,
  workingSetCount,
} from '../../domain/sessionsView'
import type { Weekday } from '../../domain/stats/weeks'
import { computeRecords, recordCount } from '../../domain/stats/records'
import { sessionVolume } from '../../domain/volume'
import type { BodyLog, ExercisePlan, Muscle, Program, Session } from '../../types'
import { AppShell } from '../../ui/AppShell'
import { CalendarWeekCells } from '../../ui/CalendarWeek'
import { workoutLetterOf, workoutToneAt, type WorkoutTone } from '../../ui/workoutMark'
import { SessionEditor } from '../../ui/SessionEditor'
import { Sheet } from '../../ui/Sheet'
import { Snackbar } from '../../ui/Snackbar'
import { SessionSummary } from '../../ui/SessionSummary'
import type { AppRoute } from '../routes'
import { useServices } from '../ServicesProvider'
import { useServiceData } from '../useServiceData'
import './SessionsScreen.css'

export type SessionsScreenProps = {
  navigate(to: AppRoute): void
  onInSession(inSession: boolean): void
  /** The clock the calendar and the week groups read; the device's by default. */
  now?: () => number
  /** A Session to open the summary of on arrival (the `{ tab: 'history', sessionId }` route). */
  initialSessionId?: string
}

/** The weeks the calendar draws (V3-09): six rows of seven days above the list. */
const CALENDAR_WEEKS = 6

/** How long "Workout deleted · Undo" stays (V5), as long as Body's "Entry deleted · Undo". */
const UNDO_MS = 6000

const WEEKDAY_INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** The Session's Workout name from `programs`, else its stored `workoutId`. */
function workoutNameOf(session: Session, programs: Program[]): string {
  const program = programs.find((candidate) => candidate.id === session.programId)
  return program?.workouts.find((workout) => workout.id === session.workoutId)?.name ?? session.workoutId
}

/** A Session's Workout tone: its index in its Program, cycling; `gone` when the Workout is. */
function workoutToneOf(session: Session, programs: Program[]): WorkoutTone {
  const index = programs
    .find((program) => program.id === session.programId)
    ?.workouts.findIndex((workout) => workout.id === session.workoutId)
  return workoutToneAt(index ?? -1)
}

/**
 * The six-week calendar (V3-09, back in place of V2-07's number row): one header line with the
 * Session count, the day letters, then six weeks of seven cells, each Session day filled in its
 * Workout's tone with its letter and today outlined. No legend: the letters carry it. Each week
 * row names its Sessions for a screen reader; V5: each Session day is a button into it, named
 * "Workout B, Mon 12 Oct" (a day with two Sessions opens a chooser, through `onOpenDay`).
 */
function SessionsCalendar({
  sessions,
  programs,
  now,
  weekStartsOn,
  onOpenDay,
}: {
  sessions: Session[]
  programs: Program[]
  now: number
  weekStartsOn: Weekday
  onOpenDay(day: number, sessions: Session[]): void
}): JSX.Element {
  const weeks = calendarWeeks(sessions, now, CALENDAR_WEEKS, weekStartsOn)
  const count = sessionsInWeeks(sessions, now, CALENDAR_WEEKS, weekStartsOn)
  const byDay = new Map<number, Session[]>()
  for (const session of [...sessions].sort((a, b) => a.startedAt - b.startedAt)) {
    const key = startOfDay(session.startedAt)
    byDay.set(key, [...(byDay.get(key) ?? []), session])
  }
  return (
    <section className="sessions-calendar card" aria-label={`Last ${CALENDAR_WEEKS} weeks`}>
      <p className="sessions-calendar-head">
        {`Last ${CALENDAR_WEEKS} weeks · ${count} ${count === 1 ? 'session' : 'sessions'}`}
      </p>
      <div className="sessions-calendar-row sessions-calendar-weekdays" aria-hidden="true">
        <span />
        <span className="sessions-calendar-weekday-cells">
          {Array.from({ length: 7 }, (_, index) => (
            <span key={index} className="sessions-calendar-weekday">
              {WEEKDAY_INITIALS[(index + weekStartsOn) % 7]}
            </span>
          ))}
        </span>
      </div>
      {weeks.map((week, index) => {
        const trained = week.days.flatMap((day) =>
          (byDay.get(day.at) ?? []).map(
            (session) => `${workoutNameOf(session, programs)} ${WEEKDAY_NAMES[new Date(day.at).getDay()]}`,
          ),
        )
        const summary = trained.length > 0 ? trained.join(', ') : 'no sessions'
        return (
          <div
            key={week.start}
            className="sessions-calendar-row"
            role="group"
            aria-label={`Week of ${dayMonth(week.start, now)}: ${summary}`}
            data-current={index === weeks.length - 1 || undefined}
          >
            <span className="sessions-calendar-week-label" aria-hidden="true">
              {dayMonth(week.start, now)}
            </span>
            <CalendarWeekCells
              cells={week.days.map((day) => {
                const onDay = byDay.get(day.at) ?? []
                const first = onDay[0]
                const names = onDay.map((session) => workoutNameOf(session, programs)).join(' and ')
                return {
                  key: day.at,
                  letter: first ? workoutLetterOf(workoutNameOf(first, programs)) : null,
                  tone: first ? workoutToneOf(first, programs) : null,
                  today: day.today,
                  future: day.future,
                  onOpen: first ? () => onOpenDay(day.at, onDay) : undefined,
                  label: first ? `${names}, ${formatDay(new Date(day.at), new Date(now))}` : undefined,
                }
              })}
            />
          </div>
        )
      })}
    </section>
  )
}

/** A row's record count, from the engine's one count: `1 PR`, `4 PRs` (V2-07, was `n records`). */
function recordsText(count: number): string {
  return `${count} ${count === 1 ? 'PR' : 'PRs'}`
}

/**
 * The Sessions tab (Progress Dashboard S6a, V2-07, V3-09) as its own container over services:
 * the six-week calendar, then every finished Session grouped by week. The
 * muscle matrix lives on Progress › Muscles (its 4 weeks segment), the volume charts are cut. A row opens the Session's summary (so does a route naming
 * one), whose Edit opens the History editor (save, delete); both refresh on the `'sessions'`
 * topic without a reload.
 *
 * Like the History group it replaces, it never puts the trainee mid-session.
 */
export function SessionsScreen({
  navigate,
  onInSession,
  now = Date.now,
  initialSessionId,
}: SessionsScreenProps): JSX.Element {
  const [summarySessionId, setSummarySessionId] = useState<string | null>(initialSessionId ?? null)
  const [editingId, setEditingId] = useState<string | null>(null)
  /** V5: a calendar day with two or more Sessions, open as a chooser of them. */
  const [chooser, setChooser] = useState<{ day: number; sessions: Session[] } | null>(null)
  /** V5: the Session just deleted, as it was, while "Workout deleted · Undo" shows. */
  const [deleted, setDeleted] = useState<Session | null>(null)
  const services = useServices()

  useEffect(() => {
    if (!deleted) return
    const timer = setTimeout(() => setDeleted(null), UNDO_MS)
    return () => clearTimeout(timer)
  }, [deleted])

  /** V5: deletes at once (marked deleted, so it syncs) and offers Undo, no confirm first. */
  const deleteSession = (session: Session): void => {
    setSummarySessionId(null)
    setEditingId(null)
    setDeleted(session)
    void services.sessions.discard(session.id)
  }
  const undoDelete = (): void => {
    if (!deleted) return
    const session = deleted
    setDeleted(null)
    // The copy as listed before the delete has no `deletedAt`: storing it back makes it live.
    void services.sessions.save(session)
  }

  useEffect(() => {
    onInSession(false)
  }, [onInSession])

  const sessionsData = useServiceData((services) => services.sessions.list(), ['sessions'])
  const programsData = useServiceData(
    (services) =>
      services.programs.load().then((loaded) => ({
        programs: loaded.programs,
        activeProgramId: loaded.activeProgramId,
      })),
    ['programs'],
  )
  const catalogData = useServiceData((services) => services.catalog.load(), [])
  const weekStartData = useServiceData(
    (services) => services.preferences.weekStart().then((day): Weekday => day as Weekday).catch((): Weekday => 1),
    ['preferences'],
  )
  const bodyweightOverridesData = useServiceData(
    (services) => services.preferences.bodyweightOverrides().catch((): Record<string, boolean> => ({})),
    ['preferences'],
  )

  const bodyLogData = useServiceData(
    (services) => services.preferences.bodyLog().catch((): BodyLog => []),
    ['preferences'],
  )

  const weekStartsOn: Weekday = weekStartData.status === 'ready' ? weekStartData.data : 1

  if (sessionsData.status !== 'ready' || programsData.status !== 'ready' || catalogData.status !== 'ready') {
    return <AppShell title="Sessions">{null}</AppShell>
  }

  const sessions = sessionsData.data.filter((session) => session.finishedAt !== null)
  const { programs, activeProgramId } = programsData.data
  const { catalog, library } = catalogData.data
  const libraryMap = new Map(library.map((entry) => [entry.id, entry] as const))
  const overrides = bodyweightOverridesData.status === 'ready' ? bodyweightOverridesData.data : {}
  const resolve: Resolve = (id) => {
    const exercise = resolveExercise(id, catalog, libraryMap)
    return exercise && applyBodyweight(exercise, overrides)
  }
  const planFor = (session: Session) => (exerciseId: string) =>
    programs
      .find((program) => program.id === session.programId)
      ?.workouts.find((workout) => workout.id === session.workoutId)
      ?.exercises.find((plan) => plan.exerciseId === exerciseId)
  const earlierThan = (session: Session) =>
    sessions.filter((other) => other.id !== session.id && other.startedAt < session.startedAt)
  const today = now()
  const bodyLog = bodyLogData.status === 'ready' ? bodyLogData.data : []

  // The engine's one record count, for every row: plans come from the active Program.
  const activeProgram = programs.find((program) => program.id === activeProgramId) ?? programs[0]
  const activePlans = new Map<string, ExercisePlan>()
  for (const workout of activeProgram?.workouts ?? []) {
    for (const plan of workout.exercises) activePlans.set(plan.exerciseId, plan)
  }
  const records = computeRecords(sessions, resolve, (id) => activePlans.get(id))

  const editSession = editingId ? sessions.find((session) => session.id === editingId) ?? null : null
  if (editSession) {
    return (
      <AppShell title="Sessions">
        <SessionEditor
          key={editSession.id}
          session={editSession}
          workoutName={workoutNameOf(editSession, programs)}
          resolve={resolve}
          onSave={async (draft) => {
            await services.sessions.save(draft)
            setEditingId(null)
          }}
          onCancel={() => setEditingId(null)}
          onDelete={() => deleteSession(editSession)}
        />
      </AppShell>
    )
  }

  const summarySession = summarySessionId
    ? sessions.find((session) => session.id === summarySessionId) ?? null
    : null

  return (
    <AppShell title="Sessions">
      {sessions.length === 0 ? (
        <p className="sessions-empty">No finished workouts yet. Finish one and it appears here.</p>
      ) : (
        <div className="sessions-screen">
          <SessionsCalendar
            sessions={sessions}
            programs={programs}
            now={today}
            weekStartsOn={weekStartsOn}
            onOpenDay={(day, onDay) => {
              if (onDay.length === 1) setSummarySessionId(onDay[0].id)
              else setChooser({ day, sessions: onDay })
            }}
          />
          {sessionsByWeek(sessions, today, weekStartsOn).map((week) => (
            <section key={week.start} className="sessions-week" aria-label={week.label}>
              <h2 className="sessions-caption">{week.label}</h2>
              <ul className="sessions-list card">
                {week.sessions.map((session) => {
                  const count = recordCount(records, session.id)
                  const minutes = Math.max(
                    0,
                    Math.round(((session.finishedAt ?? session.startedAt) - session.startedAt) / 60_000),
                  )
                  const volumeKg = Math.round(sessionVolume(session, resolve).kg)
                  return (
                    <li key={session.id} className="sessions-list-item">
                      <button
                        type="button"
                        className="session-row cell"
                        onClick={() => setSummarySessionId(session.id)}
                      >
                        <span className="session-row-main">
                          <span className="session-row-date">{formatDay(new Date(session.startedAt), new Date(today))}</span>
                          <span className="session-row-workout">{workoutNameOf(session, programs)}</span>
                        </span>
                        <span className="session-row-side">
                          <span className="session-row-tags">
                            {session.deload ? <span className="tag session-row-deload">Deload</span> : null}
                            {count > 0 ? <span className="session-row-prs">{recordsText(count)}</span> : null}
                          </span>
                          <span className="session-row-stats">
                            {`${minutes} min · ${workingSetCount(session)} sets · ${volumeKg.toLocaleString('en-US')} kg`}
                          </span>
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
      {summarySession ? (
        <SessionSummary
          session={summarySession}
          resolve={resolve}
          library={libraryMap}
          workoutName={workoutNameOf(summarySession, programs)}
          earlierSessions={earlierThan(summarySession)}
          planFor={planFor(summarySession)}
          workout={programs
            .find((program) => program.id === summarySession.programId)
            ?.workouts.find((workout) => workout.id === summarySession.workoutId)}
          program={programs.find((program) => program.id === summarySession.programId)}
          weekStartsOn={weekStartsOn}
          bodyLog={bodyLog}
          onClose={() => setSummarySessionId(null)}
          onEdit={() => {
            setSummarySessionId(null)
            setEditingId(summarySession.id)
          }}
          onDelete={() => deleteSession(summarySession)}
          onBrowse={(muscles: Muscle[]) => {
            setSummarySessionId(null)
            navigate({ tab: 'exercises', muscles })
          }}
        />
      ) : null}
      {chooser ? (
        <Sheet label={formatDay(new Date(chooser.day), new Date(today))} onClose={() => setChooser(null)}>
          <div className="sessions-chooser">
            <h3 className="sessions-chooser-heading">{formatDay(new Date(chooser.day), new Date(today))}</h3>
            {chooser.sessions.map((session) => (
              <button
                key={session.id}
                type="button"
                className="sessions-chooser-option btn-secondary"
                onClick={() => {
                  setChooser(null)
                  setSummarySessionId(session.id)
                }}
              >
                {`${workoutNameOf(session, programs)} · ${clockTime(session.startedAt)}`}
              </button>
            ))}
          </div>
        </Sheet>
      ) : null}
      {deleted ? <Snackbar message="Workout deleted" actionLabel="Undo" onAction={undoDelete} /> : null}
    </AppShell>
  )
}

/** "08:05", 24-hour: when a Session started, to tell two on one day apart. */
function clockTime(at: number): string {
  const date = new Date(at)
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}
