import './BarChart.css'

export type BarChartBar = { at: number; label: string; value: number }
export type BarChartProps = { bars: BarChartBar[]; title: string }

/**
 * Hand-drawn SVG bar chart (E4-T8). One `<rect>` per bar, in the order given, each carrying
 * `data-at`, `data-label` and `data-value`. Stub: not implemented yet.
 */
export function BarChart(_props: BarChartProps): JSX.Element {
  throw new Error('BarChart is not implemented yet')
}
