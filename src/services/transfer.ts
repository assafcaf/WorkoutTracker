import type { ImportDraft } from '../domain/importers/types'
import type { NameProposal } from '../domain/importers/mapping'
import type { ServiceDeps } from './deps'
import type { CatalogService } from './catalog'

/** A Strong or Hevy file already read: nothing of it is stored yet. */
export type PendingTransfer = {
  format: 'strong' | 'hevy'
  unitStated: boolean
  names: { source: string; sets: number; proposal: NameProposal | null }[]
  drafts: ImportDraft[]
  sessionCount: number
  leftOut: number
}

export type TransferResult = { added: number; skipped: number; leftOut: number }

export type TransferService = {
  exportCsv(): Promise<void>
  readImport(text: string, unit?: 'kg' | 'lbs'): Promise<PendingTransfer>
  confirmImport(pending: PendingTransfer, choices: Record<string, string | null>): Promise<TransferResult>
}

export function createTransferService(_deps: ServiceDeps & { catalog: CatalogService }): TransferService {
  const todo = async (): Promise<never> => {
    throw new Error('not implemented')
  }
  return { exportCsv: todo, readImport: todo, confirmImport: todo }
}
