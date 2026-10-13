import { screen, waitFor, within } from '@testing-library/react'
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
  await openProgramsPanel(user)
}

/**
 * Opens the Programs panel behind the Program tab's overflow (S7a), where the program list and
 * New program live; with no active Program, New program is on the page itself.
 */
async function openProgramsPanel(user: User): Promise<void> {
  await waitFor(() => {
    const more = screen.queryByRole('button', { name: 'Programs' })
    const newProgram = screen.queryByRole('button', { name: 'New program' })
    expect(more ?? newProgram).not.toBeNull()
  }, SETTLE)
  const more = screen.queryByRole('button', { name: 'Programs' })
  if (more !== null && more.getAttribute('aria-expanded') !== 'true') await user.click(more)
  await screen.findByRole('button', { name: 'New program' }, SETTLE)
}

/** The Program tab's action row for the Program named exactly `name`. */
function actionsRow(name: string): HTMLElement {
  const row = screen
    .getAllByRole('button', { name: 'Copy' })
    .map((button) => button.parentElement as HTMLElement)
    .find((candidate) => within(candidate).queryByText(name) !== null)
  if (row === undefined) throw new Error(`no Program tab row for ${name}`)
  return row
}

test(
  'New program opens the editor under `New program`',
  async () => {
    const user = userEvent.setup()
    await renderApp()
    await openProgramTab(user)

    await user.click(screen.getByRole('button', { name: 'New program' }))

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

    await user.click(within(actionsRow('A/B Split')).getByRole('button', { name: 'Edit' }))

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

    await user.click(within(actionsRow('A/B Split')).getByRole('button', { name: 'Copy' }))

    await screen.findByRole('heading', { name: 'Copy program' }, SETTLE)
    expect(screen.queryByRole('heading', { name: /^Edit / })).toBeNull()
  },
  LONG,
)
