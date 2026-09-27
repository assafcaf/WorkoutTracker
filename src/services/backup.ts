import {
  BackupFormatError,
  downloadOrShare,
  exportBackup,
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
  USER_PROGRAMS_KEY,
  VOLUME_BASELINE_KEY,
  WEIGHT_STEPS_KEY,
  deleteKeys,
  putRows,
  setLastExportedAt,
} from '../storage/settingsStore'
import { inTransaction } from '../storage/transaction'
import type { SettingRow } from '../storage/db'
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
          const file = await exportBackup(now)
          await downloadOrShare(file)
          await setLastExportedAt(file.exportedAt, now)
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

          // A safety copy of what is about to be overwritten, as `replaceAll` makes.
          await downloadOrShare(await exportBackup(now))

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
