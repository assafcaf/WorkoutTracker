import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { db } from '../../storage/db'
import { createServices, type Services } from '../../services'
import { startFromDashboard } from '../../test/dashboard'
import { ServicesProvider } from '../ServicesProvider'
import { WorkoutFeature } from './WorkoutFeature'

// Progress Dashboard S2/S3: the Live session's Now and All views, over the real services on
// fake-indexeddb, as WorkoutFeature.test.tsx drives them. The network is a signed-out phone.
// UX review v1: V1-01 (opens on Now), V1-06 (Finish asks first), V1-10 (slim header).

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

function buildServices(): Services {
  return createServices({ now: () => NOW, storageAvailable: true, fetch: signedOutFetch })
}

function renderFeature(services: Services) {
  const user = userEvent.setup()
  render(
    <ServicesProvider services={services}>
      <WorkoutFeature navigate={vi.fn()} onInSession={vi.fn()} />
    </ServicesProvider>,
  )
  return user
}

/** Workout A on assaf-ab-2026 with `count` back squat Sets logged, reopened (resumed). */
async function resumeWorkoutAWithSets(
  count: number,
  loggedAt: (index: number) => number = (index) => NOW + index,
) {
  const services = buildServices()
  await services.programs.setActive('assaf-ab-2026')
  const started = await services.sessions.start('assaf-ab-2026', 'workout-a')
  for (let index = 1; index <= count; index += 1) {
    await services.sessions.logSet(started.id, {
      exerciseId: 'back-squat',
      setIndex: index,
      weightKg: 60,
      reps: 8,
      loggedAt: loggedAt(index),
    })
  }
  const user = renderFeature(services)
  await screen.findByRole('radiogroup', { name: 'Session view' }, SETTLE)
  return { user }
}

/** As `resumeWorkoutAWithSets`, then one tap on All: every Exercise's cells. */
async function startWorkoutAWithSets(count: number) {
  const resumed = await resumeWorkoutAWithSets(count)
  await resumed.user.click(await screen.findByRole('radio', { name: 'All' }, SETTLE))
  await screen.findByRole('button', { name: /^Back squat/ }, SETTLE)
  return resumed
}

/** Logs every planned Set of Workout A at 20 kg x 8. */
async function logEveryPlannedSet(services: Services, sessionId: string): Promise<void> {
  const { programs } = await services.programs.load()
  const workout = programs
    .find((program) => program.id === 'assaf-ab-2026')
    ?.workouts.find((candidate) => candidate.id === 'workout-a')
  if (!workout) throw new Error('no Workout A')
  let at = NOW
  for (const plan of workout.exercises) {
    for (let index = 1; index <= plan.sets; index += 1) {
      at += 1
      await services.sessions.logSet(sessionId, {
        exerciseId: plan.exerciseId,
        setIndex: index,
        weightKg: 20,
        reps: 8,
        loggedAt: at,
      })
    }
  }
}

/** Workout A with every planned Set logged, reopened. */
async function resumeWorkoutADone() {
  const services = buildServices()
  await services.programs.setActive('assaf-ab-2026')
  const started = await services.sessions.start('assaf-ab-2026', 'workout-a')
  await logEveryPlannedSet(services, started.id)
  return { user: renderFeature(services) }
}

function counts(): string | undefined {
  return document.querySelector('.live-header-sets')?.textContent ?? undefined
}

test('Live All shows the Sets count in the header and the Now | All switch', async () => {
  await startWorkoutAWithSets(2)

  expect(screen.getByRole('radio', { name: 'All' })).toBeChecked()
  expect(counts()).toBe('2/23 sets')
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

  await waitFor(() => expect(counts()).toBe('3/23 sets'), SETTLE)
  const stored = await db.sessions.toArray()
  expect(stored[0].entries.filter((entry) => entry.exerciseId === 'back-squat')).toHaveLength(3)
})

test('Live a done cell in All opens that Set on Now, ready to edit', async () => {
  const { user } = await startWorkoutAWithSets(2)

  await user.click(screen.getByRole('button', { name: /^Set 2 · 60 / }))

  expect(await screen.findByRole('button', { name: 'Save set' }, SETTLE)).toBeVisible()
})

// --- V1-01: the live Session opens on Now ----------------------------------------------------

test('V1-01 given a Workout on the Dashboard, when Start is tapped, then the Now view shows its first Set with no extra tap', async () => {
  const services = buildServices()
  await services.programs.setActive('assaf-ab-2026')
  const user = renderFeature(services)

  await startFromDashboard(user, 'Workout A')

  expect(await screen.findByText('Set 1 of 4', undefined, SETTLE)).toBeVisible()
  expect(screen.getByRole('radio', { name: 'Now' })).toBeChecked()
  expect(screen.getByRole('button', { name: /^Log set / })).toBeVisible()
})

test('V1-01 given a Session with Sets logged, when the app reopens, then it lands on Now at the next Set, All one tap away', async () => {
  const { user } = await resumeWorkoutAWithSets(2)

  expect(await screen.findByText('Set 3 of 4', undefined, SETTLE)).toBeVisible()
  expect(screen.getByRole('radio', { name: 'Now' })).toBeChecked()

  await user.click(screen.getByRole('radio', { name: 'All' }))
  expect(await screen.findByRole('button', { name: /^Back squat/ }, SETTLE)).toBeVisible()
})

test('V1-01 given a reload 10 s into a 3:00 Rest, when the Session reopens, then the countdown shows about 2:50 with no tap', async () => {
  const realNow = Date.now()
  await resumeWorkoutAWithSets(1, () => realNow - 10_000)

  const timer = await screen.findByRole('timer', { name: 'Rest remaining' }, SETTLE)
  expect(timer.textContent).toMatch(/^2:(4\d|50)$/)
})

test('V1-01 given every planned Set logged, when the app reopens, then it lands on All with nothing left to open', async () => {
  await resumeWorkoutADone()

  expect(await screen.findByRole('radio', { name: 'All' }, SETTLE)).toBeChecked()
})

// --- V1-06: Finish asks first while planned Sets remain ---------------------------------------

test('V1-06 given 2 of 23 Sets logged, when Finish is tapped, then a Sheet says 21 sets not logged and Keep going returns to the same Set', async () => {
  const { user } = await resumeWorkoutAWithSets(2)
  await screen.findByText('Set 3 of 4', undefined, SETTLE)

  await user.click(screen.getByRole('button', { name: 'Finish' }))

  const sheet = await screen.findByRole('dialog', { name: 'Finish workout?' }, SETTLE)
  expect(within(sheet).getByText('21 sets not logged')).toBeVisible()
  await user.click(within(sheet).getByRole('button', { name: 'Keep going' }))

  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull(), SETTLE)
  expect(screen.getByText('Set 3 of 4')).toBeVisible()
  const stored = await db.sessions.toArray()
  expect(stored[0].finishedAt).toBeNull()
})

test('V1-06 given Sets left, when Finish workout is confirmed in the Sheet, then the Session ends on its summary', async () => {
  const { user } = await resumeWorkoutAWithSets(2)
  await screen.findByText('Set 3 of 4', undefined, SETTLE)

  await user.click(screen.getByRole('button', { name: 'Finish' }))
  const sheet = await screen.findByRole('dialog', { name: 'Finish workout?' }, SETTLE)
  await user.click(within(sheet).getByRole('button', { name: 'Finish workout' }))

  expect(await screen.findByRole('dialog', { name: 'Session summary' }, SETTLE)).toBeVisible()
  const stored = await db.sessions.toArray()
  expect(stored[0].finishedAt).not.toBeNull()
})

test('V1-06 given every planned Set logged, when Finish is tapped, then the summary shows in one tap', async () => {
  const { user } = await resumeWorkoutADone()

  await user.click(await screen.findByRole('button', { name: 'Finish' }, SETTLE))

  expect(await screen.findByRole('dialog', { name: 'Session summary' }, SETTLE)).toBeVisible()
  expect(screen.queryByRole('dialog', { name: 'Finish workout?' })).toBeNull()
})

// --- V1-10: the slim live header ---------------------------------------------------------------

test('V1-10 given a live Session, when its header shows, then the title row holds the Sets count and no volume line or bar', async () => {
  await resumeWorkoutAWithSets(2)
  await screen.findByText('Set 3 of 4', undefined, SETTLE)

  const header = document.querySelector('header.live-header') as HTMLElement
  const row = header.querySelector('.live-header-row') as HTMLElement
  expect(within(row).getByText('2/23 sets')).toBeVisible()
  expect(header.textContent).not.toMatch(/Volume|at this point/)
  expect(header.querySelector('.bullet')).toBeNull()
})
