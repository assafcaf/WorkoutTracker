import type { BackupFile, ImportPlan } from '../storage/backup'
import type { SyncResult } from '../sync/syncClient'
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
  _deps: ServiceDeps & { replaceRemote: () => Promise<SyncResult> },
): BackupService {
  return {
    async export() {
      throw new Error('not implemented')
    },
    async read(_text: string) {
      throw new Error('not implemented')
    },
    async confirmImport(_pending: PendingImport) {
      throw new Error('not implemented')
    },
  }
}
