import './NoProgram.css'

export type NoProgramProps = {
  onChooseProgram(): void
}

/**
 * The Workout tab with no active Program (E9-T2): a new user has none until they choose one, so
 * in place of the Workout start buttons it says so and opens the Program tab.
 */
export function NoProgram(props: NoProgramProps): JSX.Element {
  const { onChooseProgram } = props

  return (
    <section className="no-program">
      <p className="no-program-title">No program yet</p>
      <button type="button" className="no-program-choose" onClick={onChooseProgram}>
        Choose a program
      </button>
    </section>
  )
}
