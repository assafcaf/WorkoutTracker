import type { ChangeEvent } from 'react'
import type { Program, VolumeBaseline } from '../types'
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
  activeProgramId: string | null
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
  /**
   * The chosen "Compare volume with" setting (E8-T3/T10), read by the exercise list's rows.
   * Optional so pre-E8-T11 renders (this file's earlier tests) keep compiling; defaults to
   * `{ period: 'last' }`, matching `App`'s own initial state.
   */
  volumeBaseline?: VolumeBaseline
  /**
   * Called with the next `VolumeBaseline` whenever "Compare volume with", "Using" or the
   * "Since a date" date input changes (E8-T11). Optional for the same reason as
   * `volumeBaseline`.
   */
  onVolumeBaselineChange?(baseline: VolumeBaseline): void
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
    volumeBaseline = { period: 'last' },
    onVolumeBaselineChange = () => {},
  } = props

  const currentAggregate = 'aggregate' in volumeBaseline ? volumeBaseline.aggregate : 'avg'

  /** "Compare volume with": switches the period, keeping (or defaulting) the aggregate. */
  function handleCompareChange(event: ChangeEvent<HTMLSelectElement>): void {
    const period = event.target.value
    if (period === 'last') {
      onVolumeBaselineChange({ period: 'last' })
    } else if (period === 'since') {
      const since = volumeBaseline.period === 'since' ? volumeBaseline.since : Date.now()
      onVolumeBaselineChange({ period: 'since', since, aggregate: currentAggregate })
    } else {
      onVolumeBaselineChange({
        period: period as '1w' | '1m' | '3m' | '6m',
        aggregate: currentAggregate,
      })
    }
  }

  /** "Using": switches the aggregate, keeping the current period (and since date, if any). */
  function handleAggregateChange(event: ChangeEvent<HTMLSelectElement>): void {
    const aggregate = event.target.value as 'avg' | 'max'
    if (volumeBaseline.period === 'since') {
      onVolumeBaselineChange({ period: 'since', since: volumeBaseline.since, aggregate })
    } else if (volumeBaseline.period !== 'last') {
      onVolumeBaselineChange({ period: volumeBaseline.period, aggregate })
    }
  }

  /** "Since": reports the chosen date as UTC midnight, keeping the current aggregate. */
  function handleSinceChange(event: ChangeEvent<HTMLInputElement>): void {
    const [year, month, day] = event.target.value.split('-').map(Number)
    const since = Date.UTC(year, month - 1, day)
    onVolumeBaselineChange({ period: 'since', since, aggregate: currentAggregate })
  }

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
                className="settings-radio"
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
                className="settings-checkbox"
                checked={checked}
                onChange={() => handleEquipmentToggle(type)}
              />
              <span className="settings-action-label">{type}</span>
            </label>
          )
        })}
      </fieldset>
      <fieldset className="settings-group">
        <legend className="settings-legend">Compare volume</legend>
        <label className="settings-action">
          <span className="settings-action-label">Compare volume with</span>
          <select
            className="settings-select"
            value={volumeBaseline.period}
            onChange={handleCompareChange}
          >
            <option value="last">Last workout</option>
            <option value="1w">Past week</option>
            <option value="1m">Past month</option>
            <option value="3m">Past 3 months</option>
            <option value="6m">Past 6 months</option>
            <option value="since">Since a date</option>
          </select>
        </label>
        {volumeBaseline.period !== 'last' ? (
          <label className="settings-action">
            <span className="settings-action-label">Using</span>
            <select
              className="settings-select"
              value={volumeBaseline.aggregate}
              onChange={handleAggregateChange}
            >
              <option value="avg">Average</option>
              <option value="max">Best</option>
            </select>
          </label>
        ) : null}
        {volumeBaseline.period === 'since' ? (
          <label className="settings-action">
            <span className="settings-action-label">Since</span>
            <input
              className="settings-date"
              type="date"
              value={new Date(volumeBaseline.since).toISOString().slice(0, 10)}
              onChange={handleSinceChange}
            />
          </label>
        ) : null}
      </fieldset>
      <button type="button" className="settings-action" onClick={() => onExport?.()}>
        <span className="settings-action-label">Export</span>
      </button>
      <label className="settings-action">
        <span className="settings-action-label">Import backup</span>
        <input
          className="import-file"
          type="file"
          accept="application/json,.json"
          onChange={handleFileChange}
        />
      </label>
      {sync ? (
        <fieldset className="settings-group">
          <legend className="settings-legend">Account</legend>
          <p className="settings-account-email">
            {sync.accountEmail ?? 'Not signed in'}
          </p>
          <p className="settings-account-synced">
            {sync.lastSyncedAt === null
              ? 'Never synced'
              : new Date(sync.lastSyncedAt).toLocaleString()}
          </p>
          <button
            type="button"
            className="settings-action"
            onClick={() => onSyncNow?.()}
            disabled={sync.status === 'syncing'}
          >
            <span className="settings-action-label">Sync now</span>
          </button>
          {sync.status === 'signed-out' ? (
            <a className="settings-action" href="/api/login">
              <span className="settings-action-label">Sign in</span>
            </a>
          ) : null}
          {sync.status === 'account-mismatch' ? (
            <>
              <p className="settings-account-mismatch">
                This phone is signed in as {sync.signedInEmail}, but last synced as{' '}
                {sync.accountEmail}.
              </p>
              <button
                type="button"
                className="settings-action"
                onClick={() => onAdoptAccount?.()}
              >
                <span className="settings-action-label">
                  Use {sync.signedInEmail}&apos;s data on this phone
                </span>
              </button>
            </>
          ) : null}
          {sync.status === 'offline' ? (
            <p className="settings-account-offline">
              This phone is offline; it will sync later.
            </p>
          ) : null}
        </fieldset>
      ) : null}
    </div>
  )
}
