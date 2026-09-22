import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { db } from './db'
import { listSessions } from './sessionStore'
import { ACTIVE_PROGRAM_ID_KEY, getLastExportedAt, setActiveProgramId } from './settingsStore'
import {
  BACKUP_SCHEMA_VERSION,
  backupFileName,
  downloadOrShare,
  exportBackup,
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
