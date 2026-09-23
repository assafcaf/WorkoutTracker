import { createContext, useContext } from 'react'

/**
 * The element `AppShell` keeps inside its sticky action bar for the screen showing to fill.
 * Null anywhere a screen is rendered outside a shell.
 *
 * The shell creates the element once, before its first render, so a screen inside it has
 * somewhere to render its controls from its very first render: controls that appeared in the
 * body and moved to the bar a frame later would swallow the tap that landed on them first.
 */
export const ActionBarHostContext = createContext<HTMLElement | null>(null)

/**
 * The shell's action bar, for a screen whose action is bound to state it owns — the set
 * screen's "Log set" is gated by the set on its dials, so it cannot be handed up to the shell
 * as a finished control. The screen portals its controls into what this returns, and renders
 * them where they stand when it returns null, which is what happens outside a shell.
 */
export function useActionBarSlot(): HTMLElement | null {
  return useContext(ActionBarHostContext)
}
