import type { AppRoute } from '../routes'

export type ProgramFeatureProps = {
  navigate(to: AppRoute): void
  onInSession(inSession: boolean): void
}

/**
 * The Program tab as its own container over services (E11-T11, O10): lists, switches, creates,
 * copies, edits, deletes and resets Programs through `services.programs`, wrapping the existing
 * `ProgramPage` and `ProgramEditor`.
 *
 * STUB (E11-T11 test-designer): not implemented yet.
 */
export function ProgramFeature(_props: ProgramFeatureProps): JSX.Element {
  throw new Error('ProgramFeature is not implemented yet (E11-T11)')
}
