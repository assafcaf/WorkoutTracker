import type { ChangeEvent } from 'react'
import type { PlateInventory, Program, VolumeBaseline } from '../types'
import type { SyncView } from '../services/syncView'
import { formatDay } from '../domain/dates'
import { PlateInventoryEditor } from './PlateInventoryEditor'
import { Segmented, Select, Switch } from './controls'
import { Icon } from './icons'
import { NotificationSettings, type NotificationSettingsProps } from './NotificationSettings'
import './Settings.css'

export type { SyncView }

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
  /** Whether Track effort is on (E14-T10); omitted reads as off. */
  trackEffort?: boolean
  /** Called with the next Track effort value when its checkbox is toggled (E14-T10). */
  onTrackEffortChange?(on: boolean): void
  /** The trainee's bar and plates (E15-T5); omitted, the Bar and plates section does not render. */
  plateInventory?: PlateInventory
  /** Called with the next inventory when the bar or a plate row changes. */
  onPlateInventoryChange?(inventory: PlateInventory): void
  /** The service's message for a refused change, shown inline. */
  plateInventoryError?: string | null
  /** The first day of the week, 0 = Sunday ... 6 = Saturday (E19-T3); omitted reads as Monday. */
  weekStart?: number
  /** Called with the chosen weekday when "Week starts on" changes. */
  onWeekStartChange?(day: number): void
  /** Whether the screen stays on during rest (E19-T3); omitted reads as on. */
  keepScreenOnDuringRest?: boolean
  /** Called with the next value when "Keep screen on during rest" is toggled. */
  onKeepScreenOnDuringRestChange?(on: boolean): void
  /** Push notifications and reminders (E24-T9); omitted, the Notifications sections do not render. */
  notifications?: NotificationSettingsProps
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

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
    trackEffort = false,
    onTrackEffortChange,
    plateInventory,
    onPlateInventoryChange,
    plateInventoryError,
    weekStart = 1,
    onWeekStartChange,
    keepScreenOnDuringRest = true,
    onKeepScreenOnDuringRestChange,
    notifications,
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
        <div className="settings-card card">
          <Segmented
            name="active-program"
            label="Active program"
            value={activeProgramId ?? ''}
            options={programs.map((program) => ({ value: program.id, label: program.name }))}
            onChange={(id) => {
              if (id !== activeProgramId) onActiveProgramChange(id)
            }}
          />
        </div>
      </fieldset>
      <fieldset className="settings-group">
        <legend className="settings-legend">My gym&apos;s equipment</legend>
        <div className="settings-card card">
          {equipmentTypes.map((type) => {
            const checked = gymEquipment === null || gymEquipment.includes(type)
            return (
              <div key={type} className="settings-action">
                <Switch checked={checked} onChange={() => handleEquipmentToggle(type)} label={type} />
              </div>
            )
          })}
        </div>
      </fieldset>
      {plateInventory ? (
        <fieldset className="settings-group">
          <legend className="settings-legend">Bar and plates</legend>
          <div className="settings-card card">
            <PlateInventoryEditor
              inventory={plateInventory}
              onChange={(next) => onPlateInventoryChange?.(next)}
              error={plateInventoryError}
            />
          </div>
        </fieldset>
      ) : null}
      <fieldset className="settings-group">
        <legend className="settings-legend">Compare volume</legend>
        <div className="settings-card card">
          <label className="settings-action">
            <span className="settings-action-label">Compare volume with</span>
            <Select value={volumeBaseline.period} onChange={handleCompareChange}>
              <option value="last">Last workout</option>
              <option value="1w">Past week</option>
              <option value="1m">Past month</option>
              <option value="3m">Past 3 months</option>
              <option value="6m">Past 6 months</option>
              <option value="since">Since a date</option>
            </Select>
          </label>
          {volumeBaseline.period !== 'last' ? (
            <label className="settings-action">
              <span className="settings-action-label">Using</span>
              <Select value={volumeBaseline.aggregate} onChange={handleAggregateChange}>
                <option value="avg">Average</option>
                <option value="max">Best</option>
              </Select>
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
        </div>
      </fieldset>
      <fieldset className="settings-group">
        <legend className="settings-legend">Effort</legend>
        <div className="settings-card card">
          <div className="settings-action">
            <Switch
              checked={trackEffort}
              onChange={(next) => onTrackEffortChange?.(next)}
              label="Track effort"
            />
          </div>
        </div>
      </fieldset>
      <fieldset className="settings-group">
        <legend className="settings-legend">Week</legend>
        <div className="settings-card card">
          <label className="settings-action">
            <span className="settings-action-label">Week starts on</span>
            <Select
              value={String(weekStart)}
              onChange={(event) => onWeekStartChange?.(Number(event.target.value))}
            >
              {WEEKDAYS.map((name, day) => (
                <option key={name} value={String(day)}>
                  {name}
                </option>
              ))}
            </Select>
          </label>
        </div>
      </fieldset>
      <fieldset className="settings-group">
        <legend className="settings-legend">Rest</legend>
        <div className="settings-card card">
          <div className="settings-action">
            <Switch
              checked={keepScreenOnDuringRest}
              onChange={(next) => onKeepScreenOnDuringRestChange?.(next)}
              label="Keep screen on during rest"
            />
          </div>
        </div>
      </fieldset>
      {notifications ? <NotificationSettings {...notifications} /> : null}
      <section className="settings-group" aria-label="Backup">
        <h2 className="settings-legend">Backup</h2>
        <div className="settings-card card">
          <button type="button" className="settings-action btn-quiet" onClick={() => onExport?.()}>
            <span className="settings-action-label">Export</span>
            <Icon name="ChevronRight" size={18} />
          </button>
          <label className="settings-action">
            <span className="settings-action-label">Import backup</span>
            <Icon name="ChevronRight" size={18} />
            <input
              className="import-file"
              type="file"
              accept="application/json,.json"
              onChange={handleFileChange}
            />
          </label>
        </div>
      </section>
      {sync ? (
        <fieldset className="settings-group">
          <legend className="settings-legend">Account</legend>
          <div className="settings-card card">
            <p className="settings-account-email">
              {sync.accountEmail ?? 'Not signed in'}
            </p>
            <p className="settings-account-synced">
              {sync.lastSyncedAt === null
                ? 'Never synced'
                : formatDay(new Date(sync.lastSyncedAt), new Date())}
            </p>
            <button
              type="button"
              className="settings-action btn-quiet"
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
                  className="settings-action btn-quiet"
                  onClick={() => onAdoptAccount?.()}
                >
                  <span className="settings-action-label">
                    Use {sync.signedInEmail}&apos;s data on this phone
                  </span>
                </button>
              </>
            ) : null}
            {sync.status === 'update-required' ? (
              <>
                <p className="settings-account-update settings-account-offline">Update the app to keep syncing.</p>
                <p className="settings-account-update-reason settings-account-offline">
                  This version is too old to sync. Your workouts stay saved on this phone.
                </p>
              </>
            ) : null}
            {sync.status === 'offline' ? (
              <p className="settings-account-offline">
                This phone is offline; it will sync later.
              </p>
            ) : null}
          </div>
        </fieldset>
      ) : null}
    </div>
  )
}
