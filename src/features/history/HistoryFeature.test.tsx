import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test } from 'vitest'
import { db } from '../../storage/db'
import { createServices } from '../../services'
import type { SyncedSession } from '../../sync/protocol'
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
  const open = await screen.findByRole('button', { name: 'Open session' }, SETTLE)
  await userEvent.setup().click(open)

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

  await screen.findByRole('button', { name: 'Open session' }, SETTLE)
})
