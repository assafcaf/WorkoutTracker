import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { db } from './db'
import { listSessions } from './sessionStore'
import {
  ACTIVE_PROGRAM_ID_KEY,
  getGymEquipment,
  getLastExportedAt,
  setActiveProgramId,
  setGymEquipment,
} from './settingsStore'
import {
  BACKUP_SCHEMA_VERSION,
  BackupFormatError,
  backupFileName,
  downloadOrShare,
  exportBackup,
  importBackup,
  importPlan,
  readBackup,
  replaceAll,
  type BackupFile,
} from './backup'
import type { Session, SetEntry } from '../types'

// `fake-indexeddb/auto` is installed globally in src/test/setup.ts; see sessionStore.test.ts.
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
// A fixed wall-clock base, so every timestamp below is a literal derived by hand.
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

/**
 * `count` finished sessions, one per day, newest first: index 0 is the most recent -- the same
 * order `listSessions`/`exportBackup` return, so it can stand as the hand-checked expectation.
 */
function sessionsFixture(count: number): Session[] {
  return Array.from({ length: count }, (_unused, index) => {
    const startedAt = BASE - index * DAY
    return {
      id: `session-${index}`,
      programId: 'assaf-ab-2026',
      workoutId: 'workout-a',
      startedAt,
      finishedAt: startedAt + 3600 * SECOND,
      entries: [entry('lunges', 0, 20, 10, startedAt + 60 * SECOND)],
    }
  })
}

/** A `BackupFile` built by hand, independent of `exportBackup`, for the downloadOrShare tests. */
function sampleBackupFile(exportedAt: number): BackupFile {
  return {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt,
    sessions: sessionsFixture(2),
    settings: { activeProgramId: 'assaf-ab-2026', lastExportedAt: null },
  }
}

// --- backupFileName -------------------------------------------------------------------------

test('O6 backupFileName names the file workout-backup-<yyyy-mm-dd>.json for the export date', () => {
  const exportedAt = new Date(2026, 8, 22, 10, 0, 0).getTime()

  expect(backupFileName(exportedAt)).toBe('workout-backup-2026-09-22.json')
})

test('O6 backupFileName pads a single-digit month and day with a leading zero', () => {
  const exportedAt = new Date(2026, 0, 5, 10, 0, 0).getTime()

  expect(backupFileName(exportedAt)).toBe('workout-backup-2026-01-05.json')
})

// --- exportBackup ----------------------------------------------------------------------------

test('O6 given 34 logged sessions, exportBackup produces schemaVersion, exportedAt, every session and the settings', async () => {
  const sessions = sessionsFixture(34)
  await db.sessions.bulkPut(sessions)
  await setActiveProgramId('assaf-ab-2026')

  const file = await exportBackup(BASE)

  expect(file.schemaVersion).toBe(1)
  expect(file.exportedAt).toBe(BASE)
  expect(file.sessions).toEqual(sessions)
  expect(file.settings.activeProgramId).toBe('assaf-ab-2026')
  expect(file.settings.lastExportedAt).toBeNull()
})

test('O6 exportBackup produces an empty session list when nothing has been logged', async () => {
  await setActiveProgramId('assaf-ab-2026')

  const file = await exportBackup(BASE)

  expect(file.sessions).toEqual([])
})

// --- round trip: exportBackup -> readBackup -> replaceAll -> listSessions --------------------

test('O6 given 34 logged sessions, importing the exported file yields a database identical to the original', async () => {
  const original = sessionsFixture(34)
  await db.sessions.bulkPut(original)
  await setActiveProgramId('assaf-ab-2026')

  const file = await exportBackup(BASE)
  const parsed = readBackup(JSON.stringify(file))

  // A different device's database: an extra session the backup never held, and a different
  // active program. `replaceAll` must remove and replace both, not merge them.
  await db.sessions.put({
    id: 'not-in-backup',
    programId: 'full-body-starter',
    workoutId: 'full-body',
    startedAt: BASE + DAY,
    finishedAt: BASE + DAY + 3600 * SECOND,
    entries: [],
  })
  await setActiveProgramId('full-body-starter')

  await replaceAll(parsed)

  expect(await listSessions()).toEqual(original)
  const activeProgramRow = await db.settings.get(ACTIVE_PROGRAM_ID_KEY)
  expect(activeProgramRow?.value).toBe('assaf-ab-2026')
})

// --- swaps and gym equipment round-trip through backup (E5-T11 S16) -------------------------

test('S16 given a session with swaps and a saved equipment list, exporting and importing into an empty store returns both intact', async () => {
  const withSwap: Session = {
    ...sessionsFixture(1)[0],
    swaps: { 'back-squat': 'leg-press' },
  }
  await db.sessions.put(withSwap)
  await setActiveProgramId('assaf-ab-2026')
  await setGymEquipment(['barbell', 'dumbbell', 'bench'])

  const file = await exportBackup(BASE)
  const parsed = readBackup(JSON.stringify(file))
  // An empty store: everything must come back from `parsed` alone.
  await db.sessions.clear()
  await db.settings.clear()

  await replaceAll(parsed)

  const [imported] = await listSessions()
  expect(imported.swaps).toEqual({ 'back-squat': 'leg-press' })
  expect(await getGymEquipment()).toEqual(['barbell', 'dumbbell', 'bench'])
})

test('S16 a schemaVersion 1 backup made before this epic, with neither swaps nor gymEquipment, still imports', async () => {
  const legacyBackup = {
    schemaVersion: 1,
    exportedAt: BASE,
    sessions: [
      {
        id: 'legacy-session',
        programId: 'assaf-ab-2026',
        workoutId: 'workout-a',
        startedAt: BASE - DAY,
        finishedAt: BASE - DAY + 3600 * SECOND,
        entries: [entry('lunges', 0, 20, 10, BASE - DAY + 60 * SECOND)],
        // No `swaps` key at all -- shaped exactly like a backup made before this epic.
      },
    ],
    settings: { activeProgramId: 'assaf-ab-2026', lastExportedAt: null },
    // No `settings.gymEquipment` key at all.
  }

  await expect(
    replaceAll(readBackup(JSON.stringify(legacyBackup))),
  ).resolves.toBeUndefined()

  const [imported] = await listSessions()
  expect(imported.id).toBe('legacy-session')
  expect(imported.swaps).toBeUndefined()
  expect(await getGymEquipment()).toBeNull()
})

// --- downloadOrShare, the boundary O7 hangs on ------------------------------------------------

/**
 * Installs `navigator.share`/`navigator.canShare` -- absent in jsdom -- so a test can act as a
 * browser that supports sharing files. `outcome` controls whether `share` resolves or rejects,
 * for the success and cancelled-share cases.
 */
function installShareSupport(outcome: 'resolves' | 'rejects'): {
  share: ReturnType<typeof vi.fn>
  canShare: ReturnType<typeof vi.fn>
} {
  const share =
    outcome === 'resolves'
      ? vi.fn().mockResolvedValue(undefined)
      : vi.fn().mockRejectedValue(new DOMException('cancelled', 'AbortError'))
  const canShare = vi.fn().mockReturnValue(true)
  Object.defineProperty(navigator, 'share', { value: share, configurable: true })
  Object.defineProperty(navigator, 'canShare', { value: canShare, configurable: true })
  return { share, canShare }
}

/**
 * Installs `URL.createObjectURL`/`URL.revokeObjectURL` -- absent in jsdom -- and captures every
 * anchor `.click()` is called on, so a test can observe the download fallback without a real
 * browser navigation happening.
 */
function installDownloadFallback(): {
  createObjectURL: ReturnType<typeof vi.fn>
  clickedAnchors: HTMLAnchorElement[]
} {
  const clickedAnchors: HTMLAnchorElement[] = []
  const createObjectURL = vi.fn().mockReturnValue('blob:mock-url')
  Object.defineProperty(URL, 'createObjectURL', {
    value: createObjectURL,
    configurable: true,
    writable: true,
  })
  Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), configurable: true, writable: true })
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    clickedAnchors.push(this)
  })
  return { createObjectURL, clickedAnchors }
}

test('O7 downloadOrShare goes through the share sheet when the browser can share files', async () => {
  const { share, canShare } = installShareSupport('resolves')
  const { clickedAnchors } = installDownloadFallback()
  const file = sampleBackupFile(BASE)

  await downloadOrShare(file)

  expect(canShare).toHaveBeenCalledWith({ files: [expect.any(File)] })
  expect(share).toHaveBeenCalledTimes(1)
  const shared = share.mock.calls[0][0] as { files: File[] }
  expect(shared.files).toHaveLength(1)
  expect(shared.files[0].name).toBe(backupFileName(file.exportedAt))
  expect(shared.files[0].type).toBe('application/json')
  expect(clickedAnchors).toHaveLength(0)
  expect(await getLastExportedAt()).toBe(file.exportedAt)
})

test('O7 downloadOrShare falls back to a download link when the browser cannot share files', async () => {
  const { createObjectURL, clickedAnchors } = installDownloadFallback()
  const file = sampleBackupFile(BASE)

  await downloadOrShare(file)

  expect(clickedAnchors).toHaveLength(1)
  expect(clickedAnchors[0].download).toBe(backupFileName(file.exportedAt))
  expect(clickedAnchors[0].href).toBe('blob:mock-url')
  expect(createObjectURL).toHaveBeenCalledTimes(1)
  const blobArg = createObjectURL.mock.calls[0][0] as Blob
  expect(blobArg.type).toBe('application/json')
  expect(JSON.parse(await blobArg.text())).toEqual(file)
  expect(await getLastExportedAt()).toBe(file.exportedAt)
})

test('O7 downloadOrShare does not record lastExportedAt when the share sheet fails', async () => {
  installShareSupport('rejects')
  const file = sampleBackupFile(BASE)

  await downloadOrShare(file).catch(() => {
    // The rejection itself is not the point here -- whether the export got recorded is.
  })

  expect(await getLastExportedAt()).toBeNull()
})

// --- importPlan, the counts [O8]'s confirmation names ---------------------------------------

test('O8 importPlan counts sessions kept in both lists, added only by the incoming file and removed from the current database', () => {
  const current = sessionsFixture(3) // session-0, session-1, session-2
  const incoming: Session[] = [current[0], current[1], { ...current[2], id: 'incoming-only' }]

  expect(importPlan(current, incoming)).toEqual({ added: 1, removed: 1, kept: 2 })
})

test('O8 given 34 current sessions and 31 entirely different incoming sessions, importPlan reports all 34 removed and all 31 added', () => {
  const current = sessionsFixture(34)
  const incoming = sessionsFixture(31).map((session) => ({
    ...session,
    id: `incoming-${session.id}`,
  }))

  expect(importPlan(current, incoming)).toEqual({ added: 31, removed: 34, kept: 0 })
})

test('O8 importPlan reports nothing added or removed when current and incoming hold exactly the same sessions', () => {
  const sessions = sessionsFixture(5)

  expect(importPlan(sessions, sessions)).toEqual({ added: 0, removed: 0, kept: 5 })
})

test('O8 given an empty current database, importPlan reports every incoming session as added and none removed or kept', () => {
  const incoming = sessionsFixture(3)

  expect(importPlan([], incoming)).toEqual({ added: 3, removed: 0, kept: 0 })
})

// --- replaceAll's pre-import export, the ordering [O9] hangs on -----------------------------

test('O9 replaceAll exports the current database to a file before clearing and replacing it', async () => {
  const current = sessionsFixture(2)
  await db.sessions.bulkPut(current)
  await setActiveProgramId('assaf-ab-2026')
  const { createObjectURL } = installDownloadFallback()
  const incoming: BackupFile = {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: BASE + DAY,
    sessions: [{ ...current[0], id: 'incoming-only' }],
    settings: { activeProgramId: 'full-body-starter', lastExportedAt: null },
  }

  await replaceAll(incoming)

  // If the export ran after the write (or not at all), the downloaded file would reflect
  // `incoming`'s one session, not the two sessions that were on the phone beforehand.
  expect(createObjectURL).toHaveBeenCalledTimes(1)
  const blobArg = createObjectURL.mock.calls[0][0] as Blob
  const exported = JSON.parse(await blobArg.text()) as BackupFile
  expect(exported.sessions).toEqual(current)

  // ...and only then does the database end up holding what `incoming` describes.
  expect(await listSessions()).toEqual(incoming.sessions)
})

test('O9 replaceAll does not touch the database when the pre-import export fails', async () => {
  const current = sessionsFixture(2)
  await db.sessions.bulkPut(current)
  await setActiveProgramId('assaf-ab-2026')
  installShareSupport('rejects')
  const incoming: BackupFile = {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: BASE + DAY,
    sessions: [{ ...current[0], id: 'incoming-only' }],
    settings: { activeProgramId: 'full-body-starter', lastExportedAt: null },
  }

  await expect(replaceAll(incoming)).rejects.toThrow()

  expect(await listSessions()).toEqual(current)
  const activeProgramRow = await db.settings.get(ACTIVE_PROGRAM_ID_KEY)
  expect(activeProgramRow?.value).toBe('assaf-ab-2026')
})

// --- importBackup's refusal of a file it does not understand [O10] --------------------------

test('O10 importBackup refuses text that is not valid JSON, naming the problem and leaving every session untouched', async () => {
  const current = sessionsFixture(3)
  await db.sessions.bulkPut(current)

  await expect(importBackup('not valid json')).rejects.toThrow(BackupFormatError)

  expect(await listSessions()).toEqual(current)
})

test('O10 importBackup refuses a file with an unknown schemaVersion, naming the problem and leaving every session untouched', async () => {
  const current = sessionsFixture(3)
  await db.sessions.bulkPut(current)
  const unknownVersionFile = {
    schemaVersion: 2,
    exportedAt: BASE,
    sessions: sessionsFixture(1),
    settings: { activeProgramId: 'full-body-starter', lastExportedAt: null },
  }

  await expect(importBackup(JSON.stringify(unknownVersionFile))).rejects.toThrow(
    BackupFormatError,
  )

  expect(await listSessions()).toEqual(current)
})
