import { db } from './db'
import { captureInfoOf, type Photo, type PhotoAlign, type PhotoAngle, type PhotoCaptureInfo } from './photoStore'
import type { BodyLog, CustomExercise, PlateInventory, Session, UserProgram, VolumeBaseline } from '../types'

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
  /** Progress photos (E26), only when the export was asked to include them. */
  photos?: BackupPhoto[]
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
    /** Every Exercise's note by Exercise id (E14). Absent on a backup made before E14. */
    exerciseNotes?: Record<string, string>
    /** The Track effort choice (E14). Absent on a backup made before E14. */
    effortTracking?: boolean
    /** The trainee's bar and plates (E15). Absent when never changed, and on a backup made before E15. */
    plateInventory?: PlateInventory
    /** Per-Exercise Bodyweight overrides (E16). Absent when none are set, and on a backup made before E16. */
    bodyweightOverrides?: Record<string, boolean>
    /** The first day of the week, 0-6 (E19). Absent when never set. */
    weekStart?: number
    /** The deload week's epoch ms (E21). Absent when never set. */
    deloadWeek?: number
    /** Keep the screen on during rest (E19). Absent when never set. */
    keepScreenOnDuringRest?: boolean
    /** The trainee's own Exercises (E19). Absent when none exist. */
    customExercises?: CustomExercise[]
    /** The body log (E22). Absent when never set. */
    bodyLog?: BodyLog
    /** The workout reminders, or null when turned off (E24). Absent when never set. */
    workoutReminders?: Record<string, unknown> | null
  }
}

/** A photo as a backup file carries it: the bytes as base64 text. */
export type BackupPhoto = {
  id: string
  day: string
  angle: PhotoAngle
  /** The image bytes, base64. */
  data: string
  type: string
  width: number
  height: number
  align: PhotoAlign | null
  createdAt: number
} & PhotoCaptureInfo

/** A stored Photo as a backup entry (bytes to base64). */
export function encodeBackupPhoto(photo: Photo): BackupPhoto {
  const bytes = new Uint8Array(photo.data)
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return {
    id: photo.id,
    day: photo.day,
    angle: photo.angle,
    data: btoa(binary),
    type: photo.type,
    width: photo.width,
    height: photo.height,
    align: photo.align,
    createdAt: photo.createdAt,
    ...captureInfoOf(photo),
  }
}

/** A backup entry back to a stored Photo (base64 to an ArrayBuffer). */
export function decodeBackupPhoto(photo: BackupPhoto): Photo {
  const binary = atob(photo.data)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return {
    id: photo.id,
    day: photo.day,
    angle: photo.angle,
    data: bytes.buffer,
    type: photo.type,
    width: photo.width,
    height: photo.height,
    align: photo.align,
    createdAt: photo.createdAt,
    ...captureInfoOf(photo),
  }
}

/** Whether any progress photo is stored. */
export async function hasStoredPhotos(): Promise<boolean> {
  return (await db.photos.count()) > 0
}

/** Every stored photo as a backup entry. */
export async function readBackupPhotos(): Promise<BackupPhoto[]> {
  return (await db.photos.toArray()).map(encodeBackupPhoto)
}

/** Replaces every stored photo with `photos`, in one transaction. */
export async function replaceStoredPhotos(photos: BackupPhoto[]): Promise<void> {
  await db.transaction('rw', db.photos, async () => {
    await db.photos.clear()
    await db.photos.bulkPut(photos.map(decodeBackupPhoto))
  })
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
