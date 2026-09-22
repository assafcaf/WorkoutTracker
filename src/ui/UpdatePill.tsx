/**
 * The "Update ready" control: the one thing that lets a new deployment take over.
 *
 * E2-T3 stub — the behaviour is not written yet. Whether it is on screen is App's decision,
 * never this component's.
 */
export type UpdatePillProps = {
  /** Runs the update. Called only when the user presses the control. */
  onUpdate(): void | Promise<void>
}

export function UpdatePill(_props: UpdatePillProps): JSX.Element {
  throw new Error('UpdatePill is not implemented yet (E2-T3)')
}
