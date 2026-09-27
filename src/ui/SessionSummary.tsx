import { useState } from 'react'
import { contributors, muscleSets, toRegionCounts } from '../domain/muscles'
import type { Region, Resolve } from '../domain/muscles'
import type { LibraryExercise, Muscle, Session } from '../types'
import { BodyMap } from './body/BodyMap'
import { BodyMapLegend } from './body/BodyMapLegend'
import { RegionPanel } from './RegionPanel'
import { musclesForRegion } from './regionMuscles'
import './SessionSummary.css'

export type SessionSummaryProps = {
  session: Session
  resolve: Resolve
  library: Map<string, LibraryExercise>
  onClose(): void
  /** A region panel's "Browse exercises" (M9), carried up to whoever can switch tabs. */
  onBrowse?(muscles: Muscle[]): void
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
  onClose,
  onBrowse,
}: SessionSummaryProps): JSX.Element {
  const [openRegion, setOpenRegion] = useState<Region | null>(null)
  const counts = toRegionCounts(muscleSets(session.entries, resolve, library))

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Session summary"
      className="session-summary overlay-panel"
    >
      <h2 className="session-summary-heading">Session summary</h2>
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
