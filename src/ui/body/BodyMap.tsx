import { band } from '../../domain/band'
import type { Region } from '../../domain/muscles'
import { BACK_POLYGONS, FRONT_POLYGONS, type BodyPolygon } from './bodyPolygons'
import './BodyMap.css'

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

/** The data attributes and fill token one region's shapes get for `count` at `scale`. */
function regionShade(
  count: number,
  scale: BodyMapProps['scale'],
): { 'data-band'?: number; 'data-shade'?: 'primary' | 'secondary' | 'empty'; fill: string } {
  if (scale === 'exercise') {
    if (count >= 1) return { 'data-shade': 'primary', fill: 'var(--map-primary)' }
    if (count > 0) return { 'data-shade': 'secondary', fill: 'var(--map-secondary)' }
    return { 'data-shade': 'empty', fill: 'var(--map-shade-0)' }
  }
  const regionBand = band(count, scale)
  return { 'data-band': regionBand, fill: `var(--map-shade-${regionBand})` }
}

/**
 * The body-map component (E5-T17): a front and a back view drawn from `bodyPolygons.ts`'s
 * silhouette data, each counted region an SVG shape carrying `data-region="<Region>"` plus
 * either `data-band="<0-3>"` ('session'/'week' scale, M5/M8) or `data-shade="primary"|
 * "secondary"|"empty"` ('exercise' scale, M10). Every shape of one region, on either view, gets
 * the same shade. Filler shapes (`region: null` in bodyPolygons.ts, e.g. head/knees) carry
 * neither, are painted the empty shade and are not interactive.
 */
export function BodyMap({ counts, scale, onRegionTap }: BodyMapProps): JSX.Element {
  const renderView = (view: 'front' | 'back', polygons: BodyPolygon[]) => (
    <svg data-view={view} viewBox="0 0 100 220">
      {polygons.map(({ region, points }, index) => {
        if (region === null) {
          return <polygon key={index} points={points} style={{ fill: 'var(--map-shade-0)' }} />
        }
        const { fill, ...attributes } = regionShade(counts.get(region) ?? 0, scale)
        return (
          <polygon
            key={index}
            points={points}
            data-region={region}
            {...attributes}
            style={{ fill }}
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
