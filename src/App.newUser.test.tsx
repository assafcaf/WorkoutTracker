import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { App } from './App'
import { db } from './storage/db'
import { ACTIVE_PROGRAM_ID_KEY } from './storage/settingsStore'
import { FakeSyncServer } from './test/fakeSyncServer'
import type { Session } from './types'

// E9-T2: someone opening the app for the first time has no Program until they choose one; the
// trainee, who already logs, keeps theirs. App calls `useSync()` with no deps, so the network is
// faked at `fetch`, as `App.syncRefresh.test.tsx` does. The hook, syncClient and the Dexie db are
// real.

vi.mock('virtual:pwa-register', () => ({
  registerSW() {
    return async () => {}
  },
}))

const DAY_MS = 24 * 60 * 60 * 1000
const SETTLE = { timeout: 3000 }

let server: FakeSyncServer

beforeEach(async () => {
  await db.open()
  await db.sessions.clear()
  await db.settings.clear()
  server = new FakeSyncServer()
  vi.stubGlobal('fetch', server.fetch)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

/** A Session on `programId` this device finished `daysAgo` days ago. */
function finished(id: string, programId: string, workoutId: string, daysAgo: number): Session {
  const startedAt = Date.now() - daysAgo * DAY_MS
  return {
    id,
    programId,
    workoutId,
    startedAt,
    finishedAt: startedAt + 3_600_000,
    entries: [],
    updatedAt: startedAt + 3_600_000,
  }
}

/** Waits until the app is past loading: the tab bar is up. */
async function appReady(): Promise<void> {
  await screen.findByRole('navigation', { name: 'Main' }, SETTLE)
}

/** Waits until the start-up sync has been answered and nothing is in flight. */
async function syncSettled(): Promise<void> {
  await waitFor(() => {
    expect(server.requestsTo('/api/sync').length).toBeGreaterThanOrEqual(1)
    expect(server.pending).toBe(0)
  }, SETTLE)
}

// --- O19: an empty database has no Program --------------------------------------------------

test('O19 with an empty database the Workout tab shows No program yet', async () => {
  render(<App />)

  expect(await screen.findByText('No program yet', undefined, SETTLE)).toBeVisible()
})

test('O19 with an empty database the Workout tab shows no Workout start buttons', async () => {
  render(<App />)
  await appReady()
  await syncSettled()

  expect(screen.queryAllByRole('button', { name: /^Start / })).toEqual([])
})

test('O19 with an empty database Choose a program opens the Program tab', async () => {
  const user = userEvent.setup()
  render(<App />)

  await user.click(await screen.findByRole('button', { name: 'Choose a program' }, SETTLE))

  expect(screen.getByRole('button', { name: 'Program' })).toHaveAttribute('aria-current', 'page')
  expect(screen.getByRole('heading', { level: 1, name: 'Program' })).toBeVisible()
})

// --- O20: the trainee who already logs keeps a Program --------------------------------------

test('O20 with no stored choice the Workout tab offers the Workouts of the latest Session’s Program', async () => {
  await db.sessions.bulkPut([
    finished('s-old', 'assaf-ab-2026', 'workout-a', 5),
    finished('s-new', 'full-body-starter', 'full-body', 2),
  ])

  render(<App />)

  expect(await screen.findByRole('button', { name: 'Start Full body' }, SETTLE)).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Start Workout A' })).toBeNull()
  expect(screen.queryByText('No program yet')).toBeNull()
})

test('O20 with no stored choice the latest Session’s Program is stored as activeProgramId', async () => {
  await db.sessions.bulkPut([
    finished('s-old', 'assaf-ab-2026', 'workout-a', 5),
    finished('s-new', 'full-body-starter', 'full-body', 2),
  ])

  render(<App />)
  await appReady()

  await waitFor(async () => {
    expect((await db.settings.get(ACTIVE_PROGRAM_ID_KEY))?.value).toBe('full-body-starter')
  }, SETTLE)
})

test('O20 a latest Session on a Program no longer offered falls back to the first Program and stores it', async () => {
  await db.sessions.put(finished('s-gone', 'retired-program', 'workout-a', 2))

  render(<App />)

  expect(await screen.findByRole('button', { name: 'Start Workout A' }, SETTLE)).toBeVisible()
  await waitFor(async () => {
    expect((await db.settings.get(ACTIVE_PROGRAM_ID_KEY))?.value).toBe('assaf-ab-2026')
  }, SETTLE)
})

// --- O22: a new user's second device picks up the account's Program by sync -------------------

test('O22 a sync that pulls activeProgramId makes the Workout tab offer that Program’s Workouts without a restart', async () => {
  server.seedSetting('a@x', { key: 'activeProgramId', value: 'full-body-starter', updatedAt: Date.now() - DAY_MS })
  // The pull is held until the app has shown what this device had -- no Program -- so the test
  // proves the Workout tab follows the sync rather than winning a race with it.
  const release = server.hold('/api/sync')

  render(<App />)
  expect(await screen.findByText('No program yet', undefined, SETTLE)).toBeVisible()

  release()

  expect(await screen.findByRole('button', { name: 'Start Full body' }, SETTLE)).toBeVisible()
  expect(screen.queryByText('No program yet')).toBeNull()
})
