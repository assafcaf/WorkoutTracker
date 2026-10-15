import { useEffect, useState } from 'react'
import { resolveExercise } from '../../data/resolve'
import { applyBodyweight } from '../../domain/bodyweight'
import { formatDay } from '../../domain/dates'
import type { Resolve } from '../../domain/muscles'
import {
  calendarWeeks,
  dayMonth,
  formatSetCount,
  heatRowsFor,
  sessionRowStats,
  sessionsByWeek,
  sessionsInWeeks,
  volumeBars,
  weeklyRegionSets,
  workingSetCount,
  type HeatRow,
  type WeekRegionSets,
} from '../../domain/sessionsView'
import type { LibraryExercise, Muscle, Program, Session } from '../../types'
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
const WEEKDAY_INITIALS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

/** The Session's Workout name from `programs`, else its stored `workoutId`. */
function workoutNameOf(session: Session, programs: Program[]): string {
  const program = programs.find((candidate) => candidate.id === session.programId)
  return program?.workouts.find((workout) => workout.id === session.workoutId)?.name ?? session.workoutId
}

/** The six-week calendar: one square per day, Sessions filled, today outlined. */
function SessionsCalendar({ sessions, now }: { sessions: Session[]; now: number }): JSX.Element {
  const weeks = calendarWeeks(sessions, now, CALENDAR_WEEKS)
  const count = sessionsInWeeks(sessions, now, CALENDAR_WEEKS)
  return (
    <section className="sessions-calendar card" aria-label="Calendar">
      <div
        className="sessions-calendar-grid"
        role="img"
        aria-label={`Last ${CALENDAR_WEEKS} weeks: ${count} ${count === 1 ? 'session' : 'sessions'}`}
      >
        <span aria-hidden="true" />
        {WEEKDAY_INITIALS.map((initial, index) => (
          <span key={index} className="sessions-calendar-weekday" aria-hidden="true">
            {initial}
          </span>
        ))}
        {weeks.map((week) => (
          <div key={week.start} className="sessions-calendar-week">
            <span className="sessions-calendar-week-label">
              {dayMonth(week.start, now)}
            </span>
            {week.days.map((day) => (
              <span
                key={day.at}
                className="sessions-calendar-day"
                data-trained={day.trained || undefined}
                data-today={day.today || undefined}
                data-future={day.future || undefined}
                title={formatDay(new Date(day.at), new Date(now))}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="sessions-calendar-side">
        <span className="sessions-muted-xs">{`Last ${CALENDAR_WEEKS} weeks`}</span>
        <span className="sessions-calendar-count">{count}</span>
        <span className="sessions-muted-xs sessions-calendar-count-unit">{count === 1 ? 'session' : 'sessions'}</span>
        <span className="sessions-calendar-key">
          <i className="sessions-calendar-day" data-trained aria-hidden="true" />
          Session
        </span>
        <span className="sessions-calendar-key">
          <i className="sessions-calendar-day" data-today aria-hidden="true" />
          Today
        </span>
      </div>
    </section>
  )
}

/** One half of the week heat table: a row label and one heat square per week. */
function WeekHeatHalf({ rows, weeks }: { rows: HeatRow[]; weeks: WeekRegionSets[] }): JSX.Element {
  return (
    <table className="week-heat">
      <thead>
        <tr>
          <th scope="col">
            <span className="sessions-visually-hidden">Region</span>
          </th>
          {weeks.map((week) => (
            <th key={week.start} scope="col" className="week-heat-week">
              {new Date(week.start).getDate()}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.region} data-region={row.region}>
            <th scope="row" className="week-heat-label">
              {row.label}
            </th>
            {weeks.map((week) => {
              const count = week.counts.get(row.region) ?? 0
              return (
                <td key={week.start}>
                  <HeatCell count={count} scale="week" title={`${row.label} ${formatSetCount(count)} sets`} />
                </td>
              )
            })}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/** Muscle sets by week: the regions down, the last four weeks across, heat-banded. */
function MuscleWeeks({
  sessions,
  now,
  resolve,
  library,
}: {
  sessions: Session[]
  now: number
  resolve: Resolve
  library: Map<string, LibraryExercise>
}): JSX.Element {
  const weeks = weeklyRegionSets(sessions, now, HEAT_WEEKS, resolve, library)
  const rows = heatRowsFor(weeks.map((week) => week.counts))
  const half = Math.ceil(rows.length / 2)
  return (
    <section className="sessions-card card" aria-label="Muscle sets by week">
      <div className="sessions-card-head">
        <h2 className="sessions-card-title">Muscle sets by week</h2>
        <span className="sessions-muted-xs">
          {`weeks of ${dayMonth(weeks[0].start, now)} – ${dayMonth(weeks[weeks.length - 1].start, now)}`}
        </span>
      </div>
      <div className="week-heat-halves">
        <WeekHeatHalf rows={rows.slice(0, half)} weeks={weeks} />
        <WeekHeatHalf rows={rows.slice(half)} weeks={weeks} />
      </div>
      <HeatLegend scale="week" />
    </section>
  )
}

/**
 * The Sessions tab (Progress Dashboard S6a) as its own container over services: the last six
 * weeks as a calendar, the regions' sets per week, each Session's volume, and every finished
 * Session grouped by week. A row opens the Session's summary, whose Edit opens the History
 * editor (save, delete); both refresh on the `'sessions'` topic without a reload.
 *
 * Like the History group it replaces, it never puts the trainee mid-session.
 */
export function SessionsScreen({ navigate, onInSession, now = Date.now }: SessionsScreenProps): JSX.Element {
  const [summarySessionId, setSummarySessionId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const services = useServices()

  useEffect(() => {
    onInSession(false)
  }, [onInSession])

  const sessionsData = useServiceData((services) => services.sessions.list(), ['sessions'])
  const programsData = useServiceData(
    (services) => services.programs.load().then((loaded) => loaded.programs),
    ['programs'],
  )
  const catalogData = useServiceData((services) => services.catalog.load(), [])
  const bodyweightOverridesData = useServiceData(
    (services) => services.preferences.bodyweightOverrides().catch((): Record<string, boolean> => ({})),
    ['preferences'],
  )

  if (sessionsData.status !== 'ready' || programsData.status !== 'ready' || catalogData.status !== 'ready') {
    return <AppShell title="Sessions">{null}</AppShell>
  }

  const sessions = sessionsData.data.filter((session) => session.finishedAt !== null)
  const programs = programsData.data
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
  const bars = volumeBars(sessions, resolve, programs)

  return (
    <AppShell title="Sessions">
      {sessions.length === 0 ? (
        <p className="sessions-empty">No finished workouts yet. Finish one and it appears here.</p>
      ) : (
        <div className="sessions-screen">
          <SessionsCalendar sessions={sessions} now={today} />
          <MuscleWeeks sessions={sessions} now={today} resolve={resolve} library={libraryMap} />
          <section className="sessions-card card" aria-label="Volume per session, kg">
            <div className="sessions-card-head">
              <h2 className="sessions-card-title">Volume per session, kg</h2>
              {bars.legend.length > 1 ? (
                <span className="sessions-series-legend">
                  {bars.legend.map((item) => (
                    <span key={item.label} className="sessions-series-key">
                      <i className="sessions-series-swatch" data-series={item.series ?? 'a'} aria-hidden="true" />
                      {item.label}
                    </span>
                  ))}
                </span>
              ) : null}
            </div>
            <BarChart bars={bars.bars} title="Volume per session, kg" />
          </section>
          {sessionsByWeek(sessions, today).map((week) => (
            <section key={week.start} className="sessions-week" aria-label={week.label}>
              <h2 className="sessions-caption">{week.label}</h2>
              <ul className="sessions-list card">
                {week.sessions.map((session) => {
                  const stats = sessionRowStats(session, earlierThan(session), resolve, planFor(session))
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
                            {stats.prs > 0 ? <span className="tag tag-pr">{`${stats.prs} PR`}</span> : null}
                          </span>
                          <span className="session-row-stats">
                            {`${stats.minutes} min · ${workingSetCount(session)} sets · ${stats.volumeKg.toLocaleString('en-US')} kg`}
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
