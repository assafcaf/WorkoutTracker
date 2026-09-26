import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { App } from './App'
import abSplitJson from './data/programs/assaf-ab-2026.json'
import { db } from './storage/db'
import { USER_PROGRAMS_KEY } from './storage/settingsStore'
import { FakeSyncServer } from './test/fakeSyncServer'
import type { Program, Session, UserProgram } from './types'

// E9-T10: the trainee deletes their own Programs and resets an edited bundled one from the Program
// tab, and a Session in progress guards the Program and Workout it runs on. `App` composes the real
// Program tab, ProgramEditor, History, set screen and the fake-indexeddb-backed db; the network is
// faked at `fetch`, as `App.programs.test.tsx` does.

vi.mock('virtual:pwa-register', () => ({
  registerSW() {
    return async () => {}
  },
}))

type User = ReturnType<typeof userEvent.setup>

const SETTLE = { timeout: 5000 }
const LONG = 30_000

const AB_SPLIT = abSplitJson as Program
const BENCH_ID = 'Barbell_Bench_Press_-_Medium_Grip'
const GUARD = 'Finish the workout in progress first'

let server: FakeSyncServer

beforeEach(async () => {
  await db.open()
  await db.sessions.clear()
  await db.settings.clear()
  server = new FakeSyncServer()
  vi.stubGlobal('fetch', server.fetch)
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

// --- fixtures -----------------------------------------------------------------------------------

/** `P` of the ticket: a stored User Program with Workouts `Push`, `Pull` and `Legs`. */
function pushPullLegs(): UserProgram {
  return {
    id: 'user-stored-ppl',
    name: 'Push Pull Legs',
    units: 'kg',
    sessionsPerWeek: 3,
    createdAt: 1_700_000_000_000,
    workouts: [
      {
        id: 'workout-push',
        name: 'Push',
        exercises: [
          { exerciseId: BENCH_ID, sets: 4, repRange: [6, 8], restSeconds: 120, startWeightKg: 60 },
        ],
      },
      {
        id: 'workout-pull',
        name: 'Pull',
        exercises: [{ exerciseId: 'Barbell_Deadlift', sets: 3, repRange: [8, 12], restSeconds: 90 }],
      },
      {
        id: 'workout-legs',
        name: 'Legs',
        exercises: [{ exerciseId: 'Barbell_Squat', sets: 3, repRange: [8, 12], restSeconds: 90 }],
      },
    ],
  }
}

/** A second stored User Program, with no Session on it. */
function upperLower(): UserProgram {
  return {
    id: 'user-stored-ul',
    name: 'Upper Lower',
    units: 'kg',
    sessionsPerWeek: 2,
    createdAt: 1_700_000_100_000,
    workouts: [
      {
        id: 'workout-upper',
        name: 'Upper',
        exercises: [{ exerciseId: BENCH_ID, sets: 3, repRange: [8, 12], restSeconds: 90 }],
      },
      {
        id: 'workout-lower',
        name: 'Lower',
        exercises: [{ exerciseId: 'Barbell_Squat', sets: 3, repRange: [8, 12], restSeconds: 90 }],
      },
    ],
  }
}

/** Two finished Sessions of `Push Pull Legs`: one of `Push`, one of `Pull`. */
function finishedPplSessions(): Session[] {
  return [
    {
      id: 'ppl-push-done',
      programId: 'user-stored-ppl',
      workoutId: 'workout-push',
      startedAt: 1_700_100_000_000,
      finishedAt: 1_700_100_000_000 + 3_600_000,
      entries: [
        { exerciseId: BENCH_ID, setIndex: 1, weightKg: 60, reps: 6, loggedAt: 1_700_100_060_000 },
      ],
      updatedAt: 1_700_100_000_000 + 3_600_000,
    },
    {
      id: 'ppl-pull-done',
      programId: 'user-stored-ppl',
      workoutId: 'workout-pull',
      startedAt: 1_700_200_000_000,
      finishedAt: 1_700_200_000_000 + 3_600_000,
      entries: [
        { exerciseId: 'Barbell_Deadlift', setIndex: 1, weightKg: 100, reps: 8, loggedAt: 1_700_200_060_000 },
      ],
      updatedAt: 1_700_200_000_000 + 3_600_000,
    },
  ]
}

async function storeUserPrograms(programs: UserProgram[]): Promise<void> {
  await db.settings.put({ key: USER_PROGRAMS_KEY, value: programs, updatedAt: Date.now() })
}

async function storeActive(id: string): Promise<void> {
  await db.settings.put({ key: 'activeProgramId', value: id, updatedAt: Date.now() })
}

/** A fresh Session in progress on `Push` of `Push Pull Legs`, started just now, no set logged. */
async function pushInProgress(): Promise<void> {
  const now = Date.now()
  await db.sessions.put({
    id: 'push-in-progress',
    programId: 'user-stored-ppl',
    workoutId: 'workout-push',
    startedAt: now,
    finishedAt: null,
    entries: [],
    updatedAt: now,
  })
}

async function storedUserPrograms(): Promise<UserProgram[]> {
  const row = await db.settings.get(USER_PROGRAMS_KEY)
  return Array.isArray(row?.value) ? (row.value as UserProgram[]) : []
}

async function storedProgram(id: string): Promise<UserProgram | undefined> {
  return (await storedUserPrograms()).find((program) => program.id === id)
}

// --- helpers ------------------------------------------------------------------------------------

async function openProgramTab(user: User): Promise<void> {
  await user.click(await screen.findByRole('button', { name: 'Program' }, SETTLE))
  await screen.findByRole('button', { name: 'New program' }, SETTLE)
}

/** From the exercise list of the Session in progress, back to the picker, then the Program tab. */
async function openProgramTabFromSession(user: User): Promise<void> {
  await user.click(await screen.findByRole('button', { name: 'Back' }, SETTLE))
  await openProgramTab(user)
}

/** The Program tab's action row for the Program named exactly `name`, or null when it has none. */
function queryActionsRow(name: string): HTMLElement | null {
  return (
    screen
      .queryAllByRole('button', { name: 'Copy' })
      .map((button) => button.parentElement as HTMLElement)
      .find((candidate) => within(candidate).queryByText(name) !== null) ?? null
  )
}

function actionsRow(name: string): HTMLElement {
  const row = queryActionsRow(name)
  if (row === null) throw new Error(`no Program tab row for ${name}`)
  return row
}

async function deleteAndConfirm(user: User, name: string): Promise<void> {
  await user.click(within(actionsRow(name)).getByRole('button', { name: 'Delete' }))
  await user.click(within(actionsRow(name)).getByRole('button', { name: 'Confirm' }))
}

async function resetAndConfirm(user: User, name: string): Promise<void> {
  await user.click(within(actionsRow(name)).getByRole('button', { name: 'Reset to original' }))
  await user.click(within(actionsRow(name)).getByRole('button', { name: 'Confirm' }))
}

/** The editor's visible Workouts, top to bottom: each `Workout name` input's `<fieldset>`. */
function editorWorkouts(): HTMLElement[] {
  return (screen.queryAllByLabelText('Workout name') as HTMLInputElement[]).map((input) => {
    const group = input.closest('fieldset')
    if (group === null) throw new Error('a Workout name input is not inside a <fieldset>')
    return group
  })
}

/** The editor's visible Workout whose name input holds exactly `name`. */
function editorWorkout(name: string): HTMLElement {
  const found = editorWorkouts().find(
    (group) => (within(group).getByLabelText('Workout name') as HTMLInputElement).value === name,
  )
  if (found === undefined) throw new Error(`no editor Workout named ${name}`)
  return found
}

async function editProgram(user: User, name: string): Promise<void> {
  await user.click(within(actionsRow(name)).getByRole('button', { name: 'Edit' }))
  await screen.findByLabelText('Program name', undefined, SETTLE)
}

async function removeWorkout(user: User, name: string): Promise<void> {
  await user.click(within(editorWorkout(name)).getByRole('button', { name: 'Remove workout' }))
}

async function setField(user: User, scope: HTMLElement, label: string, value: string): Promise<void> {
  const input = within(scope).getByLabelText(label)
  await user.clear(input)
  await user.type(input, value)
}

async function save(user: User): Promise<void> {
  await user.click(screen.getByRole('button', { name: 'Save' }))
}

async function cancel(user: User): Promise<void> {
  await user.click(screen.getByRole('button', { name: 'Cancel' }))
  await screen.findByRole('button', { name: 'New program' }, SETTLE)
}

async function editorClosed(): Promise<void> {
  await waitFor(() => expect(screen.queryByLabelText('Program name')).toBeNull(), SETTLE)
}

/** Waits for the Program tab to show the guard line. */
async function guardShown(): Promise<void> {
  expect(await screen.findByText(GUARD, undefined, SETTLE)).toBeVisible()
}

function text(element: HTMLElement): string {
  return (element.textContent ?? '').replace(/\s+/g, ' ').trim()
}

// --- O10: Delete on a user Program --------------------------------------------------------------

test('O10 Delete then Confirm on a user Program removes it from the Program tab', async () => {
  const user = userEvent.setup()
  await storeUserPrograms([pushPullLegs()])
  await storeActive('assaf-ab-2026')
  for (const session of finishedPplSessions()) await db.sessions.put(session)
  render(<App />)

  await openProgramTab(user)
  await deleteAndConfirm(user, 'Push Pull Legs')

  await waitFor(() => expect(screen.queryByRole('radio', { name: 'Push Pull Legs' })).toBeNull(), SETTLE)
  expect(queryActionsRow('Push Pull Legs')).toBeNull()
  expect(screen.getByRole('radio', { name: 'A/B Split' })).toBeChecked()
}, LONG)

test('O10 a deleted user Program stays gone from the Program tab after a restart', async () => {
  const user = userEvent.setup()
  await storeUserPrograms([pushPullLegs()])
  await storeActive('assaf-ab-2026')
  for (const session of finishedPplSessions()) await db.sessions.put(session)
  const first = render(<App />)

  await openProgramTab(user)
  await deleteAndConfirm(user, 'Push Pull Legs')
  await waitFor(() => expect(screen.queryByRole('radio', { name: 'Push Pull Legs' })).toBeNull(), SETTLE)
  first.unmount()
  cleanup()
  render(<App />)
  await openProgramTab(user)

  expect(screen.queryByRole('radio', { name: 'Push Pull Legs' })).toBeNull()
  expect(screen.getByRole('radio', { name: 'A/B Split' })).toBeInTheDocument()
}, LONG)

test('O10 deleting a user Program keeps its finished Sessions, listed in History under their Workout names', async () => {
  const user = userEvent.setup()
  await storeUserPrograms([pushPullLegs()])
  await storeActive('assaf-ab-2026')
  for (const session of finishedPplSessions()) await db.sessions.put(session)
  render(<App />)

  await openProgramTab(user)
  await deleteAndConfirm(user, 'Push Pull Legs')
  await waitFor(() => expect(screen.queryByRole('radio', { name: 'Push Pull Legs' })).toBeNull(), SETTLE)
  await user.click(screen.getByRole('button', { name: 'History' }))

  await waitFor(() => expect(document.body.querySelectorAll('.history-row')).toHaveLength(2), SETTLE)
  const workoutNames = [...document.body.querySelectorAll<HTMLElement>('.history-workout')].map(text)
  expect(workoutNames.sort()).toEqual(['Pull', 'Push'])
  expect((await db.sessions.toArray()).map((s) => s.id).sort()).toEqual(['ppl-pull-done', 'ppl-push-done'])
}, LONG)

test('O10 deleting the active user Program falls back to the first visible Program on the Program tab', async () => {
  const user = userEvent.setup()
  await storeUserPrograms([pushPullLegs()])
  await storeActive('user-stored-ppl')
  for (const session of finishedPplSessions()) await db.sessions.put(session)
  render(<App />)

  await openProgramTab(user)
  expect(screen.getByRole('radio', { name: 'Push Pull Legs' })).toBeChecked()
  await deleteAndConfirm(user, 'Push Pull Legs')

  await waitFor(() => expect(screen.queryByRole('radio', { name: 'Push Pull Legs' })).toBeNull(), SETTLE)
  expect(screen.getByRole('radio', { name: 'A/B Split' })).toBeChecked()
  expect(screen.getByRole('heading', { level: 2, name: 'A/B Split' })).toBeVisible()
}, LONG)

test('O10 deleting the active user Program leaves the workout picker offering the first visible Program’s Workouts', async () => {
  const user = userEvent.setup()
  await storeUserPrograms([pushPullLegs()])
  await storeActive('user-stored-ppl')
  for (const session of finishedPplSessions()) await db.sessions.put(session)
  render(<App />)

  expect(await screen.findByRole('button', { name: 'Start Push' }, SETTLE)).toBeVisible()
  await openProgramTab(user)
  await deleteAndConfirm(user, 'Push Pull Legs')
  await waitFor(() => expect(screen.queryByRole('radio', { name: 'Push Pull Legs' })).toBeNull(), SETTLE)
  await user.click(screen.getByRole('button', { name: 'Workout' }))

  expect(await screen.findByRole('button', { name: 'Start Workout A' }, SETTLE)).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Start Push' })).toBeNull()
}, LONG)

test('O10 after deleting the active user Program a restart still offers the first visible Program’s Workouts', async () => {
  const user = userEvent.setup()
  await storeUserPrograms([pushPullLegs()])
  await storeActive('user-stored-ppl')
  for (const session of finishedPplSessions()) await db.sessions.put(session)
  const first = render(<App />)

  await openProgramTab(user)
  await deleteAndConfirm(user, 'Push Pull Legs')
  await waitFor(() => expect(screen.queryByRole('radio', { name: 'Push Pull Legs' })).toBeNull(), SETTLE)
  first.unmount()
  cleanup()
  render(<App />)

  expect(await screen.findByRole('button', { name: 'Start Workout A' }, SETTLE)).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Start Push' })).toBeNull()
}, LONG)

// --- O11: a Session in progress guards its Program and Workout -----------------------------------

test('O11 Delete then Confirm on the Program of the Session in progress shows Finish the workout in progress first', async () => {
  const user = userEvent.setup()
  await storeUserPrograms([pushPullLegs()])
  await storeActive('user-stored-ppl')
  await pushInProgress()
  render(<App />)

  await openProgramTabFromSession(user)
  await deleteAndConfirm(user, 'Push Pull Legs')

  await guardShown()
}, LONG)

test('O11 Delete then Confirm on the Program of the Session in progress deletes nothing', async () => {
  const user = userEvent.setup()
  await storeUserPrograms([pushPullLegs()])
  await storeActive('user-stored-ppl')
  await pushInProgress()
  render(<App />)

  await openProgramTabFromSession(user)
  await deleteAndConfirm(user, 'Push Pull Legs')
  await guardShown()

  expect(await storedUserPrograms()).toEqual([pushPullLegs()])
  expect(screen.getByRole('radio', { name: 'Push Pull Legs' })).toBeChecked()
  expect(actionsRow('Push Pull Legs')).toBeVisible()
}, LONG)

test('O11 with a Session in progress, Delete on another user Program still deletes it', async () => {
  const user = userEvent.setup()
  await storeUserPrograms([pushPullLegs(), upperLower()])
  await storeActive('user-stored-ppl')
  await pushInProgress()
  render(<App />)

  await openProgramTabFromSession(user)
  // The guard first holds for the Program the Session runs on...
  await deleteAndConfirm(user, 'Push Pull Legs')
  await guardShown()
  // ...and not for a Program it does not run on.
  await deleteAndConfirm(user, 'Upper Lower')

  await waitFor(() => expect(screen.queryByRole('radio', { name: 'Upper Lower' })).toBeNull(), SETTLE)
  expect((await storedProgram('user-stored-ul'))?.hidden).toBe(true)
  expect((await storedProgram('user-stored-ppl'))?.hidden).toBeUndefined()
}, LONG)

test('O11 removing the Workout in progress in the editor and saving shows Finish the workout in progress first and keeps the editor open', async () => {
  const user = userEvent.setup()
  await storeUserPrograms([pushPullLegs()])
  await storeActive('user-stored-ppl')
  await pushInProgress()
  render(<App />)

  await openProgramTabFromSession(user)
  await editProgram(user, 'Push Pull Legs')
  await removeWorkout(user, 'Push')
  await save(user)

  expect(await screen.findByText(GUARD, undefined, SETTLE)).toBeVisible()
  expect(screen.getByLabelText('Program name')).toBeInTheDocument()
}, LONG)

test('O11 removing the Workout in progress in the editor and saving stores nothing', async () => {
  const user = userEvent.setup()
  await storeUserPrograms([pushPullLegs()])
  await storeActive('user-stored-ppl')
  await pushInProgress()
  render(<App />)

  await openProgramTabFromSession(user)
  await editProgram(user, 'Push Pull Legs')
  await setField(user, document.body, 'Program name', 'PPL renamed')
  await removeWorkout(user, 'Push')
  await save(user)
  await screen.findByText(GUARD, undefined, SETTLE)

  expect(await storedUserPrograms()).toEqual([pushPullLegs()])
}, LONG)

test('O11 removing a Workout of a bundled Program whose Session is in progress is refused too', async () => {
  const user = userEvent.setup()
  await storeActive('assaf-ab-2026')
  const now = Date.now()
  await db.sessions.put({
    id: 'a-in-progress',
    programId: 'assaf-ab-2026',
    workoutId: 'workout-a',
    startedAt: now,
    finishedAt: null,
    entries: [],
    updatedAt: now,
  })
  render(<App />)

  await openProgramTabFromSession(user)
  await editProgram(user, 'A/B Split')
  await removeWorkout(user, 'Workout A')
  await save(user)

  expect(await screen.findByText(GUARD, undefined, SETTLE)).toBeVisible()
  expect(await storedUserPrograms()).toEqual([])
}, LONG)

test('O11 with a Session in progress, removing another Workout of its Program and saving is allowed', async () => {
  const user = userEvent.setup()
  await storeUserPrograms([pushPullLegs()])
  await storeActive('user-stored-ppl')
  await pushInProgress()
  render(<App />)

  await openProgramTabFromSession(user)
  // Removing the Workout in progress is refused...
  await editProgram(user, 'Push Pull Legs')
  await removeWorkout(user, 'Push')
  await save(user)
  await screen.findByText(GUARD, undefined, SETTLE)
  await cancel(user)
  // ...removing another Workout of the same Program is not.
  await editProgram(user, 'Push Pull Legs')
  await removeWorkout(user, 'Legs')
  await save(user)
  await editorClosed()

  await waitFor(async () => {
    const stored = await storedProgram('user-stored-ppl')
    expect(stored?.workouts.find((w) => w.id === 'workout-legs')?.hidden).toBe(true)
  }, SETTLE)
  const stored = await storedProgram('user-stored-ppl')
  expect(stored?.workouts.find((w) => w.id === 'workout-push')?.hidden).toBeUndefined()
}, LONG)

test('O11 with a Session in progress, editing its Workout’s Plans and saving is allowed and the set screen uses the new numbers', async () => {
  const user = userEvent.setup()
  await storeUserPrograms([pushPullLegs()])
  await storeActive('user-stored-ppl')
  await pushInProgress()
  render(<App />)

  await openProgramTabFromSession(user)
  // The guard holds for removing the Workout in progress...
  await editProgram(user, 'Push Pull Legs')
  await removeWorkout(user, 'Push')
  await save(user)
  await screen.findByText(GUARD, undefined, SETTLE)
  await cancel(user)
  // ...and not for changing its numbers.
  await editProgram(user, 'Push Pull Legs')
  const push = editorWorkout('Push')
  await setField(user, push, 'Max reps', '12')
  await setField(user, push, 'Min reps', '10')
  await setField(user, push, 'Starting weight (kg)', '70')
  await save(user)
  await editorClosed()

  await waitFor(async () => {
    const stored = await storedProgram('user-stored-ppl')
    expect(stored?.workouts[0].exercises[0]).toEqual({
      exerciseId: BENCH_ID,
      sets: 4,
      repRange: [10, 12],
      restSeconds: 120,
      startWeightKg: 70,
    })
  }, SETTLE)

  await user.click(await screen.findByRole('button', { name: 'Workout' }, SETTLE))
  await waitFor(() => expect(document.body.querySelector('button.resume-workout')).not.toBeNull(), SETTLE)
  await user.click(document.body.querySelector('button.resume-workout') as HTMLElement)
  await user.click(await screen.findByRole('button', { name: /^Barbell Bench Press - Medium Grip/ }, SETTLE))

  const weight = await screen.findByRole('button', { name: 'Weight' }, SETTLE)
  expect(text(weight)).toBe('70')
  expect(text(screen.getByRole('button', { name: 'Reps' }))).toBe('10')
}, LONG)

// --- O12: Reset to original on an edited A/B Split ----------------------------------------------

/** A stored edit of A/B Split: Workout A's back squat at 5 sets of 3-5, 240 s rest. */
function editedAbSplit(): UserProgram {
  return {
    ...AB_SPLIT,
    createdAt: 1_234,
    workouts: AB_SPLIT.workouts.map((workout, i) =>
      i === 0
        ? {
            ...workout,
            exercises: [
              { exerciseId: 'back-squat', sets: 5, repRange: [3, 5], restSeconds: 240 },
              ...workout.exercises.slice(1),
            ],
          }
        : workout,
    ),
  }
}

test('O12 Reset to original then Confirm on an edited A/B Split shows the bundled Plans again', async () => {
  const user = userEvent.setup()
  await storeUserPrograms([editedAbSplit()])
  await storeActive('assaf-ab-2026')
  render(<App />)

  await openProgramTab(user)
  expect(screen.getByText('Back squat 3-5 x 5, rest 240s')).toBeVisible()
  await resetAndConfirm(user, 'A/B Split')

  expect(await screen.findByText('Back squat 8-10 x 4, rest 180s', undefined, SETTLE)).toBeVisible()
  expect(screen.queryByText('Back squat 3-5 x 5, rest 240s')).toBeNull()
}, LONG)

test('O12 Reset to original then Confirm removes the stored copy and the Reset to original action', async () => {
  const user = userEvent.setup()
  await storeUserPrograms([editedAbSplit(), pushPullLegs()])
  await storeActive('assaf-ab-2026')
  render(<App />)

  await openProgramTab(user)
  await resetAndConfirm(user, 'A/B Split')

  await waitFor(async () => {
    expect((await storedUserPrograms()).map((p) => p.id)).toEqual(['user-stored-ppl'])
  }, SETTLE)
  await waitFor(() => {
    expect(within(actionsRow('A/B Split')).queryByRole('button', { name: 'Reset to original' })).toBeNull()
  }, SETTLE)
  expect(screen.getByRole('radio', { name: 'A/B Split' })).toBeChecked()
}, LONG)

test('O12 after Reset to original a set screen on Workout A uses the bundled numbers', async () => {
  const user = userEvent.setup()
  await storeUserPrograms([editedAbSplit()])
  await storeActive('assaf-ab-2026')
  render(<App />)

  await openProgramTab(user)
  await resetAndConfirm(user, 'A/B Split')
  await screen.findByText('Back squat 8-10 x 4, rest 180s', undefined, SETTLE)
  await user.click(screen.getByRole('button', { name: 'Workout' }))
  await user.click(await screen.findByRole('button', { name: 'Start Workout A' }, SETTLE))
  await user.click(await screen.findByRole('button', { name: /^Back squat/ }, SETTLE))

  const reps = await screen.findByRole('button', { name: 'Reps' }, SETTLE)
  expect(text(reps)).toBe('8')
}, LONG)
