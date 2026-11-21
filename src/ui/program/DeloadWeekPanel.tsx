import '../ProgramPage.css'

export type DeloadWeekPanelProps = {
  /** The Deload week is on this week. */
  on: boolean
  onStart(): void
  onEnd(): void
}

/**
 * The Deload week page (DX-04), pushed over the Program tab: one line of what a Deload week does,
 * and the one action that starts or ends it. While it is on, Train opens every load lighter.
 */
export function DeloadWeekPanel({ on, onStart, onEnd }: DeloadWeekPanelProps): JSX.Element {
  return (
    <div className="deload-panel">
      <p className="deload-panel-line">
        {on
          ? 'On this week: every load opens 10 % lighter, so you recover. It ends with the week.'
          : 'One lighter week every 6 to 8 weeks: every load opens 10 % lighter, so you recover. It ends with the week.'}
      </p>
      {on ? (
        <button type="button" className="deload-panel-action btn-secondary" onClick={onEnd}>
          End deload week
        </button>
      ) : (
        <button type="button" className="deload-panel-action btn-secondary" onClick={onStart}>
          Start a deload week
        </button>
      )}
    </div>
  )
}
