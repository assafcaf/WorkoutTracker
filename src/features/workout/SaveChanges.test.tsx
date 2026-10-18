import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import { db } from '../../storage/db'
import { createServices } from '../../services'
import { ServicesProvider } from '../ServicesProvider'
import { WorkoutFeature } from './WorkoutFeature'

// E19-T15 O26: a finished Session with changes offers "Save changes to program" in its summary.
// Back squat is planned for 4 Sets in Workout A; 5 logged is an extension.

const SETTLE = { timeout: 3000 }
const signedOutFetch = (async () => new Response(null, { status: 401 })) as typeof fetch

beforeEach(async () => {
  await db.open()
  await db.sessions.clear()
  await db.settings.clear()
})

async function finishWithSquatSets(extra: number) {
  const services = createServices({
    now: () => Date.now(),
    storageAvailable: true,
    fetch: signedOutFetch,
  })
  await services.programs.setActive('assaf-ab-2026')
  const started = await services.sessions.start('assaf-ab-2026', 'workout-a')
  for (let index = 1; index <= 4 + extra; index += 1) {
    await services.sessions.logSet(started.id, {
      exerciseId: 'back-squat',
      setIndex: index,
      weightKg: 60,
      reps: 8,
      loggedAt: Date.now() - 1000 + index,
    })
  }
  const user = userEvent.setup()
  render(
    <ServicesProvider services={services}>
      <WorkoutFeature navigate={vi.fn()} onInSession={vi.fn()} />
    </ServicesProvider>,
  )
  await screen.findByRole('button', { name: /^Back squat/ }, SETTLE)
  await user.click(screen.getByRole('button', { name: 'Finish' }))
  const summary = await screen.findByRole('dialog', { name: 'Session summary' }, SETTLE)
  return { user, services, summary }
}

async function squatSets(services: ReturnType<typeof createServices>): Promise<number | undefined> {
  const { userPrograms } = await services.programs.load()
  return userPrograms
    .find((p) => p.id === 'assaf-ab-2026')
    ?.workouts.find((w) => w.id === 'workout-a')
    ?.exercises.find((e) => e.exerciseId === 'back-squat')?.sets
}

test('O26 the finish summary lists the change and Save writes it to the user copy of the Program', async () => {
  const { user, services, summary } = await finishWithSquatSets(1)
  const offer = within(summary).getByRole('region', { name: 'Save changes to program' })
  expect(within(offer).getByText(/Back squat/)).toBeVisible()

  await user.click(within(offer).getByRole('button', { name: 'Save' }))

  await waitFor(async () => expect(await squatSets(services)).toBe(5), SETTLE)
  expect(within(summary).queryByRole('button', { name: 'Save' })).toBeNull()
})

test('O26 Not now changes nothing in the Program', async () => {
  const { user, services, summary } = await finishWithSquatSets(1)

  await user.click(within(summary).getByRole('button', { name: 'Not now' }))

  expect(within(summary).queryByRole('region', { name: 'Save changes to program' })).toBeNull()
  expect(await squatSets(services)).toBeUndefined()
})

test('O26 a Session with no changes offers nothing to save', async () => {
  const { summary } = await finishWithSquatSets(0)

  expect(within(summary).queryByRole('region', { name: 'Save changes to program' })).toBeNull()
})
