import type { Region } from '../../domain/muscles'
import { BACK_POLYGONS, FRONT_POLYGONS, type BodyPolygon } from './bodyPolygons'

export type BodyMapProps = {
  /** A region's set count, session/week/exercise depending on `scale` -- 0 or absent means
   * nothing counted. */
  counts: Map<Region, number>
  /** 'session'/'week' band a region through `src/domain/band.ts`'s `band()` (M5); 'exercise'
   * thresholds a count directly (M10): >= 1 is `--map-primary`, 0 < count < 1 is
   * `--map-secondary`. */
  scale: 'session' | 'week' | 'exercise'
  /** Tapping a counted region (E5-T20's region tap panel; out of scope here). */
  onRegionTap?(region: Region): void
}

/**
 * The body-map component (E5-T17): a front and a back view drawn from `bodyPolygons.ts`'s
 * silhouette data, each counted region an SVG shape carrying `data-region="<Region>"` plus
 * either `data-band="<0-3>"` ('session'/'week' scale, M5/M8) or `data-shade="primary"|
 * "secondary"` ('exercise' scale, M10). Filler shapes (`region: null` in bodyPolygons.ts, e.g.
 * head/knees) carry neither and are not interactive.
 *
 * Stub: every counted region currently renders `data-band="0"` regardless of `counts`/`scale`,
 * and no `data-shade` is ever set -- E5-T17's code-writer wires in `band()` (M5) for
 * 'session'/'week' and the primary/secondary threshold (M10) for 'exercise'.
 */
export function BodyMap({ counts, scale, onRegionTap }: BodyMapProps): JSX.Element {
  // Not yet consulted by this stub -- see the note above.
  void counts
  void scale

  const renderView = (view: 'front' | 'back', polygons: BodyPolygon[]) => (
    <svg data-view={view} viewBox="0 0 100 220">
      {polygons.map((polygon, index) =>
        polygon.region === null ? (
          <polygon key={index} points={polygon.points} />
        ) : (
          <polygon
            key={index}
            points={polygon.points}
            data-region={polygon.region}
            data-band={0}
            onClick={onRegionTap ? () => onRegionTap(polygon.region as Region) : undefined}
          />
        ),
      )}
    </svg>
  )

  return (
    <div className="body-map">
      {renderView('front', FRONT_POLYGONS)}
      {renderView('back', BACK_POLYGONS)}
    </div>
  )
}
