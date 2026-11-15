import { Segmented } from '../controls'
import './live.css'

/** Which of the Live session's two views is shown: the open Set, or every Exercise's cells. */
export type LiveView = 'now' | 'all'

export type LiveSessionBarProps = {
  view: LiveView
  onViewChange(view: LiveView): void
}

/**
 * The top of the Live session under its header (Progress Dashboard S2/S3): the `Now | All`
 * switch. The Sets count rides in the header's title row (V1-10).
 */
export function LiveSessionBar({ view, onViewChange }: LiveSessionBarProps): JSX.Element {
  return (
    <div className="live-bar">
      <div className="live-view-switch">
        <Segmented
          name="live-view"
          label="Session view"
          value={view}
          options={[
            { value: 'now', label: 'Now' },
            { value: 'all', label: 'All' },
          ]}
          onChange={onViewChange}
        />
      </div>
    </div>
  )
}
