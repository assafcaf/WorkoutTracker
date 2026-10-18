import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { db } from '../../storage/db'
import { createServices } from '../../services'
import type { PushStatus } from '../../services'
import { ServicesProvider } from '../ServicesProvider'
import { WorkoutFeature } from './WorkoutFeature'

// E24-T10 O27, O29 (and O28 in the Session): the rest push scheduled and cancelled by the
// Session, over the real services with a stubbed push service.

const SETTLE = { timeout: 3000 }
const signedOutFetch = (async () => new Response(null, { status: 401 })) as typeof fetch

beforeEach(async () => {
  await db.open()
  await db.sessions.clear()
  await db.settings.clear()
})

afterEach(() => {
  Reflect.deleteProperty(navigator as unknown as Record<string, unknown>, 'setAppBadge')
  Reflect.deleteProperty(navigator as unknown as Record<string, unknown>, 'clearAppBadge')
  vi.restoreAllMocks()
})

async function startWorkoutA(options: {
  sets: number
  ageMs: number
  status?: PushStatus
  scheduleRest?: () => Promise<void>
}) {
  const services = createServices({ now: () => Date.now(), storageAvailable: true, fetch: signedOutFetch })
  const scheduleRest = vi.fn(options.scheduleRest ?? (async () => undefined))
  const cancelRest = vi.fn(async () => undefined)
  services.push = {
    ...services.push,
    status: async () => options.status ?? 'on',
    scheduleRest,
    cancelRest,
  }
  await services.programs.setActive('assaf-ab-2026')
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
  return { user, scheduleRest, cancelRest }
}

test('O27 a Set with a rest schedules its push once, labelled by the next set', async () => {
  const { scheduleRest } = await startWorkoutA({ sets: 2, ageMs: 1000 })

  await waitFor(() => expect(scheduleRest).toHaveBeenCalledTimes(1), SETTLE)
  const [endsAt, label] = scheduleRest.mock.calls[0] as unknown as [number, string]
  expect(endsAt).toBeGreaterThan(Date.now())
  expect(label).toBe('Back squat, set 3')
})

test('O27 the next Set schedules its own rest', async () => {
  const { user, scheduleRest } = await startWorkoutA({ sets: 2, ageMs: 1000 })
  await waitFor(() => expect(scheduleRest).toHaveBeenCalledTimes(1), SETTLE)

  await user.click(await screen.findByRole('button', { name: /^Log set 3 · 60 / }, SETTLE))

  await waitFor(() => expect(scheduleRest).toHaveBeenCalledTimes(2), SETTLE)
  expect((scheduleRest.mock.calls[1] as unknown as [number, string])[1]).toBe('Back squat, set 4')
})

test('O27 skipping the rest cancels the push', async () => {
  const { user, scheduleRest, cancelRest } = await startWorkoutA({ sets: 1, ageMs: 1000 })
  await waitFor(() => expect(scheduleRest).toHaveBeenCalled(), SETTLE)

  await user.click(screen.getByRole('radio', { name: 'Now' }))
  await user.click(await screen.findByRole('button', { name: 'Skip rest' }, SETTLE))

  await waitFor(() => expect(cancelRest).toHaveBeenCalled(), SETTLE)
})

test('O27 +15 s schedules the moved end', async () => {
  const { user, scheduleRest } = await startWorkoutA({ sets: 1, ageMs: 1000 })
  await waitFor(() => expect(scheduleRest).toHaveBeenCalledTimes(1), SETTLE)
  const first = (scheduleRest.mock.calls[0] as unknown as [number, string])[0]

  await user.click(screen.getByRole('radio', { name: 'Now' }))
  await user.click(await screen.findByRole('button', { name: '+15 s' }, SETTLE))

  await waitFor(() => expect(scheduleRest).toHaveBeenCalledTimes(2), SETTLE)
  expect((scheduleRest.mock.calls[1] as unknown as [number, string])[0]).toBe(first + 15_000)
})

test('O27 a rest already over cancels the push', async () => {
  const { cancelRest, scheduleRest } = await startWorkoutA({ sets: 2, ageMs: 600_000 })

  await waitFor(() => expect(cancelRest).toHaveBeenCalled(), SETTLE)
  expect(scheduleRest).not.toHaveBeenCalled()
})

test('O27 finishing the Session cancels the push', async () => {
  const { user, scheduleRest, cancelRest } = await startWorkoutA({ sets: 1, ageMs: 1000 })
  await waitFor(() => expect(scheduleRest).toHaveBeenCalled(), SETTLE)

  await user.click(screen.getByRole('button', { name: 'Finish' }))
  await screen.findByRole('dialog', { name: 'Session summary' }, SETTLE)

  await waitFor(() => expect(cancelRest).toHaveBeenCalled(), SETTLE)
})

test('O27 with push not on, neither schedule nor cancel is called', async () => {
  const { user, scheduleRest, cancelRest } = await startWorkoutA({ sets: 1, ageMs: 1000, status: 'off' })
  await user.click(screen.getByRole('button', { name: 'Finish' }))
  await screen.findByRole('dialog', { name: 'Session summary' }, SETTLE)

  await new Promise((resolve) => setTimeout(resolve, 300))
  expect(scheduleRest).not.toHaveBeenCalled()
  expect(cancelRest).not.toHaveBeenCalled()
})

test('O28 a Session in progress badges the icon, and finishing clears it', async () => {
  const setAppBadge = vi.fn().mockResolvedValue(undefined)
  const clearAppBadge = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'setAppBadge', { value: setAppBadge, configurable: true })
  Object.defineProperty(navigator, 'clearAppBadge', { value: clearAppBadge, configurable: true })

  const { user } = await startWorkoutA({ sets: 1, ageMs: 1000 })
  await waitFor(() => expect(setAppBadge).toHaveBeenCalledWith(1), SETTLE)

  await user.click(screen.getByRole('button', { name: 'Finish' }))
  await screen.findByRole('dialog', { name: 'Session summary' }, SETTLE)
  await waitFor(() => expect(clearAppBadge).toHaveBeenCalled(), SETTLE)
})

test('O29 logging a Set stays one tap while scheduleRest is pending', async () => {
  const { user } = await startWorkoutA({
    sets: 2,
    ageMs: 600_000,
    scheduleRest: () => new Promise<void>(() => undefined),
  })

  await user.click(screen.getByRole('button', { name: /^Log set 3 · 60 / }))

  await waitFor(async () => {
    const [stored] = await db.sessions.toArray()
    expect(stored.entries).toHaveLength(3)
  }, SETTLE)
})

test('O29 logging a Set stays one tap while scheduleRest fails', async () => {
  const { user } = await startWorkoutA({
    sets: 2,
    ageMs: 600_000,
    scheduleRest: async () => {
      throw new Error('push down')
    },
  })

  await user.click(screen.getByRole('button', { name: /^Log set 3 · 60 / }))

  await waitFor(async () => {
    const [stored] = await db.sessions.toArray()
    expect(stored.entries).toHaveLength(3)
  }, SETTLE)
})
