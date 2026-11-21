// Photos2: a past workout opened from Sessions shows its day's progress photos. Its editor (Edit,
// or Log a past Session) has no Photos row: Body is the one way into Photos. "Now" is Tue 13 Oct 2026, 18:00 local.
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import { db } from '../../storage/db'
import type { Photo } from '../../storage/photoStore'
import { createServices } from '../../services'
import { ServicesProvider } from '../ServicesProvider'
import { SessionsScreen } from './SessionsScreen'

const at = (month: number, day: number, hour = 9): number => new Date(2026, month - 1, day, hour).getTime()
const NOW = at(10, 13, 18)
const SETTLE = { timeout: 3000 }

const photo = (angle: Photo['angle'], day: string): Photo => ({
  id: `${angle}-${day}`,
  day,
  angle,
  data: new Uint8Array([1]).buffer,
  type: 'image/jpeg',
  width: 8,
  height: 12,
  align: null,
  createdAt: 1,
})

beforeEach(async () => {
  await db.open()
  await db.sessions.clear()
  await db.settings.clear()
  await db.photos.clear()
  URL.createObjectURL = vi.fn(() => 'blob:test')
  URL.revokeObjectURL = vi.fn()
  await db.sessions.put({
    id: 'mon',
    programId: 'assaf-ab-2026',
    workoutId: 'workout-b',
    startedAt: at(10, 12),
    finishedAt: at(10, 12) + 3_000_000,
    entries: [{ exerciseId: 'back-squat', setIndex: 1, weightKg: 60, reps: 8, loggedAt: at(10, 12) + 60_000 }],
    updatedAt: at(10, 12) + 3_600_000,
  })
})

function renderScreen(): void {
  render(
    <ServicesProvider services={createServices({ now: () => NOW, storageAvailable: true })}>
      <SessionsScreen navigate={() => {}} onInSession={() => {}} now={() => NOW} />
    </ServicesProvider>,
  )
}

test('Photos2 O3 a past workout summary shows its day photos as one line, and none without photos', async () => {
  await db.photos.bulkPut([photo('front', '2026-10-12'), photo('back', '2026-10-12'), photo('side', '2026-10-11')])
  renderScreen()
  await userEvent.click(await screen.findByRole('button', { name: 'Workout B, Mon 12 Oct' }, SETTLE))
  const summary = await screen.findByRole('region', { name: 'Session summary' }, SETTLE)
  expect(await within(summary).findByRole('button', { name: '2 photos · front, back' }, SETTLE)).toBeVisible()
  expect(within(summary).queryByRole('button', { name: 'Add progress photos' })).toBeNull()
})

test('Photos2 Edit on a past workout has no Photos row and no Add photos; Body is the way into Photos', async () => {
  await db.photos.bulkPut([photo('front', '2026-10-12')])
  const user = userEvent.setup()
  renderScreen()
  await user.click(await screen.findByRole('button', { name: 'Workout B, Mon 12 Oct' }, SETTLE))
  await user.click(screen.getByRole('button', { name: 'Edit session' }))
  await screen.findByRole('heading', { name: 'Edit · Workout B · Mon 12 Oct' }, SETTLE)
  expect(screen.queryByRole('group', { name: 'Photos' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Add photos' })).toBeNull()
})

test('Photos2 Log a past Session has no Photos row', async () => {
  const user = userEvent.setup()
  renderScreen()
  await user.click(await screen.findByRole('button', { name: /^Log (past|a past workout)$/ }, SETTLE))
  await user.click(within(screen.getByRole('dialog', { name: 'Log a past Session' })).getByRole('button', { name: 'Log Workout A' }))
  await screen.findByRole('heading', { name: /^Log · Workout A · / }, SETTLE)
  expect(screen.queryByRole('group', { name: 'Photos' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Add photos' })).toBeNull()
})
