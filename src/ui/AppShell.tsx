import { createContext, useCallback, useContext, useState } from 'react'
import type { ReactNode } from 'react'
import { ActionBarHostContext } from './actionBarSlot'
import { TabBar } from './TabBar'
import { Icon } from './icons'
import { PageHeader } from './PageHeader'
import './AppShell.css'

/**
 * The four top-level destinations the tab bar moves between (DX-01): Train (today's Workout,
 * the launch screen), Sessions, Progress and Program. Settings is a page pushed over Program,
 * and a workout in progress is a full-screen Live session with no tab bar.
 */
export type Tab = 'train' | 'sessions' | 'progress' | 'program'

export type AppShellProps = {
  title: string
  /** The small muted line under a tab's large title. */
  subtitle?: ReactNode
  /** A tab's own icon buttons, right-aligned beside its large title (before `trailing`). */
  actions?: ReactNode
  /**
   * A pushed page (DX-06): a compact header with a back chevron and the centred title. The tab
   * bar stays. Omitted means no back control.
   */
  onBack?: () => void
  /**
   * An editor or another full-screen modal (DX-06: the Program editor, the Session editor, Log a
   * past workout): no tab bar. The screen draws its own Cancel / title / Save header.
   */
  fullScreen?: boolean
  /** The header's trailing slot. `UpdatePill` lives here. */
  trailing?: ReactNode
  /**
   * A header of the screen's own in place of the shell's (the Live session's header). A shell
   * given one is a full-screen mode: it never draws the tab bar.
   */
  header?: ReactNode
  /**
   * The screen draws its own header (an editor's Cancel / Save bar): the shell draws none and
   * leaves the main region unpadded. The tab bar stays unless `fullScreen` is set.
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
 * pressed tab goes, and the header's trailing slot ("Update ready"). A shell's own props win
 * over these.
 */
export type ShellChrome = Pick<AppShellProps, 'tab' | 'onTabChange' | 'trailing'>

export const ShellChromeContext = createContext<ShellChrome>({})

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
 * One rule for the tab bar (DX-06): it is on every screen of the Shell -- a tab, and a page
 * pushed over one (the lift page, Muscles, Body, Photos, Settings, Exercises, Programs, a
 * Session) -- and off only in a full-screen mode: the Live session (which hands its own
 * `header`) and an editor (`fullScreen`).
 *
 * The header comes in three kinds. A tab screen carries the large `PageHeader` title with its
 * subtitle and actions; a pushed page carries a compact header, the back chevron at the left and
 * its title centred, and no "Done"; and a full-screen mode hands its own `header`.
 *
 * The action bar is also offered to the screen inside it: a screen whose action is bound to
 * state it owns passes `<ActionBarSlot />` as its action and portals its controls into the
 * bar's host element, which is how the set screen's "Log set" reaches the bar without its
 * logging state leaving it. With the tab bar on, the action bar rides just above it.
 */
export function AppShell(props: AppShellProps): JSX.Element {
  const chrome = useContext(ShellChromeContext)
  const { title, subtitle, actions, onBack, action, header, ownHeader, fullScreen, children } = props
  const tab = props.tab ?? (header || fullScreen ? undefined : chrome.tab)
  const onTabChange = props.onTabChange ?? chrome.onTabChange
  const trailing = props.trailing ?? chrome.trailing

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
  if (header) {
    shellHeader = header
  } else if (ownHeader) {
    shellHeader = null
  } else if (onBack) {
    shellHeader = (
      <header className="app-header app-header-bar">
        <button type="button" className="app-header-back icon-btn" aria-label="Back" onClick={onBack}>
          <Icon name="ChevronLeft" size={24} />
        </button>
        <div className="app-header-title-group">
          <h1 className="app-header-title">{title}</h1>
        </div>
        <div className="app-header-trailing">
          {trailing}
          {actions}
        </div>
      </header>
    )
  } else {
    shellHeader = (
      <PageHeader
        className="app-header"
        title={title}
        subtitle={subtitle}
        actions={
          actions || trailing ? (
            <>
              {trailing ? <div className="app-header-trailing">{trailing}</div> : null}
              {actions}
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
