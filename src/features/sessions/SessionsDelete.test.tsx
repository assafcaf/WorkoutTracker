import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test } from 'vitest'
import { db } from '../../storage/db'
import { createServices } from '../../services'
import { ServicesProvider } from '../ServicesProvider'
import { SessionsScreen } from './SessionsScreen'

// V5: the owner found deleting a workout convoluted (open it, Edit, then Delete). A Session
// opened on Sessions, from its row or its calendar day, now offers "Delete workout" at once; the
// delete happens straight away and "Workout deleted · Undo" takes it back. "Now" is Tue 13 Oct
// 2026, 18:00 local.

const at = (month: number, day: number, hour = 9): number => new Date(2026, month - 1, day, hour).getTime()
const NOW = at(10, 13, 18)
const SETTLE = { timeout: 2000 }

beforeEach(async () => {
  await db.open()
  await db.sessions.clear()
  await db.settings.clear()
})

async function seed(id: string, startedAt: number, workoutId: 'workout-a' | 'workout-b'): Promise<void> {
  await db.sessions.put({
    id,
    programId: 'assaf-ab-2026',
    workoutId,
    startedAt,
    finishedAt: startedAt + 3_000_000,
    entries: [{ exerciseId: 'back-squat', setIndex: 1, weightKg: 60, reps: 8, loggedAt: startedAt + 60_000 }],
    updatedAt: startedAt + 3_600_000,
  })
}

function renderScreen(): void {
  render(
    <ServicesProvider services={createServices({ now: () => NOW, storageAvailable: true })}>
      <SessionsScreen navigate={() => {}} onInSession={() => {}} now={() => NOW} />
    </ServicesProvider>,
  )
}

const rows = (): HTMLElement[] => [...document.querySelectorAll<HTMLElement>('.session-row')]

test('V5 Delete workout on an opened Session deletes it at once: its row, its calendar day and the count go', async () => {
  await seed('mon', at(10, 12), 'workout-b')
  await seed('fri', at(10, 9), 'workout-a')
  renderScreen()

  await userEvent.click(await screen.findByRole('button', { name: 'Workout B, Mon 12 Oct' }, SETTLE))
  const summary = await screen.findByRole('dialog', { name: 'Session summary' }, SETTLE)
  await userEvent.click(within(summary).getByRole('button', { name: 'Delete workout' }))

  expect(screen.queryByRole('dialog', { name: 'Session summary' })).toBeNull()
  expect(await screen.findByRole('status')).toHaveTextContent('Workout deleted ·Undo')
  await waitFor(() => expect(rows()).toHaveLength(1), SETTLE)
  expect(rows()[0]).toHaveTextContent('Workout A')
  expect(screen.queryByRole('button', { name: 'Workout B, Mon 12 Oct' })).toBeNull()
  const calendar = screen.getByRole('region', { name: 'Last 6 weeks' })
  expect(calendar.querySelector('.sessions-calendar-head')?.textContent).toBe('Last 6 weeks · 1 session')
  // Marked deleted, not removed, so the delete syncs to other devices.
  expect((await db.sessions.get('mon'))?.deletedAt).toBe(NOW)
})

test('V5 Undo after Delete workout puts the Session back, in the list, the calendar and storage', async () => {
  await seed('mon', at(10, 12), 'workout-b')
  renderScreen()

  await userEvent.click(await screen.findByRole('button', { name: 'Workout B, Mon 12 Oct' }, SETTLE))
  const summary = await screen.findByRole('dialog', { name: 'Session summary' }, SETTLE)
  await userEvent.click(within(summary).getByRole('button', { name: 'Delete workout' }))
  await screen.findByText(/No finished workouts yet/, {}, SETTLE)

  await userEvent.click(within(screen.getByRole('status')).getByRole('button', { name: 'Undo' }))
  expect(await screen.findByRole('button', { name: 'Workout B, Mon 12 Oct' }, SETTLE)).toBeVisible()
  expect(rows()).toHaveLength(1)
  expect(screen.queryByRole('status')).toBeNull()
  const stored = await db.sessions.get('mon')
  expect(stored?.deletedAt).toBeUndefined()
  expect(stored?.entries).toHaveLength(1)
})

test('V5 the editor’s Delete workout also deletes at once with Undo', async () => {
  await seed('mon', at(10, 12), 'workout-b')
  renderScreen()

  await userEvent.click(await screen.findByRole('button', { name: 'Workout B, Mon 12 Oct' }, SETTLE))
  const summary = await screen.findByRole('dialog', { name: 'Session summary' }, SETTLE)
  await userEvent.click(within(summary).getByRole('button', { name: 'Edit session' }))
  await userEvent.click(await screen.findByRole('button', { name: 'Delete workout' }, SETTLE))
  // The editor's own inline confirm stays.
  await userEvent.click(screen.getByRole('button', { name: 'Confirm' }))

  expect(await screen.findByRole('status', {}, SETTLE)).toHaveTextContent('Workout deleted')
  await screen.findByText(/No finished workouts yet/, {}, SETTLE)
})
