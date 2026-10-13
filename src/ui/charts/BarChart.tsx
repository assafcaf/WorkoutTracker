import './BarChart.css'
import { dateLabel, formatValue, labelledIndexes, ticksFor } from './axis'

export type BarChartBar = {
  at: number
  label: string
  value: number
  /** 'b' marks a bar of the chart's second series (E17-T10, O19). */
  series?: 'b'
}
export type BarChartProps = { bars: BarChartBar[]; title: string }

const VIEW_WIDTH = 320
const VIEW_HEIGHT = 180
const PAD_LEFT = 40
const PAD_RIGHT = 16
const PAD_TOP = 12
const PAD_BOTTOM = 28
const BAR_GAP = 6
const X_LABEL_OFFSET = 18

/**
 * Hand-drawn SVG bar chart (E4-T8). One `<rect>` per bar, in the order given, each carrying
 * `data-at`, `data-label` and `data-value`, plus `data-series="b"` for a second-series bar. A
 * `[data-axis="y"]` group labels values from 0 up past the tallest bar, over `.bar-chart-grid`
 * gridlines, and a `[data-axis="x"]` group labels the bars' dates (E17-T10, O19). Empty `bars`
 * renders no `<svg>`.
 */
export function BarChart({ bars, title }: BarChartProps): JSX.Element {
  if (bars.length === 0) {
    return <div className="bar-chart" />
  }

  const ticks = ticksFor(0, Math.max(...bars.map((bar) => bar.value), 0))
  const top = ticks[ticks.length - 1]
  const plotWidth = VIEW_WIDTH - PAD_LEFT - PAD_RIGHT
  const plotHeight = VIEW_HEIGHT - PAD_TOP - PAD_BOTTOM
  const baseline = PAD_TOP + plotHeight
  const barWidth = (plotWidth - BAR_GAP * (bars.length - 1)) / bars.length
  const yOf = (value: number): number => baseline - (value / top) * plotHeight
  const xOf = (index: number): number => PAD_LEFT + index * (barWidth + BAR_GAP)
  const now = new Date()

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
          {labelledIndexes(bars.length).map((index) => (
            <text
              key={index}
              className="bar-chart-axis-label"
              x={xOf(index) + barWidth / 2}
              y={baseline + X_LABEL_OFFSET}
              textAnchor="middle"
            >
              {dateLabel(bars[index].at, now)}
            </text>
          ))}
        </g>
        {bars.map((bar, index) => {
          const y = yOf(Math.max(bar.value, 0))
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
              height={baseline - y}
            />
          )
        })}
      </svg>
    </div>
  )
}
