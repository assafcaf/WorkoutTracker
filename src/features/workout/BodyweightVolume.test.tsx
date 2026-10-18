import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import { db } from '../../storage/db'
import { createServices } from '../../services'
import type { Session } from '../../types'
import { ServicesProvider } from '../ServicesProvider'
import { WorkoutFeature } from './WorkoutFeature'

// E22-T11 O16 at the Workout flow: assisted pull-ups BW-20 x 10 at 80 kg = 600 kg, live and at Finish.

const SETTLE = { timeout: 3000 }
const NOW = new Date(2026, 9, 18, 12).getTime()
const STARTED = NOW - 3_600_000
const signedOutFetch = (async () => new Response(null, { status: 401 })) as typeof fetch

beforeEach(async () => {
  await db.open()
  await db.sessions.clear()
  await db.settings.clear()
})

async function renderWithActivePullups(weighed: boolean) {
  const services = createServices({ now: () => NOW, storageAvailable: true, fetch: signedOutFetch })
  await services.programs.setActive('assaf-ab-2026')
  if (weighed) await services.preferences.saveBodyEntry({ day: '2026-10-01', weightKg: 80 })
  await db.sessions.put({
    id: 'live',
    programId: 'assaf-ab-2026',
    workoutId: 'workout-b',
    startedAt: STARTED,
    finishedAt: null,
    entries: [
      { exerciseId: 'assisted-pull-ups', setIndex: 1, weightKg: null, loadKg: -20, reps: 10, loggedAt: STARTED + 1 },
    ],
  } as Session)
  const user = userEvent.setup()
  render(
    <ServicesProvider services={services}>
      <WorkoutFeature navigate={vi.fn()} onInSession={vi.fn()} />
    </ServicesProvider>,
  )
  return { user }
}

test('O16 the live Session volume counts Bodyweight Sets at the latest bodyweight', async () => {
  await renderWithActivePullups(true)
  expect(await screen.findByText(/^Volume/, undefined, SETTLE)).toHaveTextContent('600 kg')
})

test('O16 the finish summary counts them and names the bodyweight', async () => {
  const { user } = await renderWithActivePullups(true)
  await user.click(await screen.findByRole('button', { name: 'Finish' }, SETTLE))
  const summary = await screen.findByRole('dialog', { name: 'Session summary' }, SETTLE)
  const volume = summary.querySelector('[data-kpi="volume"]')
  expect(volume).toHaveTextContent('600 kg')
  expect(volume).toHaveTextContent('· bodyweight 80 kg (1 Oct)')
})

test('O16 without a body log the live volume and the summary note are as before', async () => {
  const { user } = await renderWithActivePullups(false)
  expect(await screen.findByText(/^Volume/, undefined, SETTLE)).toHaveTextContent('0 kg')
  await user.click(await screen.findByRole('button', { name: 'Finish' }, SETTLE))
  const summary = await screen.findByRole('dialog', { name: 'Session summary' }, SETTLE)
  expect(summary.querySelector('[data-kpi="volume"]')).toHaveTextContent('· 10 bodyweight reps')
})
