import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { UserEvent } from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { App } from './App'
import { db, isStorageAvailable } from './storage/db'
import {
  getGymEquipment,
  getWeightStep,
  setActiveProgramId,
  setGymEquipment,
  setWeightStep,
} from './storage/settingsStore'
import {
  finishSession,
  getActiveSession,
  listSessions,
  logSet,
  setSwap,
  startOrResumeSession,
} from './storage/sessionStore'
// A value import, not a type-only one: evaluating `backup.ts` is also what installs the
// feature-detected `Blob.prototype.text` polyfill these tests read downloaded blobs through.
import { BACKUP_SCHEMA_VERSION, type BackupFile } from './storage/backup'
import { loadPrograms } from './data/catalog'
import type { LibraryExercise, Session, SetEntry } from './types'
// The real 876-entry library fixture, imported directly (not through `loadLibrary()`) so the
// E5-T3 tests below can compute their own expected counts independently of the app's code.
import libraryFixture from './data/library/exercises.json'
import { FakeSyncServer } from './test/fakeSyncServer'
import { adoptSignedInAccount } from './sync/syncClient'
import type { SyncedSession } from './sync/protocol'

const LIBRARY = libraryFixture as unknown as LibraryExercise[]

// App composes real components (ProgramPicker, Settings, StorageUnavailableBanner) against the
// real, fake-indexeddb-backed db. Only isStorageAvailable and loadPrograms are replaced with
// controllable spies, so individual tests can force the storage-unavailable and hard-error
// branches without touching the global indexedDB or the bundled data files.
vi.mock('./storage/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./storage/db')>()
  return { ...actual, isStorageAvailable: vi.fn(actual.isStorageAvailable) }
})

// E4-T6: `getLastEntriesFor` stays the real, Dexie-backed query unless a test forces one id's
// load to reject, which is how the "a missing bar never takes the list down" rule is reached.
vi.mock('./storage/sessionStore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./storage/sessionStore')>()
  return { ...actual, getLastEntriesFor: vi.fn(actual.getLastEntriesFor) }
})

vi.mock('./data/catalog', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./data/catalog')>()
  return { ...actual, loadPrograms: vi.fn(actual.loadPrograms) }
})

// `virtual:pwa-register` is vite-plugin-pwa's generated module; under vitest it has no real
// service worker to drive, so it is replaced with a double that mirrors the real module the
// same way `src/ui/UpdatePill.test.tsx` does, which is what lets the E3-T7 tests below actually
// find a waiting update.
const pwa = vi.hoisted(() => ({
  registrations: [] as { onNeedRefresh?(): void }[],
  updateServiceWorker: vi.fn(async (_reloadPage?: boolean) => {}),
}))

vi.mock('virtual:pwa-register', () => ({
  registerSW(options: { onNeedRefresh?(): void } = {}) {
    pwa.registrations.push(options)
    return pwa.updateServiceWorker
  },
}))

beforeEach(async () => {
  const actualDb = await vi.importActual<typeof import('./storage/db')>('./storage/db')
  const actualCatalog = await vi.importActual<typeof import('./data/catalog')>('./data/catalog')
  vi.mocked(isStorageAvailable).mockImplementation(actualDb.isStorageAvailable)
  vi.mocked(loadPrograms).mockImplementation(actualCatalog.loadPrograms)

  await db.open()
  await db.settings.clear()
  // Since E9-T2 an empty database has no active Program; these tests start where the trainee is.
  await setActiveProgramId('assaf-ab-2026')
})

const FAST = { timeout: 300 }

// --- the picker leads with the active program (the bulk of O18) --------------------------

test('O18 App leads the picker with the active program’s workouts', async () => {
  render(<App />)

  expect(await screen.findByRole('heading', { name: 'Workout A' }, FAST)).toBeVisible()
})

test('O18 choosing another program in Settings makes the picker lead with it', async () => {
  const user = userEvent.setup()
  render(<App />)
  await screen.findByRole('heading', { name: 'Workout A' }, FAST)

  await user.click(screen.getByRole('button', { name: 'Settings' }))
  await user.click(await screen.findByRole('radio', { name: 'Full body starter' }, FAST))
  // E3-T3 took the free-standing Back button away: the Workout tab is the way back.
  await user.click(screen.getByRole('button', { name: 'Workout' }))

  expect(await screen.findByRole('heading', { name: 'Full body starter' }, FAST)).toBeVisible()
  expect(screen.queryByRole('heading', { name: 'Assaf A/B 2026' })).toBeNull()
})

test('O18 App navigates to Settings, hiding the picker, and back again', async () => {
  const user = userEvent.setup()
  render(<App />)
  await screen.findByRole('heading', { name: 'Workout A' }, FAST)

  await user.click(screen.getByRole('button', { name: 'Settings' }))

  expect(screen.queryByRole('heading', { name: 'Workout A' })).toBeNull()

  // And back again, which since E3-T3 is the Workout tab rather than a free-standing Back.
  await user.click(screen.getByRole('button', { name: 'Workout' }))
  expect(await screen.findByRole('heading', { name: 'Workout A' }, FAST)).toBeVisible()
})

test('O18 App falls back to the first program and says so on screen when the stored active program no longer exists', async () => {
  await setActiveProgramId('retired-program')

  render(<App />)

  expect(await screen.findByRole('heading', { name: 'Workout A' }, FAST)).toBeVisible()
  const fallbackNotice = screen.getByText(/no longer/i)
  expect(fallbackNotice).toBeVisible()
})

// --- the hard-error screen (O2's surface, reached through App's composition) --------------

test('O2 App shows a hard-error screen naming the problem and renders no picker when loadPrograms throws', async () => {
  vi.mocked(loadPrograms).mockImplementation(() => {
    throw new Error('program ghost-program, workout ghost-workout: no exercise ghost-exercise in the catalog')
  })

  render(<App />)

  const alert = await screen.findByRole('alert', {}, FAST)
  expect(alert.textContent).toMatch(/ghost-exercise/)
  expect(screen.queryByRole('heading', { name: 'Workout A' })).toBeNull()
})

// --- the storage-unavailable banner and disabled logging controls (O19, realized in App) -

test('O19 App shows the storage-unavailable banner and disables the logging controls when storage is unavailable', async () => {
  vi.mocked(isStorageAvailable).mockResolvedValue(false)

  render(<App />)

  const alert = await screen.findByRole('alert', {}, FAST)
  expect(alert.textContent).toMatch(/cannot be saved/i)
  const startButton = await screen.findByRole('button', { name: /Start Workout A/i }, FAST)
  expect(startButton).toBeDisabled()
})

test('O19 App leaves the logging controls enabled and shows no banner when storage is available', async () => {
  render(<App />)

  const startButton = await screen.findByRole('button', { name: /Start Workout A/i }, FAST)
  expect(startButton).not.toBeDisabled()
  expect(screen.queryByRole('alert')).toBeNull()
})

// --- E1-T7: the session in progress, the exercise list and an extra set ------------------
//
// These go through App on purpose: every piece below (the session store, the prefill rule,
// the set screen) is already proven on its own, so the only thing left to break is the
// wiring -- which session App resumes, and which plan and which history it hands the set
// screen.

/** A fixed wall-clock base, so the timestamps these tests write are literals. */
const BASE = 1_700_000_000_000

/** Long enough for a Dexie round-trip on a loaded machine; still short when a query is red. */
const SETTLE = { timeout: 2000 }

beforeEach(async () => {
  await db.open()
  await db.sessions.clear()
})

/** The weight readout, which is also the button that opens the weight keypad. */
function weightReadout(): HTMLElement {
  return screen.getByRole('button', { name: 'Weight' })
}

/** The reps readout, which is also the button that opens the reps keypad. */
function repsReadout(): HTMLElement {
  return screen.getByRole('button', { name: 'Reps' })
}

/** What a readout shows, whitespace-collapsed: "60", "52.5", "BW". */
function readoutValue(element: HTMLElement): string {
  return (element.textContent ?? '').replace(/\s+/g, ' ').trim()
}

/** Taps a readout to open its keypad, taps `keys`, then commits with OK. */
async function enterOnKeypad(user: UserEvent, readout: HTMLElement, keys: string[]): Promise<void> {
  await user.click(readout)
  for (const key of keys) {
    await user.click(screen.getByRole('button', { name: key }))
  }
  await user.click(screen.getByRole('button', { name: 'OK' }))
}

/** Starts a workout from the picker, which leaves the app on that session's exercise list. */
async function startWorkout(user: UserEvent, workoutName: string): Promise<void> {
  await user.click(await screen.findByRole('button', { name: `Start ${workoutName}` }, SETTLE))
}

/** Opens an exercise from the exercise list, which leaves the app on its set screen. */
async function openExercise(user: UserEvent, exerciseName: string): Promise<void> {
  await user.click(
    await screen.findByRole('button', { name: new RegExp(`^${exerciseName}`) }, SETTLE),
  )
}

/** Taps "Log set" and waits for the set after it to be the one on the dials. */
async function logSetAndOpen(
  user: UserEvent,
  nextSetIndex: number,
  plannedSets: number,
): Promise<void> {
  await user.click(screen.getByRole('button', { name: 'Log set' }))
  await screen.findByText(`Set ${nextSetIndex} of ${plannedSets}`, undefined, SETTLE)
}

/** What the exercise list shows for an exercise as its set progress: "3/4". */
function progressOf(row: HTMLElement): string {
  const shown = within(row).getByText(/^\d+\s*\/\s*\d+$/)
  return (shown.textContent ?? '').replace(/\s+/g, ' ').trim()
}

async function activeSessionEntries(): Promise<SetEntry[]> {
  const session = await getActiveSession()
  return session?.entries ?? []
}

// --- O5: a lift's history follows the lift, not the program ------------------------------

test('O5 a lift logged under one program presets set 2 of that lift under another program', async () => {
  const user = userEvent.setup()

  // One session under Assaf A/B 2026: back squat at 60 kg x 10.
  const firstRun = render(<App />)
  await startWorkout(user, 'Workout A')
  await openExercise(user, 'Back squat')
  await enterOnKeypad(user, weightReadout(), ['6', '0'])
  await enterOnKeypad(user, repsReadout(), ['1', '0'])
  await logSetAndOpen(user, 2, 4)
  const first = await getActiveSession()
  if (!first) throw new Error('the first session was never started')
  expect(first.entries.map((entry) => [entry.weightKg, entry.reps])).toEqual([[60, 10]])

  // Finishing has no control of its own yet -- that is E1-T8 -- so it is done at the store.
  await finishSession(first.id, BASE)
  firstRun.unmount()

  // The trainee switches to Full body starter, which plans back squat for 3 sets.
  await setActiveProgramId('full-body-starter')
  render(<App />)
  await startWorkout(user, 'Full body')
  await openExercise(user, 'Back squat')
  await logSetAndOpen(user, 2, 3)

  expect([readoutValue(weightReadout()), readoutValue(repsReadout())]).toEqual(['60', '10'])
})

test('O5 with nothing logged anywhere, a lift opens on its start weight and the low end of its rep range', async () => {
  const user = userEvent.setup()
  render(<App />)

  await startWorkout(user, 'Workout A')
  await openExercise(user, 'Back squat')

  expect([readoutValue(weightReadout()), readoutValue(repsReadout())]).toEqual(['50', '8'])
})

// --- O6: the rest timer is scoped to the session in progress (E6-T2) ---------------------

test('O6 opening a lift last logged in an earlier, finished session shows no rest timer', async () => {
  const user = userEvent.setup()
  const firstRun = render(<App />)
  await startWorkout(user, 'Workout A')
  await openExercise(user, 'Back squat')
  await user.click(screen.getByRole('button', { name: 'Log set' }))
  await waitFor(async () => {
    expect(await activeSessionEntries()).toHaveLength(1)
  }, SETTLE)
  const first = await getActiveSession()
  if (!first) throw new Error('the first session was never started')
  await finishSession(first.id, Date.now())
  firstRun.unmount()

  // A fresh session: back-squat's only lastEntries now come from the session just finished,
  // not from this one -- App must thread sessionStartedAt through so that history does not
  // read as "logged in this session".
  render(<App />)
  await startWorkout(user, 'Workout A')
  await openExercise(user, 'Back squat')
  await screen.findByRole('button', { name: 'Weight' }, SETTLE)

  expect(screen.queryByRole('timer')).toBeNull()
})

// --- O13: the session survives the app being closed --------------------------------------

/**
 * Logs 3 of back squat's 4 planned sets in Workout A and then closes the app: the tree is
 * unmounted and the database is shut, so nothing but storage crosses into the next render.
 * Returns the id the session had before the close.
 */
async function logThreeSetsAndCloseTheApp(user: UserEvent): Promise<string> {
  const run = render(<App />)
  await startWorkout(user, 'Workout A')
  await openExercise(user, 'Back squat')
  await logSetAndOpen(user, 2, 4)
  await logSetAndOpen(user, 3, 4)
  await logSetAndOpen(user, 4, 4)
  const session = await getActiveSession()
  if (!session) throw new Error('the session was never started')

  run.unmount()
  db.close()
  await db.open()
  return session.id
}

test('O13 reopening the app lands in the session in progress rather than in the program picker', async () => {
  const user = userEvent.setup()
  await logThreeSetsAndCloseTheApp(user)

  render(<App />)

  expect(await screen.findByRole('button', { name: /^Back squat/ }, SETTLE)).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Start Workout A' })).toBeNull()
})

test('O13 the three sets logged before the app was closed are still in the session it reopens', async () => {
  const user = userEvent.setup()
  const sessionId = await logThreeSetsAndCloseTheApp(user)

  render(<App />)
  await screen.findByRole('button', { name: /^Back squat/ }, SETTLE)

  const session = await getActiveSession()
  expect(session?.id).toBe(sessionId)
  expect(session?.entries.map((entry) => [entry.exerciseId, entry.setIndex])).toEqual([
    ['back-squat', 1],
    ['back-squat', 2],
    ['back-squat', 3],
  ])
})

test('O13 the reopened exercise list shows the exercise at 3 of its 4 planned sets', async () => {
  const user = userEvent.setup()
  await logThreeSetsAndCloseTheApp(user)

  render(<App />)

  const backSquat = await screen.findByRole('button', { name: /^Back squat/ }, SETTLE)
  expect(progressOf(backSquat)).toBe('3/4')
})

// --- O15: a set past the plan ------------------------------------------------------------

/** Logs all four planned sets of back squat, the fourth one rung heavier at 52.5 kg. */
async function logFourSetsOfBackSquat(user: UserEvent): Promise<void> {
  await startWorkout(user, 'Workout A')
  await openExercise(user, 'Back squat')
  await logSetAndOpen(user, 2, 4)
  await logSetAndOpen(user, 3, 4)
  await logSetAndOpen(user, 4, 4)
  await user.click(screen.getByRole('button', { name: 'Increase weight' }))
  await user.click(screen.getByRole('button', { name: 'Log set' }))
  await waitFor(async () => {
    expect(await activeSessionEntries()).toHaveLength(4)
  }, SETTLE)
}

test('O15 with all 4 planned sets logged, add set opens a fifth set preset from the fourth', async () => {
  const user = userEvent.setup()
  render(<App />)
  await logFourSetsOfBackSquat(user)

  await user.click(await screen.findByRole('button', { name: 'Add set' }, SETTLE))

  expect([readoutValue(weightReadout()), readoutValue(repsReadout())]).toEqual(['52.5', '8'])
})

test('O15 the added set is logged against the same exercise as set 5', async () => {
  const user = userEvent.setup()
  render(<App />)
  await logFourSetsOfBackSquat(user)

  await user.click(await screen.findByRole('button', { name: 'Add set' }, SETTLE))
  await user.click(screen.getByRole('button', { name: 'Log set' }))

  await waitFor(async () => {
    expect(await activeSessionEntries()).toHaveLength(5)
  }, SETTLE)
  const entries = await activeSessionEntries()
  expect(
    entries.map((entry) => [entry.exerciseId, entry.setIndex, entry.weightKg, entry.reps]),
  ).toEqual([
    ['back-squat', 1, 50, 8],
    ['back-squat', 2, 50, 8],
    ['back-squat', 3, 50, 8],
    ['back-squat', 4, 52.5, 8],
    ['back-squat', 5, 52.5, 8],
  ])
})

test('O15 no add-set control is offered while planned sets are still to come', async () => {
  const user = userEvent.setup()
  render(<App />)
  await startWorkout(user, 'Workout A')
  await openExercise(user, 'Back squat')
  await logSetAndOpen(user, 2, 4)
  await logSetAndOpen(user, 3, 4)

  expect(screen.queryByRole('button', { name: 'Add set' })).toBeNull()
})

// --- O17: finishing a session and the history list ----------------------------------------
//
// A fixed calendar date derived by hand from BASE (1_700_000_000_000 ms, UTC): 2023-11-14.

/** Logs one set of back squat, then closes the app, leaving the session active in storage. */
async function logOneSetAndCloseTheApp(user: UserEvent): Promise<void> {
  const run = render(<App />)
  await startWorkout(user, 'Workout A')
  await openExercise(user, 'Back squat')
  await user.click(screen.getByRole('button', { name: 'Log set' }))
  await waitFor(async () => {
    expect(await activeSessionEntries()).toHaveLength(1)
  }, SETTLE)

  run.unmount()
  db.close()
  await db.open()
}

test('O17 finishing the session from the exercise list clears the active session and returns to the picker', async () => {
  const user = userEvent.setup()
  await logOneSetAndCloseTheApp(user)

  render(<App />)
  await screen.findByRole('button', { name: /^Back squat/ }, SETTLE)

  await user.click(screen.getByRole('button', { name: 'Finish workout' }))

  await screen.findByRole('button', { name: 'Start Workout A' }, SETTLE)
  expect(await getActiveSession()).toBeNull()
})

test('O17 the finished session appears in the history list with its date, program name, workout name, total sets and total volume in kg', async () => {
  const user = userEvent.setup()
  const started = await startOrResumeSession('assaf-ab-2026', 'workout-a', BASE)
  await logSet(started.id, {
    exerciseId: 'back-squat',
    setIndex: 1,
    weightKg: 60,
    reps: 10,
    loggedAt: BASE + 1,
  })
  await logSet(started.id, {
    exerciseId: 'push-ups',
    setIndex: 1,
    weightKg: null,
    reps: 15,
    loggedAt: BASE + 2,
  })
  await finishSession(started.id, BASE + 3_600_000)

  render(<App />)
  await user.click(await screen.findByRole('button', { name: 'History' }, SETTLE))

  const row = await screen.findByRole('listitem', {}, SETTLE)
  expect(within(row).getByText('2023-11-14')).toBeVisible()
  expect(within(row).getByText('Assaf A/B 2026')).toBeVisible()
  expect(within(row).getByText('Workout A')).toBeVisible()
  expect(within(row).getByText('2 sets')).toBeVisible()
  expect(within(row).getByText('600 kg')).toBeVisible()
})

// --- E2-T8: reaching Export and Import from the app ---------------------------------------
//
// `src/storage/backup.ts` is built and proven on its own; what has never existed is the path
// from the screen to it. Every test below therefore starts at a control the trainee can press
// -- the Settings screen's Export button, or the file control a backup is chosen with -- and
// ends at what the browser was handed or what the database holds. Calling `exportBackup` or
// `importBackup` here instead would prove nothing about the wiring.

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * `count` finished sessions, one per day ending at `startedAt`, newest first -- the order
 * `listSessions` returns them in, so the fixture doubles as the hand-checked expectation.
 */
function loggedSessions(count: number, idPrefix: string, newest: number): Session[] {
  return Array.from({ length: count }, (_unused, index) => {
    const startedAt = newest - index * DAY_MS
    return {
      id: `${idPrefix}-${index}`,
      programId: 'assaf-ab-2026',
      workoutId: 'workout-a',
      startedAt,
      finishedAt: startedAt + 3_600_000,
      entries: [
        { exerciseId: 'back-squat', setIndex: 1, weightKg: 60, reps: 10, loggedAt: startedAt + 60_000 },
      ],
    }
  })
}

// Hand-checked for the confirmation O15 asks for: 5 sessions on the phone, a chosen file
// holding 3 of which 1 (session-0) is already there -> 1 kept, 4 removed, 2 added. 5, 3 and 4
// are all different, so each number in the confirmation is unambiguous.
const CURRENT: Session[] = loggedSessions(5, 'session', BASE)
const IMPORTED: Session[] = [CURRENT[0], ...loggedSessions(2, 'incoming', BASE - 10 * DAY_MS)]

/** The text of a valid backup file holding `IMPORTED`, as it would arrive from another phone. */
function importedBackupText(): string {
  const file: BackupFile = {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: BASE + DAY_MS,
    sessions: IMPORTED,
    settings: { activeProgramId: 'full-body-starter', lastExportedAt: null },
  }
  return JSON.stringify(file)
}

let anchorClick: { mockRestore(): void } | null = null

/**
 * Stands in for the one browser capability jsdom has none of: handing a file to the user.
 * There is no `navigator.share` here, so `downloadOrShare` takes its object-URL download path;
 * this installs `URL.createObjectURL`/`revokeObjectURL` and swallows the anchor click, and
 * returns the blobs the app handed over, in order.
 */
function captureDownloads(): Blob[] {
  const blobs: Blob[] = []
  Object.defineProperty(URL, 'createObjectURL', {
    value: vi.fn((blob: Blob) => {
      blobs.push(blob)
      return 'blob:mock-url'
    }),
    configurable: true,
    writable: true,
  })
  Object.defineProperty(URL, 'revokeObjectURL', {
    value: vi.fn(),
    configurable: true,
    writable: true,
  })
  anchorClick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  return blobs
}

afterEach(() => {
  anchorClick?.mockRestore()
  anchorClick = null
  delete (URL as unknown as { createObjectURL?: unknown }).createObjectURL
  delete (URL as unknown as { revokeObjectURL?: unknown }).revokeObjectURL
})

/** Opens the Settings screen from the picker. */
async function openSettings(user: UserEvent): Promise<void> {
  await user.click(await screen.findByRole('button', { name: 'Settings' }, SETTLE))
}

/**
 * Chooses a backup file holding `text` on the Settings screen. jsdom has no file picker, so
 * the file is handed to the `<input type="file">` named "Import backup" the way a picker
 * would: a change carrying one `File`.
 */
async function chooseBackupFile(user: UserEvent, text: string): Promise<void> {
  const control = screen.getByLabelText(/import backup/i)
  await user.upload(
    control,
    new File([text], 'workout-backup-2026-09-22.json', { type: 'application/json' }),
  )
}

// --- O14: Export, pressed on the screen ---------------------------------------------------

test('O14 pressing Export on the settings screen hands the browser a backup holding every logged session', async () => {
  const user = userEvent.setup()
  await db.sessions.bulkPut(CURRENT)
  await setActiveProgramId('assaf-ab-2026')
  const downloads = captureDownloads()
  render(<App />)
  await openSettings(user)

  await user.click(await screen.findByRole('button', { name: 'Export' }, SETTLE))

  await waitFor(() => {
    expect(downloads).toHaveLength(1)
  }, SETTLE)
  const handed = JSON.parse(await downloads[0].text()) as BackupFile
  expect(handed.schemaVersion).toBe(1)
  expect(handed.sessions).toEqual(CURRENT)
  expect(handed.settings.activeProgramId).toBe('assaf-ab-2026')
})

test('O14 pressing Export with nothing logged still hands the browser a backup, holding no sessions', async () => {
  const user = userEvent.setup()
  await setActiveProgramId('assaf-ab-2026')
  const downloads = captureDownloads()
  render(<App />)
  await openSettings(user)

  await user.click(await screen.findByRole('button', { name: 'Export' }, SETTLE))

  await waitFor(() => {
    expect(downloads).toHaveLength(1)
  }, SETTLE)
  const handed = JSON.parse(await downloads[0].text()) as BackupFile
  expect(handed.sessions).toEqual([])
})

// --- O15: the counted confirmation, cancelled and confirmed -------------------------------

test('O15 choosing a backup file shows a confirmation naming the current count, the incoming count and how many local sessions will be removed', async () => {
  const user = userEvent.setup()
  await db.sessions.bulkPut(CURRENT)
  render(<App />)
  await openSettings(user)

  await chooseBackupFile(user, importedBackupText())

  const dialog = await screen.findByRole('alertdialog', {}, SETTLE)
  // In that order: 5 held now, 3 in the file, 4 local sessions to be removed. Ordered, so
  // handing the confirmation the counts the other way round fails here.
  expect((dialog.textContent ?? '').replace(/\s+/g, ' ')).toMatch(/5[^0-9]+3[^0-9]+4/)
})

test('O15 cancelling the import confirmation leaves every session in the database untouched', async () => {
  const user = userEvent.setup()
  await db.sessions.bulkPut(CURRENT)
  const downloads = captureDownloads()
  render(<App />)
  await openSettings(user)
  await chooseBackupFile(user, importedBackupText())
  await screen.findByRole('alertdialog', {}, SETTLE)

  await user.click(screen.getByRole('button', { name: 'Cancel' }))

  await waitFor(() => {
    expect(screen.queryByRole('alertdialog')).toBeNull()
  }, SETTLE)
  expect(await listSessions()).toEqual(CURRENT)
  // Nothing was written, so the pre-import backup had no reason to be made either.
  expect(downloads).toHaveLength(0)
})

test('O15 confirming the import replaces the database with the chosen file sessions', async () => {
  const user = userEvent.setup()
  await db.sessions.bulkPut(CURRENT)
  captureDownloads()
  render(<App />)
  await openSettings(user)
  await chooseBackupFile(user, importedBackupText())
  await screen.findByRole('alertdialog', {}, SETTLE)

  await user.click(screen.getByRole('button', { name: 'Import' }))

  await waitFor(async () => {
    expect(await listSessions()).toEqual(IMPORTED)
  }, SETTLE)
})

// --- O16: a file the app cannot read ------------------------------------------------------

test('O16 choosing a file that is not valid JSON shows an error naming the problem and changes no session', async () => {
  const user = userEvent.setup()
  await db.sessions.bulkPut(CURRENT)
  const downloads = captureDownloads()
  render(<App />)
  await openSettings(user)

  await chooseBackupFile(user, 'this is not a backup at all')

  const alert = await screen.findByRole('alert', {}, SETTLE)
  expect(alert.textContent).toMatch(/JSON/i)
  expect(screen.queryByRole('alertdialog')).toBeNull()
  expect(await listSessions()).toEqual(CURRENT)
  expect(downloads).toHaveLength(0)
})

test('O16 choosing a file with an unknown schemaVersion shows an error naming the problem and changes no session', async () => {
  const user = userEvent.setup()
  await db.sessions.bulkPut(CURRENT)
  const downloads = captureDownloads()
  const fromALaterBuild = JSON.stringify({
    schemaVersion: 2,
    exportedAt: BASE + DAY_MS,
    sessions: IMPORTED,
    settings: { activeProgramId: 'full-body-starter', lastExportedAt: null },
  })
  render(<App />)
  await openSettings(user)

  await chooseBackupFile(user, fromALaterBuild)

  const alert = await screen.findByRole('alert', {}, SETTLE)
  expect(alert.textContent).toMatch(/schema version/i)
  expect(screen.queryByRole('alertdialog')).toBeNull()
  expect(await listSessions()).toEqual(CURRENT)
  expect(downloads).toHaveLength(0)
})

// --- E3-T3: one shell, and a tab bar instead of loose buttons ([O7], [O8], [O9]) ----------
//
// These go through App because the outcomes are about the app's chrome as a whole: which tabs
// exist, which one is current, and -- [O9] -- what E1 and E2 left above the picker that is now
// gone. AppShell's and TabBar's own contract is proven in src/ui/AppShell.test.tsx.

/** What a screen reader would announce an element as: its `aria-label`, else its text. */
function accessibleNameOf(element: Element): string {
  return (element.getAttribute('aria-label') ?? element.textContent ?? '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** The tab bar, which is the nav labelled "Main". */
function mainNav(): HTMLElement {
  return screen.getByRole('navigation', { name: 'Main' })
}

/** The tab bar's tabs, in document order, by the name each one carries. */
function tabNames(): string[] {
  return within(mainNav())
    .getAllByRole('button')
    .map((tab) => accessibleNameOf(tab))
}

/** The name of every tab currently marked `aria-current="page"`. */
function currentTabNames(): string[] {
  return within(mainNav())
    .getAllByRole('button')
    .filter((tab) => tab.getAttribute('aria-current') === 'page')
    .map((tab) => accessibleNameOf(tab))
}

/** Presses a tab in the tab bar. */
async function pressTab(user: UserEvent, name: string): Promise<void> {
  await user.click(within(mainNav()).getByRole('button', { name }))
}

/**
 * Every button with one of `names` that is not part of the tab bar -- the loose controls [O9]
 * is about. The tab bar has its own Settings and History buttons, so "gone from the document"
 * can only mean gone from outside the nav.
 *
 * RULING (E4-T4, ticket owner): the History tab's History | Stats switch holds a button named
 * exactly "History". It never leaves the History tab -- it only flips the switch back from Stats
 * -- so it is not the duplicate navigation [O9] forbids. Buttons inside that one group
 * (`role="group"`, `aria-label="History view"`) are exempt; a "History" button anywhere else
 * outside the nav still counts as loose.
 */
function looseButtons(names: string[]): string[] {
  const nav = mainNav()
  return names
    .flatMap((name) => screen.queryAllByRole('button', { name }))
    .filter((button) => !nav.contains(button))
    .filter((button) => button.closest('[role="group"][aria-label="History view"]') === null)
    .map((button) => accessibleNameOf(button))
}

test('O7 the app on load offers a Main nav holding exactly the Workout, Program, Exercises, History and Settings tabs', async () => {
  render(<App />)
  await screen.findByRole('heading', { name: 'Workout A' }, SETTLE)

  // E5-T3 inserts Exercises between Workout and History. E5-T18 (M11) inserts Program between
  // Workout and Exercises.
  expect(tabNames()).toEqual(['Workout', 'Program', 'Exercises', 'History', 'Settings'])
})

test('O7 the app on load, with no session in progress, is on the Workout tab', async () => {
  render(<App />)
  await screen.findByRole('heading', { name: 'Workout A' }, SETTLE)

  expect(currentTabNames()).toEqual(['Workout'])
})

test('O8 pressing the History tab lists the finished sessions with the tab bar still on screen', async () => {
  const user = userEvent.setup()
  await db.sessions.bulkPut(loggedSessions(1, 'session', BASE))
  render(<App />)
  await screen.findByRole('heading', { name: 'Workout A' }, SETTLE)

  await pressTab(user, 'History')

  // Hand-checked from the fixture: BASE is 2023-11-14 UTC, and one set of 60 kg x 10 is 600 kg.
  const row = await screen.findByRole('listitem', {}, SETTLE)
  expect(within(row).getByText('2023-11-14')).toBeVisible()
  expect(within(row).getByText('600 kg')).toBeVisible()
  // The shell stays put: the trainee is never stranded on a screen with no way off it.
  expect(mainNav()).toBeVisible()
})

test('O8 pressing the History tab makes History the current tab', async () => {
  const user = userEvent.setup()
  await db.sessions.bulkPut(loggedSessions(1, 'session', BASE))
  render(<App />)
  await screen.findByRole('heading', { name: 'Workout A' }, SETTLE)

  await pressTab(user, 'History')

  await waitFor(() => {
    expect(currentTabNames()).toEqual(['History'])
  }, SETTLE)
})

test('O9 the Workout tab carries no free-standing Settings, History or Back button outside the tab bar', async () => {
  render(<App />)
  await screen.findByRole('heading', { name: 'Workout A' }, SETTLE)

  expect(looseButtons(['Settings', 'History', 'Back'])).toEqual([])
})

test('O9 the History tab carries no free-standing Settings, History or Back button outside the tab bar', async () => {
  const user = userEvent.setup()
  await db.sessions.bulkPut(loggedSessions(1, 'session', BASE))
  render(<App />)
  await screen.findByRole('heading', { name: 'Workout A' }, SETTLE)

  await pressTab(user, 'History')
  await screen.findByRole('listitem', {}, SETTLE)

  expect(looseButtons(['Settings', 'History', 'Back'])).toEqual([])
})

test('O9 the Settings tab carries no free-standing Settings, History or Back button outside the tab bar', async () => {
  const user = userEvent.setup()
  render(<App />)
  await screen.findByRole('heading', { name: 'Workout A' }, SETTLE)

  await pressTab(user, 'Settings')
  await screen.findByRole('radio', { name: 'Full body starter' }, SETTLE)

  expect(looseButtons(['Settings', 'History', 'Back'])).toEqual([])
})

// --- E3-T4: the workout in progress inside the shell ([O10], [O11]) -----------------------
//
// Both outcomes are about what wraps an in-session screen, and it is App that wraps it: the
// header that names the workout or the exercise, the back control, the sticky action bar the
// one action that matters is pinned to, and the tab bar an in-session screen must not have.
// AppShell's own contract is proven in src/ui/AppShell.test.tsx; what is proven here is what
// the exercise list and the set screen are actually given.
//
// These O10 and O11 are E3's, not the O10 and O12 of E1 that src/ui/SetScreen.test.tsx names.

/** The shell around whatever screen is showing, or null when a screen renders bare. */
function shell(): HTMLElement | null {
  return document.body.querySelector('.app-shell')
}

/** The shell's header, or null when there is none. */
function shellHeader(): HTMLElement | null {
  return document.body.querySelector('header.app-header')
}

/** The shell's main region: the screen itself, without the chrome around it. */
function shellMain(): HTMLElement | null {
  return document.body.querySelector('main.app-main')
}

/** The shell's sticky action bar, or null when the screen has none. */
function actionBar(): HTMLElement | null {
  return document.body.querySelector('.action-bar')
}

/** Text with its whitespace collapsed, so a header reads as the one line it is. */
function textOf(element: Element): string {
  return (element.textContent ?? '').replace(/\s+/g, ' ').trim()
}

/** Starts Workout A and waits for its exercise list to be the screen showing. */
async function startWorkoutA(user: UserEvent): Promise<void> {
  await startWorkout(user, 'Workout A')
  await screen.findByRole('button', { name: /^Back squat/ }, SETTLE)
}

/** Starts Workout A, opens back squat, and waits for its dials to be the screen showing. */
async function openBackSquat(user: UserEvent): Promise<void> {
  await startWorkoutA(user)
  await openExercise(user, 'Back squat')
  await screen.findByRole('button', { name: 'Weight' }, SETTLE)
}

// --- O10: the exercise list ----------------------------------------------------------------

test('O10 the exercise list renders inside a shell whose header names the workout', async () => {
  const user = userEvent.setup()
  render(<App />)

  await startWorkoutA(user)

  const header = shellHeader()
  expect(header, 'the exercise list is not inside the shell at all').not.toBeNull()
  // "Workout" alone would be the picker's title: the trainee has to see which workout is on.
  expect(textOf(header as HTMLElement)).toContain('Workout A')
})

test('O10 the exercise list is inside the shell and no tab bar is rendered with it', async () => {
  const user = userEvent.setup()
  render(<App />)

  await startWorkoutA(user)

  const inShell = shell()
  expect(inShell, 'the exercise list is not inside the shell at all').not.toBeNull()
  expect(
    within(inShell as HTMLElement).getByRole('button', { name: /^Back squat/ }),
  ).toBeVisible()
  // A workout in progress is not a tab: the way out of it is the back control and finishing,
  // never a tab that would strand a half-logged session behind it.
  expect(screen.queryByRole('navigation', { name: 'Main' })).toBeNull()
})

test('O10 the exercise list shell offers a back control in its header', async () => {
  const user = userEvent.setup()
  render(<App />)

  await startWorkoutA(user)

  const header = shellHeader()
  expect(header, 'the exercise list is not inside the shell at all').not.toBeNull()
  const back = (header as HTMLElement).querySelector('button.app-header-back')
  expect(back, 'the shell around the exercise list offers no way back out of it').not.toBeNull()
  expect(accessibleNameOf(back as Element)).toMatch(/back/i)
})

test('O10 the exercise list back control lands on the picker with the session still in progress', async () => {
  const user = userEvent.setup()
  render(<App />)
  await startWorkoutA(user)

  const back = screen.queryByRole('button', { name: 'Back' })
  expect(back, 'the exercise list offers no back control').not.toBeNull()
  await user.click(back as HTMLElement)

  expect(await screen.findByRole('button', { name: 'Start Workout A' }, SETTLE)).toBeVisible()
  // Backing out is not finishing: the session is still there to come back to, which is what
  // E3-T5's resume card hangs off.
  expect(await getActiveSession()).not.toBeNull()
})

test('O10 Finish workout sits in the sticky action bar rather than after the exercise list', async () => {
  const user = userEvent.setup()
  render(<App />)

  await startWorkoutA(user)

  const bar = actionBar()
  expect(bar, 'the exercise list has no sticky action bar').not.toBeNull()
  const finish = screen.getByRole('button', { name: 'Finish workout' })
  expect((bar as HTMLElement).contains(finish)).toBe(true)
  const main = shellMain()
  expect(main, 'the exercise list is not inside the shell at all').not.toBeNull()
  // The list scrolls; the action does not. A Finish button still trailing the rows would be
  // off the bottom of a long workout however the bar is styled.
  expect((main as HTMLElement).contains(finish)).toBe(false)
  expect((main as HTMLElement).querySelector('.exercise-list')).not.toBeNull()
})

// --- O11: the set screen -------------------------------------------------------------------

test('O11 the set screen renders inside a shell whose header names the exercise', async () => {
  const user = userEvent.setup()
  render(<App />)

  await openBackSquat(user)

  const header = shellHeader()
  expect(header, 'the set screen is not inside the shell at all').not.toBeNull()
  expect(textOf(header as HTMLElement)).toContain('Back squat')
})

test('O11 the set screen is inside the shell and no tab bar is rendered with it', async () => {
  const user = userEvent.setup()
  render(<App />)

  await openBackSquat(user)

  const inShell = shell()
  expect(inShell, 'the set screen is not inside the shell at all').not.toBeNull()
  expect(within(inShell as HTMLElement).getByRole('button', { name: 'Weight' })).toBeVisible()
  expect(screen.queryByRole('navigation', { name: 'Main' })).toBeNull()
})

test('O11 the set screen back control returns to the exercise list', async () => {
  const user = userEvent.setup()
  render(<App />)
  await openBackSquat(user)

  const back = screen.queryByRole('button', { name: 'Back' })
  expect(back, 'the set screen offers no back control').not.toBeNull()
  await user.click(back as HTMLElement)

  expect(await screen.findByRole('button', { name: /^Lunges/ }, SETTLE)).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Weight' })).toBeNull()
})

test('O11 Log set sits in the sticky action bar rather than in the set screen body', async () => {
  const user = userEvent.setup()
  render(<App />)

  await openBackSquat(user)

  const bar = actionBar()
  expect(bar, 'the set screen has no sticky action bar').not.toBeNull()
  const logSetButton = screen.getByRole('button', { name: 'Log set' })
  expect((bar as HTMLElement).contains(logSetButton)).toBe(true)
  const main = shellMain()
  expect(main, 'the set screen is not inside the shell at all').not.toBeNull()
  // The dials stay in the body; only the action that ends the set is pinned to the bottom.
  expect((main as HTMLElement).contains(logSetButton)).toBe(false)
  expect((main as HTMLElement).contains(weightReadout())).toBe(true)
})

// Replaced by E6-T1: this test asserted Log set beside Add set past the Plan; E6-T1's done state
// offers Add set alone, which the E6-T1 block at the end of this file proves.
test('O11 Add set sits in the action bar once every planned set is logged', async () => {
  const user = userEvent.setup()
  render(<App />)
  await logFourSetsOfBackSquat(user)

  const addSet = await screen.findByRole('button', { name: 'Add set' }, SETTLE)

  const bar = actionBar()
  expect(bar, 'the set screen has no sticky action bar').not.toBeNull()
  expect((bar as HTMLElement).contains(addSet)).toBe(true)
})

// --- E3-T5: the resume card on the picker ([O12]) ------------------------------------------
//
// Backing out of a session in progress must not strand it behind a bare "Start Workout A": the
// Workout tab has to offer a way back into the same session, sets and all.

/** The resume control on the picker, or null when none is shown. */
function resumeControl(): HTMLElement | null {
  return document.body.querySelector('button.resume-workout')
}

/** Starts Workout A, logs one set of back squat, then backs all the way out to the picker. */
async function startLogOneSetAndBackToPicker(user: UserEvent): Promise<void> {
  await startWorkoutA(user)
  await openExercise(user, 'Back squat')
  await user.click(screen.getByRole('button', { name: 'Log set' }))
  await waitFor(async () => {
    expect(await activeSessionEntries()).toHaveLength(1)
  }, SETTLE)
  // Back out of the set screen to the exercise list, then out of the exercise list to the
  // picker -- the session stays in progress the whole way (proven by O10 and O11 above).
  await user.click(screen.getByRole('button', { name: 'Back' }))
  await screen.findByRole('button', { name: /^Back squat/ }, SETTLE)
  await user.click(screen.getByRole('button', { name: 'Back' }))
}

test('O12 backing out of a session in progress shows a resume control naming the workout in progress instead of the bare picker', async () => {
  const user = userEvent.setup()
  render(<App />)
  await startLogOneSetAndBackToPicker(user)

  const resume = resumeControl()
  expect(resume, 'no resume control is shown for the session in progress').not.toBeNull()
  expect(textOf(resume as Element)).toContain('Workout A')
})

test('O12 pressing the resume control returns to the same session with its logged sets intact', async () => {
  const user = userEvent.setup()
  render(<App />)
  await startLogOneSetAndBackToPicker(user)
  const before = await getActiveSession()
  if (!before) throw new Error('the session was never started')

  const resume = resumeControl()
  expect(resume, 'no resume control is shown for the session in progress').not.toBeNull()
  await user.click(resume as HTMLElement)

  const backSquat = await screen.findByRole('button', { name: /^Back squat/ }, SETTLE)
  expect(progressOf(backSquat)).toBe('1/4')
  const after = await getActiveSession()
  expect(after?.id).toBe(before.id)
  expect(after?.entries.map((entry) => [entry.exerciseId, entry.setIndex])).toEqual([
    ['back-squat', 1],
  ])
})

// --- E3-T7: the shell carries "Update ready" and the backup-due marker ([O13], [O14]) -----
//
// Both outcomes are about what lives in the shell rather than in one screen: the "Update
// ready" control must not be re-parented into whichever screen is showing when the update is
// found, and the backup-due marker on the Settings tab must not replace BackupBadge. Scoped in
// its own describe so the service-worker double it needs is only installed for these tests.

describe('E3-T7', () => {
  let realLocation: Location

  beforeEach(() => {
    pwa.registrations.length = 0
    pwa.updateServiceWorker.mockClear()
    // jsdom has no service worker at all, and `registerServiceWorker` correctly does nothing
    // without one, so the capability has to be there for a registration -- and an update -- to
    // ever be found.
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { controller: null, register: vi.fn(), addEventListener: vi.fn() },
    })
    realLocation = window.location
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...realLocation, reload: vi.fn(), assign: vi.fn(), replace: vi.fn() },
    })
  })

  afterEach(() => {
    Object.defineProperty(window, 'location', { configurable: true, value: realLocation })
    Reflect.deleteProperty(navigator, 'serviceWorker')
  })

  /** The options the app last registered the service worker with. */
  function lastRegistration(): { onNeedRefresh?(): void } {
    const latest = pwa.registrations[pwa.registrations.length - 1]
    if (!latest) throw new Error('nothing registered a service worker')
    return latest
  }

  /** What the browser does when a new deployment has installed and is waiting to take over. */
  function deployNewVersion(): void {
    const { onNeedRefresh } = lastRegistration()
    act(() => {
      onNeedRefresh?.()
    })
  }

  /** The current shell's header trailing slot, or null when it renders none. */
  function trailingSlot(): HTMLElement | null {
    return document.body.querySelector('.app-header-trailing')
  }

  /** The Settings tab button in the nav. */
  function settingsTabButton(): HTMLElement {
    return within(mainNav()).getByRole('button', { name: 'Settings' })
  }

  // --- O13: "Update ready" lives in the shell, not re-parented into a screen --------------

  test('O13 the Update ready control renders inside the shell header trailing slot once an update is waiting', async () => {
    render(<App />)
    await screen.findByRole('heading', { name: 'Workout A' }, SETTLE)

    deployNewVersion()

    const trailing = trailingSlot()
    expect(trailing, 'no trailing slot rendered in the header').not.toBeNull()
    expect(
      within(trailing as HTMLElement).getByRole('button', { name: 'Update ready' }),
    ).toBeVisible()
  })

  test('O13 the Update ready control stays in the header trailing slot across a tab change, never moving into the screen body', async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByRole('heading', { name: 'Workout A' }, SETTLE)
    deployNewVersion()
    await screen.findByRole('button', { name: 'Update ready' }, SETTLE)

    await pressTab(user, 'History')
    await waitFor(() => {
      expect(currentTabNames()).toEqual(['History'])
    }, SETTLE)

    // Exactly one control exists -- it was not left behind on the Workout screen -- and it
    // sits in the new shell's trailing slot rather than inside the History screen's own body.
    expect(screen.getAllByRole('button', { name: 'Update ready' })).toHaveLength(1)
    const updateButton = screen.getByRole('button', { name: 'Update ready' })
    const trailingAfterHistory = trailingSlot()
    expect(trailingAfterHistory, 'no trailing slot rendered in the header').not.toBeNull()
    expect((trailingAfterHistory as HTMLElement).contains(updateButton)).toBe(true)
    const main = shellMain()
    expect(main, 'the History tab is not inside the shell at all').not.toBeNull()
    expect((main as HTMLElement).contains(updateButton)).toBe(false)

    await pressTab(user, 'Settings')
    await screen.findByRole('radio', { name: 'Full body starter' }, SETTLE)

    expect(screen.getAllByRole('button', { name: 'Update ready' })).toHaveLength(1)
    const trailingAfterSettings = trailingSlot()
    expect(trailingAfterSettings, 'no trailing slot rendered in the header').not.toBeNull()
    expect(
      within(trailingAfterSettings as HTMLElement).getByRole('button', { name: 'Update ready' }),
    ).toBeVisible()
  })

  // --- O14: the backup-due marker lives in the nav, and never replaces BackupBadge --------

  test('O14 the Settings tab in the nav carries a marker whose accessible name says a backup is due, without changing the tab own name', async () => {
    render(<App />)
    await screen.findByRole('heading', { name: 'Workout A' }, SETTLE)

    // A fresh database has never been exported, so a backup is due from the start.
    expect(
      within(settingsTabButton()).getByRole('status', { name: /backup is due/i }),
    ).toBeVisible()
    // The seven E2 tests and this file's own openSettings helper match the button's own name
    // exactly: a badge joining it, rather than announcing itself, would break every one of them.
    expect(accessibleNameOf(settingsTabButton())).toBe('Settings')
  })

  test('O14 the Settings screen still renders BackupBadge in full when a backup is due', async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByRole('heading', { name: 'Workout A' }, SETTLE)

    await pressTab(user, 'Settings')
    await screen.findByRole('radio', { name: 'Full body starter' }, SETTLE)

    expect(
      screen.getByText('Back up your data — it has been a while since the last export.'),
    ).toBeVisible()
  })
})

// --- E5-T3: the Exercises tab ([L9], [L10]) -------------------------------------------------
//
// L9's "876 rows, sorted, name + primary muscle" contract is proven directly on `LibraryList`
// in src/ui/LibraryList.test.tsx; what is proven here is the wiring the ticket's Interfaces
// section puts in App rather than in LibraryList's own props -- tapping the Exercises tab
// actually loads the real library and shows it, plus the search box and the muscle/equipment
// filters, since LibraryList's props are just `{ library, onOpen }` with no filtering of its
// own. Per the ticket's performance note, this section renders the app once and drives it
// through the whole L10 scenario in one test rather than re-mounting per assertion, and never
// asserts an exact 876-row count (LibraryList.test.tsx already proves that).

// RULING (fix-popups, F4): this test used to assert that both "Barbell Squat" and "Zottman
// Preacher Curl" (the alphabetically first and last of the 876) were visible immediately after
// opening the tab with no search -- true when LibraryList rendered every filtered row at once,
// but neither name is in the first-10 default view F4 now requires (Zottman Preacher Curl is
// the very last of 876; Barbell Squat only surfaces after ~86-87 "Show more" taps, per
// LibraryList.test.tsx's own F4 test). A sibling of the L10 and M9 rewrites below, missed on
// the first pass and caught during the code-writer's own gate run -- same ruling, same reason.
//
// RULING (fix-the-ui-audit, O16): "Show more" is gone -- LibraryList.test.tsx's O16-O18 tests
// replace it with a Previous/Next pager. 876 rows at 10 per page is 88 pages.
test('L9 tapping the Exercises tab shows the library, with a search box, and makes Exercises the current tab', async () => {
  const user = userEvent.setup()
  render(<App />)
  await screen.findByRole('heading', { name: 'Workout A' }, SETTLE)

  await pressTab(user, 'Exercises')

  expect(await screen.findByRole('searchbox', { name: 'Search exercises' }, SETTLE)).toBeVisible()
  // O15: the search box also carries a placeholder saying what it's for, without losing its
  // accessible name (asserted above via the `name` matcher).
  expect(screen.getByPlaceholderText('Search exercises')).toBeVisible()
  // Hand-checked against the real library fixture's alphabetically (locale-aware) first name --
  // the first-10 default view F4 now requires.
  expect(await screen.findByText('3/4 Sit-Up', {}, SETTLE)).toBeVisible()
  expect(screen.getAllByRole('listitem')).toHaveLength(10)
  const pager = screen.getByRole('navigation', { name: 'Pages' })
  expect(within(pager).getByText('Page 1 of 88')).toBeVisible()
  expect(within(pager).getByRole('button', { name: 'Previous' })).toBeDisabled()
  expect(within(pager).getByRole('button', { name: 'Next' })).toBeEnabled()
  expect(currentTabNames()).toEqual(['Exercises'])
})

// RULING (fix-popups, F4): this test used to assert exact listitem counts of 36 ("lat") and 24
// (biceps + dumbbell) -- both above the 10-per-page cap LibraryList now applies, so it was
// found by inspection (not named by the operator's ticket) to break under F4 the same way L9's
// and M9's did. Rewritten to prove the filters still narrow across the whole library -- only
// the first 10 of each result render, with more reachable -- and a combination matching nothing
// still shows "No exercises match".
//
// RULING (fix-the-ui-audit, O16-O18): "Show more" is gone -- the pager's Next button reaches the
// rest of a result a page at a time (a different 10 rows, not a cumulative list), and a new
// filtered result returns the list to page 1 (O18), which is why page 2's "lat" rows are
// re-fetched after the muscle/equipment filter is applied rather than expected to carry over.
test('L10 the search box narrows by name, the muscle and equipment filters narrow further -- to their first 10 with more reachable via the pager -- and a combination matching nothing shows "No exercises match"', async () => {
  const user = userEvent.setup()
  render(<App />)
  await screen.findByRole('heading', { name: 'Workout A' }, SETTLE)
  await pressTab(user, 'Exercises')
  const search = await screen.findByRole('searchbox', { name: /search/i }, SETTLE)

  // Hand-checked against the real library fixture: 36 names contain "lat", case-insensitively --
  // above the 10-per-page cap, so only the first 10 show until Next is tapped.
  const latMatches = LIBRARY.filter((exercise) => exercise.name.toLowerCase().includes('lat'))
  expect(latMatches.length).toBeGreaterThan(10)
  await user.type(search, 'lat')
  await waitFor(() => {
    const rows = screen.getAllByRole('listitem')
    expect(rows).toHaveLength(10)
    rows.forEach((row) => {
      expect(textOf(row).toLowerCase()).toContain('lat')
    })
  }, SETTLE)
  let pager = screen.getByRole('navigation', { name: 'Pages' })
  expect(within(pager).getByText('Page 1 of 4')).toBeVisible()
  expect(within(pager).getByRole('button', { name: 'Next' })).toBeEnabled()

  await user.click(within(pager).getByRole('button', { name: 'Next' }))
  await waitFor(() => {
    const rows = screen.getAllByRole('listitem')
    expect(rows).toHaveLength(10)
    rows.forEach((row) => {
      expect(textOf(row).toLowerCase()).toContain('lat')
    })
  }, SETTLE)
  expect(
    within(screen.getByRole('navigation', { name: 'Pages' })).getByText('Page 2 of 4'),
  ).toBeVisible()

  // Clearing the search and setting muscle to biceps and equipment to dumbbell narrows to
  // exercises matching both (hand-checked: 24 in the real library fixture, by primaryMuscles),
  // also above the cap -- and changing the filter resets back to the new result's own first 10
  // (page 1), per O18.
  const bicepsDumbbellMatches = LIBRARY.filter(
    (exercise) => exercise.primaryMuscles.includes('biceps') && exercise.equipment === 'dumbbell',
  )
  expect(bicepsDumbbellMatches.length).toBeGreaterThan(10)
  await user.clear(search)
  await user.selectOptions(screen.getByRole('combobox', { name: /muscle/i }), 'biceps')
  await user.selectOptions(screen.getByRole('combobox', { name: /equipment/i }), 'dumbbell')
  await waitFor(() => {
    expect(screen.getAllByRole('listitem')).toHaveLength(10)
  }, SETTLE)
  pager = screen.getByRole('navigation', { name: 'Pages' })
  expect(within(pager).getByText('Page 1 of 3')).toBeVisible()
  expect(within(pager).getByRole('button', { name: 'Next' })).toBeEnabled()

  // Typing "lat" back in on top of those two filters matches nothing in the real library
  // fixture (hand-checked: 0), which is what "No exercises match" is for.
  await user.type(search, 'lat')
  expect(await screen.findByText('No exercises match', {}, SETTLE)).toBeVisible()
  expect(screen.queryAllByRole('listitem')).toHaveLength(0)
})

// --- E5-T8: the in-app detail overlay ([L14]) -----------------------------------------------
//
// "Exercise info" used to leave the app for a muscleandstrength.com link; now it opens the
// in-app detail screen over the current view rather than replacing it, so the set screen's own
// dial state survives the round trip. The overlay's own root and controls are scoped by
// `.exercise-detail` throughout, since the set screen underneath is never unmounted and carries
// its own heading naming the same exercise.

/** The detail overlay's own root element, or null when it is not rendered. */
function detailOverlay(): HTMLElement | null {
  return document.body.querySelector('.exercise-detail')
}

test('L14 tapping Exercise info on the deadlift set screen opens the in-app detail overlay for Barbell_Deadlift headed "Deadlift"', async () => {
  const user = userEvent.setup()
  render(<App />)
  await screen.findByRole('heading', { name: 'Workout A' }, SETTLE)
  await startWorkout(user, 'Workout B')
  await openExercise(user, 'Deadlift')
  await screen.findByRole('button', { name: 'Weight' }, SETTLE)

  await user.click(screen.getByRole('button', { name: 'Exercise info' }))

  const overlay = detailOverlay()
  expect(overlay, 'no in-app detail overlay was rendered').not.toBeNull()
  expect(within(overlay as HTMLElement).getByRole('heading', { name: 'Deadlift' })).toBeVisible()
  // Hand-checked against src/data/library/exercises.json: Barbell_Deadlift's only primary
  // muscle is lower back -- proof this is really that library entry, not just any heading.
  expect(within(overlay as HTMLElement).getByText('Primary muscle: lower back')).toBeVisible()
})

test('L14 the set screen underneath the detail overlay is not unmounted, so its dials survive the round trip', async () => {
  const user = userEvent.setup()
  render(<App />)
  await screen.findByRole('heading', { name: 'Workout A' }, SETTLE)
  await startWorkout(user, 'Workout B')
  await openExercise(user, 'Deadlift')
  await screen.findByRole('button', { name: 'Weight' }, SETTLE)
  // Nudges the dial off its preset value, so a remounted set screen would be caught below.
  await user.click(screen.getByRole('button', { name: 'Increase weight' }))
  const weightBefore = readoutValue(weightReadout())

  await user.click(screen.getByRole('button', { name: 'Exercise info' }))

  expect(detailOverlay(), 'no in-app detail overlay was rendered').not.toBeNull()
  // The set screen underneath was not unmounted: its dials are still in the document.
  expect(screen.getByRole('button', { name: 'Weight' })).toBeInTheDocument()

  // [F1, fix-popups] the overlay is a real modal popup, not content in normal document flow
  // below the set screen -- the operator's device-check defect ("the details appear in the
  // bottom instead of a dedicated popup"). Extends this existing L14 guarantee rather than
  // replacing it: the "not unmounted" assertions above are unchanged.
  const overlay = detailOverlay() as HTMLElement
  expect(overlay).toHaveAttribute('role', 'dialog')
  expect(overlay).toHaveAttribute('aria-modal', 'true')

  await user.click(within(overlay).getByRole('button', { name: 'Back' }))

  expect(detailOverlay()).toBeNull()
  expect(readoutValue(weightReadout())).toBe(weightBefore)
})

test('L14 tapping a row on the Exercises tab opens the same in-app detail overlay', async () => {
  const user = userEvent.setup()
  render(<App />)
  await screen.findByRole('heading', { name: 'Workout A' }, SETTLE)
  await pressTab(user, 'Exercises')
  const search = await screen.findByRole('searchbox', { name: /search/i }, SETTLE)
  await user.type(search, 'Barbell Squat')

  // The real library also has "Barbell Squat To A Bench", so a name-prefix match is ambiguous;
  // an exact match on the row's own name text (LibraryList's `.library-row-name`) is not.
  const squatRowName = await screen.findByText(
    'Barbell Squat',
    { selector: '.library-row-name' },
    SETTLE,
  )
  const squatRowButton = squatRowName.closest('button')
  if (!squatRowButton) throw new Error('the Barbell Squat row is not inside a button')
  await user.click(squatRowButton)

  const overlay = detailOverlay()
  expect(overlay, 'no in-app detail overlay was rendered').not.toBeNull()
  expect(
    within(overlay as HTMLElement).getByRole('heading', { name: 'Barbell Squat' }),
  ).toBeVisible()
})

test('F1 tapping a row on the Exercises tab opens the detail overlay as a modal dialog, with the Exercises tab still mounted underneath', async () => {
  const user = userEvent.setup()
  render(<App />)
  await screen.findByRole('heading', { name: 'Workout A' }, SETTLE)
  await pressTab(user, 'Exercises')
  const search = await screen.findByRole('searchbox', { name: /search/i }, SETTLE)
  await user.type(search, 'Barbell Squat')
  const squatRowName = await screen.findByText(
    'Barbell Squat',
    { selector: '.library-row-name' },
    SETTLE,
  )
  const squatRowButton = squatRowName.closest('button')
  if (!squatRowButton) throw new Error('the Barbell Squat row is not inside a button')
  await user.click(squatRowButton)

  const dialog = await screen.findByRole('dialog', { name: 'Barbell Squat' }, SETTLE)
  expect(dialog).toHaveAttribute('aria-modal', 'true')
  // The popup sits over the Exercises tab rather than replacing it: the tab's own search box
  // is still in the document underneath. Exact name, not a /search/i regex: the dialog's own
  // "Similar exercises" section composes AlternativesList, whose own search box is named
  // "Search alternatives" (src/ui/AlternativesList.tsx) and would also match the regex.
  expect(screen.getByRole('searchbox', { name: 'Search exercises' })).toBeInTheDocument()
})

// --- E5-T12: swapping an exercise mid-session ([S6], [S7]) --------------------------------
//
// seated-biceps-curls (Workout B, sets: 3, repRange: [10, 12], restSeconds: 90 in
// src/data/programs/assaf-ab-2026.json) maps to the library entry Seated_Dumbbell_Curl
// (src/data/exercises.json). Hammer_Curls is a real free-exercise-db entry, hand-checked
// against src/data/library/exercises.json: primary muscle biceps, category strength, equipment
// dumbbell -- so it ranks as an alternative to Seated_Dumbbell_Curl under `alternativesFor`
// with no gym-equipment filter, the same real domain function the list renders through.

test('S6 tapping Alternatives on the seated biceps curls set screen opens the ranked alternatives list', async () => {
  const user = userEvent.setup()
  render(<App />)
  await screen.findByRole('heading', { name: 'Workout A' }, SETTLE)
  await startWorkout(user, 'Workout B')
  await openExercise(user, 'Seated biceps curls')
  await screen.findByRole('button', { name: 'Weight' }, SETTLE)

  await user.click(screen.getByRole('button', { name: 'Alternatives' }))

  expect(await screen.findByRole('searchbox', { name: /search/i }, FAST)).toBeVisible()
  const hammerRowName = await screen.findByText(
    'Hammer Curls',
    { selector: '.alternatives-row-name' },
    FAST,
  )
  const hammerRow = hammerRowName.closest('li')
  if (!hammerRow) throw new Error('the Hammer Curls row is not inside a list item')
  expect(within(hammerRow).getByRole('button', { name: 'Do this instead' })).toBeVisible()
})

// --- F2/F3: the alternatives overlay renders as a modal popup (fix-popups) -----------------
//
// AlternativesList itself is also composed inline, browse-only, inside ExerciseDetail's own
// "Similar exercises" section (S13) -- not a popup there. It is App's own top-level overlay
// (this SetScreen "Alternatives" flow) that must carry the popup treatment, with its own "Close"
// control. Its accessible name is "Alternatives to {name}" (E6-T4's O10), so these fixtures use
// "Alternatives to Seated biceps curls", biceps curls' own plan name in Workout B.

test('F2 tapping Alternatives on a live set opens the alternatives list as a modal dialog, closable without swapping', async () => {
  const user = userEvent.setup()
  render(<App />)
  await screen.findByRole('heading', { name: 'Workout A' }, SETTLE)
  await startWorkout(user, 'Workout B')
  await openExercise(user, 'Seated biceps curls')
  await screen.findByRole('button', { name: 'Weight' }, SETTLE)

  await user.click(screen.getByRole('button', { name: 'Alternatives' }))

  const dialog = await screen.findByRole(
    'dialog',
    { name: 'Alternatives to Seated biceps curls' },
    SETTLE,
  )
  expect(dialog).toHaveAttribute('aria-modal', 'true')
  expect(within(dialog).getByRole('searchbox', { name: /search/i })).toBeVisible()

  await user.click(within(dialog).getByRole('button', { name: 'Close' }))

  await waitFor(() => {
    expect(screen.queryByRole('dialog', { name: 'Alternatives to Seated biceps curls' })).toBeNull()
  }, SETTLE)
  // The set screen underneath stays mounted, and nothing was swapped.
  expect(screen.getByRole('button', { name: 'Weight' })).toBeInTheDocument()
  expect(screen.queryByText(/instead of Seated biceps curls/)).toBeNull()
})

test('F3 the Alternatives overlay carries the shared overlay-panel class', async () => {
  const user = userEvent.setup()
  render(<App />)
  await screen.findByRole('heading', { name: 'Workout A' }, SETTLE)
  await startWorkout(user, 'Workout B')
  await openExercise(user, 'Seated biceps curls')
  await screen.findByRole('button', { name: 'Weight' }, SETTLE)

  await user.click(screen.getByRole('button', { name: 'Alternatives' }))

  const dialog = await screen.findByRole(
    'dialog',
    { name: 'Alternatives to Seated biceps curls' },
    SETTLE,
  )
  expect(dialog).toHaveClass('overlay-panel')
})

test('S7 tapping "Do this instead" on Hammer_Curls records the swap and updates the exercise list row', async () => {
  const user = userEvent.setup()
  render(<App />)
  await screen.findByRole('heading', { name: 'Workout A' }, SETTLE)
  await startWorkout(user, 'Workout B')
  await openExercise(user, 'Seated biceps curls')
  await screen.findByRole('button', { name: 'Weight' }, SETTLE)

  await user.click(screen.getByRole('button', { name: 'Alternatives' }))
  const hammerRowName = await screen.findByText(
    'Hammer Curls',
    { selector: '.alternatives-row-name' },
    FAST,
  )
  const hammerRow = hammerRowName.closest('li')
  if (!hammerRow) throw new Error('the Hammer Curls row is not inside a list item')
  await user.click(within(hammerRow).getByRole('button', { name: 'Do this instead' }))

  // The done exercise carries the planned sets, rep range and rest -- seated-biceps-curls'
  // own plan (sets: 3, repRange: [10, 12], restSeconds: 90).
  const swappedRow = await screen.findByRole(
    'button',
    { name: /^Hammer Curls, instead of Seated biceps curls, 3 sets, 10-12 reps, 90s rest/ },
    SETTLE,
  )
  expect(swappedRow).toBeVisible()
})

test('S7 opening the swapped row shows a set screen for Hammer_Curls prefilled with no history as 0 kg and the bottom of the rep range', async () => {
  const user = userEvent.setup()
  render(<App />)
  await screen.findByRole('heading', { name: 'Workout A' }, SETTLE)
  await startWorkout(user, 'Workout B')
  await openExercise(user, 'Seated biceps curls')
  await screen.findByRole('button', { name: 'Weight' }, SETTLE)

  await user.click(screen.getByRole('button', { name: 'Alternatives' }))
  const hammerRowName = await screen.findByText(
    'Hammer Curls',
    { selector: '.alternatives-row-name' },
    FAST,
  )
  const hammerRow = hammerRowName.closest('li')
  if (!hammerRow) throw new Error('the Hammer Curls row is not inside a list item')
  await user.click(within(hammerRow).getByRole('button', { name: 'Do this instead' }))

  const swappedRow = await screen.findByRole(
    'button',
    { name: /^Hammer Curls, instead of Seated biceps curls, 3 sets, 10-12 reps, 90s rest/ },
    SETTLE,
  )
  await user.click(swappedRow)

  expect(await screen.findByRole('heading', { name: 'Hammer Curls' }, SETTLE)).toBeVisible()
  await screen.findByRole('button', { name: 'Weight' }, SETTLE)
  // Hammer_Curls has no logged history of its own yet: `trainingFieldsFor`'s dumbbell
  // startWeight (0, hand-checked against src/domain/trainingFields.ts) and the bottom of
  // seated-biceps-curls' own repRange ([10, 12]).
  expect(readoutValue(weightReadout())).toBe('0')
  expect(readoutValue(repsReadout())).toBe('10')
})

// --- E5-T14: a swap is honest for the rest of the session ([S8], [S9]) and one tap away next
// time ([S10]) -----------------------------------------------------------------------------
//
// The same seated-biceps-curls -> Hammer_Curls swap as E5-T12's, in Workout B, which is the
// workout that plans seated-biceps-curls (sets: 3, repRange: [10, 12], restSeconds: 90).

/** The swapped row's accessible name, as E5-T12 already renders it. */
const HAMMER_ROW = /^Hammer Curls, instead of Seated biceps curls, 3 sets, 10-12 reps, 90s rest/

/**
 * From seated-biceps-curls' set screen: opens Alternatives, taps "Do this instead" on Hammer
 * Curls, and waits for the exercise list to show the swapped row.
 */
async function swapSeatedCurlsForHammerCurls(user: UserEvent): Promise<HTMLElement> {
  await user.click(screen.getByRole('button', { name: 'Alternatives' }))
  const hammerRowName = await screen.findByText(
    'Hammer Curls',
    { selector: '.alternatives-row-name' },
    SETTLE,
  )
  const hammerRow = hammerRowName.closest('li')
  if (!hammerRow) throw new Error('the Hammer Curls row is not inside a list item')
  await user.click(within(hammerRow).getByRole('button', { name: 'Do this instead' }))
  return screen.findByRole('button', { name: HAMMER_ROW }, SETTLE)
}

/**
 * Starts Workout B, logs 2 of seated-biceps-curls' 3 sets, then swaps it for Hammer_Curls,
 * which leaves the app on the exercise list with the swapped row showing.
 */
async function logTwoSeatedCurlsThenSwap(user: UserEvent): Promise<HTMLElement> {
  await screen.findByRole('heading', { name: 'Workout A' }, SETTLE)
  await startWorkout(user, 'Workout B')
  await openExercise(user, 'Seated biceps curls')
  await logSetAndOpen(user, 2, 3)
  await logSetAndOpen(user, 3, 3)
  return swapSeatedCurlsForHammerCurls(user)
}

/** Opens the swapped row and logs Hammer_Curls' first set, staying on its set screen. */
async function logFirstHammerCurlsSet(user: UserEvent): Promise<void> {
  await user.click(await screen.findByRole('button', { name: HAMMER_ROW }, SETTLE))
  await screen.findByRole('heading', { name: 'Hammer Curls' }, SETTLE)
  await screen.findByText('Set 1 of 3', undefined, SETTLE)
  await logSetAndOpen(user, 2, 3)
}

test('S8 the exercise list offers Undo swap after the swap while no Hammer_Curls set is logged', async () => {
  const user = userEvent.setup()
  render(<App />)
  await logTwoSeatedCurlsThenSwap(user)

  expect(await screen.findByRole('button', { name: 'Undo swap' }, SETTLE)).toBeVisible()
})

test('S8 tapping Undo swap brings back the seated biceps curls row with its 2 logged sets', async () => {
  const user = userEvent.setup()
  render(<App />)
  await logTwoSeatedCurlsThenSwap(user)

  await user.click(await screen.findByRole('button', { name: 'Undo swap' }, SETTLE))

  const seatedCurls = await screen.findByRole('button', { name: /^Seated biceps curls/ }, SETTLE)
  expect(progressOf(seatedCurls)).toBe('2/3')
  expect(screen.queryByRole('button', { name: HAMMER_ROW })).toBeNull()
})

test('S8 tapping Undo swap removes the swap from the stored session', async () => {
  const user = userEvent.setup()
  render(<App />)
  await logTwoSeatedCurlsThenSwap(user)

  await user.click(await screen.findByRole('button', { name: 'Undo swap' }, SETTLE))
  await screen.findByRole('button', { name: /^Seated biceps curls/ }, SETTLE)

  await waitFor(async () => {
    const session = await getActiveSession()
    expect(session?.swaps?.['seated-biceps-curls']).toBeUndefined()
  }, SETTLE)
})

test('S8 once the first Hammer_Curls set is logged under it, Undo swap is no longer offered', async () => {
  const user = userEvent.setup()
  render(<App />)
  await logTwoSeatedCurlsThenSwap(user)
  // Offered first, so its absence below is the withdrawal and not a control that never was.
  expect(await screen.findByRole('button', { name: 'Undo swap' }, SETTLE)).toBeVisible()

  await logFirstHammerCurlsSet(user)
  await user.click(screen.getByRole('button', { name: 'Back' }))

  expect(await screen.findByRole('button', { name: HAMMER_ROW }, SETTLE)).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Undo swap' })).toBeNull()
  // The 2 sets from before the swap stay under the planned exercise; the one after it is the
  // done exercise's own first set.
  const entries = await activeSessionEntries()
  expect(entries.map((logged) => [logged.exerciseId, logged.setIndex])).toEqual([
    ['seated-biceps-curls', 1],
    ['seated-biceps-curls', 2],
    ['Hammer_Curls', 1],
  ])
})

/** Swaps seated-biceps-curls for Hammer_Curls in Workout B, then closes the app. */
async function swapThenCloseTheApp(user: UserEvent): Promise<void> {
  const run = render(<App />)
  await logTwoSeatedCurlsThenSwap(user)
  run.unmount()
  db.close()
  await db.open()
}

test('S9 reopening the app resumes the session with the swap still applied and still undoable', async () => {
  const user = userEvent.setup()
  await swapThenCloseTheApp(user)

  render(<App />)

  // The swap itself is what E5-T11/E5-T12 already persist; what reopening must also keep is
  // the swap's standing as undoable, since no Hammer_Curls set has been logged yet.
  expect(await screen.findByRole('button', { name: HAMMER_ROW }, SETTLE)).toBeVisible()
  expect(screen.queryByRole('button', { name: /^Seated biceps curls/ })).toBeNull()
  expect(await screen.findByRole('button', { name: 'Undo swap' }, SETTLE)).toBeVisible()
})

/**
 * Stores one finished Workout B session in which seated-biceps-curls was swapped for
 * Hammer_Curls and one Hammer_Curls set was logged -- the "last time" S10 starts from.
 */
async function finishWorkoutBWithHammerCurlsSwap(): Promise<void> {
  const last = await startOrResumeSession('assaf-ab-2026', 'workout-b', BASE)
  await setSwap(last.id, 'seated-biceps-curls', 'Hammer_Curls')
  await logSet(last.id, {
    exerciseId: 'Hammer_Curls',
    setIndex: 1,
    weightKg: 12,
    reps: 10,
    loggedAt: BASE + 60_000,
  })
  await finishSession(last.id, BASE + 3_600_000)
}

test('S10 starting Workout B again shows the seated biceps curls row with a Last time: Hammer Curls button', async () => {
  await finishWorkoutBWithHammerCurlsSwap()
  const user = userEvent.setup()
  render(<App />)
  await screen.findByRole('heading', { name: 'Workout A' }, SETTLE)

  await startWorkout(user, 'Workout B')

  expect(await screen.findByRole('button', { name: /^Seated biceps curls/ }, SETTLE)).toBeVisible()
  expect(
    await screen.findByRole('button', { name: 'Last time: Hammer Curls' }, SETTLE),
  ).toBeVisible()
  expect(screen.queryByRole('button', { name: HAMMER_ROW })).toBeNull()
})

test('S10 tapping Last time: Hammer Curls applies the same swap to the exercise list row', async () => {
  await finishWorkoutBWithHammerCurlsSwap()
  const user = userEvent.setup()
  render(<App />)
  await screen.findByRole('heading', { name: 'Workout A' }, SETTLE)
  await startWorkout(user, 'Workout B')

  await user.click(await screen.findByRole('button', { name: 'Last time: Hammer Curls' }, SETTLE))

  expect(await screen.findByRole('button', { name: HAMMER_ROW }, SETTLE)).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Last time: Hammer Curls' })).toBeNull()
})

test('S10 tapping Last time: Hammer Curls records the swap on the new session', async () => {
  await finishWorkoutBWithHammerCurlsSwap()
  const user = userEvent.setup()
  render(<App />)
  await screen.findByRole('heading', { name: 'Workout A' }, SETTLE)
  await startWorkout(user, 'Workout B')

  await user.click(await screen.findByRole('button', { name: 'Last time: Hammer Curls' }, SETTLE))
  await screen.findByRole('button', { name: HAMMER_ROW }, SETTLE)

  await waitFor(async () => {
    const session = await getActiveSession()
    expect(session?.finishedAt).toBeNull()
    expect(session?.swaps).toEqual({ 'seated-biceps-curls': 'Hammer_Curls' })
  }, SETTLE)
})

// --- E5-T16: the gym's equipment ([S14], [S15]) ---------------------------------------------
//
// Every distinct `equipment` value in the real library fixture, excluding `null` (no equipment
// needed, so never excludable) and `body only` (already always allowed -- see
// `alternativesFor`'s own `passesEquipment` rule) -- hand-checked against
// src/data/library/exercises.json, the same source L9/L10 above use directly.
const EQUIPMENT_TYPES = Array.from(new Set(LIBRARY.map((exercise) => exercise.equipment)))
  .filter((equipment): equipment is string => equipment !== null && equipment !== 'body only')
  .sort((a, b) => a.localeCompare(b))

// Hand-checked against src/data/library/exercises.json: Ab_Crunch_Machine is named "Ab Crunch
// Machine", its `equipment` is 'machine', and no other entry shares that name.
const MACHINE_EXERCISE_NAME = 'Ab Crunch Machine'

test('S14 opening Settings with no saved gym equipment lists every library equipment type except body only, all ticked', async () => {
  const user = userEvent.setup()
  render(<App />)
  await screen.findByRole('heading', { name: 'Workout A' }, SETTLE)

  await openSettings(user)

  for (const equipment of EQUIPMENT_TYPES) {
    expect(await screen.findByRole('checkbox', { name: equipment }, SETTLE)).toBeChecked()
  }
  expect(screen.queryByRole('checkbox', { name: 'body only' })).toBeNull()
})

test('S14 unticking machine in Settings persists across a reload', async () => {
  const user = userEvent.setup()
  const run = render(<App />)
  await screen.findByRole('heading', { name: 'Workout A' }, SETTLE)
  await openSettings(user)

  await user.click(await screen.findByRole('checkbox', { name: 'machine' }, SETTLE))
  await waitFor(async () => {
    expect(await getGymEquipment()).not.toBeNull()
  }, SETTLE)

  // A reload: the tree is unmounted and the database is shut, so nothing but storage crosses
  // into the next render -- the same close/reopen App.test.tsx uses for O13's session survival.
  run.unmount()
  db.close()
  await db.open()

  render(<App />)
  await screen.findByRole('heading', { name: 'Workout A' }, SETTLE)
  await openSettings(user)

  expect(await screen.findByRole('checkbox', { name: 'machine' }, SETTLE)).not.toBeChecked()
  expect(screen.getByRole('checkbox', { name: 'barbell' })).toBeChecked()
})

test('S15 with machine unticked, the Exercises tab opens with the My gym only chip on and no machine exercises listed', async () => {
  await setGymEquipment(EQUIPMENT_TYPES.filter((equipment) => equipment !== 'machine'))
  const user = userEvent.setup()
  render(<App />)
  await screen.findByRole('heading', { name: 'Workout A' }, SETTLE)

  await pressTab(user, 'Exercises')
  const search = await screen.findByRole('searchbox', { name: /search/i }, SETTLE)

  expect(
    await screen.findByRole('button', { name: 'My gym only', pressed: true }, SETTLE),
  ).toBeVisible()

  await user.type(search, MACHINE_EXERCISE_NAME)

  expect(await screen.findByText('No exercises match', {}, SETTLE)).toBeVisible()
  expect(screen.queryByText(MACHINE_EXERCISE_NAME)).toBeNull()
})

test('S15 turning the My gym only chip off lists machine exercises again', async () => {
  await setGymEquipment(EQUIPMENT_TYPES.filter((equipment) => equipment !== 'machine'))
  const user = userEvent.setup()
  render(<App />)
  await screen.findByRole('heading', { name: 'Workout A' }, SETTLE)
  await pressTab(user, 'Exercises')
  const search = await screen.findByRole('searchbox', { name: /search/i }, SETTLE)
  await user.type(search, MACHINE_EXERCISE_NAME)
  await screen.findByText('No exercises match', {}, SETTLE)

  await user.click(screen.getByRole('button', { name: 'My gym only' }))

  expect(await screen.findByText(MACHINE_EXERCISE_NAME, {}, SETTLE)).toBeVisible()
})

// --- E5-T18: planning moves to a Program tab ([M11], [M12], [M13]) -------------------------
//
// M11 (the tab bar itself, in order) is proven at the TabBar/AppShell level in
// src/ui/AppShell.test.tsx; the O7 test above proves it end to end through App. M13's own
// content (the workout cards, their rest lines and their per-workout body maps, and the
// program switcher) is proven directly on the real ProgramPage in src/ui/ProgramPage.test.tsx
// (moved from src/ui/ProgramPicker.test.tsx); what is proven here is the wiring -- the Program
// tab actually reaches it -- and M12's own claim, that the Workout tab now shows only the
// active program's start buttons.

test('M12 the Workout tab shows none of its workouts’ exercise plan details, only the start buttons', async () => {
  render(<App />)
  await screen.findByRole('heading', { name: 'Workout A' }, SETTLE)

  expect(screen.getByRole('button', { name: 'Start Workout A' })).toBeVisible()
  expect(screen.getByRole('button', { name: 'Start Workout B' })).toBeVisible()
  // Hand-checked against src/data/programs/assaf-ab-2026.json: Workout A's first exercise line,
  // as ProgramPicker (E1-T2) used to render it directly on this tab.
  expect(screen.queryByText('Back squat 8-10 x 4')).toBeNull()
})

test('M12 the Workout tab offers no way to see or start another program’s workouts', async () => {
  render(<App />)
  await screen.findByRole('heading', { name: 'Workout A' }, SETTLE)

  expect(screen.queryByRole('button', { name: /Other programs/ })).toBeNull()
  expect(screen.queryByText('Full body starter')).toBeNull()
})

test('M13 tapping the Program tab shows the active program’s name and makes Program the current tab', async () => {
  const user = userEvent.setup()
  render(<App />)
  await screen.findByRole('heading', { name: 'Workout A' }, SETTLE)

  await pressTab(user, 'Program')

  expect(await screen.findByRole('heading', { name: 'Assaf A/B 2026' }, SETTLE)).toBeVisible()
  expect(currentTabNames()).toEqual(['Program'])
})

test('M13 choosing another program in the Program tab’s switcher makes it the active program', async () => {
  const user = userEvent.setup()
  render(<App />)
  await screen.findByRole('heading', { name: 'Workout A' }, SETTLE)

  await pressTab(user, 'Program')
  await user.click(await screen.findByRole('radio', { name: 'Full body starter' }, SETTLE))

  // The Program tab itself now leads with the chosen program...
  expect(await screen.findByRole('heading', { name: 'Full body starter' }, SETTLE)).toBeVisible()
  expect(screen.getByRole('radio', { name: 'Full body starter' })).toBeChecked()
  // ...and so does the Workout tab: hand-checked against full-body-starter.json, whose one
  // workout is "Full body".
  await pressTab(user, 'Workout')
  expect(await screen.findByRole('button', { name: 'Start Full body' }, SETTLE)).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Start Workout A' })).toBeNull()
})

// --- E5-T20: the session summary ([M16]) and the region panel ([M9]) --------------------------
//
// Finish now shows the finished session's summary -- a `role="dialog"` named "Session summary"
// holding its body map on the session scale -- over the picker, and "Done" closes it. A History
// row's "Open session" button shows the same summary for a finished session. Tapping a region
// on a summary's map opens `RegionPanel` (a dialog named by the region id); its "Browse
// exercises" closes both and lands on the Exercises tab listing only exercises primary in the
// region's muscles.
//
// Hand-checked against src/data/exercises.json and the real library fixture:
//   back-squat -> Barbell_Squat: quadriceps primary; calves, glutes, hamstrings, lower back
//   secondary. Three sets: quadriceps 3 (session band 2), hamstring 1.5 (band 1), chest 0.
//
//   Workout B: assisted-pull-ups -> lats primary, middle back secondary;
//   deadlift -> lats and middle back both secondary; face-pull -> middle back secondary.
//   Two pull-up sets, two deadlift sets, one face pull set: lats 2 + 1 = 3, middle back
//   1 + 1 + 0.5 = 2.5, so upper-back 5.5; contributors Assisted pull-ups 3, Deadlift 2,
//   Face pull 0.5.

function sessionSummary(): HTMLElement | null {
  return screen.queryByRole('dialog', { name: 'Session summary' })
}

/** region -> data-band for every region shape the summary draws. */
function summaryBands(summary: HTMLElement): Record<string, string | null> {
  const bands: Record<string, string | null> = {}
  for (const shape of summary.querySelectorAll('[data-region]')) {
    bands[shape.getAttribute('data-region') as string] = shape.getAttribute('data-band')
  }
  return bands
}

function expectSummaryBand(summary: HTMLElement, region: string, band: string): void {
  const shapes = [...summary.querySelectorAll(`[data-region="${region}"]`)]
  expect(shapes.length, `${region} must be drawn on the summary`).toBeGreaterThan(0)
  for (const shape of shapes) {
    expect(shape, region).toHaveAttribute('data-band', band)
  }
}

/** Leaves three back squat sets in a Workout A session still in progress. */
async function threeBackSquatSetsInProgress(): Promise<void> {
  // Stamped against the real clock, not BASE: App's launch finishes a Session whose last Set
  // is 4 h or more old (E8-T6), and this one has to still be in progress.
  const startedAt = Date.now() - 60_000
  const started = await startOrResumeSession('assaf-ab-2026', 'workout-a', startedAt)
  for (const setIndex of [1, 2, 3]) {
    await logSet(started.id, {
      exerciseId: 'back-squat',
      setIndex,
      weightKg: 60,
      reps: 10,
      loggedAt: startedAt + setIndex,
    })
  }
}

/** Stores one finished Workout B session training upper-back as the header above works out. */
async function finishedUpperBackSession(): Promise<void> {
  const started = await startOrResumeSession('assaf-ab-2026', 'workout-b', BASE)
  const entries: SetEntry[] = [
    { exerciseId: 'assisted-pull-ups', setIndex: 1, weightKg: 20, reps: 8, loggedAt: BASE + 1 },
    { exerciseId: 'assisted-pull-ups', setIndex: 2, weightKg: 20, reps: 8, loggedAt: BASE + 2 },
    { exerciseId: 'deadlift', setIndex: 1, weightKg: 80, reps: 8, loggedAt: BASE + 3 },
    { exerciseId: 'deadlift', setIndex: 2, weightKg: 80, reps: 8, loggedAt: BASE + 4 },
    { exerciseId: 'face-pull', setIndex: 1, weightKg: 15, reps: 12, loggedAt: BASE + 5 },
  ]
  for (const entry of entries) await logSet(started.id, entry)
  await finishSession(started.id, BASE + 3_600_000)
}

/** Opens the only History row's session summary. */
async function openOnlyHistorySession(user: UserEvent): Promise<HTMLElement> {
  await pressTab(user, 'History')
  const row = await screen.findByRole('listitem', {}, SETTLE)
  await user.click(within(row).getByRole('button', { name: 'Open session' }))
  return screen.findByRole('dialog', { name: 'Session summary' }, SETTLE)
}

/** Taps `region` on `summary`'s map and returns the region panel it opens. */
async function tapSummaryRegion(
  user: UserEvent,
  summary: HTMLElement,
  region: string,
): Promise<HTMLElement> {
  const shape = summary.querySelector(`[data-region="${region}"]`)
  expect(shape, `${region} must be drawn on the summary`).not.toBeNull()
  await user.click(shape as Element)
  return screen.findByRole('dialog', { name: region }, SETTLE)
}

test('M16 tapping Finish workout shows the session summary with its body map on the session scale', async () => {
  const user = userEvent.setup()
  await threeBackSquatSetsInProgress()
  render(<App />)
  await screen.findByRole('button', { name: /^Back squat/ }, SETTLE)

  await user.click(screen.getByRole('button', { name: 'Finish workout' }))

  const summary = await screen.findByRole('dialog', { name: 'Session summary' }, SETTLE)
  // On the week scale, 3 would be band 1; band 2 is what pins the session scale.
  expectSummaryBand(summary, 'quadriceps', '2')
  expectSummaryBand(summary, 'hamstring', '1')
  expectSummaryBand(summary, 'chest', '0')
})

test('F2 the Finish workout session summary is an aria-modal dialog', async () => {
  const user = userEvent.setup()
  await threeBackSquatSetsInProgress()
  render(<App />)
  await screen.findByRole('button', { name: /^Back squat/ }, SETTLE)

  await user.click(screen.getByRole('button', { name: 'Finish workout' }))

  const summary = await screen.findByRole('dialog', { name: 'Session summary' }, SETTLE)
  expect(summary).toHaveAttribute('aria-modal', 'true')
})

test('M16 Done on the finish summary closes it onto the picker with the session finished', async () => {
  const user = userEvent.setup()
  await threeBackSquatSetsInProgress()
  render(<App />)
  await screen.findByRole('button', { name: /^Back squat/ }, SETTLE)
  await user.click(screen.getByRole('button', { name: 'Finish workout' }))
  const summary = await screen.findByRole('dialog', { name: 'Session summary' }, SETTLE)

  await user.click(within(summary).getByRole('button', { name: 'Done' }))

  await waitFor(() => {
    expect(sessionSummary()).toBeNull()
  }, SETTLE)
  expect(screen.getByRole('button', { name: 'Start Workout A' })).toBeVisible()
  expect(await getActiveSession()).toBeNull()
})

test('M16 opening the finished session from History shows the same body map the finish summary showed', async () => {
  const user = userEvent.setup()
  await threeBackSquatSetsInProgress()
  render(<App />)
  await screen.findByRole('button', { name: /^Back squat/ }, SETTLE)
  await user.click(screen.getByRole('button', { name: 'Finish workout' }))
  const atFinish = await screen.findByRole('dialog', { name: 'Session summary' }, SETTLE)
  const finishBands = summaryBands(atFinish)
  expect(Object.keys(finishBands).length).toBeGreaterThan(0)
  await user.click(within(atFinish).getByRole('button', { name: 'Done' }))
  await waitFor(() => {
    expect(sessionSummary()).toBeNull()
  }, SETTLE)

  const fromHistory = await openOnlyHistorySession(user)

  expectSummaryBand(fromHistory, 'quadriceps', '2')
  expect(summaryBands(fromHistory)).toEqual(finishBands)
})

test('M9 tapping upper-back on a History session’s map opens a panel with its 5.5 sets and contributors', async () => {
  const user = userEvent.setup()
  await finishedUpperBackSession()
  render(<App />)
  await screen.findByRole('heading', { name: 'Workout A' }, SETTLE)
  const summary = await openOnlyHistorySession(user)

  const panel = await tapSummaryRegion(user, summary, 'upper-back')

  const count = within(panel)
    .getAllByText('5.5 sets')
    .filter((element) => element.closest('li') === null)
  expect(count).toHaveLength(1)
  const items = within(panel).getAllByRole('listitem')
  expect(items).toHaveLength(3)
  const byName = (name: string) => items.find((item) => within(item).queryByText(name) !== null)
  expect(within(byName('Assisted pull-ups')!).getByText('3 sets')).toBeVisible()
  expect(within(byName('Deadlift')!).getByText('2 sets')).toBeVisible()
  expect(within(byName('Face pull')!).getByText('0.5 sets')).toBeVisible()
})

// RULING (fix-popups, F4): this test used to assert exactly 72 listitems, rendering every
// lats-or-middle-back exercise at once -- above the 10-per-page cap. Rewritten to the first 10
// (still only lats/middle back), then "Show more" tapped through to all 72 and the button
// disappearing -- named by the operator's ticket as one of F4's authorised rewrites.
//
// RULING (fix-the-ui-audit, O16-O18): "Show more" is gone -- paged through with the pager's Next
// button instead, one page (10 rows, the last page 2) at a time, to the last of 8 pages.
test('M9 Browse exercises on upper-back opens the Exercises tab listing only lats or middle back exercises, first 10 with the pager reaching all 72', async () => {
  const user = userEvent.setup()
  await finishedUpperBackSession()
  render(<App />)
  await screen.findByRole('heading', { name: 'Workout A' }, SETTLE)
  const summary = await openOnlyHistorySession(user)
  const panel = await tapSummaryRegion(user, summary, 'upper-back')

  await user.click(within(panel).getByRole('button', { name: 'Browse exercises' }))

  // Hand-checked against the real library fixture: 38 exercises are lats primary and 34 middle
  // back primary, 72 in all -- above the 10-per-page cap -- and every one of them lists lats or
  // middle back first.
  const upperBack = LIBRARY.filter(
    (exercise) =>
      exercise.primaryMuscles.includes('lats') || exercise.primaryMuscles.includes('middle back'),
  )
  expect(upperBack).toHaveLength(72)
  await waitFor(() => {
    expect(currentTabNames()).toEqual(['Exercises'])
    expect(screen.getAllByRole('listitem')).toHaveLength(10)
  }, SETTLE)
  expect(sessionSummary()).toBeNull()
  expect(screen.queryByRole('dialog', { name: 'upper-back' })).toBeNull()
  expect(screen.queryByText('Barbell Bench Press - Medium Grip')).toBeNull()

  // Paging through with Next reaches all 72, 10 at a time, over 8 pages -- the 8th holding the
  // remaining 2 -- then Next disables. Each page's rows are collected rather than re-read after
  // the last page, since the pager (unlike "Show more") replaces the visible rows per page
  // instead of accumulating them.
  const seenNames: string[] = []
  const seenMuscles = new Set<string>()
  const recordCurrentPage = () => {
    for (const row of screen.getAllByRole('listitem')) {
      seenNames.push((row.querySelector('.library-row-name')?.textContent ?? '').trim())
      seenMuscles.add((row.querySelector('.library-row-muscle')?.textContent ?? '').trim())
    }
  }
  recordCurrentPage()
  let pager = screen.getByRole('navigation', { name: 'Pages' })
  expect(within(pager).getByText('Page 1 of 8')).toBeVisible()

  for (let page = 2; page <= 8; page += 1) {
    await user.click(within(pager).getByRole('button', { name: 'Next' }))
    const expectedCount = page < 8 ? 10 : 2
    await waitFor(() => {
      expect(screen.getAllByRole('listitem')).toHaveLength(expectedCount)
    }, SETTLE)
    pager = screen.getByRole('navigation', { name: 'Pages' })
    expect(within(pager).getByText(`Page ${page} of 8`)).toBeVisible()
    recordCurrentPage()
  }
  expect(within(pager).getByRole('button', { name: 'Next' })).toBeDisabled()

  expect(seenNames).toHaveLength(72)
  expect([...seenMuscles].sort()).toEqual(['lats', 'middle back'])
  expect(screen.queryByText('Barbell Bench Press - Medium Grip')).toBeNull()
}, 20000)

// --- E5-T20: App wires the logged sessions into the Program tab's "This week" --------------
//
// ProgramPage (E5-T19) takes `sessions`, `now` and `resolve`, defaulting to no sessions; these
// prove App hands it the real ones. Band values are ProgramPage.test.tsx's business -- here
// only whether logged sets reach the done map at all.

/** Stores one finished Workout A session of three back squat sets, logged at `loggedAt`. */
async function finishedBackSquatSessionAt(loggedAt: number): Promise<void> {
  const started = await startOrResumeSession('assaf-ab-2026', 'workout-a', loggedAt - 60_000)
  for (const setIndex of [1, 2, 3]) {
    await logSet(started.id, {
      exerciseId: 'back-squat',
      setIndex,
      weightKg: 60,
      reps: 10,
      loggedAt: loggedAt + setIndex,
    })
  }
  await finishSession(started.id, loggedAt + 60_000)
}

/** The Program tab's "This week" section. */
function thisWeekSection(): HTMLElement {
  const heading = screen.getByRole('heading', { name: 'This week' })
  return heading.closest('section') as HTMLElement
}

test('the Program tab’s This week reflects sets actually logged in the last 7 days', async () => {
  const user = userEvent.setup()
  await finishedBackSquatSessionAt(Date.now() - DAY_MS)
  render(<App />)
  await screen.findByRole('heading', { name: 'Workout A' }, SETTLE)

  await pressTab(user, 'Program')
  await screen.findByRole('heading', { name: 'This week' }, SETTLE)

  // The done map is the section's second body map (the first is the prescribed one).
  await waitFor(() => {
    const maps = thisWeekSection().querySelectorAll('.body-map')
    expect(maps).toHaveLength(2)
    const doneQuadriceps = maps[1].querySelector('[data-region="quadriceps"]')
    expect(doneQuadriceps).not.toBeNull()
    expect(doneQuadriceps).not.toHaveAttribute('data-band', '0')
    expect(within(thisWeekSection()).queryByText('No sets logged in the last 7 days')).toBeNull()
  }, SETTLE)
})

test('with nothing logged in the last 7 days the Program tab’s This week still reads No sets logged in the last 7 days', async () => {
  const user = userEvent.setup()
  // Logged, but eight days ago: outside the window, so it must not count as this week.
  await finishedBackSquatSessionAt(Date.now() - 8 * DAY_MS)
  render(<App />)
  await screen.findByRole('heading', { name: 'Workout A' }, SETTLE)

  await pressTab(user, 'Program')
  await screen.findByRole('heading', { name: 'This week' }, SETTLE)

  expect(
    within(thisWeekSection()).getByText('No sets logged in the last 7 days'),
  ).toBeVisible()
})

// --- E7-T8: sync runs by itself, and import replaces the server ---------------------------
//
// App calls `useSync()` with no deps, so the network is faked at `fetch` itself. Everything
// under it -- the hook, syncClient and the Dexie db -- is real.

describe('E7-T8', () => {
  let server: FakeSyncServer

  beforeEach(async () => {
    await db.sessions.clear()
    await db.settings.clear()
    // The trainee's Program (E9-T2), stamped older than any server-seeded setting (BASE), so a
    // pulled activeProgramId still wins over it.
    await db.settings.put({ key: 'activeProgramId', value: 'assaf-ab-2026', updatedAt: BASE - 1 })
    server = new FakeSyncServer()
    vi.stubGlobal('fetch', server.fetch)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  /** Waits until the fake server has answered `atLeast` requests and holds none in flight. */
  async function serverSettled(atLeast: number): Promise<void> {
    await waitFor(() => {
      expect(server.completed).toBeGreaterThanOrEqual(atLeast)
      expect(server.pending).toBe(0)
    }, SETTLE)
  }

  function remoteSession(id: string, updatedAt: number): SyncedSession {
    return {
      id,
      programId: 'assaf-ab-2026',
      workoutId: 'workout-a',
      startedAt: BASE,
      finishedAt: BASE + 3_600_000,
      entries: [
        { exerciseId: 'back-squat', setIndex: 1, weightKg: 60, reps: 10, loggedAt: BASE + 60_000 },
      ],
      updatedAt,
    }
  }

  const importedIds = IMPORTED.map((s) => s.id).sort()

  /** From a started app with CURRENT pushed: chooses the IMPORTED backup and confirms it. */
  async function importAndConfirm(user: UserEvent): Promise<void> {
    await openSettings(user)
    await chooseBackupFile(user, importedBackupText())
    await screen.findByRole('alertdialog', {}, SETTLE)
    await user.click(screen.getByRole('button', { name: 'Import' }))
  }

  // --- O13: on start ------------------------------------------------------------------------

  test('O13 starting the app runs a sync that pushes the logged sessions to the server', async () => {
    await db.sessions.bulkPut(CURRENT)

    render(<App />)

    await waitFor(() => {
      expect(server.sessionsOf('a@x').map((s) => s.id)).toEqual(CURRENT.map((s) => s.id).sort())
    }, SETTLE)
    await serverSettled(2)
  })

  test('O13 after the start sync, Settings shows the account the phone syncs to and a sync time', async () => {
    const user = userEvent.setup()
    render(<App />)
    await serverSettled(2)

    await openSettings(user)

    expect(await screen.findByText('a@x', undefined, SETTLE)).toBeVisible()
    expect(screen.queryByText('Never synced')).toBeNull()
  })

  test('O13 a start sync that pulls the active program shows it on the picker without a restart', async () => {
    server.seedSetting('a@x', { key: 'activeProgramId', value: 'full-body-starter', updatedAt: BASE })

    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Full body starter' }, SETTLE)).toBeVisible()
    await serverSettled(2)
  })

  // --- O13: after a finished session ----------------------------------------------------------

  test('O13 finishing a session runs a sync that pushes the finished session', async () => {
    const user = userEvent.setup()
    render(<App />)
    await serverSettled(2)
    await startWorkout(user, 'Workout A')

    await user.click(await screen.findByRole('button', { name: 'Finish workout' }, SETTLE))

    await waitFor(() => {
      const pushed = server.sessionsOf('a@x')
      expect(pushed).toHaveLength(1)
      expect(typeof pushed[0].finishedAt).toBe('number')
    }, SETTLE)
    await serverSettled(4)
  })

  test('O13 finishing returns to the picker while the sync it started is still in flight', async () => {
    const user = userEvent.setup()
    render(<App />)
    await serverSettled(2)
    await startWorkout(user, 'Workout A')
    const release = server.hold('/api/me')

    await user.click(await screen.findByRole('button', { name: 'Finish workout' }, SETTLE))

    expect(await screen.findByRole('button', { name: 'Start Workout A' }, SETTLE)).toBeVisible()
    // The held request cannot finish before release, so the picker showing alongside it is
    // the proof that finishing did not wait on the sync.
    await waitFor(() => {
      expect(server.pending).toBe(1)
    }, SETTLE)
    expect(screen.getByRole('button', { name: 'Start Workout A' })).toBeVisible()
    release()
    await serverSettled(4)
  })

  test('O13 logging a set is stored while the start sync is still in flight', async () => {
    const user = userEvent.setup()
    const release = server.hold('/api/me')
    render(<App />)
    await startWorkout(user, 'Workout A')
    await openExercise(user, 'Back squat')

    await user.click(screen.getByRole('button', { name: 'Log set' }))

    await waitFor(async () => {
      expect(await activeSessionEntries()).toHaveLength(1)
    }, SETTLE)
    expect(server.pending).toBe(1)
    release()
    await serverSettled(2)
  })

  // --- O13: when the browser comes back online ------------------------------------------------

  test('O13 the browser firing online runs another sync', async () => {
    render(<App />)
    await serverSettled(2)

    act(() => {
      window.dispatchEvent(new Event('online'))
    })

    await waitFor(() => {
      expect(server.requestsTo('/api/sync')).toHaveLength(2)
    }, SETTLE)
    await serverSettled(4)
  })

  // --- O13: Sync now and adopt, from Settings -------------------------------------------------

  test('O13 pressing Sync now in Settings runs a sync', async () => {
    const user = userEvent.setup()
    render(<App />)
    await serverSettled(2)
    await openSettings(user)

    await user.click(await screen.findByRole('button', { name: 'Sync now' }, SETTLE))

    await waitFor(() => {
      expect(server.requestsTo('/api/sync')).toHaveLength(2)
    }, SETTLE)
    await serverSettled(4)
  })

  test('O13 an offline start sync shows the offline notice in Settings', async () => {
    const user = userEvent.setup()
    server.failures.set('/api/me', 'network-down')
    render(<App />)
    await serverSettled(1)

    await openSettings(user)

    expect(await screen.findByText(/this phone is offline/i, undefined, SETTLE)).toBeVisible()
  })

  test('O13 pressing the adopt button in Settings replaces this phone’s sessions with the signed-in account’s', async () => {
    const user = userEvent.setup()
    await adoptSignedInAccount('a@x')
    await db.sessions.put(remoteSession('mine', BASE + 100))
    server.signedInEmail = 'b@x'
    server.seedSession('b@x', remoteSession('theirs', BASE + 200))
    render(<App />)
    await serverSettled(1)
    await openSettings(user)

    await user.click(
      await screen.findByRole('button', { name: 'Use b@x\'s data on this phone' }, SETTLE),
    )

    await waitFor(async () => {
      expect((await listSessions()).map((s) => s.id)).toEqual(['theirs'])
    }, SETTLE)
    expect(await screen.findByText('b@x', undefined, SETTLE)).toBeVisible()
    expect(server.sessionsOf('b@x').map((s) => s.id)).toEqual(['theirs'])
    await serverSettled(3)
  })

  test('O13 adopting an account whose active program differs shows it on the picker without a restart', async () => {
    const user = userEvent.setup()
    await adoptSignedInAccount('a@x')
    server.signedInEmail = 'b@x'
    server.seedSetting('b@x', { key: 'activeProgramId', value: 'full-body-starter', updatedAt: BASE })
    render(<App />)
    await serverSettled(1)
    await openSettings(user)
    await user.click(
      await screen.findByRole('button', { name: 'Use b@x\'s data on this phone' }, SETTLE),
    )
    await serverSettled(3)

    await pressTab(user, 'Workout')

    expect(await screen.findByRole('heading', { name: 'Full body starter' }, SETTLE)).toBeVisible()
  })

  // --- O14: a confirmed import replaces the server ---------------------------------------------

  test('O14 confirming an import sends every imported session with POST /api/replace', async () => {
    const user = userEvent.setup()
    await db.sessions.bulkPut(CURRENT)
    captureDownloads()
    render(<App />)
    await serverSettled(2)

    await importAndConfirm(user)

    await waitFor(() => {
      expect(server.requestsTo('/api/replace')).toHaveLength(1)
    }, SETTLE)
    const [replace] = server.requestsTo('/api/replace')
    expect(replace.method).toBe('POST')
    expect(
      (replace.body as { sessions: SyncedSession[] }).sessions.map((s) => s.id).sort(),
    ).toEqual(importedIds)
    await serverSettled(4)
  })

  test('O14 after a confirmed import the server holds exactly the imported sessions', async () => {
    const user = userEvent.setup()
    await db.sessions.bulkPut(CURRENT)
    captureDownloads()
    render(<App />)
    await waitFor(() => {
      expect(server.sessionsOf('a@x')).toHaveLength(CURRENT.length)
    }, SETTLE)
    await serverSettled(2)

    await importAndConfirm(user)

    await waitFor(() => {
      expect(server.sessionsOf('a@x').map((s) => s.id)).toEqual(importedIds)
    }, SETTLE)
    await serverSettled(4)
  })

  test('O14 the sync after a confirmed import does not bring the replaced sessions back', async () => {
    const user = userEvent.setup()
    await db.sessions.bulkPut(CURRENT)
    captureDownloads()
    render(<App />)
    await waitFor(() => {
      expect(server.sessionsOf('a@x')).toHaveLength(CURRENT.length)
    }, SETTLE)
    await serverSettled(2)
    await importAndConfirm(user)
    await waitFor(() => {
      expect(server.requestsTo('/api/replace')).toHaveLength(1)
    }, SETTLE)
    await serverSettled(4)

    act(() => {
      window.dispatchEvent(new Event('online'))
    })
    await waitFor(() => {
      expect(server.requestsTo('/api/sync')).toHaveLength(2)
    }, SETTLE)
    await serverSettled(6)

    expect((await listSessions()).map((s) => s.id).sort()).toEqual(importedIds)
    expect(server.sessionsOf('a@x').map((s) => s.id)).toEqual(importedIds)
  })
})

// --- E6-T1: the set screen's done state past the Plan ---------------------------------------
//
// Full body starter plans back squat for 3 sets. Set 3 is logged one rung heavier and at 7
// reps, so a set preset "from Set 3" is told apart from every earlier one: 52.5 kg x 7.

/**
 * Logs all 3 planned back squat sets under Full body starter and waits for the third to be
 * stored, leaving the set screen on the set after the last planned one.
 */
async function logAllThreePlannedBackSquatSets(user: UserEvent): Promise<void> {
  await setActiveProgramId('full-body-starter')
  render(<App />)
  await startWorkout(user, 'Full body')
  await openExercise(user, 'Back squat')
  await logSetAndOpen(user, 2, 3)
  await logSetAndOpen(user, 3, 3)
  await user.click(screen.getByRole('button', { name: 'Increase weight' }))
  await enterOnKeypad(user, repsReadout(), ['7'])
  await user.click(screen.getByRole('button', { name: 'Log set' }))
  await waitFor(async () => {
    expect(await activeSessionEntries()).toHaveLength(3)
  }, SETTLE)
}

/** Presses Add set in the done state. */
async function pressAddSet(user: UserEvent): Promise<void> {
  await user.click(await screen.findByRole('button', { name: 'Add set' }, SETTLE))
}

/** From the done state, adds set 4 and logs it, waiting for it to be stored. */
async function addAndLogSetFour(user: UserEvent): Promise<void> {
  await pressAddSet(user)
  await screen.findByText('Set 4 · extra', undefined, SETTLE)
  await user.click(screen.getByRole('button', { name: 'Log set' }))
  await waitFor(async () => {
    expect(await activeSessionEntries()).toHaveLength(4)
  }, SETTLE)
}

// Each test logs 3 to 5 sets through the whole app; under a loaded full-suite run that outlasts
// vitest's 5 s default, which is a timeout, not a red.
describe('E6-T1', { timeout: 15_000 }, () => {
  test('O1 with all 3 planned sets logged, the action bar holds Add set and no Log set', async () => {
    const user = userEvent.setup()
    await logAllThreePlannedBackSquatSets(user)

    const addSet = await screen.findByRole('button', { name: 'Add set' }, SETTLE)

    const bar = actionBar()
    expect(bar, 'the set screen has no sticky action bar').not.toBeNull()
    expect((bar as HTMLElement).contains(addSet)).toBe(true)
    expect(screen.queryByRole('button', { name: 'Log set' })).toBeNull()
  })

  test('O1 with all 3 planned sets logged, the counter reads All 3 sets logged', async () => {
    const user = userEvent.setup()
    await logAllThreePlannedBackSquatSets(user)

    expect(await screen.findByText('All 3 sets logged', undefined, SETTLE)).toBeVisible()
  })

  test('O2 pressing Add set in the done state opens set 4 with the counter reading Set 4 · extra', async () => {
    const user = userEvent.setup()
    await logAllThreePlannedBackSquatSets(user)

    await pressAddSet(user)

    expect(await screen.findByText('Set 4 · extra', undefined, SETTLE)).toBeVisible()
  })

  test('O2 set 4 opened by Add set is preset from set 3', async () => {
    const user = userEvent.setup()
    await logAllThreePlannedBackSquatSets(user)

    await pressAddSet(user)

    await screen.findByText('Set 4 · extra', undefined, SETTLE)
    expect([readoutValue(weightReadout()), readoutValue(repsReadout())]).toEqual(['52.5', '7'])
  })

  test('O2 pressing Add set puts Log set in the action bar and no Add set', async () => {
    const user = userEvent.setup()
    await logAllThreePlannedBackSquatSets(user)

    await pressAddSet(user)

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Add set' })).toBeNull()
    }, SETTLE)
    const bar = actionBar()
    expect(bar, 'the set screen has no sticky action bar').not.toBeNull()
    expect((bar as HTMLElement).contains(screen.getByRole('button', { name: 'Log set' }))).toBe(
      true,
    )
  })

  test('O2 logging the extra set stores it as set 4 of back squat, preset from set 3', async () => {
    const user = userEvent.setup()
    await logAllThreePlannedBackSquatSets(user)

    await addAndLogSetFour(user)

    const entries = await activeSessionEntries()
    expect(
      entries.map((entry) => [entry.exerciseId, entry.setIndex, entry.weightKg, entry.reps]),
    ).toEqual([
      ['back-squat', 1, 50, 8],
      ['back-squat', 2, 50, 8],
      ['back-squat', 3, 52.5, 7],
      ['back-squat', 4, 52.5, 7],
    ])
  })

  test('O2 logging the extra set returns to the done state with the counter reading 4 sets logged · 3 planned', async () => {
    const user = userEvent.setup()
    await logAllThreePlannedBackSquatSets(user)

    await addAndLogSetFour(user)

    expect(await screen.findByText('4 sets logged · 3 planned', undefined, SETTLE)).toBeVisible()
  })

  test('O2 logging the extra set returns the action bar to Add set with no Log set', async () => {
    const user = userEvent.setup()
    await logAllThreePlannedBackSquatSets(user)

    await addAndLogSetFour(user)

    await screen.findByRole('button', { name: 'Add set' }, SETTLE)
    expect(screen.queryByRole('button', { name: 'Log set' })).toBeNull()
  })

  test('O2 pressing Add set again after the extra set is logged opens set 5 as an extra set', async () => {
    const user = userEvent.setup()
    await logAllThreePlannedBackSquatSets(user)
    await addAndLogSetFour(user)
    await screen.findByText('4 sets logged · 3 planned', undefined, SETTLE)

    await pressAddSet(user)

    expect(await screen.findByText('Set 5 · extra', undefined, SETTLE)).toBeVisible()
  })
})

// --- E6-T10: reopening a finished exercise must not overwrite its last logged Set -----------

describe('E6-T10', { timeout: 15_000 }, () => {
  test('O3 reopening a fully logged exercise from the list opens the done state without touching Set 3', async () => {
    const user = userEvent.setup()
    await logAllThreePlannedBackSquatSets(user)
    const beforeReopen = await activeSessionEntries()

    await user.click(screen.getByRole('button', { name: 'Back' }))
    await user.click(await screen.findByRole('button', { name: /^Back squat/ }, SETTLE))

    expect(await screen.findByText('All 3 sets logged', undefined, SETTLE)).toBeVisible()
    expect(screen.getByRole('button', { name: 'Add set' })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Log set' })).toBeNull()
    const afterReopen = await activeSessionEntries()
    expect(afterReopen).toEqual(beforeReopen)
    const set3 = afterReopen.find(
      (entry) => entry.exerciseId === 'back-squat' && entry.setIndex === 3,
    )
    expect([set3?.weightKg, set3?.reps]).toEqual([52.5, 7])
  })
})

// --- E4-T4: Stats inside History, and what it says with nothing logged ([O10]) -------------
//
// Stats is not a tab of its own: it is the second half of a History | Stats switch that sits
// in the History tab. What is proven here is the path the trainee takes -- the History tab,
// then the switch's Stats button -- and what that screen says with nothing logged. Stats' own
// contract is proven in src/ui/Stats.test.tsx.

/** The History | Stats switch. */
function historyViewSwitch(): HTMLElement {
  return screen.getByRole('group', { name: 'History view' })
}

/** From a fresh render, presses the History tab and then the switch's Stats button. */
async function openStatsThroughHistory(user: UserEvent): Promise<void> {
  render(<App />)
  await screen.findByRole('heading', { name: 'Workout A' }, SETTLE)
  await pressTab(user, 'History')
  const group = await screen.findByRole('group', { name: 'History view' }, SETTLE)
  await user.click(within(group).getByRole('button', { name: 'Stats' }))
  await screen.findByRole('heading', { name: 'Stats', level: 1 }, SETTLE)
}

function statsSection(name: 'Exercise progress' | 'Volume'): HTMLElement {
  return screen.getByRole('region', { name })
}

test('O10 with nothing logged, Stats reached through the History tab says a set has to be logged before an exercise can be chosen', async () => {
  const user = userEvent.setup()
  await openStatsThroughHistory(user)

  const text = textOf(statsSection('Exercise progress'))
  expect(text).toMatch(/\blog/i)
  expect(text).toMatch(/\bset\b/i)
  expect(text).toMatch(/\bexercise\b/i)
})

test('O10 with nothing logged, Stats reached through the History tab says a session has to be finished before a bar can be drawn', async () => {
  const user = userEvent.setup()
  await openStatsThroughHistory(user)

  const text = textOf(statsSection('Volume'))
  expect(text).toMatch(/\bsession\b/i)
  expect(text).toMatch(/\bfinish/i)
})

test('O10 with nothing logged, Stats reached through the History tab draws no chart in either section', async () => {
  const user = userEvent.setup()
  await openStatsThroughHistory(user)

  expect(statsSection('Exercise progress').querySelector('svg')).toBeNull()
  expect(statsSection('Volume').querySelector('svg')).toBeNull()
})

test('O10 the History tab opens the History list with the switch on History, never Stats', async () => {
  const user = userEvent.setup()
  await db.sessions.bulkPut(loggedSessions(1, 'session', BASE))
  render(<App />)
  await screen.findByRole('heading', { name: 'Workout A' }, SETTLE)

  await pressTab(user, 'History')

  await screen.findByRole('listitem', {}, SETTLE)
  expect(screen.getByRole('heading', { name: 'History', level: 1 })).toBeVisible()
  const group = historyViewSwitch()
  expect(within(group).getByRole('button', { name: 'History' })).toHaveAttribute('aria-pressed', 'true')
  expect(within(group).getByRole('button', { name: 'Stats' })).not.toHaveAttribute('aria-pressed', 'true')
  expect(screen.queryByRole('region', { name: 'Volume' })).toBeNull()
})

test('O10 Stats is titled Stats, keeps History the current tab and marks Stats as the pressed switch button', async () => {
  const user = userEvent.setup()
  await openStatsThroughHistory(user)

  expect(currentTabNames()).toEqual(['History'])
  const group = historyViewSwitch()
  expect(within(group).getByRole('button', { name: 'Stats' })).toHaveAttribute('aria-pressed', 'true')
  expect(within(group).getByRole('button', { name: 'History' })).not.toHaveAttribute('aria-pressed', 'true')
  // The switch rides inside the shell with the content, like every other tab screen's body.
  expect(shellMain()?.contains(group)).toBe(true)
})

test('O10 choosing History in the switch goes back from Stats to the History list', async () => {
  const user = userEvent.setup()
  await db.sessions.bulkPut(loggedSessions(1, 'session', BASE))
  await openStatsThroughHistory(user)

  await user.click(within(historyViewSwitch()).getByRole('button', { name: 'History' }))

  // Hand-checked from the fixture: BASE is 2023-11-14 UTC.
  const row = await screen.findByRole('listitem', {}, SETTLE)
  expect(within(row).getByText('2023-11-14')).toBeVisible()
  expect(screen.getByRole('heading', { name: 'History', level: 1 })).toBeVisible()
  expect(screen.queryByRole('region', { name: 'Exercise progress' })).toBeNull()
})

test('O10 pressing the History tab from Stats opens the History list, not Stats', async () => {
  const user = userEvent.setup()
  await db.sessions.bulkPut(loggedSessions(1, 'session', BASE))
  await openStatsThroughHistory(user)

  await pressTab(user, 'History')

  await screen.findByRole('listitem', {}, SETTLE)
  expect(screen.getByRole('heading', { name: 'History', level: 1 })).toBeVisible()
  expect(screen.queryByRole('region', { name: 'Volume' })).toBeNull()
})

// --- E4-T6's row progression bar: superseded by E8-T10 --------------------------------------
//
// E4-T6's whole point was the in-session exercise list's row bar. E8-T10 [O2] (spec O17) states
// it plainly: "no row shows E4's Next: … kg suggestion any more" -- the spec's O16 record is
// blunter still: "The progression bar moves off the row". `ProgressionBar` and its "Next: … kg"
// stay in place in Stats (ProgressionBar.test.tsx, Stats.test.tsx); the row itself is now
// `VolumeVsBaseline` (src/ui/VolumeVsBaseline.test.tsx, src/ui/ExerciseList.test.tsx's "E8-T10"
// section), so this describe block's fixtures no longer describe anything a row does.

// --- E8-T6: a forgotten Session finishes itself at launch ----------------------------------

describe('E8-T6', () => {
  const HOUR_MS = 60 * 60 * 1000

  /**
   * Stores a Workout A Session still in progress whose four back squat Sets -- 40x10, 50x10,
   * 60x8, 60x8 -- ended five hours before the real clock, and returns the last Set's time.
   * App's launch reads `Date.now()`, so these stamps are relative to it, not to BASE.
   */
  async function staleBackSquatSession(): Promise<number> {
    const lastSetAt = Date.now() - 5 * HOUR_MS
    const startedAt = lastSetAt - 30 * 60 * 1000
    const sets: [number, number][] = [
      [40, 10],
      [50, 10],
      [60, 8],
      [60, 8],
    ]
    await db.sessions.put({
      id: 'forgotten',
      programId: 'assaf-ab-2026',
      workoutId: 'workout-a',
      startedAt,
      finishedAt: null,
      entries: sets.map(([weightKg, reps], index) => ({
        exerciseId: 'back-squat',
        setIndex: index + 1,
        weightKg,
        reps,
        loggedAt: lastSetAt - (3 - index) * 5 * 60 * 1000,
      })),
      updatedAt: lastSetAt,
    })
    return lastSetAt
  }

  test('O3 launching with a stale Session in progress shows the picker with no resume card', async () => {
    await staleBackSquatSession()

    render(<App />)

    expect(await screen.findByRole('button', { name: 'Start Workout A' }, SETTLE)).toBeVisible()
    expect(resumeControl()).toBeNull()
  })

  test('O3 launching with a stale Session in progress stores it finished at its last Set', async () => {
    const lastSetAt = await staleBackSquatSession()

    render(<App />)
    await screen.findByRole('button', { name: 'Start Workout A' }, SETTLE)

    expect(await getActiveSession()).toBeNull()
    const finished = await listSessions()
    expect(finished.map((session) => [session.id, session.finishedAt])).toEqual([
      ['forgotten', lastSetAt],
    ])
  })

  test('O3 after a stale Session finishes itself, Back squat Set 2 opens preset at 50 kg x 10', async () => {
    await staleBackSquatSession()
    const user = userEvent.setup()
    render(<App />)

    await startWorkout(user, 'Workout A')
    await openExercise(user, 'Back squat')
    expect([readoutValue(weightReadout()), readoutValue(repsReadout())]).toEqual(['40', '10'])
    await logSetAndOpen(user, 2, 4)

    expect([readoutValue(weightReadout()), readoutValue(repsReadout())]).toEqual(['50', '10'])
  })
})

// --- E8-T4: Finish exercise offers a way back to the Workout's exercise list -----------------

describe('E8-T4', { timeout: 15_000 }, () => {
  test('O1 the done state offers Finish exercise before Add set in the action bar', async () => {
    const user = userEvent.setup()
    await logAllThreePlannedBackSquatSets(user)

    const finish = await screen.findByRole('button', { name: 'Finish exercise' }, SETTLE)
    const addSet = screen.getByRole('button', { name: 'Add set' })

    const bar = actionBar()
    expect(bar, 'the set screen has no sticky action bar').not.toBeNull()
    expect((bar as HTMLElement).contains(finish)).toBe(true)
    expect((bar as HTMLElement).contains(addSet)).toBe(true)
    // Finish exercise is the primary action: it comes first in the action bar.
    const buttons = within(bar as HTMLElement).getAllByRole('button')
    expect(buttons.map((button) => button.textContent)).toEqual(['Finish exercise', 'Add set'])
  })

  test('O1 pressing Finish exercise returns to the Workout’s exercise list', async () => {
    const user = userEvent.setup()
    await logAllThreePlannedBackSquatSets(user)

    await user.click(await screen.findByRole('button', { name: 'Finish exercise' }, SETTLE))

    expect(await screen.findByRole('button', { name: /^Back squat/ }, SETTLE)).toBeVisible()
    const header = shellHeader()
    expect(header).not.toBeNull()
    expect(textOf(header as HTMLElement)).toContain('Full body')
  })

  test('O1 after an extra set is added and logged, the done state again offers Finish exercise', async () => {
    const user = userEvent.setup()
    await logAllThreePlannedBackSquatSets(user)

    await addAndLogSetFour(user)

    expect(await screen.findByRole('button', { name: 'Finish exercise' }, SETTLE)).toBeVisible()
  })
})

// --- E8-T7: always land on Workout when the document becomes visible again ([O1], [O2]) ---
//
// These go through App, not `useLandOnWorkout` directly: the outcomes are about which tab or
// screen is showing afterwards, and App is what owns `view`/`setView` and the in-session
// exception. `useLandOnWorkout` itself is only the `visibilitychange` plumbing App consumes.

/** Fires `visibilitychange` with `document.visibilityState` forced to `state`. */
function setDocumentVisibility(state: 'visible' | 'hidden'): void {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true })
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'))
  })
}

test('O1 returning from another tab with no Session in progress lands back on Workout', async () => {
  const user = userEvent.setup()
  render(<App />)
  await screen.findByRole('heading', { name: 'Workout A' }, SETTLE)

  await pressTab(user, 'History')
  expect(currentTabNames()).toEqual(['History'])

  setDocumentVisibility('hidden')
  setDocumentVisibility('visible')

  await waitFor(() => {
    expect(currentTabNames()).toEqual(['Workout'])
  }, SETTLE)
})

test('O2 a Session in progress on its exercise list stays on the exercise list when the document becomes visible again', async () => {
  const user = userEvent.setup()
  render(<App />)
  await startWorkoutA(user)

  setDocumentVisibility('hidden')
  setDocumentVisibility('visible')

  // Still the exercise list, not back at the picker.
  await waitFor(() => {
    expect(screen.getByRole('button', { name: /^Back squat/ })).toBeVisible()
  }, SETTLE)
  expect(screen.queryByRole('button', { name: 'Start Workout A' })).toBeNull()
})

test('O2 a Session in progress on a set screen stays on the same set when the document becomes visible again', async () => {
  const user = userEvent.setup()
  render(<App />)
  await openBackSquat(user)
  await enterOnKeypad(user, weightReadout(), ['6', '0'])
  await enterOnKeypad(user, repsReadout(), ['1', '0'])
  await logSetAndOpen(user, 2, 4)

  setDocumentVisibility('hidden')
  setDocumentVisibility('visible')

  // Still set 2 of 4 on back squat's dials, not swept back to the picker or set 1.
  await waitFor(() => {
    expect(screen.getByText('Set 2 of 4')).toBeVisible()
  }, SETTLE)
  expect(screen.getByRole('button', { name: 'Weight' })).toBeVisible()
})

// --- E8-T11: choosing the volume baseline in Settings wires through to the row -------------

test('O1 choosing Past 3 months and Average in Settings makes Back squat’s row read Volume vs 3-month average: 50%', async () => {
  const user = userEvent.setup()
  const now = Date.now()

  // Two finished Sessions inside the 3-month window: the older one, 60 days ago, at 800 kg·reps,
  // and the most recent one, 5 days ago, at 1200 -- so "Last workout" (1200) and "3-month
  // average" ((800 + 1200) / 2 = 1000) resolve to different baselines, proving the setting
  // chosen in Settings is what the row actually used, not a default that happens to agree.
  const older = await startOrResumeSession('assaf-ab-2026', 'workout-a', now - 60 * DAY_MS)
  await logSet(older.id, {
    exerciseId: 'back-squat',
    setIndex: 1,
    weightKg: 80,
    reps: 10,
    loggedAt: now - 60 * DAY_MS,
  })
  await finishSession(older.id, now - 60 * DAY_MS)

  const recent = await startOrResumeSession('assaf-ab-2026', 'workout-a', now - 5 * DAY_MS)
  await logSet(recent.id, {
    exerciseId: 'back-squat',
    setIndex: 1,
    weightKg: 120,
    reps: 10,
    loggedAt: now - 5 * DAY_MS,
  })
  await finishSession(recent.id, now - 5 * DAY_MS)

  // Today's own Session in progress: back squat at 50 kg x 10 = 500, half of the 3-month
  // average (1000).
  const started = await startOrResumeSession('assaf-ab-2026', 'workout-a', now)
  await logSet(started.id, {
    exerciseId: 'back-squat',
    setIndex: 1,
    weightKg: 50,
    reps: 10,
    loggedAt: now,
  })

  render(<App />)
  await screen.findByRole('button', { name: /^Back squat/ }, SETTLE)

  // Back out to the picker, which is the only view with a tab bar while a Session is in
  // progress (E3-T3/T4), reach Settings from there, and resume the Session again after.
  await user.click(screen.getByRole('button', { name: 'Back' }))
  await user.click(await screen.findByRole('button', { name: 'Settings' }, SETTLE))

  await user.selectOptions(
    await screen.findByRole('combobox', { name: 'Compare volume with' }, SETTLE),
    'Past 3 months',
  )
  await user.selectOptions(screen.getByRole('combobox', { name: 'Using' }), 'Average')

  await user.click(screen.getByRole('button', { name: 'Workout' }))
  await user.click(await screen.findByRole('button', { name: /^Resume Workout A/ }, SETTLE))

  const row = await screen.findByRole('button', { name: /^Back squat/ }, SETTLE)
  expect(within(row).getByText('Volume vs 3-month average: 50%')).toBeVisible()
})

describe('E8-T8', () => {
  /** The step control: a native select named for the weight step it currently reads. */
  function stepControl(step: number): HTMLElement {
    return screen.getByRole('combobox', { name: `Step ${step} kg` })
  }

  test('O2 back squats set screen opens with Step 5 kg once setWeightStep has stored it', async () => {
    await setWeightStep('back-squat', 5)
    const user = userEvent.setup()
    render(<App />)

    await startWorkout(user, 'Workout A')
    await openExercise(user, 'Back squat')

    expect(await screen.findByRole('combobox', { name: 'Step 5 kg' }, SETTLE)).toBeInTheDocument()
  })

  test('O2 choosing a new weight step on back squats set screen is stored for the next time it opens', async () => {
    const user = userEvent.setup()
    const firstRun = render(<App />)
    await startWorkout(user, 'Workout A')
    await openExercise(user, 'Back squat')

    await user.selectOptions(stepControl(2.5), '5')
    await waitFor(async () => {
      expect(await getWeightStep('back-squat')).toBe(5)
    }, SETTLE)
    firstRun.unmount()

    // The session started above is still in progress (never finished), so a fresh render lands
    // straight back in it -- on the exercise list, not the picker -- per AppViews' own doc
    // comment: "A session in progress wins on mount, so reopening the app lands back in it."
    render(<App />)
    await openExercise(user, 'Back squat')

    expect(await screen.findByRole('combobox', { name: 'Step 5 kg' }, SETTLE)).toBeInTheDocument()
  })
})

