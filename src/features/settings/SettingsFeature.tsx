import type { AppRoute } from '../routes'

export type SettingsFeatureProps = {
  navigate(to: AppRoute): void
  onInSession(inSession: boolean): void
}

/**
 * The Settings tab as its own container over services (E11-T14): switches the active Program,
 * saves gym equipment and the volume baseline, exports, imports with confirmation, and shows
 * the sync status and "Sync now" from `useSyncControls()` -- all as `App.tsx` did before E11.
 *
 * STUB (E11-T14 test-designer): not implemented yet.
 */
export function SettingsFeature(_props: SettingsFeatureProps): JSX.Element {
  throw new Error('SettingsFeature is not implemented yet')
}
