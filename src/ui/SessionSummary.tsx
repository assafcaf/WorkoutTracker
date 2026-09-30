import { useState } from 'react'
import { summarize } from '../domain/summary'
import { contributors, muscleSets, toRegionCounts } from '../domain/muscles'
import type { ExerciseRecord } from '../domain/records'
import type { Region, Resolve } from '../domain/muscles'
import type { ExercisePlan, LibraryExercise, Muscle, Session } from '../types'
import { BodyMap } from './body/BodyMap'
import { BodyMapLegend } from './body/BodyMapLegend'
import { CourtStripe } from './CourtStripe'
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
  onClose(): void
  /** A region panel's "Browse exercises" (M9), carried up to whoever can switch tabs. */
  onBrowse?(muscles: Muscle[]): void
}

/** `52 min`, or `1 h 05 min` from an hour up. */
function formatDuration(ms: number): string {
  const minutes = Math.round(ms / 60_000)
  if (minutes < 60) return `${minutes} min`
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')} min`
}

/** A record's set as `85 kg × 5`, or `12 reps` for a bodyweight one. */
function recordValue(record: ExerciseRecord): string {
  return record.weightKg === null ? `${record.reps} reps` : `${record.weightKg} kg × ${record.reps}`
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
 * One session's summary (E5-T20, M16): its body map on the session scale, each region tappable
 * into a `RegionPanel`. Shown on Finish and when a session is opened from History.
 */
export function SessionSummary({
  session,
  resolve,
  library,
  earlierSessions = [],
  planFor = () => undefined,
  onClose,
  onBrowse,
}: SessionSummaryProps): JSX.Element {
  const [openRegion, setOpenRegion] = useState<Region | null>(null)
  const counts = toRegionCounts(muscleSets(session.entries, resolve, library))
  const stats = summarize(session, earlierSessions, resolve, planFor)
  const volume =
    `${Math.round(stats.volumeKg).toLocaleString('en-US')} kg` +
    (stats.bodyweightReps > 0 ? ` · ${stats.bodyweightReps} bodyweight reps` : '')
  const prLines = stats.records.flatMap((entry) =>
    entry.records.map((record) => ({
      key: `${entry.exerciseId}-${record.kind}`,
      text: `${entry.name} · ${record.label} · ${recordValue(record)}`,
    })),
  )

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Session summary"
      className="session-summary overlay-panel"
    >
      <CourtStripe />
      <h2 className="session-summary-heading">Session summary</h2>
      <p className="session-summary-stat">{formatDuration(stats.durationMs)}</p>
      <p className="session-summary-stat">{volume}</p>
      {prLines.length > 0 ? (
        <ul className="session-summary-prs">
          {prLines.map((line) => (
            <li key={line.key}>{line.text}</li>
          ))}
        </ul>
      ) : null}
      <BodyMap counts={counts} scale="session" onRegionTap={setOpenRegion} />
      <BodyMapLegend scale="session" />
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
      <button type="button" className="session-summary-done" onClick={onClose}>
        Done
      </button>
    </div>
  )
}
