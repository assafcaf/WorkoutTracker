import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { db } from '../../storage/db'
import { createServices } from '../../services'
import { ServicesProvider } from '../ServicesProvider'
import { WorkoutFeature } from './WorkoutFeature'

// Progress Dashboard S2/S3: the Live session's Now and All views, over the real services on
// fake-indexeddb, as WorkoutFeature.test.tsx drives them. The network is a signed-out phone.

const SETTLE = { timeout: 3000 }
const NOW = 1_700_000_000_000
const signedOutFetch = (async () => new Response(null, { status: 401 })) as typeof fetch

beforeEach(async () => {
  await db.open()
  await db.sessions.clear()
  await db.settings.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

/** Workout A on assaf-ab-2026 with `count` back squat Sets logged, rendered on its All view. */
async function startWorkoutAWithSets(count: number) {
  const services = createServices({ now: () => NOW, storageAvailable: true, fetch: signedOutFetch })
  await services.programs.setActive('assaf-ab-2026')
  const started = await services.sessions.start('assaf-ab-2026', 'workout-a')
  for (let index = 1; index <= count; index += 1) {
    await services.sessions.logSet(started.id, {
      exerciseId: 'back-squat',
      setIndex: index,
      weightKg: 60,
      reps: 8,
      loggedAt: NOW + index,
    })
  }
  const user = userEvent.setup()
  render(
    <ServicesProvider services={services}>
      <WorkoutFeature navigate={vi.fn()} onInSession={vi.fn()} />
    </ServicesProvider>,
  )
  await screen.findByRole('button', { name: /^Back squat/ }, SETTLE)
  return { user }
}

function counts(): string | undefined {
  return document.querySelector('.live-progress-counts')?.textContent ?? undefined
}

test('Live the session lands on All, with the projection line and the Now | All switch', async () => {
  await startWorkoutAWithSets(2)

  expect(screen.getByRole('radio', { name: 'All' })).toBeChecked()
  expect(counts()).toBe('Sets 2/23 · PRs 0')
})

test('Live Now opens the Exercise the session is on at its next Set, with the rest of the Workout under it', async () => {
  const { user } = await startWorkoutAWithSets(2)

  await user.click(screen.getByRole('radio', { name: 'Now' }))

  expect(await screen.findByText('Set 3 of 4', undefined, SETTLE)).toBeVisible()
  expect(screen.getByRole('radio', { name: 'Now' })).toBeChecked()
  const rest = screen.getByRole('list', { name: 'Rest of the workout' })
  expect(within(rest).getAllByRole('button')).toHaveLength(6)

  await user.click(screen.getByRole('radio', { name: 'All' }))
  expect(await screen.findByRole('button', { name: /^Back squat/ }, SETTLE)).toBeVisible()
})

test('Live All logs the pre-filled next Set in one tap, a whole-Session put', async () => {
  const { user } = await startWorkoutAWithSets(2)

  await user.click(screen.getByRole('button', { name: /^Log set 3 · 60 / }))

  await waitFor(() => expect(counts()).toBe('Sets 3/23 · PRs 0'), SETTLE)
  const stored = await db.sessions.toArray()
  expect(stored[0].entries.filter((entry) => entry.exerciseId === 'back-squat')).toHaveLength(3)
})

test('Live a done cell in All opens that Set on Now, ready to edit', async () => {
  const { user } = await startWorkoutAWithSets(2)

  await user.click(screen.getByRole('button', { name: /^Set 2 · 60 / }))

  expect(await screen.findByRole('button', { name: 'Save set' }, SETTLE)).toBeVisible()
})
