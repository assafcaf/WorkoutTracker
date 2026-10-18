import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test } from 'vitest'
import { db } from '../../storage/db'
import { createServices } from '../../services'
import { ServicesProvider } from '../ServicesProvider'
import { SessionsScreen } from './SessionsScreen'

// E22-T6, O14. "Now" is Tue 13 Oct 2026, 18:00 local.

const at = (month: number, day: number, hour = 9): number => new Date(2026, month - 1, day, hour).getTime()
const NOW = at(10, 13, 18)
const SETTLE = { timeout: 2000 }

beforeEach(async () => {
  await db.open()
  await db.sessions.clear()
  await db.settings.clear()
})

async function seedPushUps(id: string, startedAt: number): Promise<void> {
  await db.sessions.put({
    id,
    programId: 'assaf-ab-2026',
    workoutId: 'workout-a',
    startedAt,
    finishedAt: startedAt + 3_000_000,
    entries: [
      { exerciseId: 'push-ups', setIndex: 1, weightKg: null, loadKg: 10, reps: 8, loggedAt: startedAt + 60_000 },
    ],
    updatedAt: startedAt + 3_600_000,
  })
}

async function renderScreen(weigh: boolean): Promise<void> {
  const services = createServices({ now: () => NOW, storageAvailable: true })
  if (weigh) await services.preferences.saveBodyEntry({ day: '2026-10-01', weightKg: 80 })
  render(
    <ServicesProvider services={services}>
      <SessionsScreen navigate={() => {}} onInSession={() => {}} now={() => NOW} />
    </ServicesProvider>,
  )
}

const barValues = (card: HTMLElement): string[] =>
  [...card.querySelectorAll('.bar-chart-bar')].map((bar) => bar.getAttribute('data-value') ?? '')

test('E22-T6 O14 the volume bar counts Bodyweight Sets at the logged bodyweight; tapping it reads out and opens the Session', async () => {
  await seedPushUps('mon', at(10, 12))
  await renderScreen(true)

  const card = await screen.findByRole('region', { name: 'Volume per session, kg' }, SETTLE)
  expect(barValues(card)).toEqual(['720'])
  await userEvent.click(within(card).getByRole('button', { name: /12 Oct/ }))
  const readout = within(card).getByRole('region', { name: 'Chart readout' })
  expect(readout).toHaveTextContent('12 Oct')
  expect(readout).toHaveTextContent('720')
  expect(readout).toHaveTextContent('Workout A')
  expect(readout).toHaveTextContent('Bodyweight 80 kg (1 Oct) counted')

  await userEvent.click(within(readout).getByRole('button', { name: /Open session/ }))
  const dialog = await screen.findByRole('dialog', { name: 'Session summary' }, SETTLE)
  expect(within(dialog).getByRole('heading', { name: 'Workout A' })).toBeVisible()
})

test('E22-T6 O14 without a log the bars read as before and the readout names no bodyweight', async () => {
  await seedPushUps('mon', at(10, 12))
  await renderScreen(false)

  const card = await screen.findByRole('region', { name: 'Volume per session, kg' }, SETTLE)
  expect(barValues(card)).toEqual(['0'])
  await userEvent.click(within(card).getByRole('button', { name: /12 Oct/ }))
  expect(within(card).getByRole('region', { name: 'Chart readout' })).not.toHaveTextContent('Bodyweight')
})
