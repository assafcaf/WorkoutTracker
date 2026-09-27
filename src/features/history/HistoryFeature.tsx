import type { AppRoute } from '../routes'

export type HistoryFeatureProps = {
  navigate(to: AppRoute): void
  onInSession(inSession: boolean): void
}

/**
 * The History tab as its own container over services (E11-T13, O12): shows the History |
 * Stats switch, the finished sessions and their summary, refreshing itself whenever the
 * `'sessions'` topic fires (a local write or a pulled Session), without a reload.
 *
 * STUB (E11-T13 test-designer): not implemented yet.
 */
export function HistoryFeature(_props: HistoryFeatureProps): JSX.Element | null {
  return null
}
