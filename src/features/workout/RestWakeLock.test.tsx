import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { db } from '../../storage/db'
import { createServices } from '../../services'
import { ServicesProvider } from '../ServicesProvider'
import { WorkoutFeature } from './WorkoutFeature'

// E19-T7 O12, O13 (and O10): the Session-wide rest wake lock, over the real services on
// fake-indexeddb. The exercise list (the All view) has no set screen of its own, so a lock held
// there is the Session's, not the set screen's E1 lock.

const SETTLE = { timeout: 3000 }
const signedOutFetch = (async () => new Response(null, { status: 401 })) as typeof fetch
const BACK_SQUAT_REST_MS = 180_000

type Sentinel = { release: ReturnType<typeof vi.fn> }
let requests: Sentinel[] = []

function stubWakeLock(): void {
  requests = []
  const request = vi.fn(async () => {
    const sentinel: Sentinel = { release: vi.fn().mockResolvedValue(undefined) }
    requests.push(sentinel)
    return sentinel
  })
  Object.defineProperty(navigator, 'wakeLock', { value: { request }, configurable: true })
}

function held(): number {
  return requests.filter((sentinel) => sentinel.release.mock.calls.length === 0).length
}

beforeEach(async () => {
  await db.open()
  await db.sessions.clear()
  await db.settings.clear()
  stubWakeLock()
})

afterEach(() => {
  Reflect.deleteProperty(navigator as unknown as Record<string, unknown>, 'wakeLock')
  vi.restoreAllMocks()
})

/** Workout A with back squat Sets logged `ageMs` ago, rendered on its exercise list. */
async function startWorkoutA(options: { sets: number; ageMs: number; keepOn?: boolean }) {
  const services = createServices({
    now: () => Date.now(),
    storageAvailable: true,
    fetch: signedOutFetch,
  })
  await services.programs.setActive('assaf-ab-2026')
  if (options.keepOn === false) await services.preferences.setKeepScreenOnDuringRest(false)
  const started = await services.sessions.start('assaf-ab-2026', 'workout-a')
  for (let index = 1; index <= options.sets; index += 1) {
    await services.sessions.logSet(started.id, {
      exerciseId: 'back-squat',
      setIndex: index,
      weightKg: 60,
      reps: 8,
      loggedAt: Date.now() - options.ageMs + index,
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

test('O12 a screen wake lock is held on the exercise list while a rest runs', async () => {
  await startWorkoutA({ sets: 2, ageMs: 1000 })

  await waitFor(() => expect(held()).toBe(1), SETTLE)
  expect(requests.length).toBe(1)
})

test('O12 no rest wake lock is held on the exercise list when the rest is already over', async () => {
  await startWorkoutA({ sets: 2, ageMs: BACK_SQUAT_REST_MS + 60_000 })

  await new Promise((resolve) => setTimeout(resolve, 300))
  expect(held()).toBe(0)
})

test('O12 logging a Set requests a screen wake lock, and it stays one tap', async () => {
  const { user } = await startWorkoutA({ sets: 2, ageMs: BACK_SQUAT_REST_MS + 60_000 })
  expect(held()).toBe(0)

  await user.click(screen.getByRole('button', { name: /^Log set 3 · 60 / }))

  await waitFor(() => expect(held()).toBe(1), SETTLE)
  const [stored] = await db.sessions.toArray()
  expect(stored.entries).toHaveLength(3)
})

test('O12 the lock is released when the rest runs out', async () => {
  await startWorkoutA({ sets: 1, ageMs: BACK_SQUAT_REST_MS - 1200 })
  await waitFor(() => expect(requests.length).toBe(1), SETTLE)

  await waitFor(() => expect(held()).toBe(0), SETTLE)
})

test('O12 the lock is released when the rest is skipped', async () => {
  const { user } = await startWorkoutA({ sets: 1, ageMs: 1000 })
  await waitFor(() => expect(held()).toBe(1), SETTLE)

  await user.click(screen.getByRole('radio', { name: 'Now' }))
  await user.click(await screen.findByRole('button', { name: 'Skip rest' }, SETTLE))
  await user.click(screen.getByRole('radio', { name: 'All' }))
  await screen.findByRole('button', { name: /^Back squat/ }, SETTLE)

  await waitFor(() => expect(held()).toBe(0), SETTLE)
})

test('O12 the lock is released when the Session is finished', async () => {
  const { user } = await startWorkoutA({ sets: 1, ageMs: 1000 })
  await waitFor(() => expect(held()).toBe(1), SETTLE)

  await user.click(screen.getByRole('button', { name: 'Finish' }))
  await screen.findByRole('dialog', { name: 'Session summary' }, SETTLE)

  await waitFor(() => expect(held()).toBe(0), SETTLE)
})

test('O13 with Keep screen on during rest off, logging a Set requests no wake lock', async () => {
  const { user } = await startWorkoutA({
    sets: 2,
    ageMs: BACK_SQUAT_REST_MS + 60_000,
    keepOn: false,
  })

  await user.click(screen.getByRole('button', { name: /^Log set 3 · 60 / }))

  await waitFor(async () => {
    const [stored] = await db.sessions.toArray()
    expect(stored.entries).toHaveLength(3)
  }, SETTLE)
  await new Promise((resolve) => setTimeout(resolve, 300))
  expect(requests.length).toBe(0)
})
