import { bodyweightOf } from '../domain/bodyweight'
import { parseCsv } from '../domain/csv'
import { detectFormat } from '../domain/importers/detect'
import { parseHevy } from '../domain/importers/hevy'
import { mapName, type NameProposal } from '../domain/importers/mapping'
import { buildSessions, skipDuplicates } from '../domain/importers/sessions'
import { parseStrong } from '../domain/importers/strong'
import type { ImportDraft, ParseResult } from '../domain/importers/types'
import { mergePrograms } from '../domain/programs'
import { setsCsvFileName, setsCsvText } from '../domain/setsCsv'
import { allSessions, putSessions } from '../storage/sessionStore'
import { getBodyweightOverrides, getUserPrograms } from '../storage/settingsStore'
import type { CatalogService } from './catalog'
import type { ServiceDeps } from './deps'
import { callStorage, ServiceError } from './errors'

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

/** Hands `file` to the share sheet when it can take files, else downloads it; else does nothing. */
async function shareCsvFile(text: string, name: string): Promise<void> {
  const blob = new Blob([text], { type: 'text/csv' })
  const file = new File([blob], name, { type: 'text/csv' })
  const canShare =
    typeof navigator.canShare === 'function' &&
    typeof navigator.share === 'function' &&
    navigator.canShare({ files: [file] })

  if (canShare) {
    await navigator.share({ files: [file] })
  } else if (typeof URL.createObjectURL === 'function') {
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = name
    anchor.click()
    URL.revokeObjectURL(url)
  }
}

const NOT_AN_EXPORT = 'This file is not a Strong or Hevy export.'

/**
 * Exports the sets CSV, reads a Strong or Hevy file into a pending import, and confirms it as
 * appended Sessions in one bulk write (E23-T7, O15-O17). Only `confirmImport` writes.
 */
export function createTransferService(deps: ServiceDeps & { catalog: CatalogService }): TransferService {
  return {
    async exportCsv() {
      return callStorage(
        deps,
        async () => {
          const now = new Date(deps.now())
          const [sessions, userPrograms, data] = await Promise.all([
            allSessions(),
            getUserPrograms(),
            deps.catalog.load(),
          ])
          const programs = mergePrograms(data.bundledPrograms, userPrograms)
          const text = setsCsvText(sessions, programs, [...data.catalog.values()])
          await shareCsvFile(text, setsCsvFileName(now))
        },
        'the sets could not be exported',
      )
    },

    async readImport(text, unit) {
      const rows = parseCsv(text)
      const format = rows.length > 0 ? detectFormat(rows[0]) : null
      if (format === null) throw new ServiceError('invalid-import', NOT_AN_EXPORT)

      let parsed: ParseResult
      try {
        parsed = format === 'strong' ? parseStrong(text, unit) : parseHevy(text)
      } catch (err) {
        throw new ServiceError('invalid-import', err instanceof Error ? err.message : NOT_AN_EXPORT)
      }

      const data = await callStorage(deps, () => deps.catalog.load(), 'the catalog could not be loaded')
      const library = new Map(data.library.map((e) => [e.id, e]))
      const counts = new Map<string, number>()
      for (const draft of parsed.drafts) {
        for (const set of draft.sets) counts.set(set.name, (counts.get(set.name) ?? 0) + 1)
      }
      const names = [...counts].map(([source, sets]) => ({
        source,
        sets,
        proposal: mapName(source, data.catalog, library),
      }))

      return {
        format,
        unitStated: parsed.unit === 'stated',
        names,
        drafts: parsed.drafts,
        sessionCount: parsed.drafts.length,
        leftOut: parsed.leftOut,
      }
    },

    async confirmImport(pending, choices) {
      return callStorage(
        deps,
        async () => {
          await deps.catalog.load()
          const overrides = await getBodyweightOverrides()
          const isBodyweight = (id: string): boolean => {
            const exercise = deps.catalog.resolve(id)
            return exercise ? bodyweightOf(exercise, overrides) : false
          }
          const now = deps.now()
          const built = buildSessions(
            pending.drafts,
            choices,
            pending.format === 'strong' ? 'Strong' : 'Hevy',
            now,
            () => crypto.randomUUID(),
            isBodyweight,
          )
          const { sessions, skipped } = skipDuplicates(await allSessions(), built.sessions)
          if (sessions.length > 0) await putSessions(sessions)
          deps.bus.emit('sessions')
          return { added: sessions.length, skipped, leftOut: pending.leftOut + built.leftOut }
        },
        'the history could not be imported',
      )
    },
  }
}
