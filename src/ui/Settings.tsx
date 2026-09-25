import type { ChangeEvent } from 'react'
import type { Program } from '../types'
import './Settings.css'

/** The Account section's view of the phone's cloud sync (E7-T7). */
export type SyncView = {
  accountEmail: string | null
  lastSyncedAt: number | null
  status: 'idle' | 'syncing' | 'ok' | 'offline' | 'signed-out' | 'error' | 'account-mismatch'
  // Present when status is 'account-mismatch'.
  signedInEmail?: string
  // Present when status is 'error'.
  message?: string
}

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
  /**
   * Every equipment type the library carries, except `body only` (E5-T16). Renders as "My
   * gym's equipment"'s checkbox list, in the order given.
   */
  equipmentTypes: string[]
  /**
   * The gym's saved equipment, or `null` when nothing has been saved yet -- rendered as every
   * type in `equipmentTypes` ticked (E5-T16).
   */
  gymEquipment: string[] | null
  /** Called with the next gym equipment list when a type in "My gym's equipment" is (un)ticked. */
  onGymEquipmentChange(list: string[]): void
  /** The phone's cloud sync state (E7-T7). Omitted, the Account section does not render. */
  sync?: SyncView
  /** Called when the trainee taps "Sync now". */
  onSyncNow?(): void
  /** Called when the trainee taps "Use <signedInEmail>'s data on this phone". */
  onAdoptAccount?(): void
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
 *
 * "My gym's equipment" (E5-T16) lists `equipmentTypes` as a checkbox each, checked when
 * `gymEquipment` is `null` (nothing saved yet, so everything counts as available) or includes
 * the type. Toggling a checkbox calls `onGymEquipmentChange` with the next full list: the
 * effective list (`gymEquipment ?? equipmentTypes`) with the toggled type added or removed.
 */
export function Settings(props: SettingsProps): JSX.Element {
  const {
    programs,
    activeProgramId,
    onActiveProgramChange,
    onExport,
    onImportFile,
    equipmentTypes,
    gymEquipment,
    onGymEquipmentChange,
    sync,
    onSyncNow,
    onAdoptAccount,
  } = props

  /** Toggles `type` in the effective gym equipment list and reports the next full list. */
  function handleEquipmentToggle(type: string): void {
    const effective = gymEquipment ?? equipmentTypes
    const next = effective.includes(type)
      ? effective.filter((item) => item !== type)
      : [...effective, type]
    onGymEquipmentChange(next)
  }

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

  // Stub only: E7-T7 has not implemented the Account section's controls yet.
  void onSyncNow
  void onAdoptAccount

  return (
    <div className="settings">
      <fieldset className="settings-group">
        <legend className="settings-legend">Active program</legend>
        {programs.map((program) => {
          const checked = program.id === activeProgramId
          return (
            <label
              key={program.id}
              className={`settings-action${checked ? ' settings-action-active' : ''}`}
            >
              <input
                type="radio"
                name="active-program"
                value={program.id}
                checked={checked}
                onChange={() => {
                  if (!checked) onActiveProgramChange(program.id)
                }}
              />
              <span className="settings-action-label">{program.name}</span>
            </label>
          )
        })}
      </fieldset>
      <fieldset className="settings-group">
        <legend className="settings-legend">My gym&apos;s equipment</legend>
        {equipmentTypes.map((type) => {
          const checked = gymEquipment === null || gymEquipment.includes(type)
          return (
            <label key={type} className="settings-action">
              <input
                type="checkbox"
                checked={checked}
                onChange={() => handleEquipmentToggle(type)}
              />
              <span className="settings-action-label">{type}</span>
            </label>
          )
        })}
      </fieldset>
      <button type="button" className="settings-action" onClick={() => onExport?.()}>
        <span className="settings-action-label">Export</span>
      </button>
      <label className="settings-action">
        <span className="settings-action-label">Import backup</span>
        <input
          className="settings-file-input"
          type="file"
          accept="application/json,.json"
          onChange={handleFileChange}
        />
      </label>
      {sync ? (
        // Stub only: E7-T7's Account section (email, last synced, Sync now, sign-in and
        // account-mismatch states) is not implemented yet. `onSyncNow` and `onAdoptAccount`
        // are read here so they type-check as used; nothing calls them yet.
        <fieldset className="settings-group" data-testid="settings-sync-stub">
          <legend className="settings-legend">Account</legend>
        </fieldset>
      ) : null}
    </div>
  )
}
