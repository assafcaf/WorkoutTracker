import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { renderApp } from './test/renderApp'
import { db } from './storage/db'
import { FakeSyncServer } from './test/fakeSyncServer'

// fix-copy-heading: the editor's heading names the action that opened it. New program and Edit
// keep their existing headings; Copy must not read `Edit program` (the bug this fixes).

vi.mock('virtual:pwa-register', () => ({
  registerSW() {
    return async () => {}
  },
}))

type User = ReturnType<typeof userEvent.setup>

const SETTLE = { timeout: 5000 }
const LONG = 30_000

let server: FakeSyncServer

beforeEach(async () => {
  await db.open()
  await db.sessions.clear()
  await db.settings.clear()
  server = new FakeSyncServer()
  vi.stubGlobal('fetch', server.fetch)
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

async function withActiveAbSplit(): Promise<void> {
  await db.settings.put({ key: 'activeProgramId', value: 'assaf-ab-2026', updatedAt: Date.now() })
}

async function openProgramTab(user: User): Promise<void> {
  await user.click(await screen.findByRole('button', { name: 'Program' }, SETTLE))
}

/** DX-04: the Programs page, behind the Program tab's Programs row, where New program lives. */
async function openProgramsPage(user: User): Promise<void> {
  await user.click(await screen.findByRole('button', { name: 'Programs' }, SETTLE))
  await screen.findByRole('button', { name: 'New program' }, SETTLE)
}

test(
  'New program opens the editor under `New program`',
  async () => {
    const user = userEvent.setup()
    await renderApp()
    await openProgramTab(user)

    // DX-04: a new user's Program tab is the choice list, with "New program" under it.
    await user.click(await screen.findByRole('button', { name: 'New program' }, SETTLE))

    await screen.findByRole('heading', { name: 'New program' }, SETTLE)
  },
  LONG,
)

test(
  'Edit on A/B Split opens the editor under `Edit program`',
  async () => {
    const user = userEvent.setup()
    await withActiveAbSplit()
    await renderApp()
    await openProgramTab(user)

    // DX-04: Edit is the Program tab's one header action.
    await user.click(await screen.findByRole('button', { name: 'Edit A/B Split' }, SETTLE))

    // Progress Dashboard S7b: the editor's bar names the Program it edits.
    await screen.findByRole('heading', { name: 'Edit A/B Split' }, SETTLE)
  },
  LONG,
)

test(
  'Copy on A/B Split opens the editor under `Copy program`, not `Edit program`',
  async () => {
    const user = userEvent.setup()
    await withActiveAbSplit()
    await renderApp()
    await openProgramTab(user)
    await openProgramsPage(user)

    await user.click(screen.getByRole('button', { name: 'Copy A/B Split' }))

    await screen.findByRole('heading', { name: 'Copy program' }, SETTLE)
    expect(screen.queryByRole('heading', { name: /^Edit / })).toBeNull()
  },
  LONG,
)
