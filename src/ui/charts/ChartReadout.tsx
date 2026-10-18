import './ChartReadout.css'

export type ChartReadoutProps = {
  /** The point's date as the chart's axis reads it. */
  date: string
  /** The value, already formatted, with its unit. */
  value: string
  label?: string
  detail?: string
  sessionId?: string
  onOpenSession?: (sessionId: string) => void
}

/**
 * The readout under a tapped bar or point (E22-T5, O12, O13): its date, value, label and detail,
 * and **Open session ›** where the point has a Session and the screen handles opening it.
 */
export function ChartReadout({ date, value, label, detail, sessionId, onOpenSession }: ChartReadoutProps): JSX.Element {
  return (
    <section className="chart-readout" aria-label="Chart readout">
      <div className="chart-readout-head">
        <h3 className="chart-readout-title">{label ?? date}</h3>
        {sessionId !== undefined && onOpenSession ? (
          <button type="button" className="btn-quiet chart-readout-open" onClick={() => onOpenSession(sessionId)}>
            Open session ›
          </button>
        ) : null}
      </div>
      <p className="chart-readout-line">{label ? `${date} · ${value}` : value}</p>
      {detail ? <p className="chart-readout-line">{detail}</p> : null}
    </section>
  )
}
