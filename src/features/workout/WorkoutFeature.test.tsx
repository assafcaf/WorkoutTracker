import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { UserEvent } from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { db } from '../../storage/db'
import { createServices, type Services } from '../../services'
import { ServiceError } from '../../services/errors'
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

afterEach(() => {
  vi.restoreAllMocks()
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

test('O12 the exercise list and the set screen each show the Workout time', async () => {
  const { user } = renderFeature(await servicesOnAssafAB())
  await startWorkout(user, 'Workout A')

  expect(await screen.findByRole('timer', { name: 'Workout time' }, SETTLE)).toBeVisible()

  await openExercise(user, 'Back squat')
  await screen.findByRole('button', { name: 'Log set' }, SETTLE)

  expect(screen.getByRole('timer', { name: 'Workout time' })).toBeVisible()
})

test('O12 the picker shows no Workout time', async () => {
  renderFeature(await servicesOnAssafAB())
  await screen.findByRole('button', { name: 'Start Workout A' }, SETTLE)

  expect(screen.queryByRole('timer', { name: 'Workout time' })).toBeNull()
})

// --- E13-T8 O4: rest follows the Session's latest Set, and survives a reload ------------------
//
// Workout A's back squat Plan rests 180 s and its lunges Plan 90 s. The Sets are logged through
// the real service at T0, and the wall clock the set screen reads is frozen past it.

const T0 = NOW + 1_000_000

/** The rest readout: the button holding the set screen's "Rest remaining" timer. */
async function restReadoutText(): Promise<string> {
  const timer = await screen.findByRole('timer', { name: 'Rest remaining' }, SETTLE)
  const button = timer.closest('button')
  if (button === null) throw new Error('the rest readout is not a button')
  return (button.textContent ?? '').replace(/\s+/g, ' ').trim()
}

/** Workout A in progress with `sets` logged, on the real services; answers them and the Session. */
async function workoutAWithLogged(
  sets: Array<{ exerciseId: string; setIndex: number; weightKg: number; loggedAt: number }>,
): Promise<{ services: Services; sessionId: string }> {
  const services = await servicesOnAssafAB()
  const started = await services.sessions.start('assaf-ab-2026', 'workout-a')
  for (const set of sets) {
    await services.sessions.logSet(started.id, { ...set, reps: 10 })
  }
  return { services, sessionId: started.id }
}

test("O4 a set screen opened from the list shows the rest of the Session's latest Set, of another Exercise", async () => {
  vi.spyOn(Date, 'now').mockReturnValue(T0 + 100_000)
  const { services } = await workoutAWithLogged([
    { exerciseId: 'back-squat', setIndex: 1, weightKg: 60, loggedAt: T0 },
  ])
  const { user } = renderFeature(services)

  await openExercise(user, 'Lunges')

  // Back squat's 180 s from T0, 100 s gone -- not lunges' own 90 s.
  await waitFor(async () => expect(await restReadoutText()).toBe('1:20'), SETTLE)
})

test('O4 +15 s on the set screen stores the Set with a 195 s rest through services.sessions.setRest', async () => {
  vi.spyOn(Date, 'now').mockReturnValue(T0 + 100_000)
  const { services, sessionId } = await workoutAWithLogged([
    { exerciseId: 'back-squat', setIndex: 1, weightKg: 60, loggedAt: T0 },
  ])
  const setRest = vi.spyOn(services.sessions, 'setRest')
  const { user } = renderFeature(services)
  await openExercise(user, 'Lunges')

  await user.click(await screen.findByRole('button', { name: '+15 s' }, SETTLE))

  await waitFor(() => expect(setRest).toHaveBeenCalledTimes(1), SETTLE)
  expect(setRest).toHaveBeenCalledWith(sessionId, 'back-squat', 1, 195)
  const stored = await storedActiveSession()
  expect(stored?.entries.find((entry) => entry.exerciseId === 'back-squat')?.restSeconds).toBe(195)
})

test('O4 +15 s on the set screen moves the rest readout from 1:20 to 1:35', async () => {
  vi.spyOn(Date, 'now').mockReturnValue(T0 + 100_000)
  const { services } = await workoutAWithLogged([
    { exerciseId: 'back-squat', setIndex: 1, weightKg: 60, loggedAt: T0 },
  ])
  const { user } = renderFeature(services)
  await openExercise(user, 'Lunges')

  await user.click(await screen.findByRole('button', { name: '+15 s' }, SETTLE))

  await waitFor(async () => expect(await restReadoutText()).toBe('1:35'), SETTLE)
})

test('O4 after +15 s and a reload the set screen shows the same rest', async () => {
  vi.spyOn(Date, 'now').mockReturnValue(T0 + 100_000)
  const { services } = await workoutAWithLogged([
    { exerciseId: 'back-squat', setIndex: 1, weightKg: 60, loggedAt: T0 },
  ])
  const first = renderFeature(services)
  await openExercise(first.user, 'Lunges')
  await first.user.click(await screen.findByRole('button', { name: '+15 s' }, SETTLE))
  await waitFor(async () => {
    const stored = await storedActiveSession()
    expect(stored?.entries[0].restSeconds).toBe(195)
  }, SETTLE)

  cleanup()
  const { user } = renderFeature(await servicesOnAssafAB())
  await openExercise(user, 'Lunges')

  await waitFor(async () => expect(await restReadoutText()).toBe('1:35'), SETTLE)
})

test('O4 after Skip and a reload the set screen reads +0:00 over', async () => {
  vi.spyOn(Date, 'now').mockReturnValue(T0 + 100_000)
  const { services } = await workoutAWithLogged([
    { exerciseId: 'back-squat', setIndex: 1, weightKg: 60, loggedAt: T0 },
  ])
  const first = renderFeature(services)
  await openExercise(first.user, 'Lunges')
  await first.user.click(await screen.findByRole('button', { name: 'Skip' }, SETTLE))
  await waitFor(async () => {
    const stored = await storedActiveSession()
    expect(stored?.entries[0].restSeconds).toBe(100)
  }, SETTLE)

  cleanup()
  const { user } = renderFeature(await servicesOnAssafAB())
  await openExercise(user, 'Lunges')

  await waitFor(async () => expect(await restReadoutText()).toBe('+0:00 over'), SETTLE)
})

test('O4 after the latest Set is deleted, rest follows the new latest Set', async () => {
  // Back squat at T0 (180 s), then lunges 60 s later (90 s). At 100 s the lunges Set has 0:50
  // left; deleting it leaves the back squat Set as the latest, with 1:20 left.
  vi.spyOn(Date, 'now').mockReturnValue(T0 + 100_000)
  const { services } = await workoutAWithLogged([
    { exerciseId: 'back-squat', setIndex: 1, weightKg: 60, loggedAt: T0 },
    { exerciseId: 'lunges', setIndex: 1, weightKg: 20, loggedAt: T0 + 60_000 },
  ])
  const { user } = renderFeature(services)
  await openExercise(user, 'Lunges')
  await waitFor(async () => expect(await restReadoutText()).toBe('0:50'), SETTLE)

  await user.click(await screen.findByRole('button', { name: '20 × 10' }, SETTLE))
  await user.click(screen.getByRole('button', { name: 'Delete set' }))

  await waitFor(async () => expect(await restReadoutText()).toBe('1:20'), SETTLE)
})

// --- E13-T12 O11: Finish exercise leads on to the next unfinished Exercise --------------------

/** Four back squat Sets (Workout A plans 4) at T0, for the done state. */
const FOUR_SQUATS = [1, 2, 3, 4].map((setIndex) => ({
  exerciseId: 'back-squat',
  setIndex,
  weightKg: 60,
  loggedAt: T0,
}))

test('O11 the done state of back squat shows Up next: Lunges above Finish exercise', async () => {
  vi.spyOn(Date, 'now').mockReturnValue(T0 + 100_000)
  const { user } = renderFeature((await workoutAWithLogged(FOUR_SQUATS)).services)
  await openExercise(user, 'Back squat')

  const upNext = await screen.findByText('Up next: Lunges', undefined, SETTLE)
  const finish = screen.getByRole('button', { name: 'Finish exercise' })

  expect(upNext.compareDocumentPosition(finish) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
})

test('O11 Finish exercise opens the next Exercise on Set 1 of its plan', async () => {
  vi.spyOn(Date, 'now').mockReturnValue(T0 + 100_000)
  const { user } = renderFeature((await workoutAWithLogged(FOUR_SQUATS)).services)
  await openExercise(user, 'Back squat')

  await user.click(await screen.findByRole('button', { name: 'Finish exercise' }, SETTLE))

  expect(await screen.findByText('Set 1 of 3', undefined, SETTLE)).toBeVisible()
  expect(screen.getByRole('heading', { name: 'Lunges' })).toBeVisible()
})

test('O11 after Finish exercise the next set screen still counts the rest from the last Set', async () => {
  vi.spyOn(Date, 'now').mockReturnValue(T0 + 100_000)
  const { user } = renderFeature((await workoutAWithLogged(FOUR_SQUATS)).services)
  await openExercise(user, 'Back squat')

  await user.click(await screen.findByRole('button', { name: 'Finish exercise' }, SETTLE))

  // Back squat's 180 s from T0, 100 s gone.
  await waitFor(async () => expect(await restReadoutText()).toBe('1:20'), SETTLE)
})

test('O11 Finish exercise skips a next Exercise whose Sets are all logged', async () => {
  vi.spyOn(Date, 'now').mockReturnValue(T0 + 100_000)
  const lunges = [1, 2, 3].map((setIndex) => ({
    exerciseId: 'lunges',
    setIndex,
    weightKg: 20,
    loggedAt: T0,
  }))
  const { user } = renderFeature((await workoutAWithLogged([...FOUR_SQUATS, ...lunges])).services)
  await openExercise(user, 'Back squat')

  expect(await screen.findByText('Up next: DB bench press', undefined, SETTLE)).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Finish exercise' }))

  expect(await screen.findByText('Set 1 of 4', undefined, SETTLE)).toBeVisible()
})

test('O11 with every Exercise done there is no Up next line and Finish exercise returns to the list', async () => {
  vi.spyOn(Date, 'now').mockReturnValue(T0 + 100_000)
  const plans: Array<[string, number]> = [
    ['back-squat', 4],
    ['lunges', 3],
    ['db-bench-press', 4],
    ['push-ups', 3],
    ['machine-shoulder-press', 3],
    ['lateral-raises', 3],
    ['cable-push-down', 3],
  ]
  const all = plans.flatMap(([exerciseId, count]) =>
    Array.from({ length: count }, (_, index) => ({
      exerciseId,
      setIndex: index + 1,
      weightKg: 20,
      loggedAt: T0,
    })),
  )
  const { user } = renderFeature((await workoutAWithLogged(all)).services)
  await openExercise(user, 'Back squat')

  const finish = await screen.findByRole('button', { name: 'Finish exercise' }, SETTLE)
  expect(screen.queryByText(/^Up next/)).toBeNull()
  await user.click(finish)

  const backSquat = await screen.findByRole('button', { name: /^Back squat/ }, SETTLE)
  expect(progressOf(backSquat)).toBe('4/4')
  expect(screen.queryByRole('button', { name: 'Finish exercise' })).toBeNull()
})

// --- E13-T9 O5/O6: the rest Dial, and "Use for this exercise" through programs.save -----------
//
// The bundled assaf-ab-2026 is named "A/B Split"; Workout A's Plans rest
// [180, 90, 90, 90, 90, 90, 90] (back squat first), Workout B's seated biceps curls 90 s.

/** Taps the rest readout, picks the rest Dial's Rung `label` and taps Set rest. */
async function setRestOnDial(user: UserEvent, label: string): Promise<void> {
  const timer = await screen.findByRole('timer', { name: 'Rest remaining' }, SETTLE)
  const readout = timer.closest('button')
  if (readout === null) throw new Error('the rest readout is not a button')
  await user.click(readout)
  const ladder = await screen.findByRole('listbox', { name: 'Rest ladder' }, SETTLE)
  await user.click(within(ladder).getByRole('option', { name: label }))
  await user.click(screen.getByRole('button', { name: 'Set rest' }))
}

/** Each Plan's restSeconds in `workoutId` of assaf-ab-2026, as the Program service loads it. */
async function planRests(services: Services, workoutId: string): Promise<number[]> {
  const { programs } = await services.programs.load()
  const program = programs.find((candidate) => candidate.id === 'assaf-ab-2026')
  const workout = program?.workouts.find((candidate) => candidate.id === workoutId)
  return workout?.exercises.map((plan) => plan.restSeconds) ?? []
}

test('O5 Set rest 2:30 on the rest Dial stores the Set with a 150 s rest through services.sessions.setRest', async () => {
  vi.spyOn(Date, 'now').mockReturnValue(T0 + 100_000)
  const { services, sessionId } = await workoutAWithLogged([
    { exerciseId: 'back-squat', setIndex: 1, weightKg: 60, loggedAt: T0 },
  ])
  const setRest = vi.spyOn(services.sessions, 'setRest')
  const { user } = renderFeature(services)
  await openExercise(user, 'Back squat')

  await setRestOnDial(user, '2:30')

  await waitFor(() => expect(setRest).toHaveBeenCalledTimes(1), SETTLE)
  expect(setRest).toHaveBeenCalledWith(sessionId, 'back-squat', 1, 150)
  await waitFor(async () => expect(await restReadoutText()).toBe('0:50'), SETTLE)
})

test('O6 Use 2:30 for Back squat saves A/B Split with the back squat Plan resting 150 s', async () => {
  vi.spyOn(Date, 'now').mockReturnValue(T0 + 100_000)
  const { services } = await workoutAWithLogged([
    { exerciseId: 'back-squat', setIndex: 1, weightKg: 60, loggedAt: T0 },
  ])
  const { user } = renderFeature(services)
  await openExercise(user, 'Back squat')
  await setRestOnDial(user, '2:30')

  await user.click(
    await screen.findByRole('button', { name: 'Use 2:30 for Back squat' }, SETTLE),
  )

  await waitFor(
    async () =>
      expect(await planRests(services, 'workout-a')).toEqual([150, 90, 90, 90, 90, 90, 90]),
    SETTLE,
  )
  expect(await planRests(services, 'workout-b')).toEqual([180, 90, 90, 90, 90, 90, 90])
})

test('O6 after Use 2:30 for Back squat the line reads Saved to A/B Split', async () => {
  vi.spyOn(Date, 'now').mockReturnValue(T0 + 100_000)
  const { services } = await workoutAWithLogged([
    { exerciseId: 'back-squat', setIndex: 1, weightKg: 60, loggedAt: T0 },
  ])
  const { user } = renderFeature(services)
  await openExercise(user, 'Back squat')
  await setRestOnDial(user, '2:30')

  await user.click(
    await screen.findByRole('button', { name: 'Use 2:30 for Back squat' }, SETTLE),
  )

  expect(await screen.findByText('Saved to A/B Split', undefined, SETTLE)).toBeVisible()
})

test("O6 after Use 2:30 for Back squat, the next Session's back squat rest is 2:30", async () => {
  vi.spyOn(Date, 'now').mockReturnValue(T0 + 100_000)
  const { services, sessionId } = await workoutAWithLogged([
    { exerciseId: 'back-squat', setIndex: 1, weightKg: 60, loggedAt: T0 },
  ])
  const first = renderFeature(services)
  await openExercise(first.user, 'Back squat')
  await setRestOnDial(first.user, '2:30')
  await first.user.click(
    await screen.findByRole('button', { name: 'Use 2:30 for Back squat' }, SETTLE),
  )
  await screen.findByText('Saved to A/B Split', undefined, SETTLE)
  cleanup()
  await services.sessions.finish(sessionId)
  const next = await services.sessions.start('assaf-ab-2026', 'workout-a')
  await services.sessions.logSet(next.id, {
    exerciseId: 'back-squat',
    setIndex: 1,
    weightKg: 60,
    reps: 10,
    loggedAt: T0 + 40_000,
  })

  const { user } = renderFeature(await servicesOnAssafAB())
  await openExercise(user, 'Back squat')

  // 150 s from T0 + 40 s, 60 s gone -- not the bundled 180 s's 2:00.
  await waitFor(async () => expect(await restReadoutText()).toBe('1:30'), SETTLE)
})

test('O6 a swapped-in Hammer Curls writes its rest to the Seated biceps curls Plan it was swapped under', async () => {
  vi.spyOn(Date, 'now').mockReturnValue(T0 + 30_000)
  const services = await servicesOnAssafAB()
  const started = await services.sessions.start('assaf-ab-2026', 'workout-b')
  await services.sessions.applySwap(started.id, 'seated-biceps-curls', 'Hammer_Curls')
  await services.sessions.logSet(started.id, {
    exerciseId: 'Hammer_Curls',
    setIndex: 1,
    weightKg: 10,
    reps: 10,
    loggedAt: T0,
  })
  const { user } = renderFeature(services)
  await user.click(await screen.findByRole('button', { name: HAMMER_ROW }, SETTLE))
  await setRestOnDial(user, '2:00')

  await user.click(
    await screen.findByRole('button', { name: 'Use 2:00 for Hammer Curls' }, SETTLE),
  )

  await waitFor(
    async () =>
      expect(await planRests(services, 'workout-b')).toEqual([180, 90, 90, 90, 90, 90, 120]),
    SETTLE,
  )
  const { programs } = await services.programs.load()
  const workoutB = programs
    .find((candidate) => candidate.id === 'assaf-ab-2026')
    ?.workouts.find((candidate) => candidate.id === 'workout-b')
  expect(workoutB?.exercises.map((plan) => plan.exerciseId)).not.toContain('Hammer_Curls')
})

test('O6 when programs.save refuses, its message shows inline and the back squat Plan keeps 180 s', async () => {
  vi.spyOn(Date, 'now').mockReturnValue(T0 + 100_000)
  const { services } = await workoutAWithLogged([
    { exerciseId: 'back-squat', setIndex: 1, weightKg: 60, loggedAt: T0 },
  ])
  vi.spyOn(services.programs, 'save').mockRejectedValue(
    new ServiceError('storage-unavailable', 'Could not save the Program'),
  )
  const { user } = renderFeature(services)
  await openExercise(user, 'Back squat')
  await setRestOnDial(user, '2:30')

  await user.click(
    await screen.findByRole('button', { name: 'Use 2:30 for Back squat' }, SETTLE),
  )

  expect(await screen.findByText('Could not save the Program', undefined, SETTLE)).toBeVisible()
  expect(screen.queryByText(/^Saved to/)).toBeNull()
  expect(await planRests(services, 'workout-a')).toEqual([180, 90, 90, 90, 90, 90, 90])
})

// --- E14-T4: the Session note on the list --------------------------------------------------

test('O12 Add note under the exercise list stores the typed text as the Session note', async () => {
  const { user } = await startWorkoutAWithSets(0)

  await user.click(await screen.findByRole('button', { name: 'Add note' }, SETTLE))
  await user.type(screen.getByLabelText('Note'), 'Slept badly')
  await user.click(screen.getByRole('button', { name: 'Save note' }))

  await waitFor(async () => expect((await storedActiveSession())?.note).toBe('Slept badly'), SETTLE)
  expect(await screen.findByText('Slept badly', undefined, SETTLE)).toBeVisible()
})

test('O12 saving the note empty removes it from the stored Session', async () => {
  const services = await servicesOnAssafAB()
  const started = await services.sessions.start('assaf-ab-2026', 'workout-a')
  await services.sessions.setNote(started.id, 'to be removed')
  const { user } = renderFeature(services)

  await user.click(await screen.findByRole('button', { name: 'Edit note' }, SETTLE))
  await user.clear(screen.getByLabelText('Note'))
  await user.click(screen.getByRole('button', { name: 'Save note' }))

  await waitFor(async () => {
    const stored = await storedActiveSession()
    expect(stored).not.toBeNull()
    expect(stored && 'note' in stored).toBe(false)
  }, SETTLE)
})

// --- E14-T8 O4/O5: warm-ups don't use up the Plan, and Presets match working Sets ------------
//
// Workout A's lunges Plan is 3 Sets of 10–12; lunges step by 1 kg from 7 kg. Warm-ups are stored
// through the real service with `kind: 'warmup'`, as E14-T9's kind row will store them.

type KindedSet = {
  exerciseId: string
  setIndex: number
  weightKg: number
  reps: number
  kind?: 'warmup'
}

async function logAll(services: Services, sessionId: string, sets: KindedSet[]): Promise<void> {
  for (const set of sets) {
    await services.sessions.logSet(sessionId, { ...set, loggedAt: T0 + set.setIndex })
  }
}

/** Lunges today: warm-ups 4×12 and 5×10, then one working Set 9×12. */
const LUNGES_TWO_WARMUPS_ONE_WORKING: KindedSet[] = [
  { exerciseId: 'lunges', setIndex: 1, weightKg: 4, reps: 12, kind: 'warmup' },
  { exerciseId: 'lunges', setIndex: 2, weightKg: 5, reps: 10, kind: 'warmup' },
  { exerciseId: 'lunges', setIndex: 3, weightKg: 9, reps: 12 },
]

async function workoutAWithKinded(sets: KindedSet[]): Promise<Services> {
  const services = await servicesOnAssafAB()
  const started = await services.sessions.start('assaf-ab-2026', 'workout-a')
  await logAll(services, started.id, sets)
  return services
}

test('O4 lunges with 2 warm-ups and 1 working Set logged reads 1/3 on the exercise list', async () => {
  renderFeature(await workoutAWithKinded(LUNGES_TWO_WARMUPS_ONE_WORKING))

  const lunges = await screen.findByRole('button', { name: /^Lunges/ }, SETTLE)
  expect(progressOf(lunges)).toBe('1/3')
})

test('O4 opening lunges with 2 warm-ups and 1 working Set logged shows Set 2 of 3 with Log set', async () => {
  const { user } = renderFeature(await workoutAWithKinded(LUNGES_TWO_WARMUPS_ONE_WORKING))
  await openExercise(user, 'Lunges')

  expect(await screen.findByText('Set 2 of 3', undefined, SETTLE)).toBeVisible()
  expect(screen.getByRole('button', { name: 'Log set' })).toBeVisible()
})

test('O4 the lunges Set logged after 2 warm-ups and 1 working Set is stored as setIndex 4', async () => {
  const { user } = renderFeature(await workoutAWithKinded(LUNGES_TWO_WARMUPS_ONE_WORKING))
  await openExercise(user, 'Lunges')

  await user.click(await screen.findByRole('button', { name: 'Log set' }, SETTLE))

  await waitFor(async () => {
    const stored = await storedActiveSession()
    expect(stored?.entries.map((entry) => entry.setIndex)).toEqual([1, 2, 3, 4])
  }, SETTLE)
})

test('O4 opening lunges with 2 warm-ups and 3 working Sets logged shows the done state', async () => {
  const { user } = renderFeature(
    await workoutAWithKinded([
      ...LUNGES_TWO_WARMUPS_ONE_WORKING,
      { exerciseId: 'lunges', setIndex: 4, weightKg: 9, reps: 11 },
      { exerciseId: 'lunges', setIndex: 5, weightKg: 9, reps: 10 },
    ]),
  )
  await openExercise(user, 'Lunges')

  expect(await screen.findByText('All 3 sets logged', undefined, SETTLE)).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Log set' })).toBeNull()
})

test('O4 with back squat done and only warm-ups on lunges, Up next is Lunges', async () => {
  const { user } = renderFeature(
    await workoutAWithKinded([
      ...FOUR_SQUATS.map((set) => ({ ...set, reps: 10 })),
      ...LUNGES_TWO_WARMUPS_ONE_WORKING.slice(0, 2),
      { exerciseId: 'lunges', setIndex: 3, weightKg: 6, reps: 8, kind: 'warmup' as const },
    ]),
  )
  await openExercise(user, 'Back squat')

  expect(await screen.findByText('Up next: Lunges', undefined, SETTLE)).toBeVisible()
})

test('O5 after a warm-up today, lunges opens on last time’s first working Set, not its warm-up', async () => {
  const services = await servicesOnAssafAB()
  const last = await services.sessions.start('assaf-ab-2026', 'workout-a')
  await logAll(services, last.id, [
    { exerciseId: 'lunges', setIndex: 1, weightKg: 4, reps: 12, kind: 'warmup' },
    { exerciseId: 'lunges', setIndex: 2, weightKg: 5, reps: 10, kind: 'warmup' },
    { exerciseId: 'lunges', setIndex: 3, weightKg: 10, reps: 12 },
    { exerciseId: 'lunges', setIndex: 4, weightKg: 11, reps: 10 },
    { exerciseId: 'lunges', setIndex: 5, weightKg: 12, reps: 10 },
  ])
  await services.sessions.finish(last.id)
  const today = await services.sessions.start('assaf-ab-2026', 'workout-a')
  await logAll(services, today.id, [
    { exerciseId: 'lunges', setIndex: 1, weightKg: 6, reps: 12, kind: 'warmup' },
  ])

  const { user } = renderFeature(services)
  await openExercise(user, 'Lunges')

  const weight = await screen.findByRole('button', { name: 'Weight' }, SETTLE)
  expect(
    [weight, screen.getByRole('button', { name: 'Reps' })].map((readout) =>
      (readout.textContent ?? '').replace(/\s+/g, ' ').trim(),
    ),
  ).toEqual(['10', '12'])
})
