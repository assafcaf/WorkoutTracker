import { Segmented } from '../controls'
import './live.css'

/** Which of the Live session's two views is shown: the open Set, or every Exercise's cells. */
export type LiveView = 'now' | 'all'

export type LiveSessionBarProps = {
  view: LiveView
  onViewChange(view: LiveView): void
}

const OPTIONS: { value: LiveView; label: string }[] = [
  { value: 'now', label: 'Set' },
  { value: 'all', label: 'All' },
]

/**
 * The Live session's view switch (DX-19): a two-segment control "Set | All" in the header row,
 * 44 px tall, so both views are named at all times and the selected one is always visible. "Set"
 * goes back to the Set the Session is on; "All" opens every Exercise.
 */
export function LiveSessionBar({ view, onViewChange }: LiveSessionBarProps): JSX.Element {
  return (
    <div className="live-view-switch">
      <Segmented name="live-view" label="View" value={view} options={OPTIONS} onChange={onViewChange} />
    </div>
  )
}
