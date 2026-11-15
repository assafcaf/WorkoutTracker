import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { UserEvent } from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { db } from '../../storage/db'
import { createServices, type Services } from '../../services'
import type { Session } from '../../types'
import { ServicesProvider } from '../ServicesProvider'
import { startFromDashboard } from '../../test/dashboard'
import { showAll } from '../../test/live'
import { WorkoutFeature } from './WorkoutFeature'

// UX iteration 6 (docs/ux-expert/iterations/v5/report.md), the live Session over the real
// services on fake-indexeddb, as WorkoutFeature.test.tsx drives it:
// - V5-01: Discard lands on Train with "Workout discarded · Undo", and Undo brings the Session
//   back as it was.
// - V5-02: a swapped-in Exercise opens on one Preset wherever it is shown (Now, All, Now again),
//   and Now keeps a quiet "for <planned> · Undo swap" line while the swap stands.

const NOW = 1_700_000_000_000
const SETTLE = { timeout: 3000 }
const signedOutFetch = (async () => new Response(null, { status: 401 })) as typeof fetch

beforeEach(async () => {
  await db.open()
  await db.sessions.clear()
  await db.settings.clear()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

async function servicesOnAssafAB(): Promise<Services> {
  const services = createServices({ now: () => NOW, storageAvailable: true, fetch: signedOutFetch })
  await services.programs.setActive('assaf-ab-2026')
  return services
}

function renderFeature(services: Services): { user: UserEvent } {
  const user = userEvent.setup()
  render(
    <ServicesProvider services={services}>
      <WorkoutFeature navigate={vi.fn()} onInSession={vi.fn()} />
    </ServicesProvider>,
  )
  return { user }
}

async function storedActiveSession(): Promise<Session | null> {
  const all = await db.sessions.toArray()
  return all.find((session) => session.finishedAt === null && !session.deletedAt) ?? null
}

/** The Now view's Log button: "Log set 1 · 8 × 10". */
async function logButton(): Promise<HTMLElement> {
  return screen.findByRole('button', { name: /^Log set / }, SETTLE)
}

/** From the open Set screen: the tools sheet, Swap exercise, then "Do <name> instead". */
async function swapTo(user: UserEvent, plannedName: string, chosenName: string): Promise<void> {
  await user.click(await screen.findByRole('button', { name: 'Exercise tools' }, SETTLE))
  await user.click(screen.getByRole('button', { name: /^Swap exercise/ }))
  const dialog = await screen.findByRole('dialog', { name: `Alternatives to ${plannedName}` }, SETTLE)
  await user.type(within(dialog).getByRole('searchbox'), chosenName)
  await user.click(await within(dialog).findByRole('button', { name: `Do ${chosenName} instead` }, SETTLE))
  await screen.findByRole('heading', { level: 1, name: chosenName }, SETTLE)
}

/** Starts Workout B and opens Seated biceps curls on Now (8 kg x 10 is its start, never logged). */
async function openSeatedCurls(user: UserEvent): Promise<void> {
  await startFromDashboard(user, 'Workout B')
  await showAll(user)
  await user.click(await screen.findByRole('button', { name: /^Seated biceps curls/ }, SETTLE))
  await screen.findByRole('heading', { level: 1, name: 'Seated biceps curls' }, SETTLE)
}

// --- V5-02: one Preset for a swapped-in Exercise ---------------------------------------------

test('V6 V5-02 a swapped-in Exercise opens on the planned load on Now, on All, and on Now again', async () => {
  const { user } = renderFeature(await servicesOnAssafAB())
  await openSeatedCurls(user)
  expect(await logButton()).toHaveTextContent('Log set 1 · 8 × 10')

  await swapTo(user, 'Seated biceps curls', 'Hammer Curls')
  expect(await logButton()).toHaveTextContent('Log set 1 · 8 × 10')

  await showAll(user)
  const row = (await screen.findByRole('button', { name: /^Hammer Curls/ }, SETTLE)).closest('li') as HTMLElement
  const cells = [...row.querySelectorAll('.all-cell')].map((cell) => cell.textContent)
  expect(cells).toEqual(['8×10', '8×10', '8×10'])

  // Back on Now from its row: the same Preset, never the 0 kg of an Exercise with no history.
  await user.click(within(row).getByRole('button', { name: /^Hammer Curls/ }))
  await screen.findByRole('heading', { level: 1, name: 'Hammer Curls' }, SETTLE)
  expect(await logButton()).toHaveTextContent('Log set 1 · 8 × 10')
})

test('V6 V5-02 Now keeps a quiet "for <planned> · Undo swap" line while the swap stands', async () => {
  const { user } = renderFeature(await servicesOnAssafAB())
  await openSeatedCurls(user)
  await swapTo(user, 'Seated biceps curls', 'Hammer Curls')

  // Reopened from All, long after the snackbar: the line is still there.
  await showAll(user)
  await user.click(await screen.findByRole('button', { name: /^Hammer Curls/ }, SETTLE))
  await screen.findByRole('heading', { level: 1, name: 'Hammer Curls' }, SETTLE)
  const line = await screen.findByText('for Seated biceps curls', undefined, SETTLE)
  expect(line.closest('.set-swapped')).not.toBeNull()

  await user.click(within(line.closest('.set-swapped') as HTMLElement).getByRole('button', { name: 'Undo swap' }))
  expect(await screen.findByRole('heading', { level: 1, name: 'Seated biceps curls' }, SETTLE)).toBeVisible()
  await waitFor(async () => expect((await storedActiveSession())?.swaps?.['seated-biceps-curls']).toBeUndefined())
  expect(screen.queryByText('for Seated biceps curls')).toBeNull()
})

test('V6 V5-02 a swap onto other equipment with no history asks "Set a starting weight"', async () => {
  const { user } = renderFeature(await servicesOnAssafAB())
  await openSeatedCurls(user)

  await swapTo(user, 'Seated biceps curls', 'Cable Hammer Curls - Rope Attachment')

  expect(await screen.findByText('Set a starting weight', undefined, SETTLE)).toBeVisible()
  expect(await logButton()).not.toHaveTextContent(/ 0 × /)
})

test('V6 V5-02 All draws a swapped-in Exercise’s Sets as Now does, its ramp included', async () => {
  const services = await servicesOnAssafAB()
  // Last Workout B: Deadlift ramped 60 x 10, 70 x 7, 70 x 7.
  const earlier = await services.sessions.start('assaf-ab-2026', 'workout-b')
  for (const [setIndex, weightKg, reps] of [[1, 60, 10], [2, 70, 7], [3, 70, 7]]) {
    await services.sessions.logSet(earlier.id, { exerciseId: 'deadlift', setIndex, weightKg, reps, loggedAt: NOW - 3 * 86_400_000 })
  }
  await services.sessions.finish(earlier.id)
  const { user } = renderFeature(services)
  await startFromDashboard(user, 'Workout B')
  await screen.findByRole('heading', { level: 1, name: 'Deadlift' }, SETTLE)

  await swapTo(user, 'Deadlift', 'Deadlift with Bands')
  const now = [...document.querySelectorAll('.set-cells .set-cell')].map((cell) =>
    (cell.querySelector('.set-cell-value, span:last-child')?.textContent ?? '').replace(/\s+/g, ''),
  )
  expect(now).toEqual(['60×10', '70×7', '70×7'])

  await showAll(user)
  const row = (await screen.findByRole('button', { name: /^Deadlift with Bands/ }, SETTLE)).closest('li') as HTMLElement
  expect([...row.querySelectorAll('.all-cell')].map((cell) => cell.textContent)).toEqual(['60×10', '70×7', '70×7'])
})

// --- V5-01: Discard, then Undo ----------------------------------------------------------------

/** Workout A started with `count` back squat Sets logged, rendered on Now. */
async function startWorkoutAWithSets(count: number): Promise<{ user: UserEvent; session: Session }> {
  const services = await servicesOnAssafAB()
  let session = await services.sessions.start('assaf-ab-2026', 'workout-a')
  for (let index = 1; index <= count; index += 1) {
    session = await services.sessions.logSet(session.id, {
      exerciseId: 'back-squat',
      setIndex: index,
      weightKg: 60,
      reps: 8,
      loggedAt: NOW,
    })
  }
  const { user } = renderFeature(services)
  await screen.findByRole('heading', { level: 1, name: 'Back squat' }, SETTLE)
  return { user, session }
}

async function discardFromFinish(user: UserEvent, confirm: string | null): Promise<void> {
  await user.click(await screen.findByRole('button', { name: 'Finish' }, SETTLE))
  const sheet = await screen.findByRole('dialog', { name: 'Finish workout?' }, SETTLE)
  await user.click(within(sheet).getByRole('button', { name: 'Discard workout' }))
  if (confirm !== null) await user.click(within(sheet).getByRole('button', { name: confirm }))
}

test('V6 V5-01 after Discard 2 logged sets, Train shows "Workout discarded" with Undo', async () => {
  const { user } = await startWorkoutAWithSets(2)

  await discardFromFinish(user, 'Discard 2 logged sets')

  expect(await screen.findByRole('button', { name: 'Start Workout A' }, SETTLE)).toBeVisible()
  const snackbar = await waitFor(() => {
    const found = document.querySelector('.snackbar') as HTMLElement | null
    expect(found).not.toBeNull()
    return found as HTMLElement
  }, SETTLE)
  expect(snackbar).toHaveTextContent('Workout discarded')
  expect(within(snackbar).getByRole('button', { name: 'Undo' })).toBeVisible()
  expect(await storedActiveSession()).toBeNull()
})

test('V6 V5-01 Undo on "Workout discarded" brings the Session back with its Sets, on the Exercise it was on', async () => {
  const { user, session } = await startWorkoutAWithSets(2)
  await discardFromFinish(user, 'Discard 2 logged sets')
  const snackbar = await waitFor(() => {
    const found = document.querySelector('.snackbar') as HTMLElement | null
    expect(found).not.toBeNull()
    return found as HTMLElement
  }, SETTLE)

  await user.click(within(snackbar).getByRole('button', { name: 'Undo' }))

  expect(await screen.findByRole('heading', { level: 1, name: 'Back squat' }, SETTLE)).toBeVisible()
  expect(screen.getByText('Set 3 of 4')).toBeVisible()
  const restored = await storedActiveSession()
  expect(restored?.id).toBe(session.id)
  expect(restored?.entries).toHaveLength(2)
  expect(document.querySelector('.snackbar')).toBeNull()
})

test('V6 V5-01 the "Workout discarded" snackbar leaves after 8 s', async () => {
  // The clock is faked from the start (advancing with real time), so the snackbar's timer is a
  // fake one that the test can jump.
  vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['setTimeout', 'clearTimeout'] })
  const { user } = await startWorkoutAWithSets(1)
  await discardFromFinish(user, 'Discard 1 logged set')
  await waitFor(() => expect(document.querySelector('.snackbar')).not.toBeNull(), SETTLE)

  await act(async () => {
    await vi.advanceTimersByTimeAsync(7_500)
  })
  expect(document.querySelector('.snackbar')).not.toBeNull()
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1_000)
  })
  expect(document.querySelector('.snackbar')).toBeNull()
})

test('V6 V5-01 with nothing logged, Discard is the Finish sheet primary and Undo restores the empty Session', async () => {
  const services = await servicesOnAssafAB()
  const { user } = renderFeature(services)
  await startFromDashboard(user, 'Workout A')
  await screen.findByRole('heading', { level: 1, name: 'Back squat' }, SETTLE)

  await user.click(await screen.findByRole('button', { name: 'Finish' }, SETTLE))
  const sheet = await screen.findByRole('dialog', { name: 'Finish workout?' }, SETTLE)
  expect(within(sheet).getByRole('button', { name: 'Discard workout' })).toHaveClass('btn-primary')
  expect(within(sheet).getByRole('button', { name: 'Finish workout' })).not.toHaveClass('btn-primary')
  await user.click(within(sheet).getByRole('button', { name: 'Discard workout' }))

  const snackbar = await waitFor(() => {
    const found = document.querySelector('.snackbar') as HTMLElement | null
    expect(found).not.toBeNull()
    return found as HTMLElement
  }, SETTLE)
  await user.click(within(snackbar).getByRole('button', { name: 'Undo' }))
  expect(await screen.findByRole('heading', { level: 1, name: 'Back squat' }, SETTLE)).toBeVisible()
  expect(await storedActiveSession()).not.toBeNull()
})
