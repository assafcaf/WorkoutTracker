import { useState } from 'react'
import { progression } from '../domain/progression'
import { recordsFor, type ExerciseRecord } from '../domain/records'
import { seriesFor, type SeriesKind } from '../domain/series'
import { volumeSeries } from '../domain/volume'
import type { Resolve } from '../domain/muscles'
import type { Exercise, ExercisePlan, Program, Session } from '../types'
import { BarChart } from './charts/BarChart'
import { LineChart } from './charts/LineChart'
import { ProgressionBar } from './ProgressionBar'
import './Stats.css'

export type StatsProps = { sessions: Session[]; resolve: Resolve; programs: Program[] }

/** Every distinct logged exercise that `resolve` answers, sorted by name. */
function loggedExercises(sessions: Session[], resolve: Resolve): Exercise[] {
  const found = new Map<string, Exercise>()
  for (const session of sessions) {
    for (const entry of session.entries) {
      if (found.has(entry.exerciseId)) continue
      const exercise = resolve(entry.exerciseId)
      if (exercise) found.set(entry.exerciseId, exercise)
    }
  }
  return [...found.values()].sort((a, b) => a.name.localeCompare(b.name))
}

/** Sessions holding `exerciseId`, newest first. */
function sessionsHolding(sessions: Session[], exerciseId: string): Session[] {
  return sessions
    .filter((session) => session.entries.some((entry) => entry.exerciseId === exerciseId))
    .sort((a, b) => b.startedAt - a.startedAt)
}

function firstPlan(programs: Program[], exerciseId: string): ExercisePlan | undefined {
  for (const program of programs) {
    for (const workout of program.workouts) {
      const plan = workout.exercises.find((candidate) => candidate.exerciseId === exerciseId)
      if (plan) return plan
    }
  }
  return undefined
}

/**
 * The exercise's own plan, or else the plan it was swapped in for, through the newest session
 * that swapped it in.
 */
function planFor(exerciseId: string, sessions: Session[], programs: Program[]): ExercisePlan | undefined {
  const own = firstPlan(programs, exerciseId)
  if (own) return own
  for (const session of sessionsHolding(sessions, exerciseId)) {
    const planned = Object.entries(session.swaps ?? {}).find(([, doneInstead]) => doneInstead === exerciseId)
    if (planned) return firstPlan(programs, planned[0])
  }
  return undefined
}

const SERIES_TITLES: Record<SeriesKind, string> = {
  e1rm: 'estimated 1RM',
  reps: 'reps per session',
  assistance: 'assistance',
}

function recordUnit(record: ExerciseRecord): string {
  switch (record.kind) {
    case 'heaviest-set':
    case 'best-e1rm':
      return 'kg'
    case 'lowest-assistance':
      return 'kg assist'
    case 'most-reps-at-weight':
    case 'most-reps-in-a-set':
      return 'reps'
  }
}

function calendarDate(date: number): string {
  return new Date(date).toISOString().slice(0, 10)
}

function ExerciseProgress({ sessions, resolve, programs }: StatsProps): JSX.Element {
  const exercises = loggedExercises(sessions, resolve)
  const [chosenId, setChosenId] = useState<string | undefined>(exercises[0]?.id)
  const exercise = exercises.find((candidate) => candidate.id === chosenId) ?? exercises[0]
  if (!exercise) {
    return <p className="stats-empty">No sets yet. Log a set to choose an exercise and see its progress.</p>
  }

  const plan = planFor(exercise.id, sessions, programs)
  const newest = sessionsHolding(sessions, exercise.id)[0]
  const lastEntries = newest.entries
    .filter((entry) => entry.exerciseId === exercise.id)
    .sort((a, b) => a.setIndex - b.setIndex)
  const series = seriesFor(exercise, sessions)
  const records = plan ? recordsFor(exercise, plan, sessions) : []

  return (
    <>
      <label className="stats-picker">
        <span className="stats-picker-label">Exercise</span>
        <select
          className="stats-picker-select"
          value={exercise.id}
          onChange={(event) => setChosenId(event.target.value)}
        >
          {exercises.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </select>
      </label>
      {plan ? <ProgressionBar progression={progression(exercise, plan, lastEntries)} /> : null}
      <LineChart series={series} title={`${exercise.name} ${SERIES_TITLES[series.kind]}`} />
      {records.length > 0 ? (
        <ul className="stats-records">
          {records.map((record) => (
            <li key={record.kind} className="stats-record">
              <span className="stats-record-label">{record.label}</span>{' '}
              <span className="stats-record-value">{`${Math.round(record.value * 10) / 10} ${recordUnit(record)}`}</span>{' '}
              <span className="stats-record-date">{calendarDate(record.at)}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </>
  )
}

/**
 * The statistics screen, shown inside the History tab behind its History | Stats switch.
 *
 * `sessions` is every finished session, newest first, as `listSessions()` returns it; Stats
 * loads nothing itself. It holds two views, each in its own section: exercise progress
 * (E4-T7) and volume (E4-T8). With nothing logged, each says what it needs to be drawn rather
 * than drawing an empty chart.
 */
export function Stats(props: StatsProps): JSX.Element {
  const { sessions, resolve, programs } = props
  const empty = sessions.length === 0
  const points = volumeSeries(sessions, resolve, programs)
  const bodyweightPoints = points.filter((point) => point.bodyweightReps > 0)

  return (
    <div className="stats">
      <section className="stats-section" aria-label="Exercise progress">
        <h2 className="stats-heading">Exercise progress</h2>
        <ExerciseProgress sessions={sessions} resolve={resolve} programs={programs} />
      </section>
      <section className="stats-section" aria-label="Volume">
        <h2 className="stats-heading">Volume</h2>
        {empty ? (
          <p className="stats-empty">No sessions yet. Finish a session to draw its volume bar.</p>
        ) : (
          <>
            <BarChart
              bars={points.map((point) => ({ at: point.at, label: point.workoutName, value: point.kg }))}
              title="Volume per session"
            />
            {bodyweightPoints.length > 0 ? (
              <ul className="stats-bodyweight-reps">
                {bodyweightPoints.map((point) => (
                  <li key={point.at}>{`${point.workoutName}: ${point.bodyweightReps} bodyweight reps`}</li>
                ))}
              </ul>
            ) : null}
          </>
        )}
      </section>
    </div>
  )
}
