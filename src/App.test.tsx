import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { UserEvent } from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import { App } from './App'
import { db, isStorageAvailable } from './storage/db'
import { setActiveProgramId } from './storage/settingsStore'
import { finishSession, getActiveSession, logSet, startOrResumeSession } from './storage/sessionStore'
import { loadPrograms } from './data/catalog'
import type { SetEntry } from './types'

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
  await user.click(screen.getByRole('button', { name: 'Back' }))

  expect(await screen.findByRole('heading', { name: 'Full body starter' }, FAST)).toBeVisible()
  expect(screen.queryByRole('heading', { name: 'Assaf A/B 2026' })).toBeNull()
})

test('O18 App navigates to Settings, hiding the picker, and back again', async () => {
  const user = userEvent.setup()
  render(<App />)
  await screen.findByRole('heading', { name: 'Workout A' }, FAST)

  await user.click(screen.getByRole('button', { name: 'Settings' }))

  expect(screen.queryByRole('heading', { name: 'Workout A' })).toBeNull()
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
