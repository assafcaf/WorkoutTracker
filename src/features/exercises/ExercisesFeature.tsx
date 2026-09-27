import type { Muscle } from '../../types'
import type { AppRoute } from '../routes'

export type ExercisesFeatureProps = {
  /**
   * The muscles a region panel's "Browse exercises" opened the tab on (E5-T20, M9), or `null`
   * when it was reached any other way -- the same shape `App.tsx`'s `libraryInitialMuscles` was.
   */
  initialMuscles: Muscle[] | null
  navigate(to: AppRoute): void
}

/**
 * The Exercises tab as its own container over services (E11-T12): search, filter and open an
 * exercise's detail, as today (formerly `App.tsx`'s `'exercises'` view branch), optionally
 * opened filtered to `initialMuscles`.
 *
 * STUB (E11-T12 test-designer): not implemented yet -- renders a placeholder only, so the tests
 * below fail on missing content rather than a thrown error.
 */
export function ExercisesFeature(_props: ExercisesFeatureProps): JSX.Element {
  return <div data-testid="exercises-feature-stub" />
}
