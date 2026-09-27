import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, expect, test } from 'vitest'
import { db } from '../storage/db'
import { FakeSyncServer } from '../test/fakeSyncServer'
import type { Session } from '../types'
import type { SyncedSession } from './protocol'
import { adoptSignedInAccount } from './syncClient'
import { useSync } from './useSync'

// fake-indexeddb is installed globally in src/test/setup.ts; the real Dexie `db` and the real
// syncClient run underneath the hook. Only the network is faked, through `deps.fetch`.

const T0 = 1_700_000_000_000
const HOUR = 60 * 60 * 1_000
const NOW = T0 + 5 * HOUR
const SETTLE = { timeout: 2000 }

function session(id: string, updatedAt: number): SyncedSession {
  return {
    id,
    programId: 'assaf-ab-2026',
    workoutId: 'workout-a',
    startedAt: T0,
    finishedAt: T0 + HOUR,
    entries: [
      { exerciseId: 'back-squat', setIndex: 1, weightKg: 60, reps: 10, loggedAt: T0 + 1_000 },
    ],
    updatedAt,
  }
}

async function localSessionIds(): Promise<string[]> {
  return (await db.sessions.orderBy('id').toArray()).map((s: Session) => s.id)
}

/** Resolves once the fake server has nothing in flight, after at least `atLeast` requests. */
async function serverSettled(server: FakeSyncServer, atLeast: number): Promise<void> {
  await waitFor(() => {
    expect(server.completed).toBeGreaterThanOrEqual(atLeast)
    expect(server.pending).toBe(0)
  }, SETTLE)
}

let server: FakeSyncServer
beforeEach(async () => {
  await db.open()
  await db.sessions.clear()
  await db.settings.clear()
  server = new FakeSyncServer()
})

function mount() {
  return renderHook(() => useSync({ fetch: server.fetch, now: () => NOW }))
}

// --- O13: runs by itself on start --------------------------------------------------------

test('O13 useSync runs a sync on mount without being asked, posting local sessions to /api/sync', async () => {
  await db.sessions.put(session('s1', T0 + 100))

  mount()

  await waitFor(() => {
    expect(server.sessionsOf('a@x').map((s) => s.id)).toEqual(['s1'])
  }, SETTLE)
  expect(server.requests.map((r) => r.url)).toEqual(['/api/me', '/api/sync'])
})

test('O13 after the mount sync the view shows status ok, the signed-in account and the sync time', async () => {
  const { result } = mount()

  await waitFor(() => {
    expect(result.current.sync).toEqual({
      accountEmail: 'a@x',
      lastSyncedAt: NOW,
      status: 'ok',
    })
  }, SETTLE)
})

test('O13 while a sync is in flight the view is syncing and shows the stored account and last sync time', async () => {
  await adoptSignedInAccount('a@x')
  await db.settings.put({ key: 'lastSyncedAt', value: T0 })
  const release = server.hold('/api/me')

  const { result } = mount()

  await waitFor(() => {
    expect(result.current.sync.status).toBe('syncing')
    expect(result.current.sync.accountEmail).toBe('a@x')
    expect(result.current.sync.lastSyncedAt).toBe(T0)
  }, SETTLE)
  release()
  await serverSettled(server, 2)
})

test('O13 a sync that pulled sessions brings them into the local database', async () => {
  server.seedSession('a@x', session('from-other-phone', T0 + 100))

  mount()

  await waitFor(async () => {
    expect(await localSessionIds()).toEqual(['from-other-phone'])
  }, SETTLE)
})

// --- O13: runs by itself when the browser comes back online ------------------------------

test('O13 a window online event runs another sync', async () => {
  mount()
  await serverSettled(server, 2)

  act(() => {
    window.dispatchEvent(new Event('online'))
  })

  await waitFor(() => {
    expect(server.requestsTo('/api/sync')).toHaveLength(2)
  }, SETTLE)
  await serverSettled(server, 4)
})

test('O13 an offline mount sync shows offline, and the online event then syncs to ok', async () => {
  server.failures.set('/api/me', 'network-down')
  const { result } = mount()
  await waitFor(() => {
    expect(result.current.sync.status).toBe('offline')
  }, SETTLE)

  server.failures.delete('/api/me')
  act(() => {
    window.dispatchEvent(new Event('online'))
  })

  await waitFor(() => {
    expect(result.current.sync.status).toBe('ok')
  }, SETTLE)
})

test('O13 after unmount an online event runs no sync', async () => {
  const { unmount } = mount()
  await serverSettled(server, 2)
  unmount()

  window.dispatchEvent(new Event('online'))
  await new Promise((resolve) => setTimeout(resolve, 50))

  expect(server.requests).toHaveLength(2)
})

// --- O13: each SyncResult maps onto the view ----------------------------------------------

test('O13 a signed-out answer shows status signed-out', async () => {
  server.failures.set('/api/me', 401)

  const { result } = mount()

  await waitFor(() => {
    expect(result.current.sync.status).toBe('signed-out')
  }, SETTLE)
})

test('O13 a server error shows status error with a message naming the failure', async () => {
  server.failures.set('/api/sync', 500)

  const { result } = mount()

  await waitFor(() => {
    expect(result.current.sync.status).toBe('error')
  }, SETTLE)
  expect(result.current.sync.message).toContain('500')
})

test('O13 an account mismatch shows the device account and the signed-in account', async () => {
  await adoptSignedInAccount('a@x')
  server.signedInEmail = 'b@x'

  const { result } = mount()

  await waitFor(() => {
    expect(result.current.sync.status).toBe('account-mismatch')
  }, SETTLE)
  expect(result.current.sync.accountEmail).toBe('a@x')
  expect(result.current.sync.signedInEmail).toBe('b@x')
})

// --- O13: Sync now and adopt ---------------------------------------------------------------

test('O13 syncNow runs a sync and resolves after the view shows its result', async () => {
  const { result } = mount()
  await waitFor(() => {
    expect(result.current.sync.status).toBe('ok')
  }, SETTLE)
  await db.sessions.put(session('logged-later', NOW + 100))

  await act(async () => {
    await result.current.syncNow()
  })

  expect(server.sessionsOf('a@x').map((s) => s.id)).toEqual(['logged-later'])
  expect(result.current.sync.status).toBe('ok')
})

test('O13 adoptAccount replaces local data with the signed-in account and syncs it down', async () => {
  await adoptSignedInAccount('a@x')
  await db.sessions.put(session('mine', T0 + 100))
  server.signedInEmail = 'b@x'
  server.seedSession('b@x', session('theirs', T0 + 200))
  const { result } = mount()
  await waitFor(() => {
    expect(result.current.sync.status).toBe('account-mismatch')
  }, SETTLE)

  await act(async () => {
    await result.current.adoptAccount()
  })

  expect(await localSessionIds()).toEqual(['theirs'])
  expect(result.current.sync.status).toBe('ok')
  expect(result.current.sync.accountEmail).toBe('b@x')
  // The device's own session never reached b@x's account.
  expect(server.sessionsOf('b@x').map((s) => s.id)).toEqual(['theirs'])
})

// --- O14: replaceRemote makes the server match the phone ----------------------------------

test('O14 replaceRemote sends every local session with POST /api/replace', async () => {
  await db.sessions.put(session('s1', T0 + 100))
  await db.sessions.put(session('s2', T0 + 200))
  const { result } = mount()
  await serverSettled(server, 2)

  await act(async () => {
    await result.current.replaceRemote()
  })

  const [replace] = server.requestsTo('/api/replace')
  expect(replace.method).toBe('POST')
  expect(
    (replace.body as { sessions: SyncedSession[] }).sessions.map((s) => s.id).sort(),
  ).toEqual(['s1', 's2'])
})

test('O14 after replaceRemote the next sync does not bring the replaced sessions back', async () => {
  await db.sessions.put(session('old-1', T0 + 100))
  await db.sessions.put(session('old-2', T0 + 200))
  const { result } = mount()
  await waitFor(() => {
    expect(server.sessionsOf('a@x')).toHaveLength(2)
  }, SETTLE)
  await serverSettled(server, 2)
  // What an import does to the phone: the old sessions are gone, the file's are in.
  await db.sessions.clear()
  await db.sessions.put(session('imported', NOW + 100))

  await act(async () => {
    await result.current.replaceRemote()
  })
  await act(async () => {
    await result.current.syncNow()
  })

  expect(server.sessionsOf('a@x').map((s) => s.id)).toEqual(['imported'])
  expect(await localSessionIds()).toEqual(['imported'])
})

test('O14 replaceRemote shows its result in the view', async () => {
  const { result } = mount()
  await serverSettled(server, 2)
  server.failures.set('/api/replace', 500)

  await act(async () => {
    await result.current.replaceRemote()
  })

  expect(result.current.sync.status).toBe('error')
})
