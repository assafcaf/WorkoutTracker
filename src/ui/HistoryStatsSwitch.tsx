import './HistoryStatsSwitch.css'

export type HistoryStatsView = 'history' | 'stats'
export type HistoryStatsSwitchProps = { current: HistoryStatsView; onChange(view: HistoryStatsView): void }

const OPTIONS: { view: HistoryStatsView; label: string }[] = [
  { view: 'history', label: 'History' },
  { view: 'stats', label: 'Stats' },
]

/**
 * The History tab's two-way switch between the list of finished sessions and the statistics
 * drawn from them. Stats is not a tab of its own: it lives inside History, behind this switch.
 */
export function HistoryStatsSwitch(props: HistoryStatsSwitchProps): JSX.Element {
  const { current, onChange } = props

  return (
    <div className="history-stats-switch" role="group" aria-label="History view">
      {OPTIONS.map(({ view, label }) => (
        <button
          key={view}
          type="button"
          className="history-stats-option"
          aria-pressed={view === current}
          onClick={() => onChange(view)}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
