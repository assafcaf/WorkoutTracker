import type { Tab } from './AppShell'
import { Icon, type IconName } from './icons'
import './TabBar.css'

export type TabBarProps = {
  current: Tab
  onChange(tab: Tab): void
}

/**
 * The four destinations, one per moment (DX-01), in the order they sit in the bar: Train first,
 * the launch screen.
 */
const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: 'train', label: 'Train', icon: 'Dumbbell' },
  { id: 'sessions', label: 'Sessions', icon: 'Calendar' },
  { id: 'progress', label: 'Progress', icon: 'TrendingUp' },
  { id: 'program', label: 'Program', icon: 'ClipboardList' },
]

/**
 * The bottom tab bar: the only way between Train, Sessions, Progress and Program. Each tab is
 * an icon over its label, the current one in the live colour. Settings is not a tab: it opens
 * from the Program tab's "Settings" row (DX-04).
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
