// E11-T11 (O10): ProgramFeature is the Program tab's own container over services -- it wraps
// the real ProgramPage and ProgramEditor (untouched, only read for their props) the way
// App.tsx wired them before this epic. Rendered over the real bundled catalog and programs
// (src/data/programs/assaf-ab-2026.json -- "A/B Split", Workout A/Workout B -- and
// full-body-starter, hidden by default) and fake-indexeddb (installed globally,
// src/test/setup.ts).
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import { createServices } from '../../services'
import type { AppRoute } from '../routes'
import { db } from '../../storage/db'
import { ACTIVE_PROGRAM_ID_KEY, saveUserProgram } from '../../storage/settingsStore'
import { putSessions } from '../../storage/sessionStore'
import type { Session, UserProgram } from '../../types'
import { ServicesProvider } from '../ServicesProvider'
import { ProgramFeature } from './ProgramFeature'

const NOW = 1_700_000_000_000
const SETTLE = { timeout: 2000 }
const SAVE_ERROR = 'Couldn’t save — try again'

beforeEach(async () => {
  await db.open()
  await db.settings.clear()
  await db.sessions.clear()
})

function inProgressSession(over: Partial<Session> & { id: string; programId: string; workoutId: string }): Session {
  return { startedAt: NOW - 1000, finishedAt: null, entries: [], ...over }
}

function extraVisibleProgram(): UserProgram {
  return {
    id: 'user-second',
    name: 'Second Program',
    units: 'kg',
    sessionsPerWeek: 1,
    workouts: [],
    createdAt: NOW - 1,
  }
}

function renderFeature(
  overrides: { navigate?: (to: AppRoute) => void; onInSession?: (inSession: boolean) => void } = {},
) {
  const navigate = overrides.navigate ?? vi.fn()
  const onInSession = overrides.onInSession ?? vi.fn()
  const services = createServices({ now: () => NOW, storageAvailable: true })
  render(
    <ServicesProvider services={services}>
      <ProgramFeature navigate={navigate} onInSession={onInSession} />
    </ServicesProvider>,
  )
  return { navigate, onInSession, services }
}

test('O10 ProgramFeature lists Programs, leading with the active one', async () => {
  await saveUserProgram(extraVisibleProgram(), NOW)

  renderFeature()

  expect(await screen.findByRole('heading', { name: 'A/B Split' }, SETTLE)).toBeVisible()
  expect(await screen.findByRole('radio', { name: 'Second Program' }, SETTLE)).toBeInTheDocument()
})

test('O10 ProgramFeature switches the active Program when another is chosen', async () => {
  await saveUserProgram(extraVisibleProgram(), NOW)
  const user = userEvent.setup()
  renderFeature()
  await screen.findByRole('heading', { name: 'A/B Split' }, SETTLE)

  await user.click(await screen.findByRole('radio', { name: 'Second Program' }, SETTLE))

  expect(await screen.findByRole('heading', { name: 'Second Program' }, SETTLE)).toBeVisible()
  expect(screen.getByRole('radio', { name: 'Second Program' })).toBeChecked()
})

test('O10 ProgramFeature opens the editor on New program and reports onInSession(true)', async () => {
  const user = userEvent.setup()
  const onInSession = vi.fn()
  renderFeature({ onInSession })
  await screen.findByRole('heading', { name: 'A/B Split' }, SETTLE)

  await user.click(screen.getByRole('button', { name: 'New program' }))

  expect(await screen.findByLabelText('Program name', undefined, SETTLE)).toHaveValue('')
  expect(onInSession).toHaveBeenCalledWith(true)
})

test('O10 ProgramFeature Cancel from the editor returns to the Program list', async () => {
  const user = userEvent.setup()
  renderFeature()
  await screen.findByRole('heading', { name: 'A/B Split' }, SETTLE)

  await user.click(screen.getByRole('button', { name: 'New program' }))
  await screen.findByLabelText('Program name', undefined, SETTLE)
  await user.click(screen.getByRole('button', { name: 'Cancel' }))

  expect(await screen.findByRole('heading', { name: 'A/B Split' }, SETTLE)).toBeVisible()
})

test('O10 ProgramFeature edits a Program, saving it and returning to the Program list', async () => {
  const user = userEvent.setup()
  renderFeature()
  await screen.findByRole('heading', { name: 'A/B Split' }, SETTLE)

  const row = document.querySelector('[data-program-id="assaf-ab-2026"]')
  if (!row) throw new Error('expected a row for assaf-ab-2026')
  await user.click(within(row as HTMLElement).getByRole('button', { name: 'Edit' }))

  const nameField = await screen.findByLabelText('Program name', undefined, SETTLE)
  expect(nameField).toHaveValue('A/B Split')
  await user.clear(nameField)
  await user.type(nameField, 'A/B Split Updated')
  await user.click(screen.getByRole('button', { name: 'Save' }))

  expect(await screen.findByRole('heading', { name: 'A/B Split Updated' }, SETTLE)).toBeVisible()
})

test('O10 ProgramFeature copies a Program into a new, separately listed one', async () => {
  const user = userEvent.setup()
  renderFeature()
  await screen.findByRole('heading', { name: 'A/B Split' }, SETTLE)

  const row = document.querySelector('[data-program-id="assaf-ab-2026"]')
  if (!row) throw new Error('expected a row for assaf-ab-2026')
  await user.click(within(row as HTMLElement).getByRole('button', { name: 'Copy' }))

  expect(await screen.findByLabelText('Program name', undefined, SETTLE)).toHaveValue('A/B Split (copy)')
  await user.click(screen.getByRole('button', { name: 'Save' }))

  expect(await screen.findByRole('heading', { name: 'A/B Split' }, SETTLE)).toBeVisible()
  expect(await screen.findByRole('radio', { name: 'A/B Split (copy)' }, SETTLE)).toBeInTheDocument()
})

test('O10 ProgramFeature resets an edited bundled Program back to its original', async () => {
  await saveUserProgram({ id: 'assaf-ab-2026', name: 'My AB', units: 'kg', sessionsPerWeek: 2, workouts: [], createdAt: NOW }, NOW)
  const user = userEvent.setup()
  renderFeature()
  await screen.findByRole('heading', { name: 'My AB' }, SETTLE)

  const row = document.querySelector('[data-program-id="assaf-ab-2026"]')
  if (!row) throw new Error('expected a row for assaf-ab-2026')
  await user.click(within(row as HTMLElement).getByRole('button', { name: 'Reset to original' }))
  await user.click(within(row as HTMLElement).getByRole('button', { name: 'Confirm' }))

  expect(await screen.findByRole('heading', { name: 'A/B Split' }, SETTLE)).toBeVisible()
})

test('O10 ProgramFeature deleting the Program the Session in progress runs on shows the in-progress message', async () => {
  // A stored user Program, the only kind the Program tab offers Delete on (App.tsx's
  // userProgramIds/bundledProgramIds gating, App.programDelete.test.tsx's O11).
  await saveUserProgram(
    {
      id: 'user-stored-solo',
      name: 'Solo Program',
      units: 'kg',
      sessionsPerWeek: 1,
      createdAt: NOW,
      workouts: [{ id: 'workout-solo', name: 'Solo', exercises: [] }],
    },
    NOW,
  )
  await putSessions([inProgressSession({ id: 's1', programId: 'user-stored-solo', workoutId: 'workout-solo' })])
  // The Program tab's own active-Program resolution (services/programs.ts's O5) otherwise falls
  // back to the most recent Session's Program -- here the very Session in progress -- so pin
  // the active Program explicitly to assaf-ab-2026, the one this test starts on.
  await db.settings.put({ key: ACTIVE_PROGRAM_ID_KEY, value: 'assaf-ab-2026', updatedAt: NOW })
  const user = userEvent.setup()
  renderFeature()
  await screen.findByRole('heading', { name: 'A/B Split' }, SETTLE)

  const row = document.querySelector('[data-program-id="user-stored-solo"]')
  if (!row) throw new Error('expected a row for user-stored-solo')
  await user.click(within(row as HTMLElement).getByRole('button', { name: 'Delete' }))
  await user.click(within(row as HTMLElement).getByRole('button', { name: 'Confirm' }))

  expect(await screen.findByText('Finish the workout in progress first', undefined, SETTLE)).toBeVisible()
})

test('O10 ProgramFeature a save the in-progress guard rejects shows the in-progress message', async () => {
  const user = userEvent.setup()
  const services = createServices({ now: () => NOW, storageAvailable: true })
  const guardMessage = 'Finish the workout in progress first'
  services.programs.save = vi.fn(async () => {
    const { ServiceError } = await import('../../services/errors')
    throw new ServiceError('in-progress', guardMessage)
  })
  const navigate = vi.fn()
  const onInSession = vi.fn()
  render(
    <ServicesProvider services={services}>
      <ProgramFeature navigate={navigate} onInSession={onInSession} />
    </ServicesProvider>,
  )
  await screen.findByRole('heading', { name: 'A/B Split' }, SETTLE)

  const row = document.querySelector('[data-program-id="assaf-ab-2026"]')
  if (!row) throw new Error('expected a row for assaf-ab-2026')
  await user.click(within(row as HTMLElement).getByRole('button', { name: 'Edit' }))
  await screen.findByLabelText('Program name', undefined, SETTLE)
  await user.click(screen.getByRole('button', { name: 'Save' }))

  expect(await screen.findByText(guardMessage, undefined, SETTLE)).toBeVisible()
})

test('O10 ProgramFeature a rejected save shows Couldn’t save — try again', async () => {
  const user = userEvent.setup()
  const services = createServices({ now: () => NOW, storageAvailable: true })
  services.programs.save = vi.fn(async () => {
    throw new Error('boom')
  })
  const navigate = vi.fn()
  const onInSession = vi.fn()
  render(
    <ServicesProvider services={services}>
      <ProgramFeature navigate={navigate} onInSession={onInSession} />
    </ServicesProvider>,
  )
  await screen.findByRole('heading', { name: 'A/B Split' }, SETTLE)

  const row = document.querySelector('[data-program-id="assaf-ab-2026"]')
  if (!row) throw new Error('expected a row for assaf-ab-2026')
  await user.click(within(row as HTMLElement).getByRole('button', { name: 'Edit' }))
  await screen.findByLabelText('Program name', undefined, SETTLE)
  await user.click(screen.getByRole('button', { name: 'Save' }))

  expect(await screen.findByText(SAVE_ERROR, undefined, SETTLE)).toBeVisible()
})
