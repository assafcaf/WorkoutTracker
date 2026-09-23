import type { Resolve } from '../domain/muscles'
import type { LibraryExercise, Muscle, Session } from '../types'

export type SessionSummaryProps = {
  session: Session
  resolve: Resolve
  library: Map<string, LibraryExercise>
  onClose(): void
  /** A region panel's "Browse exercises" (M9), carried up to whoever can switch tabs. */
  onBrowse?(muscles: Muscle[]): void
}

/**
 * One session's summary (E5-T20, M16): its body map on the session scale, each region tappable
 * into a `RegionPanel`. Shown on Finish and when a session is opened from History.
 *
 * Stub: E5-T20's red commit. The code-writer implements it.
 */
export function SessionSummary(_props: SessionSummaryProps): JSX.Element | null {
  return null
}
