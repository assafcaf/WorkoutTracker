import type { Tab } from './AppShell'
import './TabBar.css'

export type TabBarProps = {
  current: Tab
  onChange(tab: Tab): void
  settingsBadge?: boolean
}

/**
 * The bottom tab bar: the only way between Workout, History and Settings.
 *
 * E3-T3 stub — the markup is not written yet, which is what makes `src/ui/AppShell.test.tsx`
 * red.
 */
export function TabBar(_props: TabBarProps): JSX.Element {
  return <></>
}
