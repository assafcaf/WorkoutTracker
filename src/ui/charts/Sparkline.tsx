import './Sparkline.css'

export type SparklineProps = {
  values: number[]
  /** What the line shows, for a screen reader: `Back squat e1RM`. */
  label: string
  width?: number
  height?: number
  /** v7: the end dot wears the lift's status colour (up, flat or down); ink-3 when left out. */
  tone?: 'up' | 'flat' | 'down'
}

const PAD = 3

/**
 * A word-sized trend (the Progress ledger rows, study §3 Chart): the values joined left to right
 * in time order in a grey line, a larger value drawn higher, and the latest value as a dot in the
 * status colour. One value draws the dot alone at mid-height; none draws an empty svg. 72 × 26
 * unless told otherwise.
 */
export function Sparkline({ values, label, width = 72, height = 26, tone = 'flat' }: SparklineProps): JSX.Element {
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
      {values.length > 1 ? (
        <polyline
          className="sparkline-line"
          points={values.map((value, index) => `${xOf(index).toFixed(1)},${yOf(value).toFixed(1)}`).join(' ')}
        />
      ) : null}
      {last >= 0 ? (
        <circle className="sparkline-end" data-tone={tone} cx={xOf(last)} cy={yOf(values[last])} r={2.75} />
      ) : null}
    </svg>
  )
}
