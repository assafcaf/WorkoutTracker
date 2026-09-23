import type { ReactNode } from 'react'
import { TabBar } from './TabBar'
import './AppShell.css'

/** The three top-level destinations the tab bar moves between. */
export type Tab = 'workout' | 'history' | 'settings'

export type AppShellProps = {
  title: string
  /** Renders a back control in the header when given; omitted means no back control. */
  onBack?: () => void
  /** The header's trailing slot. `UpdatePill` lives here. */
  trailing?: ReactNode
  /** The sticky bottom action bar's contents. Omitted means no action bar. */
  action?: ReactNode
  /** Renders the tab bar with this tab current. Omitted means no tab bar. */
  tab?: Tab
  onTabChange?: (tab: Tab) => void
  /** Puts the backup-due marker on the Settings tab. */
  settingsBadge?: boolean
  children: ReactNode
}

/** The back control's chevron, drawn inline so the app ships no icon dependency. */
function BackGlyph(): JSX.Element {
  return (
    <svg
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
      <path d="M15 5l-7 7 7 7" />
    </svg>
  )
}

/**
 * The one shell every screen renders inside: a header carrying the back control, the title and
 * the trailing slot; the screen's own content; an optional sticky action bar; and the tab bar.
 *
 * Every part past the title is optional, which is what lets one shell hold both a tab screen
 * (a tab bar, no back control) and an in-session screen (a back control and an action bar, no
 * tab bar) without either screen laying out its own chrome.
 */
export function AppShell(props: AppShellProps): JSX.Element {
  const { title, onBack, trailing, action, tab, onTabChange, settingsBadge, children } = props

  return (
    <div className="app-shell">
      <header className="app-header">
        {onBack ? (
          <button type="button" className="app-header-back" aria-label="Back" onClick={onBack}>
            <BackGlyph />
          </button>
        ) : null}
        <h1 className="app-header-title">{title}</h1>
        {trailing ? <div className="app-header-trailing">{trailing}</div> : null}
      </header>
      <main className="app-main">{children}</main>
      {action ? <div className="action-bar">{action}</div> : null}
      {tab ? (
        <TabBar
          current={tab}
          onChange={(next) => onTabChange?.(next)}
          settingsBadge={settingsBadge}
        />
      ) : null}
    </div>
  )
}
