import { createBackupService, type BackupService } from './backup'
import { createCatalogService, type CatalogService } from './catalog'
import { createChangeBus, type ChangeBus } from './changes'
import { createPreferenceService, type PreferenceService } from './preferences'
import { createProgramService, type ProgramService } from './programs'
import { createSessionService, type SessionService } from './sessions'
import { createSyncService, type SyncService } from './sync'

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
 * Builds every service over one change bus, stamped with `deps.now`. Backup's `replaceRemote`
 * is the sync service's own, so an import replaces the cloud copy through the same client.
 */
export function createServices(deps: {
  now: () => number
  storageAvailable: boolean
  fetch?: typeof fetch
}): Services {
  const bus = createChangeBus()
  const serviceDeps = { now: deps.now, storageAvailable: deps.storageAvailable, bus }
  const sync = createSyncService({ ...serviceDeps, fetch: deps.fetch })

  return {
    sessions: createSessionService(serviceDeps),
    programs: createProgramService(serviceDeps),
    preferences: createPreferenceService(serviceDeps),
    catalog: createCatalogService(serviceDeps),
    backup: createBackupService({ ...serviceDeps, replaceRemote: sync.replaceRemote }),
    sync,
    bus,
  }
}
