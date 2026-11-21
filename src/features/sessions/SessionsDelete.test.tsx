import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test } from 'vitest'
import { db } from '../../storage/db'
import { createServices } from '../../services'
import { ServicesProvider } from '../ServicesProvider'
import { SessionsScreen } from './SessionsScreen'

// V5: the owner found deleting a workout convoluted (open it, Edit, then Delete). A Session
// opened on Sessions, from its row or its calendar day, is deleted from its editor (DX-11: one
// "Delete Session", at once); "Session deleted · Undo" takes it back for 8 s. "Now" is Tue 13 Oct
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

/** Opens the Session on `day` and deletes it from its editor's Delete Session (DX-11). */
async function deleteFromEditor(day: string): Promise<void> {
  await userEvent.click(await screen.findByRole('button', { name: day }, SETTLE))
  const summary = await screen.findByRole('dialog', { name: 'Session summary' }, SETTLE)
  await userEvent.click(within(summary).getByRole('button', { name: 'Edit session' }))
  await userEvent.click(await screen.findByRole('button', { name: 'Delete Session' }, SETTLE))
}

test('DX-11 Delete Session deletes it at once: its row, its calendar day and the count go', async () => {
  await seed('mon', at(10, 12), 'workout-b')
  await seed('fri', at(10, 9), 'workout-a')
  renderScreen()

  await deleteFromEditor('Workout B, Mon 12 Oct')

  expect(screen.queryByRole('dialog', { name: 'Session summary' })).toBeNull()
  // DX-11: "Session deleted · Undo", no separator trailing before Undo.
  expect(await screen.findByRole('status')).toHaveTextContent('Session deletedUndo')
  await waitFor(() => expect(rows()).toHaveLength(1), SETTLE)
  expect(rows()[0]).toHaveTextContent('Workout A')
  expect(screen.queryByRole('button', { name: 'Workout B, Mon 12 Oct' })).toBeNull()
  const calendar = screen.getByRole('region', { name: 'Last 6 weeks' })
  expect(calendar.querySelector('.sessions-calendar-head')?.textContent).toBe('Last 6 weeks · 1 session')
  // Marked deleted, not removed, so the delete syncs to other devices.
  expect((await db.sessions.get('mon'))?.deletedAt).toBe(NOW)
})

test('DX-11 Undo after Delete Session puts the Session back, in the list, the calendar and storage', async () => {
  await seed('mon', at(10, 12), 'workout-b')
  renderScreen()

  await deleteFromEditor('Workout B, Mon 12 Oct')
  await screen.findByText('Your Sessions appear here.', {}, SETTLE)

  await userEvent.click(within(screen.getByRole('status')).getByRole('button', { name: 'Undo' }))
  expect(await screen.findByRole('button', { name: 'Workout B, Mon 12 Oct' }, SETTLE)).toBeVisible()
  expect(rows()).toHaveLength(1)
  expect(screen.queryByRole('status')).toBeNull()
  const stored = await db.sessions.get('mon')
  expect(stored?.deletedAt).toBeUndefined()
  expect(stored?.entries).toHaveLength(1)
})

test('DX-11 Delete Session is offered once: in the editor, not beside Save, and not on the open Session', async () => {
  await seed('mon', at(10, 12), 'workout-b')
  renderScreen()

  await userEvent.click(await screen.findByRole('button', { name: 'Workout B, Mon 12 Oct' }, SETTLE))
  const summary = await screen.findByRole('dialog', { name: 'Session summary' }, SETTLE)
  await userEvent.click(within(summary).getByRole('button', { name: 'Edit session' }))

  const remove = await screen.findByRole('button', { name: 'Delete Session' }, SETTLE)
  expect(screen.getAllByRole('button', { name: /delete/i })).toEqual([remove])
  expect(remove.closest('.session-editor-bar')).toBeNull()
})
