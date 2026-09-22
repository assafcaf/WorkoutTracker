import type { Program } from '../types'

export type SettingsProps = {
  programs: Program[]
  activeProgramId: string
  onActiveProgramChange(id: string): void
  // Optional so E1-T6's existing calls, which predate E2-T4, still type-check unchanged;
  // E2-T5/T6 wire a real handler from `App`.
  onExport?(): void | Promise<void>
}

/**
 * Lets the trainee choose which program is active, and export a backup of the database.
 *
 * Lists `programs` as a radio group named by `program.name`, marks the one matching
 * `activeProgramId` checked, and calls `onActiveProgramChange(program.id)` when another is
 * chosen. Choosing the already-active program is a no-op, not a redundant call.
 *
 * E2-T4 stub: the Export control renders but does not yet call `onExport` — that wiring is
 * this task's to finish.
 */
export function Settings(props: SettingsProps): JSX.Element {
  const { programs, activeProgramId, onActiveProgramChange } = props

  return (
    <>
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
      <button type="button">Export</button>
    </>
  )
}
