import './BarChart.css'
import { dateLabel, spacedIndexes, ticksFor } from './axis'

export type BarChartBar = {
  at: number
  label: string
  value: number
  /** 'b' marks a bar of the chart's second series (E17-T10, O19). */
  series?: 'b'
}
export type BarChartProps = { bars: BarChartBar[]; title: string }

// The mock's volume chart (S6a): 334 x 124 inside a card, the plot inset for the y labels on
// the left and the last bar's value label above.
const VIEW_WIDTH = 334
const VIEW_HEIGHT = 124
const PAD_LEFT = 46
const PAD_RIGHT = 8
const PAD_TOP = 22
const PAD_BOTTOM = 22
const BAR_MAX_WIDTH = 16
const BAR_RADIUS = 4
/** About this many steps up the y-axis: 0, 5,000 and 10,000 for a 9,840 kg session. */
const Y_TICK_TARGET = 2
/** The closest two x labels' centres may sit, so "30 Sep" never runs into "9 Oct". */
const X_LABEL_GAP = 52

/** A value as an axis or a bar reads it: whole, with thousands separators. */
function formatAmount(value: number): string {
  return Math.round(value).toLocaleString('en-US')
}

/** A bar's date as the x-axis reads it, without the weekday: "13 Oct". */
function shortDate(at: number, now: Date): string {
  return dateLabel(at, now).replace(/^[A-Z][a-z]{2} /, '')
}

/**
 * Hand-drawn SVG bar chart (E4-T8). One `<rect>` per bar, in the order given, each carrying
 * `data-at`, `data-label` and `data-value`, plus `data-series="b"` for a second-series bar. A
 * `[data-axis="y"]` group labels values from 0 up past the tallest bar, over `.bar-chart-grid`
 * gridlines, a `[data-axis="x"]` group labels the bars' dates where they fit (the first and the
 * last always), and the last bar carries its own value (S6a, E17-T10, O19). Empty `bars`
 * renders no `<svg>`.
 */
export function BarChart({ bars, title }: BarChartProps): JSX.Element {
  if (bars.length === 0) {
    return <div className="bar-chart" />
  }

  const ticks = ticksFor(0, Math.max(...bars.map((bar) => bar.value), 0), Y_TICK_TARGET)
  const top = ticks[ticks.length - 1]
  const plotWidth = VIEW_WIDTH - PAD_LEFT - PAD_RIGHT
  const plotHeight = VIEW_HEIGHT - PAD_TOP - PAD_BOTTOM
  const baseline = PAD_TOP + plotHeight
  const slot = plotWidth / bars.length
  const barWidth = Math.min(BAR_MAX_WIDTH, slot * 0.7)
  const yOf = (value: number): number => baseline - (value / top) * plotHeight
  const xOf = (index: number): number => PAD_LEFT + index * slot + (slot - barWidth) / 2
  const now = new Date()
  const last = bars.length - 1
  const labelled = spacedIndexes(
    bars.map((_, index) => xOf(index) + barWidth / 2),
    X_LABEL_GAP,
  )

  return (
    <div className="bar-chart">
      <svg className="bar-chart-svg" role="img" aria-label={title} viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}>
        {ticks.map((tick) => (
          <line
            key={tick}
            className="bar-chart-grid"
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
              className="bar-chart-axis-label"
              x={PAD_LEFT - 8}
              y={yOf(tick) + 4}
              textAnchor="end"
            >
              {formatAmount(tick)}
            </text>
          ))}
        </g>
        <g data-axis="x">
          {labelled.map((index) => {
            // The last label ends at the plot's right edge, as the mock's "13 Oct" does.
            const end = index === last && bars.length > 1
            return (
              <text
                key={index}
                className="bar-chart-axis-label"
                x={end ? VIEW_WIDTH - 2 : xOf(index) + barWidth / 2}
                y={VIEW_HEIGHT - 4}
                textAnchor={end ? 'end' : 'middle'}
              >
                {shortDate(bars[index].at, now)}
              </text>
            )
          })}
        </g>
        {bars.map((bar, index) => {
          const y = yOf(Math.max(bar.value, 0))
          const height = baseline - y
          return (
            <rect
              key={`${bar.at}-${index}`}
              className="bar-chart-bar"
              data-at={bar.at}
              data-label={bar.label}
              data-value={bar.value}
              data-series={bar.series}
              x={xOf(index)}
              y={y}
              width={barWidth}
              // Rounded on top only: the rounded foot hangs under the baseline and is clipped.
              height={height > 0 ? height + BAR_RADIUS : 0}
              rx={Math.min(BAR_RADIUS, height)}
            >
              <title>{`${dateLabel(bar.at, now)} · ${bar.label} · ${formatAmount(bar.value)}`}</title>
            </rect>
          )
        })}
        <text
          className="bar-chart-value-label"
          x={xOf(last) + barWidth}
          y={yOf(Math.max(bars[last].value, 0)) - 7}
          textAnchor="end"
        >
          {formatAmount(bars[last].value)}
        </text>
      </svg>
    </div>
  )
}
