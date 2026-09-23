import { volumeSeries } from '../domain/volume'
import type { Resolve } from '../domain/muscles'
import type { Program, Session } from '../types'
import { BarChart } from './charts/BarChart'
import './Stats.css'

export type StatsProps = { sessions: Session[]; resolve: Resolve; programs: Program[] }

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
        {empty ? (
          <p className="stats-empty">No sets yet. Log a set to choose an exercise and see its progress.</p>
        ) : null}
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
