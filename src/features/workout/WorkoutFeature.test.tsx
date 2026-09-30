import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { UserEvent } from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import { db } from '../../storage/db'
import { createServices, type Services } from '../../services'
import type { Session, SetEntry } from '../../types'
import { ServicesProvider } from '../ServicesProvider'
import { WorkoutFeature } from './WorkoutFeature'

// E11-T10 O9: the Workout tab as its own container, over the real services (createServices) and
// the real session and settings stores underneath, on fake-indexeddb (src/test/setup.ts). The
// only double is the network: a signed-out phone, whose /api/* answers 401, so the provider's
// sync on mount stops at once and writes nothing.
//
// Every visible string below is the one App.tsx and its components show today:
// "Start Workout A" (WorkoutStartButtons), "Resume Workout A" (ResumeCard), "Choose a program"
// (NoProgram), "Log set" / "Set 2 of 4" (SetScreen), "Alternatives to …", "Do this instead",
// "Undo swap", "Finish workout", and the "Session summary" dialog with its "Done".

const NOW = 1_700_000_000_000
const SETTLE = { timeout: 3000 }

/** Workout B's seated-biceps-curls swapped for Hammer_Curls, as the exercise list names it. */
const HAMMER_ROW = /^Hammer Curls[ ]+instead of Seated biceps curls/

const signedOutFetch = (async () => new Response(null, { status: 401 })) as typeof fetch

beforeEach(async () => {
  await db.open()
  await db.sessions.clear()
  await db.settings.clear()
})

function buildServices(): Services {
  return createServices({ now: () => NOW, storageAvailable: true, fetch: signedOutFetch })
}

/** Services with assaf-ab-2026 as the active Program, where the trainee is. */
async function servicesOnAssafAB(): Promise<Services> {
  const services = buildServices()
  await services.programs.setActive('assaf-ab-2026')
  return services
}

function renderFeature(services: Services) {
  const user = userEvent.setup()
  const navigate = vi.fn()
  const onInSession = vi.fn()
  render(
    <ServicesProvider services={services}>
      <WorkoutFeature navigate={navigate} onInSession={onInSession} />
    </ServicesProvider>,
  )
  return { user, navigate, onInSession }
}

async function startWorkout(user: UserEvent, workoutName: string): Promise<void> {
  await user.click(await screen.findByRole('button', { name: `Start ${workoutName}` }, SETTLE))
}

async function openExercise(user: UserEvent, exerciseName: string): Promise<void> {
  await user.click(
    await screen.findByRole('button', { name: new RegExp(`^${exerciseName}`) }, SETTLE),
  )
}

/** What the exercise list shows as an exercise's set progress: "1/4". */
function progressOf(row: HTMLElement): string {
  const shown = within(row).getByText(/^\d+\s*\/\s*\d+$/)
  return (shown.textContent ?? '').replace(/\s+/g, ' ').trim()
}

/** The Session in progress as stored, read straight from the database. */
async function storedActiveSession(): Promise<Session | null> {
  const all = await db.sessions.toArray()
  return all.find((session) => session.finishedAt === null && !session.deletedAt) ?? null
}

/** From Workout B's seated biceps curls set screen: swaps it for Hammer Curls. */
async function swapSeatedCurlsForHammerCurls(user: UserEvent): Promise<HTMLElement> {
  await user.click(await screen.findByRole('button', { name: 'Alternatives' }, SETTLE))
  await screen.findByRole('dialog', { name: 'Alternatives to Seated biceps curls' }, SETTLE)
  const hammerRowName = await screen.findByText(
    'Hammer Curls',
    { selector: '.alternatives-row-name' },
    SETTLE,
  )
  const hammerRow = hammerRowName.closest('li')
  if (!hammerRow) throw new Error('the Hammer Curls row is not inside a list item')
  await user.click(within(hammerRow).getByRole('button', { name: 'Do this instead' }))
  return screen.findByRole('button', { name: HAMMER_ROW }, SETTLE)
}

// --- the picker -----------------------------------------------------------------------------

test('O9 WorkoutFeature shows the Workout picker with the active program’s start buttons', async () => {
  renderFeature(await servicesOnAssafAB())

  expect(await screen.findByRole('button', { name: 'Start Workout A' }, SETTLE)).toBeVisible()
  expect(screen.getByRole('button', { name: 'Start Workout B' })).toBeVisible()
})

test('O9 WorkoutFeature reports onInSession(false) on the picker', async () => {
  const { onInSession } = renderFeature(await servicesOnAssafAB())

  await screen.findByRole('button', { name: 'Start Workout A' }, SETTLE)

  await waitFor(() => expect(onInSession).toHaveBeenLastCalledWith(false), SETTLE)
  expect(onInSession).not.toHaveBeenCalledWith(true)
})

test('O9 with no active program the picker offers Choose a program, which navigates to the Program tab', async () => {
  const { user, navigate } = renderFeature(buildServices())

  await user.click(await screen.findByRole('button', { name: 'Choose a program' }, SETTLE))

  expect(navigate).toHaveBeenCalledWith({ tab: 'program' })
  expect(screen.queryByRole('button', { name: 'Start Workout A' })).toBeNull()
})

// --- start or resume ------------------------------------------------------------------------

test('O9 tapping Start Workout A starts a Session and shows its exercise list', async () => {
  const { user } = renderFeature(await servicesOnAssafAB())

  await startWorkout(user, 'Workout A')

  const backSquat = await screen.findByRole('button', { name: /^Back squat/ }, SETTLE)
  expect(progressOf(backSquat)).toBe('0/4')
  const stored = await storedActiveSession()
  expect([stored?.programId, stored?.workoutId, stored?.entries]).toEqual([
    'assaf-ab-2026',
    'workout-a',
    [],
  ])
})

test('O9 WorkoutFeature reports onInSession(true) on the exercise list', async () => {
  const { user, onInSession } = renderFeature(await servicesOnAssafAB())

  await startWorkout(user, 'Workout A')
  await screen.findByRole('button', { name: /^Back squat/ }, SETTLE)

  await waitFor(() => expect(onInSession).toHaveBeenLastCalledWith(true), SETTLE)
})

test('O9 a Session already in progress on mount opens on its exercise list with its logged Set', async () => {
  const services = await servicesOnAssafAB()
  const started = await services.sessions.start('assaf-ab-2026', 'workout-a')
  await services.sessions.logSet(started.id, {
    exerciseId: 'back-squat',
    setIndex: 1,
    weightKg: 60,
    reps: 10,
    loggedAt: NOW + 1,
  })
  const { onInSession } = renderFeature(services)

  const backSquat = await screen.findByRole('button', { name: /^Back squat/ }, SETTLE)
  expect(progressOf(backSquat)).toBe('1/4')
  expect(screen.queryByRole('button', { name: 'Start Workout A' })).toBeNull()
  await waitFor(() => expect(onInSession).toHaveBeenLastCalledWith(true), SETTLE)
})

test('O9 backing out of the exercise list shows Resume Workout A on the picker and reports onInSession(false)', async () => {
  const { user, onInSession } = renderFeature(await servicesOnAssafAB())
  await startWorkout(user, 'Workout A')
  await screen.findByRole('button', { name: /^Back squat/ }, SETTLE)

  await user.click(screen.getByRole('button', { name: 'Back' }))

  expect(await screen.findByRole('button', { name: 'Resume Workout A' }, SETTLE)).toBeVisible()
  await waitFor(() => expect(onInSession).toHaveBeenLastCalledWith(false), SETTLE)
  expect(await storedActiveSession()).not.toBeNull()
})

test('O9 Resume Workout A returns to the same Session in progress', async () => {
  const { user } = renderFeature(await servicesOnAssafAB())
  await startWorkout(user, 'Workout A')
  await screen.findByRole('button', { name: /^Back squat/ }, SETTLE)
  const before = await storedActiveSession()
  await user.click(screen.getByRole('button', { name: 'Back' }))

  await user.click(await screen.findByRole('button', { name: 'Resume Workout A' }, SETTLE))

  await screen.findByRole('button', { name: /^Back squat/ }, SETTLE)
  const sessions = await db.sessions.toArray()
  expect(sessions.map((session) => session.id)).toEqual([before?.id])
})

// --- logging a Set --------------------------------------------------------------------------

test('O9 Log set on the set screen logs the Set through services.sessions.logSet', async () => {
  const services = await servicesOnAssafAB()
  const logSet = vi.spyOn(services.sessions, 'logSet')
  const { user } = renderFeature(services)
  await startWorkout(user, 'Workout A')
  await openExercise(user, 'Back squat')

  await user.click(await screen.findByRole('button', { name: 'Log set' }, SETTLE))

  await waitFor(() => expect(logSet).toHaveBeenCalledTimes(1), SETTLE)
  const stored = await storedActiveSession()
  const [sessionId, entry] = logSet.mock.calls[0] as [string, SetEntry]
  expect(sessionId).toBe(stored?.id)
  // Nothing logged anywhere: back squat opens on its start weight and its low rep.
  expect([entry.exerciseId, entry.setIndex, entry.weightKg, entry.reps]).toEqual([
    'back-squat',
    1,
    50,
    8,
  ])
})

test('O9 a Set logged on the set screen is stored on the Session and opens Set 2 of 4', async () => {
  const { user } = renderFeature(await servicesOnAssafAB())
  await startWorkout(user, 'Workout A')
  await openExercise(user, 'Back squat')

  await user.click(await screen.findByRole('button', { name: 'Log set' }, SETTLE))

  expect(await screen.findByText('Set 2 of 4', undefined, SETTLE)).toBeVisible()
  const stored = await storedActiveSession()
  expect(stored?.entries.map((e) => [e.exerciseId, e.setIndex, e.weightKg, e.reps])).toEqual([
    ['back-squat', 1, 50, 8],
  ])
})

test('O9 WorkoutFeature reports onInSession(true) on the set screen', async () => {
  const { user, onInSession } = renderFeature(await servicesOnAssafAB())
  await startWorkout(user, 'Workout A')
  await openExercise(user, 'Back squat')

  await screen.findByRole('button', { name: 'Log set' }, SETTLE)

  await waitFor(() => expect(onInSession).toHaveBeenLastCalledWith(true), SETTLE)
  expect(onInSession).not.toHaveBeenLastCalledWith(false)
})

test('O9 Back from the set screen shows the exercise list with the logged Set counted', async () => {
  const { user } = renderFeature(await servicesOnAssafAB())
  await startWorkout(user, 'Workout A')
  await openExercise(user, 'Back squat')
  await user.click(await screen.findByRole('button', { name: 'Log set' }, SETTLE))
  await screen.findByText('Set 2 of 4', undefined, SETTLE)

  await user.click(screen.getByRole('button', { name: 'Back' }))

  const backSquat = await screen.findByRole('button', { name: /^Back squat/ }, SETTLE)
  expect(progressOf(backSquat)).toBe('1/4')
})

// --- a swap through the alternatives overlay ------------------------------------------------

test('O9 Do this instead on Hammer Curls in the alternatives overlay swaps the exercise list row', async () => {
  const { user } = renderFeature(await servicesOnAssafAB())
  await startWorkout(user, 'Workout B')
  await openExercise(user, 'Seated biceps curls')

  const swappedRow = await swapSeatedCurlsForHammerCurls(user)

  expect(swappedRow).toBeVisible()
  expect(screen.queryByRole('dialog', { name: 'Alternatives to Seated biceps curls' })).toBeNull()
  const stored = await storedActiveSession()
  expect(stored?.swaps).toEqual({ 'seated-biceps-curls': 'Hammer_Curls' })
})

test('O9 Undo swap brings back the Seated biceps curls row and clears the stored swap', async () => {
  const { user } = renderFeature(await servicesOnAssafAB())
  await startWorkout(user, 'Workout B')
  await openExercise(user, 'Seated biceps curls')
  await swapSeatedCurlsForHammerCurls(user)

  await user.click(await screen.findByRole('button', { name: 'Undo swap' }, SETTLE))

  expect(
    await screen.findByRole('button', { name: /^Seated biceps curls/ }, SETTLE),
  ).toBeVisible()
  expect(screen.queryByRole('button', { name: HAMMER_ROW })).toBeNull()
  const stored = await storedActiveSession()
  expect(stored?.swaps?.['seated-biceps-curls']).toBeUndefined()
})

// --- finishing ------------------------------------------------------------------------------

test('O9 Finish workout finishes the Session and shows the Session summary', async () => {
  const { user } = renderFeature(await servicesOnAssafAB())
  await startWorkout(user, 'Workout A')
  await openExercise(user, 'Back squat')
  await user.click(await screen.findByRole('button', { name: 'Log set' }, SETTLE))
  await screen.findByText('Set 2 of 4', undefined, SETTLE)
  await user.click(screen.getByRole('button', { name: 'Back' }))
  await screen.findByRole('button', { name: /^Back squat/ }, SETTLE)

  await user.click(screen.getByRole('button', { name: 'Finish workout' }))

  expect(await screen.findByRole('dialog', { name: 'Session summary' }, SETTLE)).toBeVisible()
  expect(await storedActiveSession()).toBeNull()
  const [finished] = await db.sessions.toArray()
  expect(finished.entries.map((e) => [e.exerciseId, e.setIndex])).toEqual([['back-squat', 1]])
})

test('O9 Done on the Session summary leaves the picker, reporting onInSession(false)', async () => {
  const { user, onInSession } = renderFeature(await servicesOnAssafAB())
  await startWorkout(user, 'Workout A')
  await screen.findByRole('button', { name: /^Back squat/ }, SETTLE)
  await user.click(screen.getByRole('button', { name: 'Finish workout' }))
  const summary = await screen.findByRole('dialog', { name: 'Session summary' }, SETTLE)

  await user.click(within(summary).getByRole('button', { name: 'Done' }))

  await waitFor(() => {
    expect(screen.queryByRole('dialog', { name: 'Session summary' })).toBeNull()
  }, SETTLE)
  expect(screen.getByRole('button', { name: 'Start Workout A' })).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Resume Workout A' })).toBeNull()
  expect(onInSession).toHaveBeenLastCalledWith(false)
})

// --- E12-T5: discard the workout in progress ------------------------------------------------

/** Starts Workout A on the real services, with `count` back squat sets logged, and renders it. */
async function startWorkoutAWithSets(count: number): Promise<{ user: UserEvent }> {
  const services = await servicesOnAssafAB()
  const started = await services.sessions.start('assaf-ab-2026', 'workout-a')
  for (let index = 1; index <= count; index += 1) {
    await services.sessions.logSet(started.id, {
      exerciseId: 'back-squat',
      setIndex: index,
      weightKg: 60,
      reps: 8,
      loggedAt: NOW,
    })
  }
  const { user } = renderFeature(services)
  await screen.findByRole('button', { name: /^Back squat/ }, SETTLE)
  return { user }
}

test('O12 Discard workout asks "Discard this workout? Its N sets are deleted." with the set count', async () => {
  const { user } = await startWorkoutAWithSets(3)

  await user.click(await screen.findByRole('button', { name: 'Discard workout' }, SETTLE))

  expect(await screen.findByText('Discard this workout? Its 3 sets are deleted.')).toBeVisible()
})

test('O12 confirming discards the Session and returns to the Workout tab with no resume card', async () => {
  const { user } = await startWorkoutAWithSets(2)

  await user.click(await screen.findByRole('button', { name: 'Discard workout' }, SETTLE))
  await user.click(await screen.findByRole('button', { name: 'Discard' }, SETTLE))

  expect(await screen.findByRole('button', { name: 'Start Workout A' }, SETTLE)).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Resume Workout A' })).toBeNull()
  expect(await storedActiveSession()).toBeNull()
})

test('O12 after discarding, the next Start begins a new Session', async () => {
  const { user } = await startWorkoutAWithSets(2)
  const before = (await db.sessions.toArray())[0]

  await user.click(await screen.findByRole('button', { name: 'Discard workout' }, SETTLE))
  await user.click(await screen.findByRole('button', { name: 'Discard' }, SETTLE))
  await startWorkout(user, 'Workout A')

  const backSquat = await screen.findByRole('button', { name: /^Back squat/ }, SETTLE)
  expect(progressOf(backSquat)).toBe('0/4')
  expect((await storedActiveSession())?.id).not.toBe(before.id)
})

test('O12 cancelling the discard leaves the Session as it was', async () => {
  const { user } = await startWorkoutAWithSets(2)

  await user.click(await screen.findByRole('button', { name: 'Discard workout' }, SETTLE))
  await user.click(await screen.findByRole('button', { name: 'Cancel' }, SETTLE))

  expect(screen.queryByText(/^Discard this workout\?/)).toBeNull()
  const backSquat = await screen.findByRole('button', { name: /^Back squat/ }, SETTLE)
  expect(progressOf(backSquat)).toBe('2/4')
  expect((await storedActiveSession())?.entries).toHaveLength(2)
})
