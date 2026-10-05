import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { db } from '../storage/db'
import { getPlateInventory, readRow } from '../storage/settingsStore'
import { DEFAULT_PLATE_INVENTORY } from '../domain/plates'
import { LAST_EXPORTED_AT_KEY, setActiveProgramId } from '../storage/settingsStore'
import { BACKUP_SCHEMA_VERSION, type BackupFile } from '../storage/backup'
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
  // What exportBackup built for this store, written out by hand (E11-T15 O15 deleted
  // storage/backup's exportBackup): every session, and every other setting at its default.
  const expected: BackupFile = {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: BASE,
    sessions,
    settings: {
      activeProgramId: 'assaf-ab-2026',
      lastExportedAt: null,
      gymEquipment: null,
      weightSteps: {},
      volumeBaseline: { period: 'last' },
      userPrograms: [],
    },
  }
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

test('E12-T1 O4 export leaves a deleted Session out of the backup file', async () => {
  const [kept, deleted] = sessionsFixture(2)
  await db.sessions.bulkPut([kept, { ...deleted, deletedAt: BASE, updatedAt: BASE }])
  const { clickedAnchors } = installDownloadFallback()

  await createBackupService(makeDeps()).export()

  expect(clickedAnchors).toHaveLength(1)
  const createObjectURL = URL.createObjectURL as ReturnType<typeof vi.fn>
  const blobArg = createObjectURL.mock.calls[0][0] as Blob
  const file = JSON.parse(await blobArg.text()) as BackupFile
  expect(file.sessions).toEqual([kept])
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

// --- E14-T15 O18: R3's fields and settings survive export then import --------------------------

test('E14-T15 O18 an export imported into an empty app keeps every R3 field and setting', async () => {
  const r3Session: Session = {
    id: 'r3-session',
    programId: 'user-program',
    workoutId: 'w1',
    startedAt: BASE,
    finishedAt: BASE + 3600 * SECOND,
    note: 'Felt strong, slept badly',
    entries: [
      { exerciseId: 'lunges', setIndex: 0, weightKg: 20, reps: 10, loggedAt: BASE + 60 * SECOND, kind: 'warmup' },
      { exerciseId: 'lunges', setIndex: 1, weightKg: 40, reps: 8, loggedAt: BASE + 120 * SECOND, rir: 2, loadKg: 37.5 },
      { exerciseId: 'lunges', setIndex: 2, weightKg: 35, reps: 12, loggedAt: BASE + 180 * SECOND, kind: 'amrap', rir: 0 },
    ],
  }
  const userProgram = {
    id: 'user-program',
    name: 'Mine',
    units: 'kg' as const,
    sessionsPerWeek: 3,
    createdAt: BASE,
    workouts: [
      {
        id: 'w1',
        name: 'Legs',
        exercises: [
          { exerciseId: 'lunges', sets: 3, repRange: [8, 12] as [number, number], restSeconds: 90, amrapLast: true },
          { exerciseId: 'squat', sets: 3, repRange: [5, 5] as [number, number], restSeconds: 120 },
        ],
      },
    ],
  }
  await db.sessions.bulkPut([r3Session])
  await db.settings.bulkPut([
    { key: 'userPrograms', value: [userProgram], updatedAt: BASE },
    { key: 'exerciseNotes', value: { lunges: 'Pause at the bottom' }, updatedAt: BASE },
    { key: 'effortTracking', value: true, updatedAt: BASE },
  ])
  const { clickedAnchors } = installDownloadFallback()
  const service = createBackupService(makeDeps())

  await service.export()
  expect(clickedAnchors).toHaveLength(1)
  const exported = await ((URL.createObjectURL as ReturnType<typeof vi.fn>).mock.calls[0][0] as Blob).text()
  expect(JSON.parse(exported).schemaVersion).toBe(1)

  await db.sessions.clear()
  await db.settings.clear()
  const pending = await service.read(exported)
  await service.confirmImport(pending)

  expect(await db.sessions.toArray()).toEqual([r3Session])
  expect((await db.settings.get('userPrograms'))?.value).toEqual([userProgram])
  expect((await db.settings.get('exerciseNotes'))?.value).toEqual({ lunges: 'Pause at the bottom' })
  expect((await db.settings.get('effortTracking'))?.value).toBe(true)
})

test('E14-T15 O18 a backup made before R3 imports with every Set working and no notes, loads or effort', async () => {
  const oldFile = {
    schemaVersion: 1,
    exportedAt: BASE,
    sessions: sessionsFixture(2),
    settings: { activeProgramId: 'assaf-ab-2026', lastExportedAt: null },
  }
  // What the device held before: R3 settings that an old backup, knowing nothing of them, must clear.
  await db.settings.bulkPut([
    { key: 'exerciseNotes', value: { lunges: 'stale note' }, updatedAt: BASE },
    { key: 'effortTracking', value: true, updatedAt: BASE },
  ])
  installDownloadFallback()
  const service = createBackupService(makeDeps())

  const pending = await service.read(JSON.stringify(oldFile))
  await service.confirmImport(pending)

  const sessions = await db.sessions.toArray()
  expect(sessions).toHaveLength(2)
  for (const session of sessions) {
    expect(session.note).toBeUndefined()
    for (const set of session.entries) {
      expect(set.kind).toBeUndefined()
      expect(set.rir).toBeUndefined()
      expect(set.loadKg).toBeUndefined()
    }
  }
  expect((await db.settings.get('exerciseNotes'))?.value ?? {}).toEqual({})
  expect((await db.settings.get('effortTracking'))?.value ?? false).toBe(false)
})

test('E15-T4 O6 a backup made before the Plate inventory imports with the default and no stored row', async () => {
  const oldFile = {
    schemaVersion: 1,
    exportedAt: BASE,
    sessions: sessionsFixture(1),
    settings: { activeProgramId: 'assaf-ab-2026', lastExportedAt: null },
  }
  await db.settings.bulkPut([
    { key: 'plateInventory', value: { barKg: 15, plates: [{ kg: 5, pairs: 2 }] }, updatedAt: BASE },
  ])
  installDownloadFallback()
  const service = createBackupService(makeDeps())

  await service.confirmImport(await service.read(JSON.stringify(oldFile)))

  expect(await db.settings.get('plateInventory')).toBeUndefined()
  expect(await getPlateInventory()).toEqual(DEFAULT_PLATE_INVENTORY)
})

test('E15-T4 O6 a changed Plate inventory survives export and import, an unchanged one is not written', async () => {
  const changed = { barKg: 15, plates: [{ kg: 5, pairs: 2 }] }
  installDownloadFallback()
  const service = createBackupService(makeDeps())

  await service.export()
  const first = await ((URL.createObjectURL as ReturnType<typeof vi.fn>).mock.calls[0][0] as Blob).text()
  expect(JSON.parse(first).settings).not.toHaveProperty('plateInventory')

  await db.settings.bulkPut([{ key: 'plateInventory', value: changed, updatedAt: BASE }])
  await service.export()
  const second = await ((URL.createObjectURL as ReturnType<typeof vi.fn>).mock.calls[1][0] as Blob).text()
  expect(JSON.parse(second).schemaVersion).toBe(1)
  expect(JSON.parse(second).settings.plateInventory).toEqual(changed)

  await db.settings.clear()
  await service.confirmImport(await service.read(second))
  expect(await getPlateInventory()).toEqual(changed)
})
