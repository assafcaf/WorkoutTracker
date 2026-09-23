export type HistoryStatsView = 'history' | 'stats'
export type HistoryStatsSwitchProps = { current: HistoryStatsView; onChange(view: HistoryStatsView): void }

/** E4-T4 red stub: renders nothing until the History | Stats switch is built. */
export function HistoryStatsSwitch(_props: HistoryStatsSwitchProps): JSX.Element {
  return <></>
}
