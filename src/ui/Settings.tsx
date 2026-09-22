import type { Program } from '../types'

export type SettingsProps = {
  programs: Program[]
  activeProgramId: string
  onActiveProgramChange(id: string): void
}

/**
 * Lets the trainee choose which program is active.
 *
 * E1-T6 stub: not yet interactive. The eventual implementation lists `programs` as a radio
 * group named by `program.name`, marks the one matching `activeProgramId` checked, and calls
 * `onActiveProgramChange(program.id)` when another is chosen.
 */
export function Settings(_props: SettingsProps): JSX.Element {
  return <div />
}
