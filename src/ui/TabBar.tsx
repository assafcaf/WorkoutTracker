import type { Tab } from './AppShell'
import { Icon, type IconName } from './icons'
import './TabBar.css'

export type TabBarProps = {
  current: Tab
  onChange(tab: Tab): void
}

/** The four destinations, in the order they sit in the bar (Progress Dashboard navigation). */
const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: 'dashboard', label: 'Train', icon: 'LayoutDashboard' },
  { id: 'lifts', label: 'Progress', icon: 'TrendingUp' },
  { id: 'sessions', label: 'Sessions', icon: 'Calendar' },
  { id: 'program', label: 'Program', icon: 'ClipboardList' },
]

/**
 * The bottom tab bar: the only way between Dashboard, Sessions, Lifts and Program. Each tab is
 * an icon over its label, the current one in the primary colour. Settings is not a tab: it
 * opens from the Dashboard header's gear.
 *
 * Each tab names itself with an `aria-label`, so its accessible name is exactly its label.
 */
export function TabBar(props: TabBarProps): JSX.Element {
  const { current, onChange } = props

  return (
    <nav className="tab-bar" aria-label="Main">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className="tab-bar-tab tab"
          aria-label={tab.label}
          aria-current={tab.id === current ? 'page' : undefined}
          onClick={() => onChange(tab.id)}
        >
          <Icon name={tab.icon} size={24} />
          <span className="tab-bar-label">{tab.label}</span>
        </button>
      ))}
    </nav>
  )
}
