import './UpdatePill.css'
import { SIGN_IN_PATH } from '../sync/syncClient'

/**
 * The "Update ready" control: the one thing that lets a new deployment take over.
 *
 * Presentational, and deliberately so — it holds no state and never reaches for the service
 * worker itself. Whether it is on screen is App's decision, never this component's, and the
 * update runs only when the trainee presses it.
 */
export type UpdatePillProps = {
  /** Runs the update. Called only when the user presses the control. */
  onUpdate(): void | Promise<void>
}

export function UpdatePill({ onUpdate }: UpdatePillProps): JSX.Element {
  return (
    <button
      type="button"
      className="update-pill btn-primary"
      onClick={() => {
        void onUpdate()
      }}
    >
      Update ready
    </button>
  )
}

/**
 * Shown instead when the update check is turned away by the login in front of the app: no
 * new version can be found until the trainee signs in again, and nothing else would say so.
 */
export function SignInToUpdatePill(): JSX.Element {
  return (
    <a className="update-pill update-pill--quiet" href={SIGN_IN_PATH}>
      Sign in to update
    </a>
  )
}
