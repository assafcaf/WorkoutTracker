import { render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { App } from './App'
import { db } from './storage/db'
import { finishSession, logSet, startOrResumeSession } from './storage/sessionStore'
import { FakeSyncServer } from './test/fakeSyncServer'
import type { SyncedSession } from './sync/protocol'

// The row's "Volume vs …" bar (E8-T10) must follow what a sync brings in, as History already
// does: a finished Session or a baseline setting pulled from the server. And the sync has to
// happen when the trainee comes back to the installed app, not only on a cold start.
//
// App calls `useSync()` with no deps, so the network is faked at `fetch`. Everything under it --
// the hook, syncClient and the Dexie db -- is real.

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
  setVisibility('visible')
})

function setVisibility(state: DocumentVisibilityState): void {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state })
}

function leaveAndReturn(): void {
  setVisibility('hidden')
  document.dispatchEvent(new Event('visibilitychange'))
  setVisibility('visible')
  document.dispatchEvent(new Event('visibilitychange'))
}

/** A Session finished on another device: back squat at `weightKg` × 10, `daysAgo` days ago. */
function finishedElsewhere(id: string, weightKg: number, daysAgo: number): SyncedSession {
  const startedAt = Date.now() - daysAgo * DAY_MS
  return {
    id,
    programId: 'assaf-ab-2026',
    workoutId: 'workout-a',
    startedAt,
    finishedAt: startedAt + 60 * 60 * 1000,
    entries: [{ exerciseId: 'back-squat', setIndex: 1, weightKg, reps: 10, loggedAt: startedAt + 60_000 }],
    updatedAt: startedAt + 60 * 60 * 1000,
  }
}

/** Today's Session in progress on this device, with back squat at 50 kg × 10 (500) logged. */
async function todayInProgress(): Promise<void> {
  const now = Date.now()
  const started = await startOrResumeSession('assaf-ab-2026', 'workout-a', now)
  await logSet(started.id, { exerciseId: 'back-squat', setIndex: 1, weightKg: 50, reps: 10, loggedAt: now })
}

/** A Session finished on this device: back squat at `weightKg` × 10, `daysAgo` days ago. */
async function finishedHere(weightKg: number, daysAgo: number): Promise<void> {
  const at = Date.now() - daysAgo * DAY_MS
  const session = await startOrResumeSession('assaf-ab-2026', 'workout-a', at)
  await logSet(session.id, { exerciseId: 'back-squat', setIndex: 1, weightKg, reps: 10, loggedAt: at })
  await finishSession(session.id, at)
}

async function backSquatRow(): Promise<HTMLElement> {
  return screen.findByRole('button', { name: /^Back squat/ }, SETTLE)
}

test('a finished Session pulled by the start-up sync makes Back squat’s row compare with it, not read No previous workout', async () => {
  await todayInProgress()
  server.seedSession('a@x', finishedElsewhere('remote-1', 100, 2))
  // The pull is held until the list has rendered from what this device had, so the test
  // proves the row follows the sync rather than winning a race with it.
  const release = server.hold('/api/sync')

  render(<App />)
  expect(within(await backSquatRow()).getByText('No previous workout')).toBeVisible()

  release()

  await waitFor(async () => {
    expect(within(await backSquatRow()).getByText('Volume vs last workout: 50%')).toBeVisible()
  }, SETTLE)
})

test('a volume baseline setting pulled by sync makes Back squat’s row use it', async () => {
  await finishedHere(80, 60) // 800
  await finishedHere(120, 5) // 1200: "last workout"; the 3-month average is 1000
  await todayInProgress() // 500
  server.seedSetting('a@x', {
    key: 'volumeBaseline',
    value: { period: '3m', aggregate: 'avg' },
    updatedAt: Date.now(),
  })
  const release = server.hold('/api/sync')

  render(<App />)
  expect(within(await backSquatRow()).getByText('Volume vs last workout: 42%')).toBeVisible()

  release()

  await waitFor(async () => {
    expect(within(await backSquatRow()).getByText('Volume vs 3-month average: 50%')).toBeVisible()
  }, SETTLE)
})

test('coming back to the app syncs by itself, and a Session finished elsewhere meanwhile reaches the row', async () => {
  await todayInProgress()

  render(<App />)
  await waitFor(() => {
    expect(server.requestsTo('/api/sync')).toHaveLength(1)
    expect(server.pending).toBe(0)
  }, SETTLE)
  expect(within(await backSquatRow()).getByText('No previous workout')).toBeVisible()

  // Logged and finished on another device while this app sat in the background.
  server.seedSession('a@x', finishedElsewhere('remote-2', 100, 1))
  leaveAndReturn()

  await waitFor(async () => {
    expect(within(await backSquatRow()).getByText('Volume vs last workout: 50%')).toBeVisible()
  }, SETTLE)
})
