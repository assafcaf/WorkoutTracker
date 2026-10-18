import { useEffect, useState } from 'react'
import { resolveExercise } from '../../data/resolve'
import { bodyweightOn } from '../../domain/bodyLog'
import { applyBodyweight } from '../../domain/bodyweight'
import { formatDay } from '../../domain/dates'
import type { Resolve } from '../../domain/muscles'
import {
  calendarWeeks,
  dayMonth,
  sessionsByWeek,
  sessionsInWeeks,
  startOfWeek,
  workingSetCount,
} from '../../domain/sessionsView'
import { muscleWeeks, STATS_MUSCLES } from '../../domain/stats/muscles'
import type { Weekday } from '../../domain/stats/weeks'
import { computeRecords, recordCount } from '../../domain/stats/records'
import { sessionVolume } from '../../domain/volume'
import type { BodyLog, ExercisePlan, LibraryExercise, Muscle, Program, Session } from '../../types'
import { AppShell } from '../../ui/AppShell'
import { BarChart } from '../../ui/charts/BarChart'
import { HeatCell, HeatLegend } from '../../ui/RegionHeat'
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

const CALENDAR_WEEKS = 6
const HEAT_WEEKS = 4
const VOLUME_LIMIT = 12
const WEEKDAY_INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

const MUSCLE_LABELS: Record<string, string> = {
  chest: 'Chest',
  shoulders: 'Shoulders',
  triceps: 'Triceps',
  lats: 'Lats',
  'middle back': 'Mid back',
  biceps: 'Biceps',
  quadriceps: 'Quads',
  hamstrings: 'Hamstrings',
  glutes: 'Glutes',
  calves: 'Calves',
  'lower back': 'Lower back',
  abdominals: 'Abs',
}

/** The Session's Workout name from `programs`, else its stored `workoutId`. */
function workoutNameOf(session: Session, programs: Program[]): string {
  const program = programs.find((candidate) => candidate.id === session.programId)
  return program?.workouts.find((workout) => workout.id === session.workoutId)?.name ?? session.workoutId
}

/** The data tokens a Workout takes by its index in its Program, cycling (E22-T6, O15). */
const WORKOUT_COLORS = ['push', 'pull', 'legs', 'core'] as const

/** A Session's Workout colour key: its index in its Program, cycling; `gone` when the Workout is. */
function workoutColorOf(session: Session, programs: Program[]): string {
  const index = programs
    .find((program) => program.id === session.programId)
    ?.workouts.findIndex((workout) => workout.id === session.workoutId)
  return index === undefined || index < 0 ? 'gone' : WORKOUT_COLORS[index % WORKOUT_COLORS.length]
}

/** The local midnight of `ms`. */
function midnightOf(ms: number): number {
  const day = new Date(ms)
  day.setHours(0, 0, 0, 0)
  return day.getTime()
}

/**
 * The six-week calendar: one square per day, each trained day a button coloured and named by its
 * Workout, today outlined. A day with one Session opens its summary; a day with two lists both.
 */
function SessionsCalendar({
  sessions,
  programs,
  now,
  weekStartsOn,
  onOpen,
}: {
  sessions: Session[]
  programs: Program[]
  now: number
  weekStartsOn: Weekday
  onOpen: (sessionId: string) => void
}): JSX.Element {
  const [openDay, setOpenDay] = useState<number | null>(null)
  const weeks = calendarWeeks(sessions, now, CALENDAR_WEEKS, weekStartsOn)
  const count = sessionsInWeeks(sessions, now, CALENDAR_WEEKS, weekStartsOn)
  const byDay = new Map<number, Session[]>()
  for (const session of [...sessions].sort((a, b) => a.startedAt - b.startedAt)) {
    const key = midnightOf(session.startedAt)
    byDay.set(key, [...(byDay.get(key) ?? []), session])
  }
  const shown = new Map<string, string>()
  for (const week of weeks) {
    for (const day of week.days) {
      for (const session of byDay.get(day.at) ?? []) {
        shown.set(workoutNameOf(session, programs), workoutColorOf(session, programs))
      }
    }
  }
  const listed = openDay !== null ? byDay.get(openDay) ?? [] : []
  return (
    <section className="sessions-calendar card" aria-label="Calendar">
      <div className="sessions-calendar-main">
        <div
          className="sessions-calendar-grid"
          role="group"
          aria-label={`Last ${CALENDAR_WEEKS} weeks: ${count} ${count === 1 ? 'session' : 'sessions'}`}
        >
          <span aria-hidden="true" />
          {Array.from({ length: 7 }, (_, index) => WEEKDAY_INITIALS[(index + weekStartsOn) % 7]).map((initial, index) => (
            <span key={index} className="sessions-calendar-weekday" aria-hidden="true">
              {initial}
            </span>
          ))}
          {weeks.map((week) => (
            <div key={week.start} className="sessions-calendar-week">
              <span className="sessions-calendar-week-label">{dayMonth(week.start, now)}</span>
              {week.days.map((day) => {
                const title = formatDay(new Date(day.at), new Date(now))
                const trained = byDay.get(day.at) ?? []
                const flags = {
                  'data-trained': day.trained || undefined,
                  'data-today': day.today || undefined,
                  'data-future': day.future || undefined,
                }
                if (trained.length === 0) {
                  return <span key={day.at} className="sessions-calendar-day" title={title} {...flags} />
                }
                const names = [...new Set(trained.map((session) => workoutNameOf(session, programs)))].join(' and ')
                return (
                  <button
                    key={day.at}
                    type="button"
                    className="sessions-calendar-day cell"
                    title={title}
                    aria-label={`${title}: ${names}`}
                    data-workout={workoutColorOf(trained[0], programs)}
                    onClick={() =>
                      trained.length === 1 ? onOpen(trained[0].id) : setOpenDay(openDay === day.at ? null : day.at)
                    }
                    {...flags}
                  />
                )
              })}
            </div>
          ))}
        </div>
        {listed.length > 1 && openDay !== null ? (
          <ul className="sessions-calendar-day-list" aria-label={formatDay(new Date(openDay), new Date(now))}>
            {listed.map((session) => (
              <li key={session.id}>
                <button type="button" className="btn-quiet" onClick={() => onOpen(session.id)}>
                  {workoutNameOf(session, programs)}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <div className="sessions-calendar-side">
        <span className="sessions-muted-xs">{`Last ${CALENDAR_WEEKS} weeks`}</span>
        <span className="sessions-calendar-count">{count}</span>
        <span className="sessions-muted-xs sessions-calendar-count-unit">{count === 1 ? 'session' : 'sessions'}</span>
        {[...shown].map(([name, color]) => (
          <span key={name} className="sessions-calendar-key">
            <i className="sessions-calendar-day" data-workout={color} aria-hidden="true" />
            {name}
          </span>
        ))}
        <span className="sessions-calendar-key">
          <i className="sessions-calendar-day" data-today aria-hidden="true" />
          Today
        </span>
      </div>
    </section>
  )
}

/** One calendar week's column of the muscle table: its Monday and each muscle's sets. */
type MuscleColumn = { start: number; inProgress: boolean; sets: Map<Muscle, number> }

/** One half of the week heat table: a row label and one heat square per week. */
function WeekHeatHalf({ muscles, weeks }: { muscles: readonly Muscle[]; weeks: MuscleColumn[] }): JSX.Element {
  return (
    <table className="week-heat">
      <thead>
        <tr>
          <th scope="col">
            <span className="sessions-visually-hidden">Muscle</span>
          </th>
          {weeks.map((week) => (
            <th
              key={week.start}
              scope="col"
              className="week-heat-week"
              data-in-progress={week.inProgress || undefined}
            >
              {new Date(week.start).getDate()}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {muscles.map((muscle) => (
          <tr key={muscle} data-muscle={muscle}>
            <th scope="row" className="week-heat-label">
              {MUSCLE_LABELS[muscle]}
            </th>
            {weeks.map((week) => {
              const count = Math.round(week.sets.get(muscle) ?? 0)
              return (
                <td key={week.start}>
                  <HeatCell count={count} scale="week" title={`${MUSCLE_LABELS[muscle]} ${count} sets`} />
                </td>
              )
            })}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/** The last `count` calendar weeks ending with `now`'s, empty weeks included, oldest first. */
function lastWeeks(
  sessions: Session[],
  now: number,
  count: number,
  resolve: Resolve,
  library: Map<string, LibraryExercise>,
  weekStartsOn: Weekday,
): MuscleColumn[] {
  const byStart = new Map(muscleWeeks(sessions, now, resolve, library, weekStartsOn).map((week) => [week.start, week] as const))
  const current = startOfWeek(now, weekStartsOn)
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(current)
    date.setDate(date.getDate() - 7 * (count - 1 - index))
    const start = date.getTime()
    return byStart.get(start) ?? { start, inProgress: false, sets: new Map<Muscle, number>() }
  })
}

/** Muscle sets by calendar week: the 12 muscles down, the last four weeks across, heat-banded. */
function MuscleWeeks({
  sessions,
  now,
  resolve,
  library,
  weekStartsOn,
}: {
  sessions: Session[]
  now: number
  resolve: Resolve
  library: Map<string, LibraryExercise>
  weekStartsOn: Weekday
}): JSX.Element {
  const weeks = lastWeeks(sessions, now, HEAT_WEEKS, resolve, library, weekStartsOn)
  const half = Math.ceil(STATS_MUSCLES.length / 2)
  return (
    <section className="sessions-card card" aria-label="Muscle sets by week">
      <div className="sessions-card-head">
        <h2 className="sessions-card-title">Muscle sets by week</h2>
        <span className="sessions-muted-xs">
          {`weeks of ${dayMonth(weeks[0].start, now)} – ${dayMonth(weeks[weeks.length - 1].start, now)}`}
        </span>
      </div>
      <div className="week-heat-halves">
        <WeekHeatHalf muscles={STATS_MUSCLES.slice(0, half)} weeks={weeks} />
        <WeekHeatHalf muscles={STATS_MUSCLES.slice(half)} weeks={weeks} />
      </div>
      <HeatLegend scale="week" />
    </section>
  )
}

/** Volume per Session, one chart per Workout: A is compared with A and B with B. */
function VolumeByWorkout({
  sessions,
  programs,
  resolve,
  bodyLog,
  now,
  onOpen,
}: {
  sessions: Session[]
  programs: Program[]
  resolve: Resolve
  bodyLog: BodyLog
  now: number
  onOpen: (sessionId: string) => void
}): JSX.Element {
  const groups = new Map<string, { position: number; sessions: Session[] }>()
  for (const session of [...sessions].sort((a, b) => a.startedAt - b.startedAt)) {
    const name = workoutNameOf(session, programs)
    const position = programs
      .find((program) => program.id === session.programId)
      ?.workouts.findIndex((workout) => workout.id === session.workoutId)
    const group = groups.get(name) ?? {
      position: position !== undefined && position >= 0 ? position : 99,
      sessions: [],
    }
    group.sessions.push(session)
    groups.set(name, group)
  }
  const ordered = [...groups.entries()].sort(
    ([nameA, a], [nameB, b]) => a.position - b.position || nameA.localeCompare(nameB),
  )
  return (
    <section className="sessions-card card" aria-label="Volume per session, kg">
      <div className="sessions-card-head">
        <h2 className="sessions-card-title">Volume per session, kg</h2>
      </div>
      {ordered.map(([name, group]) => (
        <div key={name} className="sessions-volume-workout">
          <h3 className="sessions-volume-name">{name}</h3>
          <BarChart
            title={`${name} volume per session, kg`}
            unit="kg"
            onOpenSession={onOpen}
            bars={group.sessions.slice(-VOLUME_LIMIT).map((session) => {
              const weighed = bodyweightOn(bodyLog, session.startedAt)
              const counted = weighed !== null && session.entries.some((entry) => resolve(entry.exerciseId)?.bodyweight)
              const [year, month, day] = (weighed?.day ?? '').split('-').map(Number)
              return {
                at: session.startedAt,
                label: name,
                value: Math.round(sessionVolume(session, resolve, weighed?.kg ?? null).kg),
                sessionId: session.id,
                detail:
                  counted && weighed
                    ? `Bodyweight ${weighed.kg} kg (${dayMonth(new Date(year, month - 1, day).getTime(), now)}) counted`
                    : undefined,
              }
            })}
          />
        </div>
      ))}
    </section>
  )
}

/** A row's record count in words, from the engine's one count: `1 record`, `4 records`. */
function recordsText(count: number): string {
  return `${count} ${count === 1 ? 'record' : 'records'}`
}

/**
 * The Sessions tab (Progress Dashboard S6a) as its own container over services: the last six
 * weeks as a calendar, the 12 muscles' sets per calendar week, each Workout's volume, and every
 * finished Session grouped by week. A row opens the Session's summary (so does a route naming
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
          <SessionsCalendar
            sessions={sessions}
            programs={programs}
            now={today}
            weekStartsOn={weekStartsOn}
            onOpen={setSummarySessionId}
          />
          <MuscleWeeks
            sessions={sessions}
            now={today}
            resolve={resolve}
            library={libraryMap}
            weekStartsOn={weekStartsOn}
          />
          <VolumeByWorkout
            sessions={sessions}
            programs={programs}
            resolve={resolve}
            bodyLog={bodyLog}
            now={today}
            onOpen={setSummarySessionId}
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
