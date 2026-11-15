import { useEffect, useState } from 'react'
import { resolveExercise } from '../../data/resolve'
import { applyBodyweight } from '../../domain/bodyweight'
import { formatDay } from '../../domain/dates'
import type { Resolve } from '../../domain/muscles'
import { dayMonth, sessionsByWeek, sessionsInWeeks, weekStarts, workingSetCount } from '../../domain/sessionsView'
import type { Weekday } from '../../domain/stats/weeks'
import { computeRecords, recordCount } from '../../domain/stats/records'
import { sessionVolume } from '../../domain/volume'
import type { BodyLog, ExercisePlan, Muscle, Program, Session } from '../../types'
import { AppShell } from '../../ui/AppShell'
import { SessionEditor } from '../../ui/SessionEditor'
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

/** The weeks the consistency strip totals (V2-07): one row of six numbers above the list. */
const STRIP_WEEKS = 6

/** The Session's Workout name from `programs`, else its stored `workoutId`. */
function workoutNameOf(session: Session, programs: Program[]): string {
  const program = programs.find((candidate) => candidate.id === session.programId)
  return program?.workouts.find((workout) => workout.id === session.workoutId)?.name ?? session.workoutId
}

/**
 * The consistency strip (V2-07, replacing the six-week calendar): one total per week, oldest
 * first and this week last, then the Sessions those weeks hold. It answers "am I consistent?"
 * in one row, so the list (the screen's job) starts right under it.
 */
function WeekStrip({
  sessions,
  now,
  weekStartsOn,
}: {
  sessions: Session[]
  now: number
  weekStartsOn: Weekday
}): JSX.Element {
  const starts = weekStarts(now, STRIP_WEEKS, weekStartsOn)
  const totals = starts.map((start, index) => {
    const end = index + 1 < starts.length ? starts[index + 1] : Infinity
    return sessions.filter((session) => session.startedAt >= start && session.startedAt < end).length
  })
  const count = sessionsInWeeks(sessions, now, STRIP_WEEKS, weekStartsOn)
  return (
    <section className="sessions-strip" aria-label={`Last ${STRIP_WEEKS} weeks`}>
      <span className="sessions-strip-label">{`${STRIP_WEEKS} weeks`}</span>
      <span
        className="sessions-strip-weeks"
        role="img"
        aria-label={`Sessions per week from ${dayMonth(starts[0], now)}: ${totals.join(', ')}`}
      >
        {starts.map((start, index) => (
          <span
            key={start}
            className="sessions-strip-week"
            data-week={dayMonth(start, now)}
            data-current={index === starts.length - 1 || undefined}
            title={`Week of ${dayMonth(start, now)}: ${totals[index]} ${totals[index] === 1 ? 'session' : 'sessions'}`}
          >
            {totals[index]}
          </span>
        ))}
      </span>
      <span className="sessions-strip-count">
        <b>{count}</b> {count === 1 ? 'session' : 'sessions'}
      </span>
    </section>
  )
}

/** A row's record count, from the engine's one count: `1 PR`, `4 PRs` (V2-07, was `n records`). */
function recordsText(count: number): string {
  return `${count} ${count === 1 ? 'PR' : 'PRs'}`
}

/**
 * The Sessions tab (Progress Dashboard S6a, V2-07) as its own container over services: one
 * consistency row (the last six weeks' totals), then every finished Session grouped by week. The
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
  const services = useServices()

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
          onDelete={() => {
            void services.sessions.discard(editSession.id).then(() => setEditingId(null))
          }}
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
          <WeekStrip sessions={sessions} now={today} weekStartsOn={weekStartsOn} />
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
                            {count > 0 ? <span className="tag tag-pr">{recordsText(count)}</span> : null}
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
          bodyLog={bodyLog}
          onClose={() => setSummarySessionId(null)}
          onEdit={() => {
            setSummarySessionId(null)
            setEditingId(summarySession.id)
          }}
          onBrowse={(muscles: Muscle[]) => {
            setSummarySessionId(null)
            navigate({ tab: 'exercises', muscles })
          }}
        />
      ) : null}
    </AppShell>
  )
}
