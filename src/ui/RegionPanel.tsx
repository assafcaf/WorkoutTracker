import type { Region } from '../domain/muscles'
import type { Muscle } from '../types'
import { musclesForRegion } from './regionMuscles'
import './RegionPanel.css'

export type RegionPanelProps = {
  region: Region
  count: number
  contributors: { exerciseId: string; name: string; sets: number }[]
  onBrowse(muscles: Muscle[]): void
  onClose(): void
}

/**
 * The panel a tapped body-map region opens (E5-T20, M9): the region's set count, the exercises
 * that contributed to it, "Browse exercises" (every muscle the region is drawn for) and "Close".
 */
export function RegionPanel({
  region,
  count,
  contributors,
  onBrowse,
  onClose,
}: RegionPanelProps): JSX.Element {
  return (
    <div role="dialog" aria-label={region} className="region-panel">
      <h3 className="region-panel-heading">{region}</h3>
      <p className="region-panel-count">{`${count} sets`}</p>
      {contributors.length > 0 ? (
        <ul className="region-panel-contributors">
          {contributors.map((contributor) => (
            <li key={contributor.exerciseId} className="region-panel-contributor">
              <span className="region-panel-contributor-name">{contributor.name}</span>{' '}
              <span className="region-panel-contributor-sets">{`${contributor.sets} sets`}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="region-panel-actions">
        <button
          type="button"
          className="region-panel-button"
          onClick={() => onBrowse(musclesForRegion(region))}
        >
          Browse exercises
        </button>
        <button type="button" className="region-panel-button" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  )
}
