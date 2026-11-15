import { Icon } from '../icons'
import './live.css'

/** Which of the Live session's two views is shown: the open Set, or every Exercise's cells. */
export type LiveView = 'now' | 'all'

export type LiveSessionBarProps = {
  view: LiveView
  onViewChange(view: LiveView): void
}

/**
 * The Live session's view switch (V3-07): one button in the header row, not a band under it.
 * On Now it opens every Exercise ("All exercises", a list icon over "All"); on All it goes back to
 * the Set the Session is on ("Now"). A plain button, so the keyboard and a screen reader reach it
 * by its name.
 */
export function LiveSessionBar({ view, onViewChange }: LiveSessionBarProps): JSX.Element {
  const toAll = view === 'now'
  return (
    <button
      type="button"
      className="live-view-button btn-quiet"
      aria-label={toAll ? 'All exercises' : 'Now'}
      onClick={() => onViewChange(toAll ? 'all' : 'now')}
    >
      <Icon name={toAll ? 'ListChecks' : 'Dumbbell'} size={20} />
      <span className="live-view-button-text" aria-hidden="true">
        {toAll ? 'All' : 'Now'}
      </span>
    </button>
  )
}
