import type { Program } from '../types'

export type SettingsProps = {
  programs: Program[]
  activeProgramId: string
  onActiveProgramChange(id: string): void
}

/**
 * Lets the trainee choose which program is active.
 *
 * Lists `programs` as a radio group named by `program.name`, marks the one matching
 * `activeProgramId` checked, and calls `onActiveProgramChange(program.id)` when another is
 * chosen. Choosing the already-active program is a no-op, not a redundant call.
 */
export function Settings(props: SettingsProps): JSX.Element {
  const { programs, activeProgramId, onActiveProgramChange } = props

  return (
    <fieldset>
      <legend>Active program</legend>
      {programs.map((program) => (
        <label key={program.id}>
          <input
            type="radio"
            name="active-program"
            value={program.id}
            checked={program.id === activeProgramId}
            onChange={() => {
              if (program.id !== activeProgramId) onActiveProgramChange(program.id)
            }}
          />
          {program.name}
        </label>
      ))}
    </fieldset>
  )
}
