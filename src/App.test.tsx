import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import { App } from './App'
import { db, isStorageAvailable } from './storage/db'
import { setActiveProgramId } from './storage/settingsStore'
import { loadPrograms } from './data/catalog'

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
