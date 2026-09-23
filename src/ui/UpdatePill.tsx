import './UpdatePill.css'

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
      className="update-pill"
      onClick={() => {
        void onUpdate()
      }}
    >
      Update ready
    </button>
  )
}
