import './LineChart.css'
import type { Series, SeriesKind } from '../../domain/series'
import { shortDay } from '../../domain/lifts'
import { dateLabel, formatValue, labelledIndexes, spacedIndexes, ticksFor } from './axis'

export type LineChartProps = {
  series: Series
  title: string
  /**
   * The `at` of each point that set a record. When given, those points wear the record marker
   * (`.line-chart-record`, the primary fill) and the rest and the line read in the secondary ink,
   * so the records stand out (the Lifts tab, S6b). Omitted, every point is drawn alike.
   */
  recordAts?: number[]
  /**
   * Dates on the x-axis read `21 Sep` rather than `Mon 21 Sep`, and only as many as fit without
   * touching are labelled (always the first and the last).
   */
  compactDates?: boolean
}

const VIEW_WIDTH = 320
const VIEW_HEIGHT = 180
const PAD_LEFT = 40
const PAD_RIGHT = 16
const PAD_TOP = 24
const PAD_BOTTOM = 28
const POINT_RADIUS = 4
const X_LABEL_OFFSET = 18
/** The least distance, in view units, between two compact date labels' anchors. */
const COMPACT_LABEL_GAP = 64

const UNITS: Record<SeriesKind, string> = {
  e1rm: 'kg',
  reps: 'reps',
  load: 'kg',
}

/**
 * Hand-drawn SVG line chart for one exercise's series (E4-T7). One `<circle>` per point, in the
 * order given, each carrying the raw `data-at` and `data-value`; one `<polyline>` joins two or
 * more points. Time runs left to right by index and a larger value is drawn higher; a load
 * series is signed, so less assistance reads as higher. Only the latest value is labelled directly.
 * A `[data-axis="y"]` group labels the value ticks and a `[data-axis="x"]` group labels the
 * points' dates (E17-T10, O19). No points renders no `<svg>`.
 */
export function LineChart({ series, title, recordAts, compactDates }: LineChartProps): JSX.Element {
  const { points, kind } = series
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
    return PAD_TOP + (1 - fraction) * plotHeight
  }
  const xOf = (index: number): number =>
    points.length === 1 ? PAD_LEFT + plotWidth / 2 : PAD_LEFT + (index / (points.length - 1)) * plotWidth

  const placed = points.map((point, index) => ({ ...point, x: xOf(index), y: yOf(point.value) }))
  const latest = placed[placed.length - 1]
  const unit = UNITS[kind]
  const now = new Date()
  const lastIndex = placed.length - 1

  return (
    <div className="line-chart" data-records={recordAts ? '' : undefined}>
      <svg className="line-chart-svg" role="img" aria-label={title} viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}>
        <text className="line-chart-unit" x={0} y={12}>
          {`${unit} `}
        </text>
        {ticks.map((tick) => (
          <line
            key={tick}
            className="line-chart-grid"
            x1={PAD_LEFT}
            x2={VIEW_WIDTH - PAD_RIGHT}
            y1={yOf(tick)}
            y2={yOf(tick)}
          />
        ))}
        <g data-axis="y">
          {ticks.map((tick) => (
            <text
              key={tick}
              className="line-chart-axis-label"
              x={PAD_LEFT - 6}
              y={yOf(tick)}
              textAnchor="end"
              dominantBaseline="middle"
            >
              {formatValue(tick)}
            </text>
          ))}
        </g>
        <g data-axis="x">
          {(compactDates
            ? spacedIndexes(placed.map((point) => point.x), COMPACT_LABEL_GAP)
            : labelledIndexes(placed.length)
          ).map((index) => (
            <text
              key={index}
              className="line-chart-axis-label"
              x={placed[index].x}
              y={VIEW_HEIGHT - PAD_BOTTOM + X_LABEL_OFFSET}
              textAnchor={placed.length === 1 ? 'middle' : index === 0 ? 'start' : index === lastIndex ? 'end' : 'middle'}
            >
              {compactDates ? shortDay(placed[index].at, now) : dateLabel(placed[index].at, now)}
            </text>
          ))}
        </g>
        {placed.length > 1 ? (
          <polyline className="line-chart-line" points={placed.map((point) => `${point.x},${point.y}`).join(' ')} />
        ) : null}
        {placed.map((point, index) => (
          <circle
            key={`${point.at}-${index}`}
            className={
              recordAts === undefined
                ? 'line-chart-point'
                : recordAts.includes(point.at)
                  ? 'line-chart-point line-chart-record'
                  : 'line-chart-point line-chart-plain'
            }
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
