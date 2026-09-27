import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { db } from '../storage/db'
import { readRow } from '../storage/settingsStore'
import { LAST_EXPORTED_AT_KEY, setActiveProgramId } from '../storage/settingsStore'
import { exportBackup, BACKUP_SCHEMA_VERSION, type BackupFile } from '../storage/backup'
import type { Session, SetEntry } from '../types'
import { createChangeBus } from './changes'
import { ServiceError } from './errors'
import { createBackupService, type PendingImport } from './backup'
import type { SyncResult } from '../sync/syncClient'

// `fake-indexeddb/auto` is installed globally in src/test/setup.ts; see storage/backup.test.ts.
beforeEach(async () => {
  await db.open()
  await db.sessions.clear()
  await db.settings.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
  delete (navigator as unknown as { share?: unknown }).share
  delete (navigator as unknown as { canShare?: unknown }).canShare
  delete (URL as unknown as { createObjectURL?: unknown }).createObjectURL
  delete (URL as unknown as { revokeObjectURL?: unknown }).revokeObjectURL
})

const SECOND = 1_000
const DAY = 24 * 60 * 60 * SECOND
const BASE = 1_700_000_000_000

function entry(
  exerciseId: string,
  setIndex: number,
  weightKg: number | null,
  reps: number,
  loggedAt: number,
): SetEntry {
  return { exerciseId, setIndex, weightKg, reps, loggedAt }
}

function sessionsFixture(count: number, prefix = 'session'): Session[] {
  return Array.from({ length: count }, (_unused, index) => {
    const startedAt = BASE - index * DAY
    return {
      id: `${prefix}-${index}`,
      programId: 'assaf-ab-2026',
      workoutId: 'workout-a',
      startedAt,
      finishedAt: startedAt + 3600 * SECOND,
      entries: [entry('lunges', 0, 20, 10, startedAt + 60 * SECOND)],
    }
  })
}

/** Installs `URL.createObjectURL`/anchor click capture, absent in jsdom, as backup.test.ts does. */
function installDownloadFallback(): { clickedAnchors: HTMLAnchorElement[] } {
  const clickedAnchors: HTMLAnchorElement[] = []
  Object.defineProperty(URL, 'createObjectURL', {
    value: vi.fn().mockReturnValue('blob:mock-url'),
    configurable: true,
    writable: true,
  })
  Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), configurable: true, writable: true })
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    clickedAnchors.push(this)
  })
  return { clickedAnchors }
}

function makeDeps(replaceRemote: () => Promise<SyncResult> = vi.fn().mockResolvedValue({
  status: 'ok',
  at: BASE,
  pushed: 0,
  pulled: 0,
})) {
  return {
    now: () => BASE,
    bus: createChangeBus(),
    storageAvailable: true,
    replaceRemote,
  }
}

// --- O5: exactly export, read and confirmImport ----------------------------------------------

test('O5 createBackupService exposes exactly export, read and confirmImport, each working', async () => {
  const service = createBackupService(makeDeps())

  expect(Object.keys(service).sort()).toEqual(['confirmImport', 'export', 'read'])

  // The shape alone proves nothing if none of the three actually do their job -- exercise one.
  installDownloadFallback()
  await expect(service.export()).resolves.toBeUndefined()
})

// --- O5/O7: export builds the file as exportBackup does, shares it, and stamps lastExportedAt --

test('O5 export shares the file exportBackup would build and stamps lastExportedAt at now()', async () => {
  const sessions = sessionsFixture(3)
  await db.sessions.bulkPut(sessions)
  await setActiveProgramId('assaf-ab-2026')
  const expected = await exportBackup(BASE)
  const { clickedAnchors } = installDownloadFallback()
  const service = createBackupService(makeDeps())

  await service.export()

  expect(clickedAnchors).toHaveLength(1)
  const url = clickedAnchors[0].href
  expect(url).toBe('blob:mock-url')
  const createObjectURL = URL.createObjectURL as ReturnType<typeof vi.fn>
  const blobArg = createObjectURL.mock.calls[0][0] as Blob
  expect(JSON.parse(await blobArg.text())).toEqual(expected)

  const row = await readRow(LAST_EXPORTED_AT_KEY)
  expect(row?.value).toBe(BASE)
  expect(row?.updatedAt).toBe(BASE)
})

// --- O8: export announces exactly the preferences topic ---------------------------------------

test('O8 export calls a preferences subscriber exactly once and does not call sessions or programs', async () => {
  installDownloadFallback()
  const bus = createChangeBus()
  const preferences = vi.fn()
  const sessionsFn = vi.fn()
  const programs = vi.fn()
  bus.subscribe('preferences', preferences)
  bus.subscribe('sessions', sessionsFn)
  bus.subscribe('programs', programs)
  const service = createBackupService({ now: () => BASE, bus, storageAvailable: true, replaceRemote: vi.fn() })

  await service.export()

  expect(preferences).toHaveBeenCalledTimes(1)
  expect(sessionsFn).not.toHaveBeenCalled()
  expect(programs).not.toHaveBeenCalled()
})

// --- O6/O7: read rejects invalid backup text with the verbatim message ------------------------

test('O6 read rejects with ServiceError invalid-backup and the message readBackup throws for text that is not valid JSON', async () => {
  const service = createBackupService(makeDeps())

  const rejection = service.read('not valid json')
  await expect(rejection).rejects.toBeInstanceOf(ServiceError)
  await expect(rejection).rejects.toMatchObject({
    code: 'invalid-backup',
    message: 'backup file is not valid JSON',
  })
})

test('O6 read rejects with ServiceError invalid-backup and the message readBackup throws for an unknown schema version', async () => {
  const service = createBackupService(makeDeps())
  const unknownVersion = JSON.stringify({
    schemaVersion: 2,
    exportedAt: BASE,
    sessions: [],
    settings: { activeProgramId: 'assaf-ab-2026', lastExportedAt: null },
  })

  const rejection = service.read(unknownVersion)
  await expect(rejection).rejects.toBeInstanceOf(ServiceError)
  await expect(rejection).rejects.toMatchObject({
    code: 'invalid-backup',
    message: 'backup file has an unknown schema version',
  })
})

// --- O5: read returns { file, plan } with the plan from importPlan ----------------------------

test('O5 read returns the parsed file and the plan importPlan would compute against the finished sessions on the phone', async () => {
  const current = sessionsFixture(3)
  await db.sessions.bulkPut(current)
  // An in-progress session must not count toward "current" -- listSessions excludes it.
  await db.sessions.put({
    id: 'in-progress',
    programId: 'assaf-ab-2026',
    workoutId: 'workout-a',
    startedAt: BASE,
    finishedAt: null,
    entries: [],
  })
  const incoming = [current[0], { ...current[1], id: 'incoming-only' }]
  const file: BackupFile = {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: BASE,
    sessions: incoming,
    settings: { activeProgramId: 'assaf-ab-2026', lastExportedAt: null },
  }
  const service = createBackupService(makeDeps())

  const pending = await service.read(JSON.stringify(file))

  expect(pending.file).toEqual(file)
  expect(pending.plan).toEqual({ added: 1, removed: 2, kept: 1 })
})

// --- O5/O8: confirmImport replaces locally as replaceAll does, then calls replaceRemote --------

test('O5 confirmImport replaces the stored sessions and settings with the pending file', async () => {
  await db.sessions.bulkPut(sessionsFixture(2, 'old'))
  await setActiveProgramId('old-program')
  const incoming = sessionsFixture(2, 'new')
  const file: BackupFile = {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: BASE,
    sessions: incoming,
    settings: { activeProgramId: 'new-program', lastExportedAt: null },
  }
  const pending: PendingImport = { file, plan: { added: 2, removed: 2, kept: 0 } }
  const service = createBackupService(makeDeps())

  await service.confirmImport(pending)

  const storedSessions = await db.sessions.toArray()
  expect(storedSessions).toEqual(incoming)
  const activeProgramRow = await readRow('activeProgramId')
  expect(activeProgramRow?.value).toBe('new-program')
})

test('O5 confirmImport calls the injected replaceRemote and returns its result', async () => {
  const file: BackupFile = {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: BASE,
    sessions: [],
    settings: { activeProgramId: 'assaf-ab-2026', lastExportedAt: null },
  }
  const pending: PendingImport = { file, plan: { added: 0, removed: 0, kept: 0 } }
  const result: SyncResult = { status: 'ok', at: BASE, pushed: 0, pulled: 0 }
  const replaceRemote = vi.fn().mockResolvedValue(result)
  const service = createBackupService(makeDeps(replaceRemote))

  await expect(service.confirmImport(pending)).resolves.toEqual(result)
  expect(replaceRemote).toHaveBeenCalledTimes(1)
})

test('O8 confirmImport calls a subscriber to each of sessions, programs and preferences exactly once', async () => {
  const bus = createChangeBus()
  const sessionsFn = vi.fn()
  const programs = vi.fn()
  const preferences = vi.fn()
  bus.subscribe('sessions', sessionsFn)
  bus.subscribe('programs', programs)
  bus.subscribe('preferences', preferences)
  const file: BackupFile = {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: BASE,
    sessions: [],
    settings: { activeProgramId: 'assaf-ab-2026', lastExportedAt: null },
  }
  const pending: PendingImport = { file, plan: { added: 0, removed: 0, kept: 0 } }
  const service = createBackupService({
    now: () => BASE,
    bus,
    storageAvailable: true,
    replaceRemote: vi.fn().mockResolvedValue({ status: 'ok', at: BASE, pushed: 0, pulled: 0 }),
  })

  await service.confirmImport(pending)

  expect(sessionsFn).toHaveBeenCalledTimes(1)
  expect(programs).toHaveBeenCalledTimes(1)
  expect(preferences).toHaveBeenCalledTimes(1)
})
