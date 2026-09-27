import { useCallback, useState } from 'react'
import type { ReactNode } from 'react'
import { ActionBarHostContext } from './actionBarSlot'
import { TabBar } from './TabBar'
import './AppShell.css'

/**
 * The five top-level destinations the tab bar moves between.
 *
 * E5-T18 (M11) adds 'program': the Program tab holds the workouts' details, their body maps
 * and program switching, which the Workout tab (M12) no longer carries.
 */
export type Tab = 'workout' | 'program' | 'exercises' | 'history' | 'settings'

export type AppShellProps = {
  title: string
  /** Renders a back control in the header when given; omitted means no back control. */
  onBack?: () => void
  /** The header's trailing slot. `UpdatePill` lives here. */
  trailing?: ReactNode
  /**
   * The sticky bottom action bar's contents. Omitted means no action bar. A screen that fills
   * the bar itself passes `<ActionBarSlot />` and portals its controls in through
   * `useActionBarSlot`.
   */
  action?: ReactNode
  /** Renders the tab bar with this tab current. Omitted means no tab bar. */
  tab?: Tab
  onTabChange?: (tab: Tab) => void
  /** Puts the backup-due marker on the Settings tab. */
  settingsBadge?: boolean
  children: ReactNode
}

/**
 * The action a screen that fills the action bar itself hands the shell: it draws nothing of
 * its own, and says the shell is to lay out a bar for the screen's controls to portal into.
 */
export function ActionBarSlot(): null {
  return null
}

/** The element the action bar holds for the screen inside the shell to portal controls into. */
function createActionBarHost(): HTMLElement {
  const host = document.createElement('div')
  host.className = 'action-bar-slot'
  return host
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
 *
 * The action bar is also offered to the screen inside it: a screen whose action is bound to
 * state it owns passes `<ActionBarSlot />` as its action and portals its controls into the
 * bar's host element, which is how the set screen's "Log set" reaches the bar without its
 * logging state leaving it.
 */
export function AppShell(props: AppShellProps): JSX.Element {
  const { title, onBack, trailing, action, tab, onTabChange, settingsBadge, children } = props

  // Created before the first render and kept for the shell's lifetime, so a screen inside the
  // shell can portal its controls into it while it is still rendering. The bar takes it in as
  // a child of its own, which is why the two ride the same commit and nothing ever moves.
  const [host] = useState(createActionBarHost)
  const holdHost = useCallback(
    (bar: HTMLDivElement | null) => {
      bar?.appendChild(host)
    },
    [host],
  )

  return (
    // The host is only offered while there is a bar to hold it, so a screen inside a shell
    // that lays out no action bar keeps its controls where they stand.
    <ActionBarHostContext.Provider value={action ? host : null}>
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
        {action ? (
          <div className="action-bar" ref={holdHost}>
            {action}
          </div>
        ) : null}
        {tab ? (
          <TabBar
            current={tab}
            onChange={(next) => onTabChange?.(next)}
            settingsBadge={settingsBadge}
          />
        ) : null}
      </div>
    </ActionBarHostContext.Provider>
  )
}
