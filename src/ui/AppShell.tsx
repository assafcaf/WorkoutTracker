import { createContext, useCallback, useContext, useState } from 'react'
import type { ReactNode } from 'react'
import { ActionBarHostContext } from './actionBarSlot'
import { TabBar } from './TabBar'
import { Icon } from './icons'
import { PageHeader } from './PageHeader'
import './AppShell.css'

/**
 * The four top-level destinations the tab bar moves between (Progress Dashboard navigation):
 * Dashboard, Sessions, Lifts and Program. Settings is a full-screen page off the Dashboard
 * header's gear, and a workout in progress is a full-screen Live session with no tab bar.
 */
export type Tab = 'dashboard' | 'sessions' | 'lifts' | 'program'

export type AppShellProps = {
  title: string
  /** The small muted line under a tab's large title. */
  subtitle?: ReactNode
  /** A tab's own icon buttons, right-aligned beside its large title (before `trailing`). */
  actions?: ReactNode
  /** Renders a back control in the header when given; omitted means no back control. */
  onBack?: () => void
  /** The header's trailing slot. `UpdatePill` lives here. */
  trailing?: ReactNode
  /**
   * A header of the screen's own in place of the shell's (the Live session's header). A shell
   * given one is a full-screen mode: it never draws the tab bar.
   */
  header?: ReactNode
  /**
   * The tab screen draws its own large title (the Dashboard, whose header carries the sync
   * state): the shell draws no header and leaves the main region unpadded. The tab bar stays.
   */
  ownHeader?: boolean
  /**
   * The sticky bottom action bar's contents. Omitted means no action bar. A screen that fills
   * the bar itself passes `<ActionBarSlot />` and portals its controls in through
   * `useActionBarSlot`.
   */
  action?: ReactNode
  /** Renders the tab bar with this tab current. Omitted means no tab bar. */
  tab?: Tab
  onTabChange?: (tab: Tab) => void
  children: ReactNode
}

/**
 * What the app root hands every shell below it (E11-T15): the tab bar's current tab, where a
 * pressed tab goes, the header's trailing slot, what sits above a tab's title (the Program
 * tab's Program | Exercises switch), and the Settings page's way in -- the gear's handler and
 * its backup-due marker. A shell's own props win over these.
 */
export type ShellChrome = Pick<AppShellProps, 'tab' | 'onTabChange' | 'trailing'> & {
  /** Above a tab screen's large title, e.g. the Program tab's Program | Exercises switch. */
  lead?: ReactNode
  /** Opens the full-screen Settings page; unset means no gear is offered. */
  onOpenSettings?: () => void
  /** Puts the backup-due marker on the Settings gear. */
  settingsBadge?: boolean
}

export const ShellChromeContext = createContext<ShellChrome>({})

export type SettingsButtonProps = {
  /** Overrides the app root's handler. */
  onOpen?: () => void
  /** Overrides the app root's backup-due marker. */
  badge?: boolean
}

/**
 * The gear that opens Settings (S1), carrying the backup-due marker when a backup is due. It
 * names itself "Settings" with an `aria-label`, so the marker -- which announces its own
 * reason -- never lands in the control's name. Renders nothing where there is no Settings page
 * to open.
 */
export function SettingsButton(props: SettingsButtonProps): JSX.Element | null {
  const chrome = useContext(ShellChromeContext)
  const onOpen = props.onOpen ?? chrome.onOpenSettings
  const badge = props.badge ?? chrome.settingsBadge
  if (!onOpen) return null
  return (
    <button type="button" className="settings-open icon-btn" aria-label="Settings" onClick={onOpen}>
      <Icon name="Gear" size={24} />
      {badge ? <span className="settings-open-badge" role="status" aria-label="A backup is due" /> : null}
    </button>
  )
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

/**
 * The one shell every screen renders inside: a header, the screen's own content, an optional
 * sticky action bar, and the tab bar.
 *
 * The header comes in three kinds. A tab screen (no back control, no action bar) carries the
 * large `PageHeader` title with its subtitle and icon buttons, under whatever the app root
 * leads it with; a page inside a tab or off it (Settings, an editor) carries a compact header
 * with a back chevron and its title; and a full-screen mode hands its own `header` (the Live
 * session). Only a tab screen holds the tab bar.
 *
 * The action bar is also offered to the screen inside it: a screen whose action is bound to
 * state it owns passes `<ActionBarSlot />` as its action and portals its controls into the
 * bar's host element, which is how the set screen's "Log set" reaches the bar without its
 * logging state leaving it.
 */
export function AppShell(props: AppShellProps): JSX.Element {
  const chrome = useContext(ShellChromeContext)
  const { title, subtitle, actions, onBack, action, header, ownHeader, children } = props
  // A screen with a back control, an action bar or a header of its own is inside a session, an
  // editor or a page: no tab bar.
  const tab = props.tab ?? (onBack || action || header ? undefined : chrome.tab)
  const onTabChange = props.onTabChange ?? chrome.onTabChange
  const trailing = props.trailing ?? chrome.trailing
  const isTabScreen = !onBack && !header

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

  let shellHeader: ReactNode
  if (ownHeader && !onBack && !header) {
    shellHeader = null
  } else if (header) {
    shellHeader = header
  } else if (onBack) {
    shellHeader = (
      <header className="app-header app-header-bar">
        <button type="button" className="app-header-back icon-btn" aria-label="Back" onClick={onBack}>
          <Icon name="ChevronLeft" size={24} />
        </button>
        <div className="app-header-title-group">
          <h1 className="app-header-title">{title}</h1>
        </div>
        {trailing ? <div className="app-header-trailing">{trailing}</div> : null}
      </header>
    )
  } else {
    // Under a lead (the Program tab's switch, S7a) the screen's own actions ride the lead's row,
    // right-aligned, and the title below carries only the trailing slot.
    const titleActions = chrome.lead ? null : actions
    shellHeader = (
      <PageHeader
        className="app-header"
        title={title}
        subtitle={subtitle}
        actions={
          titleActions || trailing ? (
            <>
              {trailing ? <div className="app-header-trailing">{trailing}</div> : null}
              {titleActions}
            </>
          ) : undefined
        }
      />
    )
  }

  const shellClass = ['app-shell', tab ? 'app-shell-tabbed' : '', header ? 'app-shell-full' : '']
    .filter(Boolean)
    .join(' ')

  return (
    // The host is only offered while there is a bar to hold it, so a screen inside a shell
    // that lays out no action bar keeps its controls where they stand.
    <ActionBarHostContext.Provider value={action ? host : null}>
      <div className={shellClass}>
        {isTabScreen && chrome.lead ? (
          <div className="app-lead">
            {chrome.lead}
            {actions ? <div className="app-lead-actions">{actions}</div> : null}
          </div>
        ) : null}
        {shellHeader}
        <main className={ownHeader ? 'app-main app-main-flush' : 'app-main'}>{children}</main>
        {action ? (
          <div className="action-bar" ref={holdHost}>
            {action}
          </div>
        ) : null}
        {tab ? <TabBar current={tab} onChange={(next) => onTabChange?.(next)} /> : null}
      </div>
    </ActionBarHostContext.Provider>
  )
}
