// Photos2 O1: the summary right after Finish offers "Add progress photos" for the Session's day.
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import { db } from '../../storage/db'
import { createServices } from '../../services'
import { ServicesProvider } from '../ServicesProvider'
import { WorkoutFeature } from './WorkoutFeature'
import { finishWorkout } from '../../test/live'

const SETTLE = { timeout: 3000 }
const signedOutFetch = (async () => new Response(null, { status: 401 })) as typeof fetch

beforeEach(async () => {
  await db.open()
  await db.sessions.clear()
  await db.settings.clear()
  await db.photos.clear()
})

test('Photos2 O1 the finish summary has one Add progress photos action that opens the capture screen', async () => {
  const services = createServices({ now: () => Date.now(), storageAvailable: true, fetch: signedOutFetch })
  await services.programs.setActive('assaf-ab-2026')
  const started = await services.sessions.start('assaf-ab-2026', 'workout-a')
  await services.sessions.logSet(started.id, {
    exerciseId: 'back-squat',
    setIndex: 1,
    weightKg: 60,
    reps: 8,
    loggedAt: Date.now() - 1000,
  })
  const user = userEvent.setup()
  render(
    <ServicesProvider services={services}>
      <WorkoutFeature navigate={vi.fn()} onInSession={vi.fn()} />
    </ServicesProvider>,
  )
  await screen.findByRole('button', { name: 'All exercises' }, SETTLE)
  await finishWorkout(user)
  const summary = await screen.findByRole('dialog', { name: 'Session summary' }, SETTLE)
  const add = await within(summary).findByRole('button', { name: 'Add progress photos' }, SETTLE)
  expect(within(summary).getAllByRole('button', { name: /photo/i })).toHaveLength(1)
  await user.click(add)
  expect(await screen.findByRole('heading', { name: 'New photo' })).toBeVisible()
})
