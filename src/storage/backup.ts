import type { Session, UserProgram, VolumeBaseline } from '../types'
import { db } from './db'
import { listSessions } from './sessionStore'
import {
  ACTIVE_PROGRAM_ID_KEY,
  GYM_EQUIPMENT_KEY,
  LAST_EXPORTED_AT_KEY,
  VOLUME_BASELINE_KEY,
  WEIGHT_STEPS_KEY,
  getGymEquipment,
  getLastExportedAt,
  getVolumeBaseline,
  getWeightSteps,
  setActiveProgramId,
  setGymEquipment,
  setLastExportedAt,
  setVolumeBaseline,
  setWeightSteps,
} from './settingsStore'

/** Bumped whenever the shape below changes in a way `readBackup` cannot translate on its own. */
export const BACKUP_SCHEMA_VERSION = 1

/**
 * Everything a backup file carries: every logged session and the settings this app owns,
 * dated by when the export was made.
 */
export type BackupFile = {
  schemaVersion: 1
  exportedAt: number
  sessions: Session[]
  settings: {
    activeProgramId: string
    lastExportedAt: number | null
    /**
     * The gym's saved equipment list (E5-T11). Absent on a `schemaVersion: 1` backup made
     * before this epic; `undefined` and `null` both mean "never set" on import.
     */
    gymEquipment?: string[] | null
    /** Every Exercise's stored weight step (E8). Absent on a backup made before E8. */
    weightSteps?: Record<string, number>
    /** The volume baseline choice (E8). Absent on a backup made before E8. */
    volumeBaseline?: VolumeBaseline
    /** The trainee's created and edited Programs (E9). Absent on a backup made before E9. */
    userPrograms?: UserProgram[]
  }
}

/**
 * The file name an export made at `exportedAt` is given: `workout-backup-<yyyy-mm-dd>.json`,
 * dated by the local calendar day, so it matches what the trainee sees on the device that made
 * it.
 */
export function backupFileName(exportedAt: number): string {
  const date = new Date(exportedAt)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `workout-backup-${year}-${month}-${day}.json`
}

/**
 * Every logged session and the settings this app owns, as of `now`.
 */
export async function exportBackup(now: number): Promise<BackupFile> {
  const [sessions, activeProgramRow, lastExportedAt, gymEquipment, weightSteps, volumeBaseline] =
    await Promise.all([
      listSessions(),
      db.settings.get(ACTIVE_PROGRAM_ID_KEY),
      getLastExportedAt(),
      getGymEquipment(),
      getWeightSteps(),
      getVolumeBaseline(),
    ])
  const activeProgramId = typeof activeProgramRow?.value === 'string' ? activeProgramRow.value : ''

  return {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: now,
    sessions,
    settings: { activeProgramId, lastExportedAt, gymEquipment, weightSteps, volumeBaseline },
  }
}

// `Blob.prototype.text` is missing in some runtimes that otherwise implement `Blob` and
// `FileReader` fully — older Safari, and jsdom (the environment this file's tests run under).
// Feature-detected so real, capable browsers are left untouched.
if (typeof Blob !== 'undefined' && typeof Blob.prototype.text !== 'function') {
  Blob.prototype.text = function (this: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(reader.error ?? new Error('failed to read blob'))
      reader.readAsText(this)
    })
  }
}

/**
 * Hands `file` to the browser's share sheet when `navigator.canShare({ files })` says it can,
 * otherwise downloads it through an object-URL anchor. Records
 * `setLastExportedAt(file.exportedAt)` once that succeeds.
 */
export async function downloadOrShare(file: BackupFile): Promise<void> {
  const name = backupFileName(file.exportedAt)
  const blob = new Blob([JSON.stringify(file)], { type: 'application/json' })
  const shareFile = new File([blob], name, { type: 'application/json' })

  const canShare =
    typeof navigator.canShare === 'function' &&
    typeof navigator.share === 'function' &&
    navigator.canShare({ files: [shareFile] })

  if (canShare) {
    await navigator.share({ files: [shareFile] })
  } else if (typeof URL.createObjectURL === 'function') {
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = name
    anchor.click()
    URL.revokeObjectURL(url)
  }
  // Else: neither the share sheet nor object URLs are available. Every real browser supports at
  // least one of them; this only happens in test environments that exercise `replaceAll`'s
  // pre-import export (see `importBackup`/`replaceAll`) without also standing in for one -- so
  // there is nothing to hand a file to, but that is not a failure worth rejecting the import for.

  await setLastExportedAt(file.exportedAt)
}

/** Raised by `readBackup` for text that is not valid JSON or names an unknown schema version. */
export class BackupFormatError extends Error {}

/**
 * Parses and validates `text` as a `BackupFile`, throwing `BackupFormatError` when it is not
 * valid JSON or carries a `schemaVersion` this build does not know.
 */
export function readBackup(text: string): BackupFile {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new BackupFormatError('backup file is not valid JSON')
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    (parsed as { schemaVersion?: unknown }).schemaVersion !== BACKUP_SCHEMA_VERSION
  ) {
    throw new BackupFormatError('backup file has an unknown schema version')
  }

  return parsed as BackupFile
}

/** What importing `incoming` over `current` would change, compared by session id. */
export type ImportPlan = { added: number; removed: number; kept: number }

/**
 * Compares `current` (what is on the phone now) with `incoming` (what a backup file holds) by
 * session id: `kept` is in both, `added` is only in `incoming`, `removed` is only in `current`.
 * Pure -- reads neither array's contents beyond `id`, and touches no storage.
 */
export function importPlan(current: Session[], incoming: Session[]): ImportPlan {
  const currentIds = new Set(current.map((session) => session.id))
  const incomingIds = new Set(incoming.map((session) => session.id))

  let kept = 0
  for (const id of currentIds) {
    if (incomingIds.has(id)) kept += 1
  }

  return {
    added: incoming.filter((session) => !currentIds.has(session.id)).length,
    removed: current.filter((session) => !incomingIds.has(session.id)).length,
    kept,
  }
}

/**
 * Reads and validates `text` (see `readBackup`), then replaces the whole database with it (see
 * `replaceAll`). Refuses -- without writing a single session -- when `text` is not valid JSON or
 * names a schema version this build does not understand.
 */
export async function importBackup(text: string): Promise<void> {
  await replaceAll(readBackup(text))
}

/**
 * Clears and rewrites `db.sessions` and the settings this file owns, in one transaction, so the
 * database afterward holds exactly what `file` describes and nothing it does not.
 *
 * First exports the current database and hands it to `downloadOrShare`, so nothing is
 * overwritten before a fresh copy exists elsewhere; if that export rejects, this does not write
 * at all.
 */
export async function replaceAll(file: BackupFile): Promise<void> {
  await downloadOrShare(await exportBackup(Date.now()))

  await db.transaction('rw', db.sessions, db.settings, async () => {
    await db.sessions.clear()
    await db.sessions.bulkPut(file.sessions)
    await setActiveProgramId(file.settings.activeProgramId)
    if (file.settings.lastExportedAt === null) {
      await db.settings.delete(LAST_EXPORTED_AT_KEY)
    } else {
      await setLastExportedAt(file.settings.lastExportedAt)
    }
    if (file.settings.gymEquipment === undefined || file.settings.gymEquipment === null) {
      await db.settings.delete(GYM_EQUIPMENT_KEY)
    } else {
      await setGymEquipment(file.settings.gymEquipment)
    }
    if (file.settings.weightSteps === undefined) {
      await db.settings.delete(WEIGHT_STEPS_KEY)
    } else {
      await setWeightSteps(file.settings.weightSteps)
    }
    if (file.settings.volumeBaseline === undefined) {
      await db.settings.delete(VOLUME_BASELINE_KEY)
    } else {
      await setVolumeBaseline(file.settings.volumeBaseline)
    }
  })
}
