import './RecordSpark.css'

export type RecordSparkProps = { values: number[]; label: string; width?: number; height?: number }

const PAD = 4

/**
 * A record's trend as a small sparkline (Progress Dashboard S5b): a secondary-ink line through
 * `values`, oldest first, ending on an accent dot that marks today's record. One value draws the
 * dot alone; none draws nothing.
 */
export function RecordSpark({ values, label, width = 64, height = 24 }: RecordSparkProps): JSX.Element | null {
  if (values.length === 0) return null
  const min = Math.min(...values)
  const max = Math.max(...values)
  const x = (index: number): number =>
    values.length === 1 ? width - PAD : PAD + (index * (width - 2 * PAD)) / (values.length - 1)
  const y = (value: number): number =>
    max === min ? height / 2 : height - PAD - ((value - min) / (max - min)) * (height - 2 * PAD)
  const path = values.map((value, index) => `${index ? 'L' : 'M'}${x(index).toFixed(1)} ${y(value).toFixed(1)}`).join(' ')
  const last = values.length - 1

  return (
    <svg
      className="record-spark"
      role="img"
      aria-label={label}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
    >
      {values.length > 1 ? <path className="record-spark-line" d={path} /> : null}
      <circle className="record-spark-end" cx={x(last)} cy={y(values[last])} r={3} />
    </svg>
  )
}
