import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test } from 'vitest'
import { db } from '../../storage/db'
import { createServices } from '../../services'
import type { SyncedSession } from '../../sync/protocol'
import type { Session } from '../../types'
import { FakeSyncServer } from '../../test/fakeSyncServer'
import type { AppRoute } from '../routes'
import { ServicesProvider } from '../ServicesProvider'
import { HistoryFeature } from './HistoryFeature'

// fake-indexeddb is installed globally in src/test/setup.ts, so the real repositories run
// underneath `createServices`; only the network (a pulled sync) is a double, through
// `FakeSyncServer`.

const T0 = 1_700_000_000_000
const HOUR = 60 * 60 * 1_000
const NOW = T0 + 5 * HOUR
const SETTLE = { timeout: 2000 }

beforeEach(async () => {
  await db.open()
  await db.sessions.clear()
  await db.settings.clear()
})

function navigate(_to: AppRoute): void {}
function onInSession(_inSession: boolean): void {}

/** The History | Stats switch. */
function historyViewSwitch(): HTMLElement {
  return screen.getByRole('group', { name: 'History view' })
}

/** Starts, logs one set of and finishes a Workout A Session, through the real SessionService --
 * a real, bundled Program id (`assaf-ab-2026`/`workout-a`) so `HistoryList`, `Stats` and
 * `SessionSummary` all resolve it the way the app does. */
async function finishASession(services: ReturnType<typeof createServices>): Promise<void> {
  const session = await services.sessions.start('assaf-ab-2026', 'workout-a')
  await services.sessions.logSet(session.id, {
    exerciseId: 'back-squat',
    setIndex: 0,
    weightKg: 60,
    reps: 8,
    loggedAt: NOW,
  })
  await services.sessions.finish(session.id)
}

/** A `SyncedSession` the server can seed, shaped like `finishASession`'s own Session. */
function syncedSession(id: string, updatedAt: number): SyncedSession {
  return {
    id,
    programId: 'assaf-ab-2026',
    workoutId: 'workout-a',
    startedAt: T0,
    finishedAt: T0 + HOUR,
    entries: [{ exerciseId: 'back-squat', setIndex: 0, weightKg: 60, reps: 8, loggedAt: T0 + 1_000 }],
    updatedAt,
  }
}

test('O12 HistoryFeature lists a finished Session and opens its summary', async () => {
  const services = createServices({ now: () => NOW, storageAvailable: true })
  await finishASession(services)

  render(
    <ServicesProvider services={services}>
      <HistoryFeature navigate={navigate} onInSession={onInSession} />
    </ServicesProvider>,
  )

  historyViewSwitch()
  const user = userEvent.setup()
  await user.click(await screen.findByRole('button', { expanded: false }, SETTLE))
  const open = await screen.findByRole('button', { name: 'Open session' }, SETTLE)
  await user.click(open)

  await screen.findByRole('dialog', { name: 'Session summary' }, SETTLE)
})

test('O12 HistoryFeature switches to Stats through the History | Stats switch', async () => {
  const services = createServices({ now: () => NOW, storageAvailable: true })

  render(
    <ServicesProvider services={services}>
      <HistoryFeature navigate={navigate} onInSession={onInSession} />
    </ServicesProvider>,
  )

  const group = await waitFor(() => historyViewSwitch(), SETTLE)
  await userEvent.setup().click(within(group).getByRole('button', { name: 'Stats' }))

  await screen.findByRole('heading', { name: 'Stats', level: 1 }, SETTLE)
})

test('O12 a Session written through services.sessions shows in History without a reload', async () => {
  const services = createServices({ now: () => NOW, storageAvailable: true })

  render(
    <ServicesProvider services={services}>
      <HistoryFeature navigate={navigate} onInSession={onInSession} />
    </ServicesProvider>,
  )

  await screen.findByText(/No finished workouts yet/, {}, SETTLE)
  expect(screen.queryByRole('button', { name: 'Open session' })).toBeNull()

  await act(async () => {
    await finishASession(services)
  })

  await userEvent.setup().click(await screen.findByRole('button', { expanded: false }, SETTLE))
  await screen.findByRole('button', { name: 'Open session' }, SETTLE)
})

test('O12 a Session pulled by services.sync.syncNow from FakeSyncServer shows in History without a reload', async () => {
  const server = new FakeSyncServer()
  const services = createServices({ now: () => NOW, storageAvailable: true, fetch: server.fetch })

  render(
    <ServicesProvider services={services}>
      <HistoryFeature navigate={navigate} onInSession={onInSession} />
    </ServicesProvider>,
  )

  await screen.findByText(/No finished workouts yet/, {}, SETTLE)

  server.seedSession('a@x', syncedSession('pulled-1', T0 + 100))
  await act(async () => {
    await services.sync.syncNow()
  })

  await userEvent.setup().click(await screen.findByRole('button', { expanded: false }, SETTLE))
  await screen.findByRole('button', { name: 'Open session' }, SETTLE)
})

// --- E12-T6: the History editor ---------------------------------------------------------------

const MINUTE = 60 * 1_000
/** Local wall-clock times, so the `datetime-local` values below are literals in any timezone. */
const EDIT_START = new Date(2023, 10, 14, 18, 0).getTime()
const EDIT_END = new Date(2023, 10, 14, 19, 0).getTime()
/** The services' clock: days after the Session, so a save's stamp is later than its old one. */
const EDIT_NOW = new Date(2023, 10, 20, 9, 0).getTime()

/** A finished Workout A Session of three Back squat Sets: 60 x 8, 62.5 x 6, 65 x 5. */
function editableSession(): Session {
  return {
    id: 'done-1',
    programId: 'assaf-ab-2026',
    workoutId: 'workout-a',
    startedAt: EDIT_START,
    finishedAt: EDIT_END,
    entries: [
      { exerciseId: 'back-squat', setIndex: 1, weightKg: 60, reps: 8, loggedAt: EDIT_START + 10 * MINUTE },
      { exerciseId: 'back-squat', setIndex: 2, weightKg: 62.5, reps: 6, loggedAt: EDIT_START + 20 * MINUTE },
      { exerciseId: 'back-squat', setIndex: 3, weightKg: 65, reps: 5, loggedAt: EDIT_START + 30 * MINUTE },
    ],
    updatedAt: EDIT_END,
  }
}

type Editing = { services: ReturnType<typeof createServices>; writes: () => number }

/** Seeds `editableSession`, renders History over real services, and counts `'sessions'` writes. */
async function renderHistoryWithEditableSession(): Promise<Editing> {
  await db.sessions.put(editableSession())
  const services = createServices({ now: () => EDIT_NOW, storageAvailable: true })
  let writes = 0
  services.bus.subscribe('sessions', () => {
    writes += 1
  })
  render(
    <ServicesProvider services={services}>
      <HistoryFeature navigate={navigate} onInSession={onInSession} />
    </ServicesProvider>,
  )
  return { services, writes: () => writes }
}

/** Expands the only History card (E12-T9), where Edit workout and Open session live. */
async function expandTheCard(): Promise<void> {
  await userEvent.setup().click(await screen.findByRole('button', { expanded: false }, SETTLE))
}

async function openEditor(): Promise<void> {
  await expandTheCard()
  const edit = await screen.findByRole('button', { name: 'Edit workout' }, SETTLE)
  await userEvent.setup().click(edit)
  await screen.findByRole('heading', { name: 'Workout A' }, SETTLE)
}

function squatGroup(): HTMLElement {
  return screen.getByRole('group', { name: 'Back squat' })
}

test('O13 Edit workout on a History row opens the editor for that Session', async () => {
  await renderHistoryWithEditableSession()

  await openEditor()

  expect((screen.getByLabelText('Start') as HTMLInputElement).value).toBe('2023-11-14T18:00')
  expect((screen.getByLabelText('End') as HTMLInputElement).value).toBe('2023-11-14T19:00')
  expect(within(squatGroup()).getByRole('button', { name: 'Edit set 3' })).toBeVisible()
  expect(within(squatGroup()).getByRole('button', { name: 'Delete set 3' })).toBeVisible()
  expect(within(squatGroup()).getByRole('button', { name: 'Add set' })).toBeVisible()
  expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
  expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled()
})

test('O14 Save stores the edited Sets in one write, advances updatedAt and History shows the change', async () => {
  const { writes } = await renderHistoryWithEditableSession()
  await openEditor()
  const user = userEvent.setup()

  await user.click(within(squatGroup()).getByRole('button', { name: 'Delete set 2' }))
  await user.click(within(squatGroup()).getByRole('button', { name: 'Add set' }))
  await user.click(within(squatGroup()).getByRole('button', { name: 'Edit set 1' }))
  await user.click(within(screen.getByRole('group', { name: 'Weight (kg)' })).getByRole('button', { name: 'Increase weight' }))
  // Nothing reaches storage before Save: the editor works on a draft.
  expect(await db.sessions.get('done-1')).toEqual(editableSession())

  await user.click(screen.getByRole('button', { name: 'Save' }))

  await waitFor(() => expect(writes()).toBe(1), SETTLE)
  const stored = await db.sessions.get('done-1')
  expect(stored?.updatedAt).toBe(EDIT_NOW)
  expect([...(stored?.entries ?? [])].sort((one, other) => one.setIndex - other.setIndex)).toEqual([
    { exerciseId: 'back-squat', setIndex: 1, weightKg: 62.5, reps: 8, loggedAt: EDIT_START + 10 * MINUTE },
    { exerciseId: 'back-squat', setIndex: 2, weightKg: 65, reps: 5, loggedAt: EDIT_START + 30 * MINUTE },
    { exerciseId: 'back-squat', setIndex: 3, weightKg: 65, reps: 5, loggedAt: EDIT_END },
  ])
  // 62.5 x 8 + 65 x 5 + 65 x 5 = 1150 kg over 3 sets.
  await waitFor(() => {
    const row = screen.getByRole('listitem')
    expect(within(row).getByText('3 sets')).toBeVisible()
    expect(within(row).getByText('1150 kg')).toBeVisible()
  }, SETTLE)
  expect(writes()).toBe(1)
})

test('O14 Save stores changed start and end times', async () => {
  await renderHistoryWithEditableSession()
  await openEditor()

  fireEvent.change(screen.getByLabelText('Start'), { target: { value: '2023-11-14T17:45' } })
  fireEvent.change(screen.getByLabelText('End'), { target: { value: '2023-11-14T19:30' } })
  await userEvent.setup().click(screen.getByRole('button', { name: 'Save' }))

  await waitFor(async () => {
    const stored = await db.sessions.get('done-1')
    expect(stored).toEqual({
      ...editableSession(),
      startedAt: new Date(2023, 10, 14, 17, 45).getTime(),
      finishedAt: new Date(2023, 10, 14, 19, 30).getTime(),
      updatedAt: EDIT_NOW,
    })
  }, SETTLE)
})

test('O14 Cancel leaves the stored Session unchanged and returns to History', async () => {
  const { writes } = await renderHistoryWithEditableSession()
  await openEditor()
  const user = userEvent.setup()

  await user.click(within(squatGroup()).getByRole('button', { name: 'Delete set 1' }))
  await user.click(screen.getByRole('button', { name: 'Cancel' }))

  await screen.findByRole('button', { expanded: false }, SETTLE)
  expect(screen.queryByRole('heading', { name: 'Workout A' })).toBeNull()
  expect(await db.sessions.get('done-1')).toEqual(editableSession())
  expect(writes()).toBe(0)
})

test('O18 Edit on an Exercise in an expanded History card opens the editor with that Exercise\'s first Set open on the Dials', async () => {
  await db.sessions.put({
    ...editableSession(),
    entries: [
      ...editableSession().entries,
      { exerciseId: 'deadlift', setIndex: 1, weightKg: 80, reps: 5, loggedAt: EDIT_START + 40 * MINUTE },
      { exerciseId: 'deadlift', setIndex: 2, weightKg: 90, reps: 3, loggedAt: EDIT_START + 50 * MINUTE },
    ],
  })
  const services = createServices({ now: () => EDIT_NOW, storageAvailable: true })
  render(
    <ServicesProvider services={services}>
      <HistoryFeature navigate={navigate} onInSession={onInSession} />
    </ServicesProvider>,
  )
  const user = userEvent.setup()
  await expandTheCard()
  const deadlift = (await screen.findByRole('heading', { name: 'Deadlift' }, SETTLE)).closest('li') as HTMLElement
  expect(within(deadlift).getByText('80 × 5')).toBeVisible()
  expect(within(deadlift).getByText('90 × 3')).toBeVisible()

  await user.click(within(deadlift).getByRole('button', { name: 'Edit' }))

  await screen.findByRole('button', { name: 'Save' }, SETTLE)
  const editorDeadlift = screen.getByRole('group', { name: 'Deadlift' })
  expect(within(editorDeadlift).getByRole('button', { name: 'Edit set 1' })).toHaveAttribute('aria-pressed', 'true')
  expect(within(editorDeadlift).getByRole('button', { name: 'Edit set 2' })).toHaveAttribute('aria-pressed', 'false')
  expect(within(editorDeadlift).getByRole('group', { name: 'Weight (kg)' })).toBeVisible()
  expect(within(squatGroup()).queryByRole('group', { name: 'Weight (kg)' })).toBeNull()
})
