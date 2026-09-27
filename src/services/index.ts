import type { BackupService } from './backup'
import type { CatalogService } from './catalog'
import type { ChangeBus } from './changes'
import type { PreferenceService } from './preferences'
import type { ProgramService } from './programs'
import type { SessionService } from './sessions'
import type { SyncService } from './sync'

export { ServiceError } from './errors'
export type { ServiceErrorCode } from './errors'
export type { ChangeBus, ChangeTopic } from './changes'
export type { ServiceDeps } from './deps'
export type { SessionService } from './sessions'
export type { ProgramService, ProgramsLoad } from './programs'
export type { PreferenceService } from './preferences'
export type { CatalogService, CatalogData } from './catalog'
export type { BackupService, PendingImport, ImportPlan } from './backup'
export type { SyncService, SyncResult, SyncState, SyncView } from './sync'

/** The whole service API a screen group reaches through `ServicesProvider` (E11-T9, O5). */
export type Services = {
  sessions: SessionService
  programs: ProgramService
  preferences: PreferenceService
  catalog: CatalogService
  backup: BackupService
  sync: SyncService
  bus: ChangeBus
}

/**
 * Builds every service over one change bus, stamped with `deps.now`.
 *
 * STUB (E11-T9 test-designer): not implemented yet.
 */
export function createServices(_deps: {
  now: () => number
  storageAvailable: boolean
  fetch?: typeof fetch
}): Services {
  throw new Error('not implemented: createServices')
}
