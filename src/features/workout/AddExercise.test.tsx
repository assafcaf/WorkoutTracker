import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import { db } from '../../storage/db'
import { createServices } from '../../services'
import { ServicesProvider } from '../ServicesProvider'
import { WorkoutFeature } from './WorkoutFeature'

// E19-T13 O23: Add exercise at the end of the All view, over the real services on fake-indexeddb.

const SETTLE = { timeout: 3000 }
const signedOutFetch = (async () => new Response(null, { status: 401 })) as typeof fetch

beforeEach(async () => {
  await db.open()
  await db.sessions.clear()
  await db.settings.clear()
})

async function openAllView() {
  const services = createServices({
    now: () => Date.now(),
    storageAvailable: true,
    fetch: signedOutFetch,
  })
  await services.programs.setActive('assaf-ab-2026')
  await services.sessions.start('assaf-ab-2026', 'workout-a')
  const user = userEvent.setup()
  render(
    <ServicesProvider services={services}>
      <WorkoutFeature navigate={vi.fn()} onInSession={vi.fn()} />
    </ServicesProvider>,
  )
  await screen.findByRole('button', { name: /^Back squat/ }, SETTLE)
  return { user, services }
}

function plannedSets(): number {
  const counts = document.querySelector('.live-progress-counts')?.textContent ?? ''
  return Number(/\/(\d+)/.exec(counts)?.[1])
}

async function addBenchPress(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Add exercise' }))
  const picker = await screen.findByRole('dialog', { name: /add exercise/i }, SETTLE)
  await user.type(within(picker).getByRole('searchbox', { name: /search/i }), 'bech press')
  await user.click(await within(picker).findByRole('button', { name: 'Dumbbell Bench Press' }, SETTLE))
}

test('O23 Add exercise picks an Exercise that appears last in the list as 3 x 8-12', async () => {
  const { user } = await openAllView()

  await addBenchPress(user)

  const added = await screen.findByRole('button', { name: /^Dumbbell Bench Press/ }, SETTLE)
  expect(added).toHaveTextContent('3 × 8–12')
  const rows = document.querySelectorAll('.exercise-list > li')
  expect(rows[rows.length - 1]).toContainElement(added)
  expect(screen.queryByRole('dialog', { name: /add exercise/i })).toBeNull()
})

test('O23 the added Exercise counts its 3 planned Sets in the live progress', async () => {
  const { user } = await openAllView()
  const before = plannedSets()

  await addBenchPress(user)

  await screen.findByRole('button', { name: /^Dumbbell Bench Press/ }, SETTLE)
  await waitFor(() => expect(plannedSets()).toBe(before + 3), SETTLE)
})

test('O23 the added Exercise logs like any other and shows in the summary and the stored Session', async () => {
  const { user } = await openAllView()
  await addBenchPress(user)

  await user.click(await screen.findByRole('button', { name: /^Dumbbell Bench Press/ }, SETTLE))
  await user.click(await screen.findByRole('button', { name: 'Log set' }, SETTLE))

  await waitFor(async () => {
    const [stored] = await db.sessions.toArray()
    expect(stored.entries.filter((e) => e.exerciseId === 'Dumbbell_Bench_Press')).toHaveLength(1)
    expect(stored.added?.map((plan) => plan.exerciseId)).toEqual(['Dumbbell_Bench_Press'])
  }, SETTLE)

  await user.click(await screen.findByRole('radio', { name: 'All' }, SETTLE))
  await user.click(await screen.findByRole('button', { name: 'Finish' }, SETTLE))
  const summary = await screen.findByRole('dialog', { name: 'Session summary' }, SETTLE)
  expect(within(summary).getAllByText(/Dumbbell Bench Press/).length).toBeGreaterThan(0)
})
