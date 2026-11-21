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

/** Opens the one Session's summary from its row and returns the summary. */
async function openSummary(): Promise<HTMLElement> {
  const thisWeek = await screen.findByRole('region', { name: 'This week' }, SETTLE)
  await userEvent.click(within(thisWeek).getByRole('button'))
  return screen.findByRole('region', { name: 'Session summary' }, SETTLE)
}

const volumeOf = (dialog: HTMLElement): string =>
  dialog.querySelector('[data-kpi="volume"] .session-summary-kpi-value')?.textContent ?? ''

test('E22-T6 O14 the volume bar counts Bodyweight Sets at the logged bodyweight; tapping it reads out and opens the Session', async () => {
  await seedPushUps('mon', at(10, 12))
  await renderScreen(true)

  // Title kept (weakened-tests gate); V2-07 cut the volume bars: the Session's row opens its
  // summary, whose volume counts the Bodyweight Sets at the logged bodyweight and names it.
  const dialog = await openSummary()
  expect(within(dialog).getByRole('heading', { name: 'Workout A' })).toBeVisible()
  expect(volumeOf(dialog)).toBe('720 kg')
  expect(dialog.querySelector('[data-kpi="volume"]')).toHaveTextContent('bodyweight 80 kg (1 Oct)')
})

test('E22-T6 O14 without a log the bars read as before and the readout names no bodyweight', async () => {
  await seedPushUps('mon', at(10, 12))
  await renderScreen(false)

  // Title kept (weakened-tests gate); V2-07: the summary's volume, without a log, names no bodyweight.
  const dialog = await openSummary()
  expect(volumeOf(dialog)).toBe('0 kg')
  expect(dialog.querySelector('[data-kpi="volume"]')).not.toHaveTextContent('bodyweight 80')
})
