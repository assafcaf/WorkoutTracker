import './Sparkline.css'

export type SparklineProps = {
  values: number[]
  /** What the line shows, for a screen reader: `Back squat e1RM`. */
  label: string
  width?: number
  height?: number
}

const PAD = 4

/**
 * A word-sized trend (the Dashboard's Lifts rows): a hairline baseline, the values joined left to
 * right in time order with a larger value drawn higher, and a dot on the latest value. One value
 * draws the dot alone at mid-height; none draws an empty svg.
 */
export function Sparkline({ values, label, width = 64, height = 24 }: SparklineProps): JSX.Element {
  const low = Math.min(...values)
  const high = Math.max(...values)
  const xOf = (index: number): number =>
    values.length === 1 ? width - PAD : PAD + (index * (width - 2 * PAD)) / (values.length - 1)
  const yOf = (value: number): number =>
    high === low ? height / 2 : height - PAD - ((value - low) / (high - low)) * (height - 2 * PAD)
  const last = values.length - 1

  return (
    <svg
      className="sparkline"
      role="img"
      aria-label={label}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
    >
      <line className="sparkline-base" x1={PAD} x2={width - PAD} y1={height - 0.5} y2={height - 0.5} />
      {values.length > 1 ? (
        <polyline
          className="sparkline-line"
          points={values.map((value, index) => `${xOf(index).toFixed(1)},${yOf(value).toFixed(1)}`).join(' ')}
        />
      ) : null}
      {last >= 0 ? <circle className="sparkline-end" cx={xOf(last)} cy={yOf(values[last])} r={3} /> : null}
    </svg>
  )
}
