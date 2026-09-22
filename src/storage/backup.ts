import type { Session } from '../types'

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
  settings: { activeProgramId: string; lastExportedAt: number | null }
}

/**
 * The file name an export made at `exportedAt` is given: `workout-backup-<yyyy-mm-dd>.json`,
 * dated by the local calendar day, so it matches what the trainee sees on the device that made
 * it.
 */
export function backupFileName(_exportedAt: number): string {
  throw new Error('backupFileName is not implemented')
}

/**
 * Every logged session and the settings this app owns, as of `now`.
 */
export async function exportBackup(_now: number): Promise<BackupFile> {
  throw new Error('exportBackup is not implemented')
}

/**
 * Hands `file` to the browser's share sheet when `navigator.canShare({ files })` says it can,
 * otherwise downloads it through an object-URL anchor. Records
 * `setLastExportedAt(file.exportedAt)` once that succeeds.
 */
export async function downloadOrShare(_file: BackupFile): Promise<void> {
  throw new Error('downloadOrShare is not implemented')
}

/** Raised by `readBackup` for text that is not valid JSON or names an unknown schema version. */
export class BackupFormatError extends Error {}

/**
 * Parses and validates `text` as a `BackupFile`, throwing `BackupFormatError` when it is not
 * valid JSON or carries a `schemaVersion` this build does not know.
 */
export function readBackup(_text: string): BackupFile {
  throw new Error('readBackup is not implemented')
}

/**
 * Clears and rewrites `db.sessions` and the settings this file owns, in one transaction, so the
 * database afterward holds exactly what `file` describes and nothing it does not.
 */
export async function replaceAll(_file: BackupFile): Promise<void> {
  throw new Error('replaceAll is not implemented')
}
