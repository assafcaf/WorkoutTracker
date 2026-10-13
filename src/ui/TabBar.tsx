import type { Tab } from './AppShell'
import { Icon, type IconName } from './icons'
import './TabBar.css'

export type TabBarProps = {
  current: Tab
  onChange(tab: Tab): void
  settingsBadge?: boolean
}

/** The five destinations, in the order they sit in the bar. */
const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: 'workout', label: 'Workout', icon: 'Dumbbell' },
  { id: 'program', label: 'Program', icon: 'ListChecks' },
  { id: 'exercises', label: 'Exercises', icon: 'ChartLine' },
  { id: 'history', label: 'History', icon: 'History' },
  { id: 'settings', label: 'Settings', icon: 'Settings' },
]

/**
 * The bottom tab bar: the only way between Workout, Program, Exercises, History and Settings.
 *
 * Each tab names itself with an `aria-label` rather than leaning on its text, so the
 * backup-due marker the Settings tab can carry never lands in that tab's accessible name —
 * the trainee, and every test that reaches Settings by name, keeps a control called exactly
 * "Settings". The marker announces its own reason instead.
 */
export function TabBar(props: TabBarProps): JSX.Element {
  const { current, onChange, settingsBadge } = props

  return (
    <nav className="tab-bar" aria-label="Main">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className="tab-bar-tab"
          aria-label={tab.label}
          aria-current={tab.id === current ? 'page' : undefined}
          onClick={() => onChange(tab.id)}
        >
          <Icon name={tab.icon} size={24} />
          <span className="tab-bar-label">{tab.label}</span>
          {tab.id === 'settings' && settingsBadge ? (
            <span className="tab-bar-badge" role="status" aria-label="A backup is due" />
          ) : null}
        </button>
      ))}
    </nav>
  )
}
