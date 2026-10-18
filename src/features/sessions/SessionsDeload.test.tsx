import { render, screen, within } from '@testing-library/react'
import { beforeEach, expect, test } from 'vitest'
import { db } from '../../storage/db'
import { createServices } from '../../services'
import { ServicesProvider } from '../ServicesProvider'
import { SessionsScreen } from './SessionsScreen'

// E21-T10 [O21]: a deload Session's row says Deload in words. "Now" is Tue 13 Oct 2026, 18:00.

const at = (month: number, day: number, hour = 9): number => new Date(2026, month - 1, day, hour).getTime()
const NOW = at(10, 13, 18)
const SETTLE = { timeout: 2000 }

beforeEach(async () => {
  await db.open()
  await db.sessions.clear()
  await db.settings.clear()
})

async function seed(id: string, startedAt: number, deload: boolean): Promise<void> {
  await db.sessions.put({
    id,
    programId: 'assaf-ab-2026',
    workoutId: 'workout-a',
    startedAt,
    finishedAt: startedAt + 52 * 60_000,
    entries: [{ exerciseId: 'back-squat', setIndex: 1, weightKg: 60, reps: 8, loggedAt: startedAt + 60_000 }],
    updatedAt: startedAt + 60 * 60_000,
    ...(deload ? { deload: true as const } : {}),
  })
}

test('O21 a deload Session row carries a Deload label in words and a plain Session none', async () => {
  await seed('light', at(10, 13), true)
  await seed('plain', at(10, 12), false)
  const services = createServices({ now: () => NOW, storageAvailable: true })
  render(
    <ServicesProvider services={services}>
      <SessionsScreen navigate={() => {}} onInSession={() => {}} now={() => NOW} />
    </ServicesProvider>,
  )
  const rows = await screen.findAllByRole('button', { name: /Workout A/ }, SETTLE)
  expect(rows).toHaveLength(2)
  const [first, second] = rows
  expect(first).toHaveTextContent('Tue 13 Oct')
  expect(within(first).getByText('Deload')).toBeVisible()
  expect(second).toHaveTextContent('Mon 12 Oct')
  expect(within(second).queryByText('Deload')).toBeNull()
})
