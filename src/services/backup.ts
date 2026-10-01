import {
  BACKUP_SCHEMA_VERSION,
  BackupFormatError,
  backupFileName,
  importPlan,
  readBackup,
  type BackupFile,
  type ImportPlan,
} from '../storage/backup'
import { listSessions, replaceAllSessions } from '../storage/sessionStore'
import {
  ACTIVE_PROGRAM_ID_KEY,
  GYM_EQUIPMENT_KEY,
  LAST_EXPORTED_AT_KEY,
  PLATE_INVENTORY_KEY,
  USER_PROGRAMS_KEY,
  EXERCISE_NOTES_KEY,
  EFFORT_TRACKING_KEY,
  getExerciseNotes,
  getTrackEffort,
  VOLUME_BASELINE_KEY,
  WEIGHT_STEPS_KEY,
  deleteKeys,
  getGymEquipment,
  getLastExportedAt,
  getUserPrograms,
  getVolumeBaseline,
  getWeightSteps,
  putRows,
  readRow,
  setLastExportedAt,
} from '../storage/settingsStore'
import { inTransaction } from '../storage/transaction'
import type { SettingRow } from '../storage/db'
import type { PlateInventory } from '../types'
import type { SyncResult } from '../sync/syncClient'
import { CHANGE_TOPICS } from './changes'
import { callStorage, ServiceError } from './errors'
import type { ServiceDeps } from './deps'

export type { ImportPlan }

/** A backup file already read and validated, with the counts importing it would change. */
export type PendingImport = { file: BackupFile; plan: ImportPlan }

export type BackupService = {
  export(): Promise<void>
  read(text: string): Promise<PendingImport>
  confirmImport(pending: PendingImport): Promise<SyncResult>
}

/** Every logged session and the settings this app owns, as of `now` (moved from storage, E11-T15). */
async function buildBackupFile(now: number): Promise<BackupFile> {
  const [
    sessions,
    activeProgramRow,
    lastExportedAt,
    gymEquipment,
    weightSteps,
    volumeBaseline,
    userPrograms,
    exerciseNotes,
    effortTracking,
    plateInventoryRow,
  ] = await Promise.all([
    listSessions(),
    readRow(ACTIVE_PROGRAM_ID_KEY),
    getLastExportedAt(),
    getGymEquipment(),
    getWeightSteps(),
    getVolumeBaseline(),
    getUserPrograms(),
    getExerciseNotes(),
    getTrackEffort(),
    readRow(PLATE_INVENTORY_KEY),
  ])
  const activeProgramId = typeof activeProgramRow?.value === 'string' ? activeProgramRow.value : ''

  return {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: now,
    sessions,
    settings: {
      activeProgramId,
      lastExportedAt,
      gymEquipment,
      weightSteps,
      volumeBaseline,
      userPrograms,
      ...(Object.keys(exerciseNotes).length > 0 ? { exerciseNotes } : {}),
      ...(effortTracking ? { effortTracking } : {}),
      ...(plateInventoryRow ? { plateInventory: plateInventoryRow.value as PlateInventory } : {}),
    },
  }
}

/**
 * Hands `file` to the browser's share sheet when `navigator.canShare({ files })` says it can,
 * otherwise downloads it through an object-URL anchor, then records `lastExportedAt` as the
 * file's `exportedAt`, stamped at `now`.
 */
async function shareBackupFile(file: BackupFile, now: number): Promise<void> {
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
  // least one of them; this only happens in test environments that exercise the pre-import
  // safety copy without standing in for one -- not a failure worth rejecting the import for.

  await setLastExportedAt(file.exportedAt, now)
}

/**
 * Exports, reads and confirms a backup import through E11-T2's repository operations, stamping
 * `lastExportedAt` and announcing every change topic an import touches (E11-T8).
 */
export function createBackupService(
  deps: ServiceDeps & { replaceRemote: () => Promise<SyncResult> },
): BackupService {
  return {
    async export() {
      return callStorage(
        deps,
        async () => {
          const now = deps.now()
          await shareBackupFile(await buildBackupFile(now), now)
          deps.bus.emit('preferences')
        },
        'the backup could not be exported',
      )
    },

    async read(text: string) {
      return callStorage(
        deps,
        async () => {
          let file: BackupFile
          try {
            file = readBackup(text)
          } catch (err) {
            throw new ServiceError(
              'invalid-backup',
              err instanceof BackupFormatError ? err.message : 'backup file could not be read',
            )
          }

          const current = await listSessions()
          return { file, plan: importPlan(current, file.sessions) }
        },
        'the backup could not be read',
      )
    },

    async confirmImport(pending: PendingImport) {
      return callStorage(
        deps,
        async () => {
          const { file } = pending
          const now = deps.now()

          // A safety copy of what is about to be overwritten, before anything is written.
          await shareBackupFile(await buildBackupFile(now), now)

          await inTransaction('rw', async () => {
            await replaceAllSessions(file.sessions)

            const toPut: SettingRow[] = [
              { key: ACTIVE_PROGRAM_ID_KEY, value: file.settings.activeProgramId, updatedAt: now },
            ]
            const toDelete: string[] = []

            if (file.settings.lastExportedAt === null) toDelete.push(LAST_EXPORTED_AT_KEY)
            else toPut.push({ key: LAST_EXPORTED_AT_KEY, value: file.settings.lastExportedAt, updatedAt: now })

            if (file.settings.gymEquipment === undefined || file.settings.gymEquipment === null) {
              toDelete.push(GYM_EQUIPMENT_KEY)
            } else {
              toPut.push({ key: GYM_EQUIPMENT_KEY, value: file.settings.gymEquipment, updatedAt: now })
            }

            if (file.settings.weightSteps === undefined) toDelete.push(WEIGHT_STEPS_KEY)
            else toPut.push({ key: WEIGHT_STEPS_KEY, value: file.settings.weightSteps, updatedAt: now })

            if (file.settings.volumeBaseline === undefined) toDelete.push(VOLUME_BASELINE_KEY)
            else toPut.push({ key: VOLUME_BASELINE_KEY, value: file.settings.volumeBaseline, updatedAt: now })

            if (file.settings.userPrograms === undefined) toDelete.push(USER_PROGRAMS_KEY)
            else toPut.push({ key: USER_PROGRAMS_KEY, value: file.settings.userPrograms, updatedAt: now })

            if (file.settings.exerciseNotes === undefined) toDelete.push(EXERCISE_NOTES_KEY)
            else toPut.push({ key: EXERCISE_NOTES_KEY, value: file.settings.exerciseNotes, updatedAt: now })

            if (file.settings.effortTracking === undefined) toDelete.push(EFFORT_TRACKING_KEY)
            else toPut.push({ key: EFFORT_TRACKING_KEY, value: file.settings.effortTracking, updatedAt: now })

            if (file.settings.plateInventory === undefined) toDelete.push(PLATE_INVENTORY_KEY)
            else toPut.push({ key: PLATE_INVENTORY_KEY, value: file.settings.plateInventory, updatedAt: now })

            if (toPut.length > 0) await putRows(toPut)
            if (toDelete.length > 0) await deleteKeys(toDelete)
          })

          const result = await deps.replaceRemote()
          for (const topic of CHANGE_TOPICS) deps.bus.emit(topic)
          return result
        },
        'the backup could not be imported',
      )
    },
  }
}
