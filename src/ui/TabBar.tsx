import type { ReactNode } from 'react'
import type { Tab } from './AppShell'
import './TabBar.css'

export type TabBarProps = {
  current: Tab
  onChange(tab: Tab): void
  settingsBadge?: boolean
}

/**
 * A tab's glyph: drawn inline rather than pulled from an icon package, so the app ships no
 * icon dependency and the strokes take the tab's own colour through `currentColor`. Hidden
 * from assistive technology — the tab already names itself.
 */
function glyph(path: ReactNode): JSX.Element {
  return (
    <svg
      className="tab-bar-glyph"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {path}
    </svg>
  )
}

/** The five destinations, in the order they sit in the bar. */
const TABS: { id: Tab; label: string; icon: JSX.Element }[] = [
  {
    id: 'workout',
    label: 'Workout',
    // A dumbbell: two plates either side of a bar.
    icon: glyph(
      <>
        <path d="M4 9v6M7 7v10M17 7v10M20 9v6" />
        <path d="M7 12h10" />
      </>,
    ),
  },
  {
    id: 'program',
    label: 'Program',
    // A clipboard: the plan the trainee follows.
    icon: glyph(
      <>
        <rect x="6" y="4" width="12" height="17" rx="2" />
        <path d="M9 4h6v3H9zM9 12h6M9 16h4" />
      </>,
    ),
  },
  {
    id: 'exercises',
    label: 'Exercises',
    // An open book: the library the tab opens into.
    icon: glyph(
      <>
        <path d="M4 5c3.5 0 6 1 8 3 2-2 4.5-3 8-3v13c-3.5 0-6 1-8 3-2-2-4.5-3-8-3V5z" />
        <path d="M12 8v13" />
      </>,
    ),
  },
  {
    id: 'history',
    label: 'History',
    // A clock, which is what a list of past sessions is about.
    icon: glyph(
      <>
        <circle cx="12" cy="12" r="8" />
        <path d="M12 7v5l3 2" />
      </>,
    ),
  },
  {
    id: 'settings',
    label: 'Settings',
    // Three sliders.
    icon: glyph(
      <>
        <path d="M5 6h14M5 12h14M5 18h14" />
        <circle cx="9" cy="6" r="2" />
        <circle cx="15" cy="12" r="2" />
        <circle cx="9" cy="18" r="2" />
      </>,
    ),
  },
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
          {tab.icon}
          <span className="tab-bar-label">{tab.label}</span>
          {tab.id === 'settings' && settingsBadge ? (
            <span className="tab-bar-badge" role="status" aria-label="A backup is due" />
          ) : null}
        </button>
      ))}
    </nav>
  )
}
