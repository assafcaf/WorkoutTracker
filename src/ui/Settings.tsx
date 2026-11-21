import { useEffect, useState, type ChangeEvent, type ReactNode } from 'react'
import type { PlateInventory } from '../types'
import type { SyncView } from '../services/syncView'
import { formatDay } from '../domain/dates'
import { AppleHealthSettings } from './AppleHealthSettings'
import { PlateInventoryEditor } from './PlateInventoryEditor'
import { Select, Switch } from './controls'
import { Icon } from './icons'
import { NotificationSettings, type NotificationSettingsProps } from './NotificationSettings'
import { SettingsPage } from './SettingsPage'
import './Settings.css'

export type { SyncView }

export type SettingsProps = {
  // Optional so E1-T6's existing calls, which predate E2-T4, still type-check unchanged;
  // E2-T5/T6 wire a real handler from `App`.
  onExport?(): void | Promise<void>
  // Optional for the same reason as `onExport`; E2-T6 wires a real handler from `App` that
  // reads the chosen file and hands its text to `importBackup`.
  onImportFile?(text: string): void | Promise<void>
  /**
   * When the last backup was exported (V1-30), `null` when never; omitted, the "Last backup"
   * line does not render (it is still being read).
   */
  lastExportedAt?: number | null
  /** What else Data & sync carries after the backup rows: the sets CSV and the Strong or Hevy import. */
  dataExtras?: ReactNode
  /** The phone's cloud sync state (E7-T7). Omitted, the account rows do not render. */
  sync?: SyncView
  /**
   * Called when the trainee taps "Sync now". Returning the sync's promise lets the row show
   * "Syncing…" until it settles, then its result (DX-13).
   */
  onSyncNow?(): void | Promise<void>
  /** Called when the trainee taps "Use <signedInEmail>'s data on this phone". */
  onAdoptAccount?(): void
  /** Whether Track effort is on (E14-T10); omitted reads as off. */
  trackEffort?: boolean
  /** Called with the next Track effort value when its checkbox is toggled (E14-T10). */
  onTrackEffortChange?(on: boolean): void
  /** The trainee's bar and plates (E15-T5); omitted, the Bar and plates row does not render. */
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
  /** Push notifications and reminders (E24-T9); omitted, the Reminders group does not render. */
  notifications?: NotificationSettingsProps
  /** The trainee's height in cm, `null` when unset; omitted while it is still being read. */
  heightCm?: number | null
  /**
   * Stores the height (100 to 250 cm), or clears it with `null`. Given, and the height read, the
   * Body group renders with its "Height (cm)" field (Body's own page no longer edits it).
   */
  onHeightCmChange?(cm: number | null): void
}

const HEIGHT_MIN = 100
const HEIGHT_MAX = 250

/**
 * The Body group's "Height (cm)" field: typed freely, saved when it leaves the field -- a whole
 * number from 100 to 250, or empty to clear it; anything else says so and saves nothing.
 */
function HeightField({
  heightCm,
  onChange,
}: {
  heightCm: number | null | undefined
  onChange(cm: number | null): void
}): JSX.Element {
  const [text, setText] = useState(heightCm === null || heightCm === undefined ? '' : String(heightCm))
  const [fault, setFault] = useState(false)
  // A height read or synced in later shows in the field.
  useEffect(() => {
    setText(heightCm === null || heightCm === undefined ? '' : String(heightCm))
    setFault(false)
  }, [heightCm])

  function commit(): void {
    const trimmed = text.trim()
    if (trimmed === '') {
      setFault(false)
      if (heightCm !== null && heightCm !== undefined) onChange(null)
      return
    }
    const cm = Number(trimmed)
    if (!Number.isInteger(cm) || cm < HEIGHT_MIN || cm > HEIGHT_MAX) {
      setFault(true)
      return
    }
    setFault(false)
    if (cm !== heightCm) onChange(cm)
  }

  return (
    <>
      <label className="settings-action">
        <span className="settings-action-label">Height (cm)</span>
        <input
          className="settings-number"
          type="number"
          inputMode="numeric"
          min={HEIGHT_MIN}
          max={HEIGHT_MAX}
          value={text}
          aria-invalid={fault || undefined}
          aria-describedby={fault ? 'settings-height-fault' : undefined}
          onChange={(event) => setText(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur()
          }}
        />
      </label>
      {fault ? (
        <p id="settings-height-fault" className="settings-action settings-fault">
          {`Height is a whole number from ${HEIGHT_MIN} to ${HEIGHT_MAX} cm.`}
        </p>
      ) : null}
    </>
  )
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/**
 * The Settings page in three groups (V2-09), as iOS Settings groups its lists:
 *
 * - **Workout**: Track effort, Keep screen on during rest, Week starts on, and a Bar and plates
 *   row that pushes its page (DX-23).
 * - **Body**: Height (cm), when `onHeightCmChange` is given.
 * - **Reminders**: notifications and the reminder days and time.
 * - **Data & sync**: the account and Sync now, the "Last backup" line, Export and Import
 *   backup, then `dataExtras` (the sets CSV and the Strong or Hevy import) and Apple Health.
 *
 * The active Program is chosen on the Program tab, and the gym's equipment on Program ›
 * Exercises beside the "My gym only" chip; "Compare volume with" is gone (V2-09). Every
 * setting left here behaves and is stored as before.
 *
 * The Export control calls `onExport` when it is provided, and is a no-op otherwise. The
 * Import backup control reads the chosen file and hands its text to `onImportFile`; dismissing
 * the picker without choosing one reads nothing and calls nothing.
 */
export function Settings(props: SettingsProps): JSX.Element {
  const {
    onExport,
    onImportFile,
    lastExportedAt,
    dataExtras,
    sync,
    onSyncNow,
    onAdoptAccount,
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
    heightCm,
    onHeightCmChange,
  } = props
  const [platesOpen, setPlatesOpen] = useState(false)

  // DX-13: "Sync now" answers under itself: "Syncing…", then the result the sync settled on.
  const [asked, setAsked] = useState(false)
  const [pending, setPending] = useState(false)
  const signedIn = sync !== undefined && (sync.accountEmail !== null || sync.status === 'account-mismatch')
  const syncing = pending || sync?.status === 'syncing'

  function handleSyncNow(): void {
    setAsked(true)
    setPending(true)
    Promise.resolve()
      .then(() => onSyncNow?.())
      .catch(() => undefined)
      .finally(() => setPending(false))
  }

  let syncLine: string | null = null
  if (asked && sync) {
    if (syncing) syncLine = 'Syncing…'
    else if (sync.status === 'ok') syncLine = 'Synced just now'
    else if (sync.status === 'signed-out') syncLine = 'Not signed in. Your Sessions are safe on this phone.'
    else if (sync.status === 'offline' || sync.status === 'error')
      syncLine = 'Can’t reach the server. Your Sessions are safe on this phone.'
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
        <legend className="settings-legend">Workout</legend>
        <div className="settings-card">
          <div className="settings-action">
            <Switch
              checked={trackEffort}
              onChange={(next) => onTrackEffortChange?.(next)}
              label="Track effort"
            />
          </div>
          <div className="settings-action">
            <Switch
              checked={keepScreenOnDuringRest}
              onChange={(next) => onKeepScreenOnDuringRestChange?.(next)}
              label="Keep screen on during rest"
            />
          </div>
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
          {plateInventory ? (
            // DX-23: one row that pushes the Bar and plates page.
            <button
              type="button"
              className="settings-action btn-quiet"
              aria-haspopup="dialog"
              onClick={() => setPlatesOpen(true)}
            >
              <span className="settings-action-label">Bar and plates</span>
              <span className="settings-action-value">{`${plateInventory.barKg} kg bar`}</span>
              <Icon name="ChevronRight" size={18} />
            </button>
          ) : null}
        </div>
      </fieldset>
      {plateInventory && platesOpen ? (
        <SettingsPage title="Bar and plates" onBack={() => setPlatesOpen(false)}>
          <div role="group" aria-label="Bar and plates">
            <PlateInventoryEditor
              inventory={plateInventory}
              onChange={(next) => onPlateInventoryChange?.(next)}
              error={plateInventoryError}
            />
          </div>
        </SettingsPage>
      ) : null}
      {onHeightCmChange && heightCm !== undefined ? (
        <section className="settings-group" aria-label="Body">
          <h2 className="settings-legend">Body</h2>
          <div className="settings-card">
            <HeightField heightCm={heightCm} onChange={onHeightCmChange} />
          </div>
        </section>
      ) : null}
      {notifications ? <NotificationSettings {...notifications} /> : null}
      <section className="settings-group" aria-label="Data & sync">
        <h2 className="settings-legend">Data &amp; sync</h2>
        <div className="settings-card">
          {sync ? (
            <>
              {/* DX-13: signed out, the first row is the action, not a statement of the problem. */}
              {signedIn ? (
                <>
                  <p className="settings-account-email">{sync.accountEmail}</p>
                  <p className="settings-account-synced">
                    {sync.lastSyncedAt === null
                      ? 'Never synced'
                      : `Last synced ${formatDay(new Date(sync.lastSyncedAt), new Date())}`}
                  </p>
                </>
              ) : (
                <a className="settings-action settings-sign-in" href="/api/login">
                  <span className="settings-action-label">Sign in to sync</span>
                  <Icon name="ChevronRight" size={18} />
                </a>
              )}
              <button
                type="button"
                className="settings-action btn-quiet"
                onClick={handleSyncNow}
                disabled={syncing}
              >
                <span className="settings-action-label">Sync now</span>
              </button>
              {syncLine ? (
                <p className="settings-account-synced settings-sync-result" role="status">
                  {syncLine}
                </p>
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
              {sync.status === 'offline' && !asked ? (
                <p className="settings-account-offline">This phone is offline; it will sync later.</p>
              ) : null}
            </>
          ) : null}
          {lastExportedAt !== undefined ? (
            <p className="settings-account-synced settings-last-backup">
              {`Last backup: ${lastExportedAt === null ? 'never' : formatDay(new Date(lastExportedAt), new Date())}`}
            </p>
          ) : null}
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
        {dataExtras}
        <AppleHealthSettings />
      </section>
    </div>
  )
}
