import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { renderApp } from './test/renderApp'
import { db } from './storage/db'
import { FakeSyncServer } from './test/fakeSyncServer'
import type { Session } from './types'

// V6-03 (UX iteration 6, wave 3): every place a lift's name appears opens the one Lift page, by
// one app-level route (`{ tab: 'lift' }`): Train's rows, the Session summary's Lift by lift,
// the Program tab's rows and Exercises > My lifts. Back returns to where it was opened.

vi.mock('virtual:pwa-register', () => ({
  registerSW() {
    return async () => {}
  },
}))

const SETTLE = { timeout: 5000 }
const LONG = 30_000
const DAY = 86_400_000

let server: FakeSyncServer

beforeEach(async () => {
  await db.open()
  await db.sessions.clear()
  await db.settings.clear()
  server = new FakeSyncServer()
  vi.stubGlobal('fetch', server.fetch)
  await db.settings.put({ key: 'activeProgramId', value: 'assaf-ab-2026', updatedAt: Date.now() })
  // One finished Workout A two days ago, with Back squat in it.
  const at = Date.now() - 2 * DAY
  const session: Session = {
    id: 'a1',
    programId: 'assaf-ab-2026',
    workoutId: 'workout-a',
    startedAt: at,
    finishedAt: at + 3_600_000,
    updatedAt: at + 3_600_000,
    entries: [1, 2, 3, 4].map((setIndex) => ({
      exerciseId: 'back-squat',
      setIndex,
      weightKg: 60,
      reps: 8,
      loggedAt: at + setIndex * 60_000,
    })),
  }
  await db.sessions.put(session)
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

/** The Lift page is open on `name`: its title, its Sessions log, a Back control. */
async function expectLiftPage(name: string): Promise<void> {
  await screen.findByRole('heading', { level: 1, name }, SETTLE)
  expect(await screen.findByRole('list', { name: 'Sessions' }, SETTLE)).toBeTruthy()
}

async function back(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.click(screen.getByRole('button', { name: /^Back/ }))
}

test(
  'V6-03 a Train row opens the Lift page, and Back returns to Train',
  async () => {
    const user = userEvent.setup()
    await renderApp()
    const lifts = await screen.findByRole('list', { name: /lifts$/ }, SETTLE)
    await user.click(within(lifts).getAllByRole('button')[0])
    const name = (await screen.findByRole('heading', { level: 1 }, SETTLE)).textContent ?? ''
    await expectLiftPage(name)
    await back(user)
    expect(await screen.findByRole('list', { name: /lifts$/ }, SETTLE)).toBeTruthy()
  },
  LONG,
)

test(
  'V6-03 a Lift by lift row of a Session summary opens the Lift page, and Back returns to the summary',
  async () => {
    const user = userEvent.setup()
    await renderApp()
    await user.click(await screen.findByRole('button', { name: 'Sessions' }, SETTLE))
    const rows = await screen.findAllByRole('button', { name: /Workout A/ }, SETTLE)
    await user.click(rows[rows.length - 1])
    const moves = await screen.findByRole('region', { name: 'Lift by lift' }, SETTLE)
    await user.click(within(moves).getByRole('button', { name: 'Back squat' }))
    await expectLiftPage('Back squat')
    await back(user)
    expect(await screen.findByRole('region', { name: 'Lift by lift' }, SETTLE)).toBeTruthy()
  },
  LONG,
)

test(
  'V6-03 a Program row opens the Lift page',
  async () => {
    const user = userEvent.setup()
    await renderApp()
    await user.click(await screen.findByRole('button', { name: 'Program' }, SETTLE))
    const squat = await screen.findAllByRole('button', { name: 'Back squat' }, SETTLE)
    await user.click(squat[0])
    await expectLiftPage('Back squat')
    await back(user)
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Back squat' }).length).toBeGreaterThan(0), SETTLE)
  },
  LONG,
)

test(
  'V6-03 Exercises > My lifts opens the same Lift page',
  async () => {
    const user = userEvent.setup()
    await renderApp()
    await user.click(await screen.findByRole('button', { name: 'Program' }, SETTLE))
    await user.click(await screen.findByRole('radio', { name: 'Exercises' }, SETTLE))
    const mine = await screen.findByRole('list', { name: 'My lifts' }, SETTLE)
    await user.click(within(mine).getByRole('button', { name: /^Back squat/ }))
    await expectLiftPage('Back squat')
    expect(screen.queryByRole('dialog')).toBeNull()
  },
  LONG,
)
