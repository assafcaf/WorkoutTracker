import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { renderApp } from './test/renderApp'
import { workoutOffered } from './test/dashboard'
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

test('O21 a new user’s Program tab lists A/B Split with a Choose a Program row', async () => {
  const user = userEvent.setup()
  await renderApp()

  await openProgramTab(user)

  expect(
    await screen.findByRole('button', { name: /^A\/B Split/ }, SETTLE),
  ).toBeVisible()
  // DX-04: the empty Program tab is "Choose a Program": the same rows as Train, then its list group.
  expect(screen.getByRole('heading', { level: 1, name: 'Choose a Program' })).toBeVisible()
  // DX-04: no duplicate "Programs" row; the list's "New program" sits under the choices.
  expect(screen.queryByRole('button', { name: 'Programs' })).toBeNull()
  expect(screen.getByRole('button', { name: 'New program' })).toBeVisible()
})

test('O21 a new user’s Program tab does not list Full body starter', async () => {
  const user = userEvent.setup()
  await renderApp()

  await openProgramTab(user)
  await screen.findByRole('button', { name: /^A\/B Split/ }, SETTLE)

  expect(screen.queryByText('Full body starter')).toBeNull()
})

test('O21 choosing A/B Split makes it active and the Workout tab offers Workout A and B', async () => {
  const user = userEvent.setup()
  await renderApp()

  await openProgramTab(user)
  await user.click(await screen.findByRole('button', { name: /^A\/B Split/ }, SETTLE))

  await user.click(await screen.findByRole('button', { name: 'Train' }, SETTLE))

  // DX-01: Train offers Workout A, due first, and only it.
  expect(await screen.findByRole('button', { name: 'Start Workout A' }, SETTLE)).toBeVisible()
  expect(await workoutOffered()).toBe('Workout A')
})

test('O21 choosing A/B Split stores it as the active program', async () => {
  const user = userEvent.setup()
  await renderApp()

  await openProgramTab(user)
  await user.click(await screen.findByRole('button', { name: /^A\/B Split/ }, SETTLE))

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
  // DX-04: the program list is the Programs page, behind its row.
  await user.click(await screen.findByRole('button', { name: 'Programs' }, SETTLE))
  await screen.findByRole('button', { name: /^A\/B Split/ }, SETTLE)

  expect(screen.queryByText('Full body starter')).toBeNull()
})

// --- O37: Upper/Lower is offered next to A/B Split --------------------------------------------

test('O37 a new user Program tab offers Upper/Lower next to A/B Split', async () => {
  const user = userEvent.setup()
  await renderApp()

  await openProgramTab(user)

  expect(await screen.findByRole('button', { name: /^A\/B Split/ }, SETTLE)).toBeVisible()
  expect(await screen.findByRole('button', { name: /^Upper\/Lower/ }, SETTLE)).toBeVisible()
})

test('O37 choosing Upper/Lower stores it and the Workout tab offers Upper and Lower', async () => {
  const user = userEvent.setup()
  await renderApp()

  await openProgramTab(user)
  await user.click(await screen.findByRole('button', { name: /^Upper\/Lower/ }, SETTLE))

  await waitFor(async () => {
    expect((await db.settings.get('activeProgramId'))?.value).toBe('upper-lower')
  }, SETTLE)
  await user.click(await screen.findByRole('button', { name: 'Train' }, SETTLE))
  expect(await workoutOffered()).toBe('Upper')
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
  // DX-04: Settings is the Program tab's Settings row.
  await openProgramTab(user)
  await user.click(await screen.findByRole('button', { name: /^Settings/ }, SETTLE))
  // V2-09: Settings lists no Programs at all now; the Program tab is where they are chosen.
  await screen.findByRole('group', { name: 'Workout' }, SETTLE)

  expect(screen.queryByText('Full body starter')).toBeNull()
})
