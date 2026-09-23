import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { UserEvent } from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { App } from './App'
import { db, isStorageAvailable } from './storage/db'
import { setActiveProgramId } from './storage/settingsStore'
import {
  finishSession,
  getActiveSession,
  listSessions,
  logSet,
  startOrResumeSession,
} from './storage/sessionStore'
// A value import, not a type-only one: evaluating `backup.ts` is also what installs the
// feature-detected `Blob.prototype.text` polyfill these tests read downloaded blobs through.
import { BACKUP_SCHEMA_VERSION, type BackupFile } from './storage/backup'
import { loadPrograms } from './data/catalog'
import type { Session, SetEntry } from './types'

// App composes real components (ProgramPicker, Settings, StorageUnavailableBanner) against the
// real, fake-indexeddb-backed db. Only isStorageAvailable and loadPrograms are replaced with
// controllable spies, so individual tests can force the storage-unavailable and hard-error
// branches without touching the global indexedDB or the bundled data files.
vi.mock('./storage/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./storage/db')>()
  return { ...actual, isStorageAvailable: vi.fn(actual.isStorageAvailable) }
})

vi.mock('./data/catalog', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./data/catalog')>()
  return { ...actual, loadPrograms: vi.fn(actual.loadPrograms) }
})

beforeEach(async () => {
  const actualDb = await vi.importActual<typeof import('./storage/db')>('./storage/db')
  const actualCatalog = await vi.importActual<typeof import('./data/catalog')>('./data/catalog')
  vi.mocked(isStorageAvailable).mockImplementation(actualDb.isStorageAvailable)
  vi.mocked(loadPrograms).mockImplementation(actualCatalog.loadPrograms)

  await db.open()
  await db.settings.clear()
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
 */
function looseButtons(names: string[]): string[] {
  const nav = mainNav()
  return names
    .flatMap((name) => screen.queryAllByRole('button', { name }))
    .filter((button) => !nav.contains(button))
    .map((button) => accessibleNameOf(button))
}

test('O7 the app on load offers a Main nav holding exactly the Workout, History and Settings tabs', async () => {
  render(<App />)
  await screen.findByRole('heading', { name: 'Workout A' }, SETTLE)

  expect(tabNames()).toEqual(['Workout', 'History', 'Settings'])
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

test('O11 Add set sits in the action bar beside Log set once every planned set is logged', async () => {
  const user = userEvent.setup()
  render(<App />)
  await logFourSetsOfBackSquat(user)

  const addSet = await screen.findByRole('button', { name: 'Add set' }, SETTLE)

  const bar = actionBar()
  expect(bar, 'the set screen has no sticky action bar').not.toBeNull()
  expect((bar as HTMLElement).contains(addSet)).toBe(true)
  expect((bar as HTMLElement).contains(screen.getByRole('button', { name: 'Log set' }))).toBe(
    true,
  )
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
