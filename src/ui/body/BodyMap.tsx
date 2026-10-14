import { band } from '../../domain/band'
import type { Region } from '../../domain/muscles'
import { BACK_POLYGONS, FRONT_POLYGONS, type BodyPolygon } from './bodyPolygons'
import './BodyMap.css'

export type BodyMapProps = {
  /** A region's set count, session/week/exercise depending on `scale` -- 0 or absent means
   * nothing counted. */
  counts: Map<Region, number>
  /** 'session'/'week' band a region through `src/domain/band.ts`'s `band()` (M5); 'exercise'
   * thresholds a count directly (M10): >= 1 is primary (`--heat-3`), 0 < count < 1 is
   * secondary (`--heat-2`). */
  scale: 'session' | 'week' | 'exercise'
  /** Tapping a counted region (E5-T20's region tap panel; out of scope here). */
  onRegionTap?(region: Region): void
}

/** The data attributes one region's shapes get for `count` at `scale`; BodyMap.css paints
 * each band and shade its heat step (E17-T10, O18). */
function regionShade(
  count: number,
  scale: BodyMapProps['scale'],
): { 'data-band'?: number; 'data-shade'?: 'primary' | 'secondary' | 'empty' } {
  if (scale === 'exercise') {
    if (count >= 1) return { 'data-shade': 'primary' }
    if (count > 0) return { 'data-shade': 'secondary' }
    return { 'data-shade': 'empty' }
  }
  return { 'data-band': band(count, scale) }
}

/**
 * The body-map component (E5-T17): a front and a back view drawn from `bodyPolygons.ts`'s
 * silhouette data, each counted region an SVG shape carrying `data-region="<Region>"` plus
 * either `data-band="<0-3>"` ('session'/'week' scale, M5/M8) or `data-shade="primary"|
 * "secondary"|"empty"` ('exercise' scale, M10). Every shape of one region, on either view, gets
 * the same shade. Filler shapes (`region: null` in bodyPolygons.ts, e.g. head/knees) carry
 * neither, are painted the empty shade and are not interactive.
 *
 * On the 'session'/'week' scales each view's `<svg>` carries `role="img"` and an `aria-label`
 * naming its view and scale (E6-T9, O23), so a screen reader gets a label for each map. The
 * 'exercise' scale is left unlabelled: `ExerciseDetail` already names its own photos with
 * `role="img"`, and a second, unnamed set of images there would break that screen's own tests.
 */
export function BodyMap({ counts, scale, onRegionTap }: BodyMapProps): JSX.Element {
  const renderView = (view: 'front' | 'back', polygons: BodyPolygon[]) => (
    <svg
      data-view={view}
      viewBox="0 0 100 220"
      {...(scale === 'exercise'
        ? {}
        : { role: 'img', 'aria-label': `${view} view, ${scale} scale` })}
    >
      {polygons.map(({ region, points }, index) => {
        if (region === null) {
          return <polygon key={index} points={points} />
        }
        return (
          <polygon
            key={index}
            points={points}
            data-region={region}
            {...regionShade(counts.get(region) ?? 0, scale)}
            onClick={onRegionTap ? () => onRegionTap(region) : undefined}
          />
        )
      })}
    </svg>
  )

  return (
    <div className="body-map">
      {renderView('front', FRONT_POLYGONS)}
      {renderView('back', BACK_POLYGONS)}
    </div>
  )
}
