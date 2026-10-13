import { BAND_LABELS, band } from '../domain/band'
import type { Region } from '../domain/muscles'
import { formatSetCount, type HeatRow } from '../domain/sessionsView'
import './RegionHeat.css'

export type HeatScale = 'session' | 'week'

/** One heat square: the count, shaded by its band on `scale`. */
export function HeatCell({ count, scale, title }: { count: number; scale: HeatScale; title?: string }): JSX.Element {
  // A week's square is too narrow for a half set: it reads whole sets, banded on the true count.
  return (
    <span className="heat-cell" data-band={band(count, scale)} title={title}>
      {scale === 'week' ? String(Math.round(count)) : formatSetCount(count)}
    </span>
  )
}

/** The four bands' squares and labels, with the unit at the end: `0 1–2 3–5 6+   sets / session`. */
export function HeatLegend({ scale }: { scale: HeatScale }): JSX.Element {
  return (
    <div className="heat-legend" data-scale={scale}>
      {BAND_LABELS[scale].map((label, index) => (
        <span key={label} className="heat-legend-item">
          <i className="heat-legend-swatch" data-band={index} aria-hidden="true" />
          {label.replace(' sets', '')}
        </span>
      ))}
      <span className="heat-legend-unit">{scale === 'session' ? 'sets / session' : 'sets / week'}</span>
    </div>
  )
}

export type RegionHeatListProps = {
  rows: HeatRow[]
  counts: Map<Region, number>
  scale: HeatScale
  /** A tapped row, carried up so its region can open its panel. */
  onRegionTap?(region: Region): void
}

/**
 * Regions as a two-column list of `label  [count]` rows (Progress Dashboard S5b's "Worked
 * today"). Each row is a button carrying `data-region` and `data-band`, so a tap opens the
 * region's panel the way the body map's shapes did.
 */
export function RegionHeatList({ rows, counts, scale, onRegionTap }: RegionHeatListProps): JSX.Element {
  const half = Math.ceil(rows.length / 2)
  const column = (part: HeatRow[]) => (
    <div className="region-heat-column">
      {part.map((row) => {
        const count = counts.get(row.region) ?? 0
        return (
          <button
            key={row.region}
            type="button"
            className="region-heat-row cell"
            data-region={row.region}
            data-band={band(count, scale)}
            aria-label={`${row.label}, ${formatSetCount(count)} sets`}
            onClick={() => onRegionTap?.(row.region)}
          >
            <span className="region-heat-label">{row.label}</span>
            <HeatCell count={count} scale={scale} />
          </button>
        )
      })}
    </div>
  )
  return (
    <div className="region-heat">
      {column(rows.slice(0, half))}
      {column(rows.slice(half))}
    </div>
  )
}
