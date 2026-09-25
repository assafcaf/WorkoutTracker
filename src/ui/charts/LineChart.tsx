import './LineChart.css'
import type { Series, SeriesKind } from '../../domain/series'

export type LineChartProps = { series: Series; title: string }

const VIEW_WIDTH = 320
const VIEW_HEIGHT = 180
const PAD_LEFT = 40
const PAD_RIGHT = 16
const PAD_TOP = 24
const PAD_BOTTOM = 12
const POINT_RADIUS = 4
const TICK_TARGET = 4

const UNITS: Record<SeriesKind, string> = {
  e1rm: 'kg',
  reps: 'reps',
  assistance: 'kg assist',
}

/** A clean step (1, 2 or 5 times a power of ten) giving about `TICK_TARGET` ticks over `span`. */
function niceStep(span: number): number {
  const raw = span / TICK_TARGET
  const power = 10 ** Math.floor(Math.log10(raw))
  const fraction = raw / power
  const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10
  return nice * power
}

/** Clean ticks covering `min`..`max`, lowest first. A flat series gets a band around its value. */
function ticksFor(min: number, max: number): number[] {
  const span = max - min
  const step = niceStep(span > 0 ? span : Math.max(Math.abs(max), 1))
  const low = Math.floor(min / step) * step
  const high = Math.max(Math.ceil(max / step) * step, low + step)
  const ticks: number[] = []
  for (let tick = low; tick <= high + step / 2; tick += step) {
    ticks.push(Number(tick.toPrecision(12)))
  }
  return ticks
}

function formatValue(value: number): string {
  return String(Math.round(value * 10) / 10)
}

/**
 * Hand-drawn SVG line chart for one exercise's series (E4-T7). One `<circle>` per point, in the
 * order given, each carrying the raw `data-at` and `data-value`; one `<polyline>` joins two or
 * more points. Time runs left to right by index; the value axis is reversed for an inverted
 * series, so less assistance reads as higher. Only the latest value is labelled directly.
 * No points renders no `<svg>`.
 */
export function LineChart({ series, title }: LineChartProps): JSX.Element {
  const { points, kind, inverted } = series
  if (points.length === 0) {
    return <div className="line-chart" />
  }

  const values = points.map((point) => point.value)
  const ticks = ticksFor(Math.min(...values), Math.max(...values))
  const low = ticks[0]
  const high = ticks[ticks.length - 1]
  const plotWidth = VIEW_WIDTH - PAD_LEFT - PAD_RIGHT
  const plotHeight = VIEW_HEIGHT - PAD_TOP - PAD_BOTTOM

  const yOf = (value: number): number => {
    const fraction = (value - low) / (high - low)
    return PAD_TOP + (inverted ? fraction : 1 - fraction) * plotHeight
  }
  const xOf = (index: number): number =>
    points.length === 1 ? PAD_LEFT + plotWidth / 2 : PAD_LEFT + (index / (points.length - 1)) * plotWidth

  const placed = points.map((point, index) => ({ ...point, x: xOf(index), y: yOf(point.value) }))
  const latest = placed[placed.length - 1]
  const unit = UNITS[kind]

  return (
    <div className="line-chart">
      <svg className="line-chart-svg" role="img" aria-label={title} viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}>
        <text className="line-chart-unit" x={0} y={12}>
          {`${unit} `}
        </text>
        {ticks.map((tick) => (
          <g key={tick}>
            <line className="line-chart-grid" x1={PAD_LEFT} x2={VIEW_WIDTH - PAD_RIGHT} y1={yOf(tick)} y2={yOf(tick)} />
            <text className="line-chart-tick" x={PAD_LEFT - 6} y={yOf(tick)} textAnchor="end" dominantBaseline="middle">
              {formatValue(tick)}
            </text>
          </g>
        ))}
        {placed.length > 1 ? (
          <polyline className="line-chart-line" points={placed.map((point) => `${point.x},${point.y}`).join(' ')} />
        ) : null}
        {placed.map((point, index) => (
          <circle
            key={`${point.at}-${index}`}
            className="line-chart-point"
            data-at={point.at}
            data-value={point.value}
            cx={point.x}
            cy={point.y}
            r={POINT_RADIUS}
          />
        ))}
        <text className="line-chart-latest" x={latest.x} y={latest.y - POINT_RADIUS - 6} textAnchor="end">
          {formatValue(latest.value)}
        </text>
      </svg>
    </div>
  )
}
