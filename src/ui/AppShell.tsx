import type { ReactNode } from 'react'
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

/**
 * The one shell every screen renders inside: a header, the screen's own content, an optional
 * sticky action bar, and the tab bar.
 *
 * E3-T3 stub — the markup is not written yet, which is what makes `src/ui/AppShell.test.tsx`
 * red. The implementer replaces this body; the props above are the contract E3-T4, E3-T5 and
 * E3-T7 build on.
 */
export function AppShell(_props: AppShellProps): JSX.Element {
  return <></>
}
