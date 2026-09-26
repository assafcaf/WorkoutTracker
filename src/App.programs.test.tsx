import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { App } from './App'
import abSplitJson from './data/programs/assaf-ab-2026.json'
import { db } from './storage/db'
import { USER_PROGRAMS_KEY } from './storage/settingsStore'
import { FakeSyncServer } from './test/fakeSyncServer'
import type { Program, UserProgram } from './types'

// E9-T9: the trainee builds, copies and edits Programs from the Program tab, and trains on them.
// `App` composes the real Program tab, ProgramEditor, set screen and the fake-indexeddb-backed db;
// the network is faked at `fetch`, as `App.newUser.test.tsx` does.

vi.mock('virtual:pwa-register', () => ({
  registerSW() {
    return async () => {}
  },
}))

type User = ReturnType<typeof userEvent.setup>

const SETTLE = { timeout: 5000 }
/** A whole build-a-Program flow types into a search over the full library; give it room. */
const LONG = 30_000

const AB_SPLIT = abSplitJson as Program
const BENCH = 'Barbell Bench Press - Medium Grip'
const BENCH_ID = 'Barbell_Bench_Press_-_Medium_Grip'

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

// --- helpers ------------------------------------------------------------------------------------

async function withActiveAbSplit(): Promise<void> {
  await db.settings.put({ key: 'activeProgramId', value: 'assaf-ab-2026', updatedAt: Date.now() })
}

async function storedUserPrograms(): Promise<UserProgram[]> {
  const row = await db.settings.get(USER_PROGRAMS_KEY)
  return Array.isArray(row?.value) ? (row.value as UserProgram[]) : []
}

async function openProgramTab(user: User): Promise<void> {
  await user.click(await screen.findByRole('button', { name: 'Program' }, SETTLE))
  await screen.findByRole('button', { name: 'New program' }, SETTLE)
}

/** The Program tab's action row for the Program named exactly `name`. */
function actionsRow(name: string): HTMLElement {
  const row = screen
    .getAllByRole('button', { name: 'Copy' })
    .map((button) => button.parentElement as HTMLElement)
    .find((candidate) => within(candidate).queryByText(name) !== null)
  if (row === undefined) throw new Error(`no Program tab row for ${name}`)
  return row
}

/** The editor's visible Workouts, top to bottom: each `Workout name` input's `<fieldset>`. */
function editorWorkouts(): HTMLElement[] {
  return (screen.queryAllByLabelText('Workout name') as HTMLInputElement[]).map((input) => {
    const group = input.closest('fieldset')
    if (group === null) throw new Error('a Workout name input is not inside a <fieldset>')
    return group
  })
}

function valuesOf(scope: HTMLElement, label: string): string[] {
  return (within(scope).queryAllByLabelText(label) as HTMLInputElement[]).map((i) => i.value)
}

async function addWorkout(user: User, name: string): Promise<HTMLElement> {
  await user.click(screen.getByRole('button', { name: 'Add workout' }))
  const all = editorWorkouts()
  const added = all[all.length - 1]
  await user.type(within(added).getByLabelText('Workout name'), name)
  return added
}

/** `Add exercise` on `workout`, search `query`, then `Pick` on the row named exactly `name`. */
async function pickInto(user: User, workout: HTMLElement, query: string, name: string): Promise<void> {
  await user.click(within(workout).getByRole('button', { name: 'Add exercise' }))
  const dialog = await screen.findByRole('dialog', { name: 'Add exercise' }, SETTLE)
  await user.type(within(dialog).getByLabelText('Search exercises'), query)
  const row = await waitFor(() => {
    const found = within(dialog)
      .getAllByRole('listitem')
      .find((item) => within(item).queryByText(name) !== null)
    if (found === undefined) throw new Error(`no pickable row for ${name}`)
    return found
  }, SETTLE)
  await user.click(within(row).getByRole('button', { name: 'Pick' }))
}

async function setField(user: User, scope: HTMLElement, label: string, value: string): Promise<void> {
  const input = within(scope).getByLabelText(label)
  await user.clear(input)
  await user.type(input, value)
}

async function save(user: User): Promise<void> {
  await user.click(screen.getByRole('button', { name: 'Save' }))
}

/** Waits until the editor has closed after a save. */
async function editorClosed(): Promise<void> {
  await waitFor(() => expect(screen.queryByLabelText('Program name')).toBeNull(), SETTLE)
}

/**
 * The O13 build: `New program`, name `Push Pull Legs`, Workouts `Push`, `Pull`, `Legs`; `Push`
 * gets `Barbell Bench Press - Medium Grip` at 4 sets, 6-8 reps, 120 s rest, 60 kg. `Pull` and
 * `Legs` each get one Exercise at its defaults, so the Program is valid and `Save` is enabled.
 */
async function buildPushPullLegs(user: User): Promise<void> {
  await openProgramTab(user)
  await user.click(screen.getByRole('button', { name: 'New program' }))
  await user.type(await screen.findByLabelText('Program name', undefined, SETTLE), 'Push Pull Legs')

  const push = await addWorkout(user, 'Push')
  const pull = await addWorkout(user, 'Pull')
  const legs = await addWorkout(user, 'Legs')

  await pickInto(user, push, 'bench press', BENCH)
  await setField(user, push, 'Sets', '4')
  await setField(user, push, 'Min reps', '6')
  await setField(user, push, 'Max reps', '8')
  await setField(user, push, 'Rest (s)', '120')
  await setField(user, push, 'Starting weight (kg)', '60')

  await pickInto(user, pull, 'barbell deadlift', 'Barbell Deadlift')
  await pickInto(user, legs, 'barbell squat', 'Barbell Squat')

  await save(user)
  await editorClosed()
}

function pushPullLegsStored(): UserProgram {
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

// --- O13: a new Program is built, stored, listed, made active and trained on ---------------------

test(
  'O13 saving a built Program stores it with its Workouts and the Push Plan’s 4 sets, 6-8 reps, 120 s rest and 60 kg',
  async () => {
    const user = userEvent.setup()
    await withActiveAbSplit()
    render(<App />)
    const before = Date.now()

    await buildPushPullLegs(user)

    await waitFor(async () => expect(await storedUserPrograms()).toHaveLength(1), SETTLE)
    const [stored] = await storedUserPrograms()
    expect(stored.id).toMatch(/^user-.+/)
    expect(stored.name).toBe('Push Pull Legs')
    expect(stored.units).toBe('kg')
    expect(stored.sessionsPerWeek).toBe(3)
    expect(stored.createdAt).toBeGreaterThanOrEqual(before)
    expect(stored.createdAt).toBeLessThanOrEqual(Date.now())
    expect(stored.workouts.map((w) => w.name)).toEqual(['Push', 'Pull', 'Legs'])
    expect(stored.workouts[0].exercises).toEqual([
      { exerciseId: BENCH_ID, sets: 4, repRange: [6, 8], restSeconds: 120, startWeightKg: 60 },
    ])
  },
  LONG,
)

test(
  'O13 a saved new Program is listed on the Program tab',
  async () => {
    const user = userEvent.setup()
    await withActiveAbSplit()
    render(<App />)

    await buildPushPullLegs(user)
    await openProgramTab(user)

    expect(screen.getByRole('radio', { name: 'Push Pull Legs' })).toBeInTheDocument()
    expect(actionsRow('Push Pull Legs')).toBeVisible()
  },
  LONG,
)

test(
  'O13 a saved new Program chosen on the Program tab becomes the active Program and the Workout tab offers its Workouts',
  async () => {
    const user = userEvent.setup()
    await withActiveAbSplit()
    render(<App />)

    await buildPushPullLegs(user)
    await openProgramTab(user)
    await user.click(screen.getByRole('radio', { name: 'Push Pull Legs' }))

    const [stored] = await storedUserPrograms()
    await waitFor(async () => {
      expect((await db.settings.get('activeProgramId'))?.value).toBe(stored.id)
    }, SETTLE)
    await user.click(screen.getByRole('button', { name: 'Workout' }))
    expect(await screen.findByRole('button', { name: 'Start Push' }, SETTLE)).toBeVisible()
    expect(screen.getByRole('button', { name: 'Start Pull' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Start Legs' })).toBeVisible()
  },
  LONG,
)

test(
  'O13 a Session started on Push opens the bench press Set 1 at 60 kg x 6',
  async () => {
    const user = userEvent.setup()
    await withActiveAbSplit()
    render(<App />)

    await buildPushPullLegs(user)
    await openProgramTab(user)
    await user.click(screen.getByRole('radio', { name: 'Push Pull Legs' }))
    await user.click(screen.getByRole('button', { name: 'Workout' }))
    await user.click(await screen.findByRole('button', { name: 'Start Push' }, SETTLE))
    await user.click(await screen.findByRole('button', { name: /^Barbell Bench Press - Medium Grip/ }, SETTLE))

    const weight = await screen.findByRole('button', { name: 'Weight' }, SETTLE)
    expect((weight.textContent ?? '').replace(/\s+/g, ' ').trim()).toBe('60')
    const reps = screen.getByRole('button', { name: 'Reps' })
    expect((reps.textContent ?? '').replace(/\s+/g, ' ').trim()).toBe('6')
  },
  LONG,
)

test('O13 a stored User Program is listed on the Program tab at launch', async () => {
  const user = userEvent.setup()
  await withActiveAbSplit()
  await db.settings.put({ key: USER_PROGRAMS_KEY, value: [pushPullLegsStored()], updatedAt: Date.now() })
  render(<App />)

  await openProgramTab(user)

  expect(screen.getByRole('radio', { name: 'Push Pull Legs' })).toBeInTheDocument()
}, LONG)

test('O13 a stored active User Program’s Workouts are offered on the Workout tab at launch', async () => {
  await db.settings.put({ key: USER_PROGRAMS_KEY, value: [pushPullLegsStored()], updatedAt: Date.now() })
  await db.settings.put({ key: 'activeProgramId', value: 'user-stored-ppl', updatedAt: Date.now() })
  render(<App />)

  expect(await screen.findByRole('button', { name: 'Start Push' }, SETTLE)).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Start Workout A' })).toBeNull()
}, LONG)

test('O13 a User Program pulled by a sync is listed on the Program tab without a restart', async () => {
  const user = userEvent.setup()
  await withActiveAbSplit()
  server.seedSetting('a@x', {
    key: 'userPrograms',
    value: [pushPullLegsStored()],
    updatedAt: Date.now() + 60_000,
  })
  // The pull is held until the Program tab has shown what this device had, so the test proves
  // the tab follows the sync rather than a launch read winning a race with it.
  const release = server.hold('/api/sync')
  render(<App />)

  await openProgramTab(user)
  expect(screen.queryByRole('radio', { name: 'Push Pull Legs' })).toBeNull()

  release()

  expect(await screen.findByRole('radio', { name: 'Push Pull Legs' }, SETTLE)).toBeInTheDocument()
}, LONG)

// --- O9: Copy and Edit, and a save that fails ---------------------------------------------------

test(
  'O9 Copy on A/B Split opens the editor named A/B Split (copy) holding its Workouts',
  async () => {
    const user = userEvent.setup()
    await withActiveAbSplit()
    render(<App />)

    await openProgramTab(user)
    await user.click(within(actionsRow('A/B Split')).getByRole('button', { name: 'Copy' }))

    const name = (await screen.findByLabelText('Program name', undefined, SETTLE)) as HTMLInputElement
    expect(name.value).toBe('A/B Split (copy)')
    expect(
      (screen.getAllByLabelText('Workout name') as HTMLInputElement[]).map((i) => i.value),
    ).toEqual(['Workout A', 'Workout B'])
  },
  LONG,
)

test(
  'O9 Copy on A/B Split opens the editor holding every Plan of it',
  async () => {
    const user = userEvent.setup()
    await withActiveAbSplit()
    render(<App />)

    await openProgramTab(user)
    await user.click(within(actionsRow('A/B Split')).getByRole('button', { name: 'Copy' }))
    await screen.findByLabelText('Program name', undefined, SETTLE)

    const [a, b] = editorWorkouts()
    expect(valuesOf(a, 'Sets')).toEqual(['4', '3', '4', '3', '3', '3', '3'])
    expect(valuesOf(a, 'Min reps')).toEqual(['8', '10', '8', '10', '8', '10', '10'])
    expect(valuesOf(a, 'Max reps')).toEqual(['10', '12', '10', '15', '10', '15', '12'])
    expect(valuesOf(a, 'Rest (s)')).toEqual(['180', '90', '90', '90', '90', '90', '90'])
    expect(valuesOf(b, 'Sets')).toEqual(['3', '4', '3', '4', '3', '3', '3'])
    expect(valuesOf(b, 'Min reps')).toEqual(['8', '5', '10', '8', '10', '10', '10'])
    expect(valuesOf(b, 'Max reps')).toEqual(['10', '8', '12', '10', '15', '15', '12'])
    expect(valuesOf(b, 'Rest (s)')).toEqual(['180', '90', '90', '90', '90', '90', '90'])
  },
  LONG,
)

test(
  'O9 saving a copy of A/B Split stores a new Program with a new id and every Plan of it',
  async () => {
    const user = userEvent.setup()
    await withActiveAbSplit()
    render(<App />)

    await openProgramTab(user)
    await user.click(within(actionsRow('A/B Split')).getByRole('button', { name: 'Copy' }))
    await screen.findByLabelText('Program name', undefined, SETTLE)
    await save(user)
    await editorClosed()

    await waitFor(async () => expect(await storedUserPrograms()).toHaveLength(1), SETTLE)
    const [copy] = await storedUserPrograms()
    expect(copy.id).toMatch(/^user-.+/)
    expect(copy.name).toBe('A/B Split (copy)')
    expect(copy.workouts.map((w) => w.name)).toEqual(['Workout A', 'Workout B'])
    expect(copy.workouts.map((w) => w.exercises)).toEqual(AB_SPLIT.workouts.map((w) => w.exercises))
    expect(copy.workouts.map((w) => w.id)).not.toContain('workout-a')
    expect(copy.workouts.map((w) => w.id)).not.toContain('workout-b')
  },
  LONG,
)

test(
  'O9 a saved copy is listed on the Program tab beside A/B Split, which stays unchanged',
  async () => {
    const user = userEvent.setup()
    await withActiveAbSplit()
    render(<App />)

    await openProgramTab(user)
    await user.click(within(actionsRow('A/B Split')).getByRole('button', { name: 'Copy' }))
    await screen.findByLabelText('Program name', undefined, SETTLE)
    await save(user)
    await editorClosed()
    await openProgramTab(user)

    expect(await screen.findByRole('radio', { name: 'A/B Split (copy)' }, SETTLE)).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'A/B Split' })).toBeInTheDocument()
    expect((await storedUserPrograms()).map((p) => p.id)).not.toContain('assaf-ab-2026')
    expect(within(actionsRow('A/B Split')).queryByRole('button', { name: 'Reset to original' })).toBeNull()
  },
  LONG,
)

test(
  'O9 Edit on A/B Split and Save stores a user copy under assaf-ab-2026',
  async () => {
    const user = userEvent.setup()
    await withActiveAbSplit()
    render(<App />)
    const before = Date.now()

    await openProgramTab(user)
    await user.click(within(actionsRow('A/B Split')).getByRole('button', { name: 'Edit' }))
    const name = (await screen.findByLabelText('Program name', undefined, SETTLE)) as HTMLInputElement
    expect(name.value).toBe('A/B Split')
    await save(user)
    await editorClosed()

    await waitFor(async () => expect(await storedUserPrograms()).toHaveLength(1), SETTLE)
    const [stored] = await storedUserPrograms()
    expect(stored.id).toBe('assaf-ab-2026')
    expect(stored.name).toBe('A/B Split')
    expect(stored.workouts).toEqual(AB_SPLIT.workouts)
    expect(stored.createdAt).toBeGreaterThanOrEqual(before)
  },
  LONG,
)

test(
  'O9 after Edit and Save the Program tab marks A/B Split with Reset to original',
  async () => {
    const user = userEvent.setup()
    await withActiveAbSplit()
    render(<App />)

    await openProgramTab(user)
    await user.click(within(actionsRow('A/B Split')).getByRole('button', { name: 'Edit' }))
    await screen.findByLabelText('Program name', undefined, SETTLE)
    await save(user)
    await editorClosed()
    await openProgramTab(user)

    expect(
      await within(actionsRow('A/B Split')).findByRole('button', { name: 'Reset to original' }, SETTLE),
    ).toBeVisible()
  },
  LONG,
)

test(
  'O9 saving an edit of a stored user copy keeps its createdAt',
  async () => {
    const user = userEvent.setup()
    await withActiveAbSplit()
    await db.settings.put({
      key: USER_PROGRAMS_KEY,
      value: [{ ...AB_SPLIT, createdAt: 1_234 }],
      updatedAt: Date.now(),
    })
    render(<App />)

    await openProgramTab(user)
    await user.click(within(actionsRow('A/B Split')).getByRole('button', { name: 'Edit' }))
    await screen.findByLabelText('Program name', undefined, SETTLE)
    await setField(user, document.body, 'Program name', 'A/B Split v2')
    await save(user)
    await editorClosed()

    await waitFor(async () => {
      const [stored] = await storedUserPrograms()
      expect(stored.name).toBe('A/B Split v2')
    }, SETTLE)
    const [stored] = await storedUserPrograms()
    expect(stored.id).toBe('assaf-ab-2026')
    expect(stored.createdAt).toBe(1_234)
  },
  LONG,
)

/** Makes the next write of the User Programs reject, as a full or broken store would. */
function rejectUserProgramsWrite(): void {
  const put = db.settings.put.bind(db.settings)
  vi.spyOn(db.settings, 'put').mockImplementation(((row: { key: string }, ...rest: unknown[]) =>
    row.key === USER_PROGRAMS_KEY
      ? Promise.reject(new Error('QuotaExceededError'))
      : (put as (...args: unknown[]) => unknown)(row, ...rest)) as typeof db.settings.put)
}

test(
  'O9 a save that rejects shows Couldn’t save — try again and leaves the editor open',
  async () => {
    const user = userEvent.setup()
    await withActiveAbSplit()
    render(<App />)

    await openProgramTab(user)
    await user.click(within(actionsRow('A/B Split')).getByRole('button', { name: 'Copy' }))
    await screen.findByLabelText('Program name', undefined, SETTLE)
    rejectUserProgramsWrite()
    await save(user)

    expect(await screen.findByText('Couldn’t save — try again', undefined, SETTLE)).toBeVisible()
    expect(screen.getByLabelText('Program name')).toBeInTheDocument()
  },
  LONG,
)

test(
  'O9 a save that rejects keeps the editor’s draft and stores nothing',
  async () => {
    const user = userEvent.setup()
    await withActiveAbSplit()
    render(<App />)

    await openProgramTab(user)
    await user.click(within(actionsRow('A/B Split')).getByRole('button', { name: 'Copy' }))
    const name = await screen.findByLabelText('Program name', undefined, SETTLE)
    await user.clear(name)
    await user.type(name, 'My split')
    rejectUserProgramsWrite()
    await save(user)
    await screen.findByText('Couldn’t save — try again', undefined, SETTLE)

    expect((screen.getByLabelText('Program name') as HTMLInputElement).value).toBe('My split')
    expect(
      (screen.getAllByLabelText('Workout name') as HTMLInputElement[]).map((i) => i.value),
    ).toEqual(['Workout A', 'Workout B'])
    vi.restoreAllMocks()
    expect(await storedUserPrograms()).toEqual([])
  },
  LONG,
)
