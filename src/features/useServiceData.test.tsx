import { act, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import { db } from '../storage/db'
import { createBackupService } from '../services/backup'
import { createCatalogService } from '../services/catalog'
import { createChangeBus } from '../services/changes'
import { ServiceError } from '../services/errors'
import { createPreferenceService } from '../services/preferences'
import { createProgramService } from '../services/programs'
import { createSessionService } from '../services/sessions'
import type { ChangeTopic, Services, SyncService } from '../services'
import type { Session } from '../types'
import { ServicesProvider } from './ServicesProvider'
import { useServiceData, type ServiceData } from './useServiceData'

// fake-indexeddb is installed globally in src/test/setup.ts, so the real session repository runs
// underneath. Only sync is a double: a signed-out phone, which never pulls, so no topic fires
// that the test did not cause.

const NOW = 1_700_000_000_000
const SETTLE = { timeout: 2000 }

beforeEach(async () => {
  await db.open()
  await db.sessions.clear()
  await db.settings.clear()
})

function signedOutSync(): SyncService {
  return {
    state: async () => ({ accountEmail: null, lastSyncedAt: null }),
    syncNow: async () => ({ status: 'signed-out' }),
    replaceRemote: async () => ({ status: 'signed-out' }),
    adoptAccount: async () => {},
  }
}

/** Every real service over one bus, built by hand so this test does not rest on createServices. */
function buildServices(): Services {
  const bus = createChangeBus()
  const deps = { now: () => NOW, bus, storageAvailable: true }
  const sync = signedOutSync()
  return {
    sessions: createSessionService(deps),
    programs: createProgramService(deps),
    preferences: createPreferenceService(deps),
    catalog: createCatalogService(deps),
    backup: createBackupService({ ...deps, replaceRemote: sync.replaceRemote }),
    sync,
    bus,
  }
}

/** Every state the hook has handed out, in order, so a test can read the exact error object. */
let seen: ServiceData<unknown>[] = []

function Probe<T>({
  read,
  topics,
  show,
}: {
  read: (s: Services) => Promise<T>
  topics: ChangeTopic[]
  show: (data: T) => string
}): JSX.Element {
  // A fresh array literal each render, as a screen would write it.
  const state = useServiceData(read, [...topics])
  seen.push(state as ServiceData<unknown>)
  const text =
    state.status === 'ready'
      ? `ready: ${show(state.data)}`
      : state.status === 'error'
        ? `error: ${(state.error as ServiceError).code}`
        : 'loading'
  return <p data-testid="state">{text}</p>
}

/** The session in progress, as the Workout tab reads it: its entry count. */
function entryCount(session: Session | null): string {
  return session === null ? 'no session' : `session with ${session.entries.length} entries`
}

beforeEach(() => {
  seen = []
})

test('D6 useServiceData shows loading before the read resolves', () => {
  const services = buildServices()
  const read = vi.fn(() => new Promise<Session | null>(() => {}))

  render(
    <ServicesProvider services={services}>
      <Probe read={read} topics={['sessions']} show={entryCount} />
    </ServicesProvider>,
  )

  expect(screen.getByTestId('state')).toHaveTextContent('loading')
})

test("D6 useServiceData shows ready with the read's data", async () => {
  const services = buildServices()
  await services.sessions.start('assaf-ab-2026', 'workout-a')

  render(
    <ServicesProvider services={services}>
      <Probe read={(s) => s.sessions.resumeActive()} topics={['sessions']} show={entryCount} />
    </ServicesProvider>,
  )

  await waitFor(
    () => expect(screen.getByTestId('state')).toHaveTextContent('ready: session with 0 entries'),
    SETTLE,
  )
})

test('D6 useServiceData passes the provider services to read', async () => {
  const services = buildServices()
  const read = vi.fn(async (s: Services) => (s === services ? 'same services' : 'other services'))

  render(
    <ServicesProvider services={services}>
      <Probe read={read} topics={['sessions']} show={(text) => text} />
    </ServicesProvider>,
  )

  await waitFor(
    () => expect(screen.getByTestId('state')).toHaveTextContent('ready: same services'),
    SETTLE,
  )
})

test('D6 a sessions.logSet write re-reads once and shows the new data', async () => {
  const services = buildServices()
  const session = await services.sessions.start('assaf-ab-2026', 'workout-a')
  const read = vi.fn((s: Services) => s.sessions.resumeActive())

  render(
    <ServicesProvider services={services}>
      <Probe read={read} topics={['sessions']} show={entryCount} />
    </ServicesProvider>,
  )
  await waitFor(
    () => expect(screen.getByTestId('state')).toHaveTextContent('ready: session with 0 entries'),
    SETTLE,
  )
  expect(read).toHaveBeenCalledTimes(1)

  await act(async () => {
    await services.sessions.logSet(session.id, {
      exerciseId: 'back-squat',
      setIndex: 0,
      weightKg: 60,
      reps: 10,
      loggedAt: NOW,
    })
  })

  await waitFor(
    () => expect(screen.getByTestId('state')).toHaveTextContent('ready: session with 1 entries'),
    SETTLE,
  )
  expect(read).toHaveBeenCalledTimes(2)
})

test('D6 a topic the component did not ask for does not re-read', async () => {
  const services = buildServices()
  const read = vi.fn(async () => 'loaded')

  render(
    <ServicesProvider services={services}>
      <Probe read={read} topics={['sessions']} show={(text) => text} />
    </ServicesProvider>,
  )
  await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('ready: loaded'), SETTLE)

  await act(async () => {
    services.bus.emit('programs')
    services.bus.emit('preferences')
  })

  expect(read).toHaveBeenCalledTimes(1)
})

test('D6 a rejected read shows error with the ServiceError', async () => {
  const services = buildServices()
  const failure = new ServiceError('storage-failed', 'the sessions could not be read')
  const read = vi.fn(async (): Promise<string> => {
    throw failure
  })

  render(
    <ServicesProvider services={services}>
      <Probe read={read} topics={['sessions']} show={(text) => text} />
    </ServicesProvider>,
  )

  await waitFor(
    () => expect(screen.getByTestId('state')).toHaveTextContent('error: storage-failed'),
    SETTLE,
  )
  const last = seen[seen.length - 1]
  expect(last.status).toBe('error')
  expect(last.error).toBe(failure)
  expect(last.data).toBeUndefined()
})

test('D6 unmounting unsubscribes from the topics', async () => {
  const services = buildServices()
  const read = vi.fn(async () => 'loaded')

  const { unmount } = render(
    <ServicesProvider services={services}>
      <Probe read={read} topics={['sessions']} show={(text) => text} />
    </ServicesProvider>,
  )
  await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('ready: loaded'), SETTLE)
  expect(read).toHaveBeenCalledTimes(1)

  unmount()
  services.bus.emit('sessions')

  expect(read).toHaveBeenCalledTimes(1)
})
