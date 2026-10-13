import { formatKg } from '../../domain/liveProgress'
import type { LiveProgress } from '../../domain/liveProgress'
import { Segmented } from '../controls'
import { Bullet } from './Bullet'
import './live.css'

/** Which of the Live session's two views is shown: the open Set, or every Exercise's cells. */
export type LiveView = 'now' | 'all'

export type LiveSessionBarProps = {
  progress: LiveProgress
  /** The Workout's name; "Workout A" reads "A" in "last A at this point". */
  workoutName: string
  view: LiveView
  onViewChange(view: LiveView): void
}

/** "Workout A" -> "A"; any other name is kept as it is. */
function shortName(workoutName: string): string {
  return workoutName.replace(/^workout\s+/i, '')
}

/**
 * The top of the Live session under its header (Progress Dashboard S2/S3): the volume projection
 * line -- today against the last time this Workout was done, at the same point -- with Sets and
 * PRs so far, then the `Now | All` switch.
 */
export function LiveSessionBar({ progress, workoutName, view, onViewChange }: LiveSessionBarProps): JSX.Element {
  const { volumeKg, lastVolumeKg, setsDone, setsPlanned, prs } = progress
  const name = shortName(workoutName)
  return (
    <div className="live-bar">
      <div className="live-progress">
        <p className="live-progress-volume">
          {'Volume '}
          <b className="live-figure">{formatKg(volumeKg)} kg</b>
          {lastVolumeKg === null ? null : ` · last ${name} at this point ${formatKg(lastVolumeKg)} kg`}
        </p>
        <div className="live-progress-row">
          <Bullet
            today={volumeKg}
            last={lastVolumeKg}
            label={
              lastVolumeKg === null
                ? `Today ${formatKg(volumeKg)} kg`
                : `Today ${formatKg(volumeKg)} kg · last time ${formatKg(lastVolumeKg)} kg`
            }
          />
          <span className="live-progress-counts">
            {'Sets '}
            <b className="live-figure">{setsDone}</b>
            {`/${setsPlanned} · PRs `}
            <b className="live-figure">{prs}</b>
          </span>
        </div>
      </div>
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
