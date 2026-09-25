import './BarChart.css'

export type BarChartBar = { at: number; label: string; value: number }
export type BarChartProps = { bars: BarChartBar[]; title: string }

const VIEW_WIDTH = 100
const VIEW_HEIGHT = 60
const BAR_GAP = 2

/**
 * Hand-drawn SVG bar chart (E4-T8). One `<rect>` per bar, in the order given, each carrying
 * `data-at`, `data-label` and `data-value`. Empty `bars` renders no `<svg>`.
 */
export function BarChart({ bars, title }: BarChartProps): JSX.Element {
  if (bars.length === 0) {
    return <div className="bar-chart" />
  }

  const max = Math.max(...bars.map((bar) => bar.value), 0)
  const barWidth = (VIEW_WIDTH - BAR_GAP * (bars.length - 1)) / bars.length

  return (
    <div className="bar-chart">
      <svg className="bar-chart-svg" role="img" aria-label={title} viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}>
        {bars.map((bar, index) => {
          const height = max > 0 ? (bar.value / max) * VIEW_HEIGHT : 0
          const x = index * (barWidth + BAR_GAP)
          const y = VIEW_HEIGHT - height
          return (
            <rect
              key={`${bar.at}-${index}`}
              className="bar-chart-bar"
              data-at={bar.at}
              data-label={bar.label}
              data-value={bar.value}
              x={x}
              y={y}
              width={barWidth}
              height={height}
            />
          )
        })}
      </svg>
    </div>
  )
}
