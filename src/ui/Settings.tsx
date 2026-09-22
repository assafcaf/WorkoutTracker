import type { ChangeEvent } from 'react'
import type { Program } from '../types'

export type SettingsProps = {
  programs: Program[]
  activeProgramId: string
  onActiveProgramChange(id: string): void
  // Optional so E1-T6's existing calls, which predate E2-T4, still type-check unchanged;
  // E2-T5/T6 wire a real handler from `App`.
  onExport?(): void | Promise<void>
  // Optional for the same reason as `onExport`; E2-T6 wires a real handler from `App` that
  // reads the chosen file and hands its text to `importBackup`.
  onImportFile?(text: string): void | Promise<void>
}

/**
 * Lets the trainee choose which program is active, and export a backup of the database.
 *
 * Lists `programs` as a radio group named by `program.name`, marks the one matching
 * `activeProgramId` checked, and calls `onActiveProgramChange(program.id)` when another is
 * chosen. Choosing the already-active program is a no-op, not a redundant call.
 *
 * The Export control calls `onExport` when it is provided, and is a no-op otherwise. The
 * Import backup control reads the chosen file and hands its text to `onImportFile`; dismissing
 * the picker without choosing one reads nothing and calls nothing.
 */
export function Settings(props: SettingsProps): JSX.Element {
  const { programs, activeProgramId, onActiveProgramChange, onExport, onImportFile } = props

  /** Reads the chosen backup file, if one was chosen, and hands its text over. */
  function handleFileChange(event: ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0]
    if (!file) return
    file
      .text()
      .then((text) => onImportFile?.(text))
      .catch(() => {
        // The file could not be read at all; there is nothing to hand over and nothing to undo.
      })
  }

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
      <button type="button" onClick={() => onExport?.()}>
        Export
      </button>
      <label>
        Import backup
        <input type="file" accept="application/json,.json" onChange={handleFileChange} />
      </label>
    </>
  )
}
