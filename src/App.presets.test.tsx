import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { renderApp } from './test/renderApp'
import { workoutsOffered } from './test/dashboard'
import { db } from './storage/db'
import { FakeSyncServer } from './test/fakeSyncServer'

// E9-T6: `assaf-ab-2026` is the one preset offered to a new user, renamed `A/B Split`;
// `full-body-starter` is never offered. `App` composes the real Program tab against the real,
// fake-indexeddb-backed db, as `App.newUser.test.tsx` does for the Workout tab.

vi.mock('virtual:pwa-register', () => ({
  registerSW() {
    return async () => {}
  },
}))

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

async function openProgramTab(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.click(await screen.findByRole('button', { name: 'Program' }, SETTLE))
}

// --- O21: a new user's Program tab offers only A/B Split -------------------------------------

test('O21 a new user’s Program tab lists A/B Split with a Use this button', async () => {
  const user = userEvent.setup()
  await renderApp()

  await openProgramTab(user)

  expect(
    await screen.findByRole('button', { name: 'Use this A/B Split' }, SETTLE),
  ).toBeVisible()
  expect(screen.getByRole('button', { name: 'New program' })).toBeVisible()
})

test('O21 a new user’s Program tab does not list Full body starter', async () => {
  const user = userEvent.setup()
  await renderApp()

  await openProgramTab(user)
  await screen.findByRole('button', { name: 'Use this A/B Split' }, SETTLE)

  expect(screen.queryByText('Full body starter')).toBeNull()
})

test('O21 pressing Use this on A/B Split makes it active and the Workout tab offers Workout A and B', async () => {
  const user = userEvent.setup()
  await renderApp()

  await openProgramTab(user)
  await user.click(await screen.findByRole('button', { name: 'Use this A/B Split' }, SETTLE))

  await user.click(await screen.findByRole('button', { name: 'Train' }, SETTLE))

  // The Dashboard's dock offers Workout A, due first, and "Change" steps to Workout B.
  expect(await screen.findByRole('button', { name: 'Start Workout A' }, SETTLE)).toBeVisible()
  expect(await workoutsOffered(user)).toEqual(['Workout A', 'Workout B'])
})

test('O21 pressing Use this on A/B Split stores it as the active program', async () => {
  const user = userEvent.setup()
  await renderApp()

  await openProgramTab(user)
  await user.click(await screen.findByRole('button', { name: 'Use this A/B Split' }, SETTLE))

  await waitFor(async () => {
    expect((await db.settings.get('activeProgramId'))?.value).toBe('assaf-ab-2026')
  }, SETTLE)
})

// --- O21: with an active Program, the Program tab and Settings list only visible Programs ----

test('O21 with an active program the Program tab still does not list Full body starter', async () => {
  const user = userEvent.setup()
  await db.settings.put({ key: 'activeProgramId', value: 'assaf-ab-2026', updatedAt: Date.now() })
  await renderApp()

  await screen.findByRole('button', { name: 'Start Workout A' }, SETTLE)
  await openProgramTab(user)
  // The program list is the Programs panel behind the head's overflow (S7a).
  await user.click(await screen.findByRole('button', { name: 'Programs' }, SETTLE))
  await screen.findByRole('radio', { name: 'A/B Split' }, SETTLE)

  expect(screen.queryByText('Full body starter')).toBeNull()
})

// --- O37: Upper/Lower is offered next to A/B Split --------------------------------------------

test('O37 a new user Program tab offers Upper/Lower next to A/B Split', async () => {
  const user = userEvent.setup()
  await renderApp()

  await openProgramTab(user)

  expect(await screen.findByRole('button', { name: 'Use this A/B Split' }, SETTLE)).toBeVisible()
  expect(await screen.findByRole('button', { name: 'Use this Upper/Lower' }, SETTLE)).toBeVisible()
})

test('O37 pressing Use this on Upper/Lower stores it and the Workout tab offers Upper and Lower', async () => {
  const user = userEvent.setup()
  await renderApp()

  await openProgramTab(user)
  await user.click(await screen.findByRole('button', { name: 'Use this Upper/Lower' }, SETTLE))

  await waitFor(async () => {
    expect((await db.settings.get('activeProgramId'))?.value).toBe('upper-lower')
  }, SETTLE)
  await user.click(await screen.findByRole('button', { name: 'Train' }, SETTLE))
  expect(await workoutsOffered(user)).toEqual(['Upper', 'Lower'])
})

test('O37 nothing is active for a new user, so A/B Split stays the default', async () => {
  await renderApp()

  await screen.findByRole('button', { name: 'Program' }, SETTLE)
  expect((await db.settings.get('activeProgramId'))?.value).toBeUndefined()
})

test('O21 with an active program Settings still does not list Full body starter', async () => {
  const user = userEvent.setup()
  await db.settings.put({ key: 'activeProgramId', value: 'assaf-ab-2026', updatedAt: Date.now() })
  await renderApp()

  await screen.findByRole('button', { name: 'Start Workout A' }, SETTLE)
  await user.click(await screen.findByRole('button', { name: 'Settings' }, SETTLE))
  await screen.findByRole('radio', { name: 'A/B Split' }, SETTLE)

  expect(screen.queryByText('Full body starter')).toBeNull()
})
