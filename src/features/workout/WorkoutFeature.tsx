import type { AppRoute } from '../routes'

export type WorkoutFeatureProps = {
  /** Sends the app to another tab: the Program tab from "Choose a program", Exercises from a summary. */
  navigate(to: AppRoute): void
  /** Told `true` on the exercise list and set screen, `false` on the picker. */
  onInSession(inSession: boolean): void
}

/**
 * The Workout tab as its own container over the services (E11-T10, O9): the picker, the
 * exercise list and set screen of the Session in progress, the swap overlays and the summary.
 *
 * STUB (E11-T10 test-designer): not implemented yet.
 */
export function WorkoutFeature(_props: WorkoutFeatureProps): JSX.Element {
  return <div />
}
