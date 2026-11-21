import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test } from 'vitest'
import { db } from '../../storage/db'
import { createServices } from '../../services'
import type { AppRoute } from '../routes'
import { ServicesProvider } from '../ServicesProvider'
import { SessionsScreen } from './SessionsScreen'

// V6-13: from Sessions, log a missed Session (a date and a Workout, then its Sets in the Session
// editor) and add an Exercise to a past Session. V6-14: the editor's one header. Real services on
// fake-indexeddb; "now" is Tue 13 Oct 2026, 18:00 local.

const at = (month: number, day: number, hour = 9): number => new Date(2026, month - 1, day, hour).getTime()
const NOW = at(10, 13, 18)
const SETTLE = { timeout: 2000 }

beforeEach(async () => {
  await db.open()
  await db.sessions.clear()
  await db.settings.clear()
  await db.settings.put({ key: 'activeProgramId', value: 'assaf-ab-2026', updatedAt: NOW })
})

function navigate(_to: AppRoute): void {}
function onInSession(_inSession: boolean): void {}

async function seedSession(id: string, startedAt: number): Promise<void> {
  await db.sessions.put({
    id,
    programId: 'assaf-ab-2026',
    workoutId: 'workout-a',
    startedAt,
    finishedAt: startedAt + 52 * 60_000,
    entries: [1, 2, 3].map((setIndex) => ({
      exerciseId: 'back-squat',
      setIndex,
      weightKg: 60,
      reps: 8,
      loggedAt: startedAt + setIndex * 60_000,
    })),
    updatedAt: startedAt + 60 * 60_000,
  })
}

function renderScreen(): void {
  const services = createServices({ now: () => NOW, storageAvailable: true })
  render(
    <ServicesProvider services={services}>
      <SessionsScreen navigate={navigate} onInSession={onInSession} now={() => NOW} />
    </ServicesProvider>,
  )
}

test('V6-13 Log a past Session: a date and a Workout open the editor on its Sets, and Save adds the Session', async () => {
  await seedSession('mon', at(10, 12))
  renderScreen()
  const user = userEvent.setup()

  // DX-11: the header's text button says what it does.
  await user.click(await screen.findByRole('button', { name: 'Log past' }, SETTLE))
  const sheet = screen.getByRole('dialog', { name: 'Log a past Session' })
  // N1: a visible way out.
  expect(within(sheet).getByRole('button', { name: 'Close' })).toBeVisible()
  const date = within(sheet).getByLabelText('Date') as HTMLInputElement
  expect(date.max).toBe('2026-10-13')
  fireEvent.change(date, { target: { value: '2026-10-10' } })
  await user.click(within(sheet).getByRole('button', { name: 'Log Workout B' }))

  expect(await screen.findByRole('heading', { name: 'Log · Workout B · Sat 10 Oct', level: 1 }, SETTLE)).toBeVisible()
  // Workout B's first Plan, Deadlift, never logged: its Sets open at its start weight.
  expect(screen.getByRole('group', { name: 'Deadlift' })).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Save' }))

  const lastWeek = await screen.findByRole('region', { name: 'Last week' }, SETTLE)
  expect(within(lastWeek).getByRole('button', { name: /Sat 10 Oct.*Workout B/ })).toBeVisible()
  const stored = (await db.sessions.toArray()).find((session) => session.workoutId === 'workout-b')
  expect(stored?.finishedAt).not.toBeNull()
  expect(new Date(stored?.startedAt ?? 0).getDate()).toBe(10)
})

test('V6-13 Cancel on a logged-past draft stores nothing', async () => {
  renderScreen()
  const user = userEvent.setup()

  // DX-21: with nothing finished yet, the empty state's one action is the way in.
  await user.click(await screen.findByRole('button', { name: 'Log a past Session' }, SETTLE))
  await user.click(within(screen.getByRole('dialog', { name: 'Log a past Session' })).getByRole('button', { name: 'Log Workout A' }))
  await screen.findByRole('heading', { name: /^Log · Workout A · Mon 12 Oct$/ }, SETTLE)
  await user.click(screen.getByRole('button', { name: 'Cancel' }))

  expect(await screen.findByText('Your Sessions appear here.', {}, SETTLE)).toBeVisible()
  expect(await db.sessions.count()).toBe(0)
})

test('V6-14 the Session editor shows one header, "Edit · Workout A · Mon 12 Oct", and no Sessions title', async () => {
  await seedSession('mon', at(10, 12))
  renderScreen()
  const user = userEvent.setup()

  await user.click(await screen.findByRole('button', { name: /Mon 12 Oct.*Workout A/ }, SETTLE))
  await user.click(screen.getByRole('button', { name: 'Edit session' }))

  expect(await screen.findByRole('heading', { name: 'Edit · Workout A · Mon 12 Oct' }, SETTLE)).toBeVisible()
  expect(screen.queryByRole('heading', { name: 'Sessions' })).toBeNull()
})

test('V6-13 an Exercise added to a past Session in the editor is saved with it', async () => {
  await seedSession('mon', at(10, 12))
  renderScreen()
  const user = userEvent.setup()

  await user.click(await screen.findByRole('button', { name: /Mon 12 Oct.*Workout A/ }, SETTLE))
  await user.click(screen.getByRole('button', { name: 'Edit session' }))
  await user.click(await screen.findByRole('button', { name: 'Add exercise' }, SETTLE))
  // DX-22: the picker adds to this Session; DX-08: with "My gym only" like every picker.
  const picker = screen.getByRole('dialog', { name: 'Add to this Session' })
  expect(within(picker).getByRole('button', { name: 'My gym only' })).toBeVisible()
  await user.type(within(picker).getByRole('searchbox', { name: 'Search exercises' }), 'deadlift')
  await user.click(within(picker).getByRole('button', { name: 'Deadlift' }))
  // The added Set opens in the Set sheet; its Save keeps it, then the editor's Save stores it.
  await user.click(within(screen.getByRole('dialog', { name: 'Deadlift · Set 1' })).getByRole('button', { name: 'Save' }))
  await user.click(screen.getByRole('button', { name: 'Save' }))

  await waitFor(async () => {
    const stored = await db.sessions.get('mon')
    expect(stored?.entries.filter((entry) => entry.exerciseId === 'deadlift')).toHaveLength(1)
  }, SETTLE)
})

test('N1 the Log a past Session sheet closes with its X', async () => {
  await seedSession('mon', at(10, 12))
  renderScreen()
  const user = userEvent.setup()

  await user.click(await screen.findByRole('button', { name: 'Log past' }, SETTLE))
  await user.click(within(screen.getByRole('dialog', { name: 'Log a past Session' })).getByRole('button', { name: 'Close' }))
  expect(screen.queryByRole('dialog', { name: 'Log a past Session' })).toBeNull()
})
