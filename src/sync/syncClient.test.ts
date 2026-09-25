import { beforeEach, expect, test } from 'vitest'
import { db, type SettingRow } from '../storage/db'
import { logSet } from '../storage/sessionStore'
import type { Session, SetEntry } from '../types'
import type {
  ReplaceRequest,
  SyncedSession,
  SyncedSetting,
  SyncRequest,
  SyncResponse,
} from './protocol'
import { adoptSignedInAccount, getSyncState, replaceRemote, syncNow } from './syncClient'

// fake-indexeddb is installed globally in src/test/setup.ts; the real Dexie `db` is used.
beforeEach(async () => {
  await db.open()
  await db.sessions.clear()
  await db.settings.clear()
})

// --- a fake Worker holding the protocol's semantics ------------------------------------------

type Failure = 'network-down' | 'opaqueredirect' | number
type RecordedRequest = { url: string; method: string; init: RequestInit | undefined; body: unknown }
type ServerAccount = {
  seq: number
  sessions: Map<string, { doc: SyncedSession; seq: number }>
  settings: Map<string, { doc: SyncedSetting; seq: number }>
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

/** What `fetch` hands back for a cross-origin redirect under `redirect: 'manual'`. */
function opaqueRedirectResponse(): Response {
  const response = new Response(null, { status: 200 })
  Object.defineProperties(response, {
    type: { value: 'opaqueredirect' },
    status: { value: 0 },
    ok: { value: false },
    statusText: { value: '' },
  })
  return response
}

class FakeSyncServer {
  /** The account Cloudflare Access has signed the browser into. */
  signedInEmail = 'a@x'
  requests: RecordedRequest[] = []
  /** path -> how that path fails. */
  failures = new Map<string, Failure>()
  /** Runs once, inside the next /api/sync, after the push is stored and before the answer. */
  duringNextSync: (() => Promise<void>) | null = null
  private accounts = new Map<string, ServerAccount>()

  private account(email: string): ServerAccount {
    let account = this.accounts.get(email)
    if (!account) {
      account = { seq: 0, sessions: new Map(), settings: new Map() }
      this.accounts.set(email, account)
    }
    return account
  }

  /** Stores `doc` only when it is newer than the stored copy; a tie keeps the stored copy. */
  private storeSession(account: ServerAccount, doc: SyncedSession): void {
    const stored = account.sessions.get(doc.id)
    if (stored && stored.doc.updatedAt >= doc.updatedAt) return
    account.seq += 1
    account.sessions.set(doc.id, { doc: structuredClone(doc), seq: account.seq })
  }

  private storeSetting(account: ServerAccount, doc: SyncedSetting): void {
    const stored = account.settings.get(doc.key)
    if (stored && stored.doc.updatedAt >= doc.updatedAt) return
    account.seq += 1
    account.settings.set(doc.key, { doc: structuredClone(doc), seq: account.seq })
  }

  seedSession(email: string, doc: SyncedSession): void {
    this.storeSession(this.account(email), doc)
  }

  seedSetting(email: string, doc: SyncedSetting): void {
    this.storeSetting(this.account(email), doc)
  }

  sessionsOf(email: string): SyncedSession[] {
    return [...this.account(email).sessions.values()]
      .map((row) => row.doc)
      .sort((one, other) => one.id.localeCompare(other.id))
  }

  settingsOf(email: string): SyncedSetting[] {
    return [...this.account(email).settings.values()]
      .map((row) => row.doc)
      .sort((one, other) => one.key.localeCompare(other.key))
  }

  syncRequests(): SyncRequest[] {
    return this.requests.filter((r) => r.url === '/api/sync').map((r) => r.body as SyncRequest)
  }

  fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url =
      typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const method = (init?.method ?? 'GET').toUpperCase()
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined
    this.requests.push({ url, method, init, body })

    const failure = this.failures.get(url)
    if (failure === 'network-down') throw new TypeError('Failed to fetch')
    if (failure === 'opaqueredirect') return opaqueRedirectResponse()
    if (typeof failure === 'number') return jsonResponse({ error: `failed with ${failure}` }, failure)

    const account = this.account(this.signedInEmail)
    if (url === '/api/me') return jsonResponse({ email: this.signedInEmail })

    if (url === '/api/sync' && method === 'POST') {
      const request = body as SyncRequest
      for (const doc of request.sessions) this.storeSession(account, doc)
      for (const doc of request.settings) this.storeSetting(account, doc)
      const hook = this.duringNextSync
      this.duringNextSync = null
      if (hook) await hook()
      const answer: SyncResponse = {
        cursor: account.seq,
        sessions: [...account.sessions.values()]
          .filter((row) => row.seq > request.since)
          .map((row) => structuredClone(row.doc)),
        settings: [...account.settings.values()]
          .filter((row) => row.seq > request.since)
          .map((row) => structuredClone(row.doc)),
      }
      return jsonResponse(answer)
    }

    if (url === '/api/replace' && method === 'POST') {
      const request = body as ReplaceRequest
      account.sessions.clear()
      account.settings.clear()
      for (const doc of request.sessions) this.storeSession(account, doc)
      for (const doc of request.settings) this.storeSetting(account, doc)
      return jsonResponse({ cursor: account.seq })
    }

    return jsonResponse({ error: 'not found' }, 404)
  }
}

// --- fixtures --------------------------------------------------------------------------------

const T0 = 1_700_000_000_000
const HOUR = 60 * 60 * 1_000

function entry(exerciseId: string, setIndex: number, weightKg: number, reps: number): SetEntry {
  return { exerciseId, setIndex, weightKg, reps, loggedAt: T0 + setIndex * 1_000 }
}

function session(id: string, updatedAt: number, entries: SetEntry[] = []): SyncedSession {
  return {
    id,
    programId: 'assaf-ab-2026',
    workoutId: 'A',
    startedAt: T0,
    finishedAt: T0 + HOUR,
    entries,
    updatedAt,
  }
}

async function putLocalSession(doc: Session): Promise<void> {
  await db.sessions.put(doc)
}

async function putLocalSetting(row: SettingRow): Promise<void> {
  await db.settings.put(row)
}

async function localSessions(): Promise<Session[]> {
  return db.sessions.orderBy('id').toArray()
}

async function localSyncedSettings(): Promise<SettingRow[]> {
  const rows = await db.settings.toArray()
  return rows
    .filter((row) => row.key === 'activeProgramId' || row.key === 'gymEquipment')
    .sort((one, other) => one.key.localeCompare(other.key))
}

/** Lets the clock move on, so a write after this is strictly later than one before it. */
function laterTick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 5))
}

let server: FakeSyncServer
beforeEach(() => {
  server = new FakeSyncServer()
})

// --- O9: push local changes, pull newer server rows, keep the cursor ------------------------

test('O9 syncNow asks /api/me first, then posts to /api/sync, both relative, same-origin and with manual redirects', async () => {
  await putLocalSession(session('s1', T0 + 100))

  await syncNow({ fetch: server.fetch })

  expect(server.requests.map((r) => [r.url, r.method])).toEqual([
    ['/api/me', 'GET'],
    ['/api/sync', 'POST'],
  ])
  for (const request of server.requests) {
    expect(request.init?.credentials).toBe('same-origin')
    expect(request.init?.redirect).toBe('manual')
  }
})

test('O9 a first sync posts every local session and synced setting with since 0', async () => {
  await putLocalSession(session('s1', T0 + 100))
  await putLocalSession(session('s2', T0 + 200))
  await putLocalSetting({ key: 'activeProgramId', value: 'assaf-ab-2026', updatedAt: T0 + 300 })

  await syncNow({ fetch: server.fetch })

  const [request] = server.syncRequests()
  expect(request.since).toBe(0)
  expect(request.sessions.map((s) => s.id).sort()).toEqual(['s1', 's2'])
  expect(request.settings).toEqual([
    { key: 'activeProgramId', value: 'assaf-ab-2026', updatedAt: T0 + 300 },
  ])
  expect(server.sessionsOf('a@x')).toEqual([session('s1', T0 + 100), session('s2', T0 + 200)])
})

test('O9 only activeProgramId and gymEquipment are ever pushed, never bookkeeping or other settings', async () => {
  await putLocalSetting({ key: 'lastExportedAt', value: T0 })
  await putLocalSetting({ key: 'gymEquipment', value: ['barbell'], updatedAt: T0 + 100 })

  await syncNow({ fetch: server.fetch })
  await laterTick()
  await putLocalSetting({ key: 'activeProgramId', value: 'assaf-ab-2026', updatedAt: Date.now() })
  await syncNow({ fetch: server.fetch })

  const pushedKeys = server.syncRequests().flatMap((r) => r.settings.map((s) => s.key))
  expect(pushedKeys.length).toBeGreaterThan(0)
  for (const key of pushedKeys) expect(['activeProgramId', 'gymEquipment']).toContain(key)
})

test('O9 the next sync passes the cursor the last one returned as since', async () => {
  await putLocalSession(session('s1', T0 + 100))
  await putLocalSession(session('s2', T0 + 200))
  // An empty server stores s1 and s2 as seq 1 and 2, so the first answer's cursor is 2.
  await syncNow({ fetch: server.fetch })

  await syncNow({ fetch: server.fetch })

  expect(server.syncRequests().map((r) => r.since)).toEqual([0, 2])
})

test('O9 the next sync pushes only the sessions changed since the last one', async () => {
  await putLocalSession(session('s1', T0 + 100))
  await putLocalSession(session('s2', T0 + 200))
  await syncNow({ fetch: server.fetch })

  await laterTick()
  await logSet('s1', entry('bench', 0, 60, 8))
  await syncNow({ fetch: server.fetch })

  const second = server.syncRequests()[1]
  expect(second.sessions.map((s) => s.id)).toEqual(['s1'])
  expect(second.sessions[0].entries).toEqual([entry('bench', 0, 60, 8)])
})

test('O9 a session another device synced is stored locally as the server holds it', async () => {
  const fromOtherPhone = session('s9', T0 + 500, [entry('squat', 0, 100, 5)])
  server.seedSession('a@x', fromOtherPhone)

  await syncNow({ fetch: server.fetch })

  expect(await localSessions()).toEqual([fromOtherPhone])
})

test('O9 a pulled session newer than the local copy replaces it, keeping the server updatedAt', async () => {
  const newer = session('s1', T0 + 200, [entry('bench', 0, 70, 6)])
  server.seedSession('a@x', newer)
  await putLocalSession(session('s1', T0 + 100, [entry('bench', 0, 60, 8)]))

  await syncNow({ fetch: server.fetch })

  expect(await localSessions()).toEqual([newer])
})

test('O9 a pulled session with the same updatedAt as the local copy leaves the local copy', async () => {
  server.seedSession('a@x', session('s1', T0 + 200, [entry('bench', 0, 70, 6)]))
  const local = session('s1', T0 + 200, [entry('bench', 0, 60, 8)])
  await putLocalSession(local)

  await syncNow({ fetch: server.fetch })

  expect(await localSessions()).toEqual([local])
})

test('O9 a pulled setting newer than the local value replaces it, keeping the server updatedAt', async () => {
  server.seedSetting('a@x', { key: 'activeProgramId', value: 'full-body-starter', updatedAt: T0 + 200 })
  await putLocalSetting({ key: 'activeProgramId', value: 'assaf-ab-2026', updatedAt: T0 + 100 })

  await syncNow({ fetch: server.fetch })

  expect(await localSyncedSettings()).toEqual([
    { key: 'activeProgramId', value: 'full-body-starter', updatedAt: T0 + 200 },
  ])
})

test('O9 a pulled setting with the same updatedAt as the local value leaves the local value', async () => {
  server.seedSetting('a@x', { key: 'gymEquipment', value: ['cable'], updatedAt: T0 + 300 })
  await putLocalSetting({ key: 'gymEquipment', value: ['barbell'], updatedAt: T0 + 300 })

  await syncNow({ fetch: server.fetch })

  expect(await localSyncedSettings()).toEqual([
    { key: 'gymEquipment', value: ['barbell'], updatedAt: T0 + 300 },
  ])
})

test('O9 a finished session without updatedAt is pushed and stamped locally with its finishedAt', async () => {
  const { updatedAt: _dropped, ...legacy } = session('old', T0 + 999)
  await putLocalSession(legacy)

  await syncNow({ fetch: server.fetch })

  const expected = { ...legacy, updatedAt: T0 + HOUR }
  expect(server.syncRequests()[0].sessions).toEqual([expected])
  expect(await localSessions()).toEqual([expected])
})

test('O9 an unfinished session without updatedAt is pushed and stamped locally with its startedAt', async () => {
  const { updatedAt: _dropped, ...legacy } = { ...session('open', T0 + 999), finishedAt: null }
  await putLocalSession(legacy)

  await syncNow({ fetch: server.fetch })

  const expected = { ...legacy, updatedAt: T0 }
  expect(server.syncRequests()[0].sessions).toEqual([expected])
  expect(await localSessions()).toEqual([expected])
})

test('O9 a set logged while a sync is in flight is not overwritten by the pulled copy', async () => {
  await putLocalSession(session('s1', T0 + 100))
  server.duringNextSync = async () => {
    await laterTick()
    await logSet('s1', entry('bench', 0, 60, 8))
  }

  await syncNow({ fetch: server.fetch })

  const [stored] = await localSessions()
  expect(stored.entries).toEqual([entry('bench', 0, 60, 8)])
})

test('O9 a set logged while a sync is in flight is pushed by the next sync', async () => {
  await putLocalSession(session('s1', T0 + 100))
  server.duringNextSync = async () => {
    await laterTick()
    await logSet('s1', entry('bench', 0, 60, 8))
  }
  await syncNow({ fetch: server.fetch })

  await syncNow({ fetch: server.fetch })

  expect(server.sessionsOf('a@x').map((s) => s.entries)).toEqual([[entry('bench', 0, 60, 8)]])
})

test('O9 a sync resolves ok at the time now() gives, and getSyncState reports it as lastSyncedAt', async () => {
  await putLocalSession(session('s1', T0 + 100))
  await putLocalSession(session('s2', T0 + 200))
  const at = T0 + 24 * HOUR

  const result = await syncNow({ fetch: server.fetch, now: () => at })

  expect(result).toMatchObject({ status: 'ok', at, pushed: 2 })
  expect((await getSyncState()).lastSyncedAt).toBe(at)
})

test('O9 a syncNow made while one is running shares it: one /api/sync request, one result', async () => {
  await putLocalSession(session('s1', T0 + 100))

  const [first, second] = await Promise.all([
    syncNow({ fetch: server.fetch }),
    syncNow({ fetch: server.fetch }),
  ])

  expect(server.syncRequests()).toHaveLength(1)
  expect(second).toEqual(first)
  expect(first.status).toBe('ok')
})

test('O9 a replaceRemote made while a sync is running returns the running sync', async () => {
  await putLocalSession(session('s1', T0 + 100))

  const [synced, replaced] = await Promise.all([
    syncNow({ fetch: server.fetch }),
    replaceRemote({ fetch: server.fetch }),
  ])

  expect(server.requests.filter((r) => r.url === '/api/replace')).toHaveLength(0)
  expect(replaced).toEqual(synced)
})

test('O9 replaceRemote leaves the server holding exactly the local sessions and synced settings', async () => {
  await syncNow({ fetch: server.fetch })
  server.seedSession('a@x', session('A', T0 + 100))
  server.seedSession('a@x', session('B', T0 + 200))
  await putLocalSession(session('C', T0 + 300))
  await putLocalSetting({ key: 'gymEquipment', value: ['barbell'], updatedAt: T0 + 400 })
  await putLocalSetting({ key: 'lastExportedAt', value: T0 })

  const result = await replaceRemote({ fetch: server.fetch })

  expect(result.status).toBe('ok')
  expect(server.sessionsOf('a@x')).toEqual([session('C', T0 + 300)])
  expect(server.settingsOf('a@x')).toEqual([
    { key: 'gymEquipment', value: ['barbell'], updatedAt: T0 + 400 },
  ])
})

test('O9 the sync after replaceRemote passes the cursor /api/replace returned as since', async () => {
  await syncNow({ fetch: server.fetch })
  await putLocalSession(session('C', T0 + 300))
  await putLocalSession(session('D', T0 + 400))
  // The replace stores C and D on a fresh count: seq 1 and 2, so its cursor is 2.
  await replaceRemote({ fetch: server.fetch })

  await syncNow({ fetch: server.fetch })

  expect(server.syncRequests().map((r) => r.since)).toEqual([0, 2])
})

// --- O10: offline, server errors and an expired sign-in -------------------------------------

async function seedLocalState(): Promise<void> {
  await putLocalSession({ ...session('s1', T0 + 100), finishedAt: null })
  await putLocalSetting({ key: 'activeProgramId', value: 'assaf-ab-2026', updatedAt: T0 + 100 })
  server.seedSession('a@x', session('s9', T0 + 500))
  server.seedSetting('a@x', { key: 'activeProgramId', value: 'full-body-starter', updatedAt: T0 + 600 })
}

test('O10 syncNow resolves offline when fetch rejects', async () => {
  server.failures.set('/api/me', 'network-down')

  expect(await syncNow({ fetch: server.fetch })).toEqual({ status: 'offline' })
})

test('O10 syncNow resolves offline when the network drops on /api/sync', async () => {
  server.failures.set('/api/sync', 'network-down')

  expect(await syncNow({ fetch: server.fetch })).toEqual({ status: 'offline' })
})

test('O10 an offline sync leaves local sessions and synced settings unchanged', async () => {
  await seedLocalState()
  const sessionsBefore = await localSessions()
  const settingsBefore = await localSyncedSettings()
  server.failures.set('/api/sync', 'network-down')

  await syncNow({ fetch: server.fetch })

  expect(await localSessions()).toEqual(sessionsBefore)
  expect(await localSyncedSettings()).toEqual(settingsBefore)
})

test('O10 a set can still be logged after an offline sync', async () => {
  await seedLocalState()
  server.failures.set('/api/me', 'network-down')
  await syncNow({ fetch: server.fetch })

  const updated = await logSet('s1', entry('bench', 0, 60, 8))

  expect(updated.entries).toEqual([entry('bench', 0, 60, 8)])
  expect((await db.sessions.get('s1'))?.entries).toEqual([entry('bench', 0, 60, 8)])
})

test('O10 a change an offline sync could not push is pushed by the next sync', async () => {
  await putLocalSession(session('s1', T0 + 100))
  await syncNow({ fetch: server.fetch })
  await laterTick()
  await logSet('s1', entry('bench', 0, 60, 8))
  server.failures.set('/api/sync', 'network-down')
  await syncNow({ fetch: server.fetch })

  server.failures.clear()
  await syncNow({ fetch: server.fetch })

  expect(server.sessionsOf('a@x').map((s) => s.entries)).toEqual([[entry('bench', 0, 60, 8)]])
})

test('O10 syncNow resolves error with a message when /api/sync answers 503', async () => {
  server.failures.set('/api/sync', 503)

  const result = await syncNow({ fetch: server.fetch })

  expect(result.status).toBe('error')
  expect(result.status === 'error' && result.message.length).toBeGreaterThan(0)
})

test('O10 syncNow resolves error with a message when /api/me answers 500', async () => {
  server.failures.set('/api/me', 500)

  const result = await syncNow({ fetch: server.fetch })

  expect(result.status).toBe('error')
  expect(result.status === 'error' && result.message.length).toBeGreaterThan(0)
  expect(server.syncRequests()).toHaveLength(0)
})

test('O10 a 5xx answer leaves local data unchanged and the next sync resends from the same cursor', async () => {
  await seedLocalState()
  await syncNow({ fetch: server.fetch })
  const sessionsBefore = await localSessions()
  const settingsBefore = await localSyncedSettings()
  const [first] = server.syncRequests()
  server.seedSession('a@x', session('s10', T0 + 700))
  server.failures.set('/api/sync', 502)

  await syncNow({ fetch: server.fetch })

  expect(await localSessions()).toEqual(sessionsBefore)
  expect(await localSyncedSettings()).toEqual(settingsBefore)
  server.failures.clear()
  await syncNow({ fetch: server.fetch })
  const sinces = server.syncRequests().map((r) => r.since)
  expect(first.since).toBe(0)
  expect(sinces[1]).toBe(sinces[2])
  expect(sinces[2]).toBeGreaterThan(0)
})

test('O10 syncNow resolves signed-out when /api/me answers 401', async () => {
  server.failures.set('/api/me', 401)

  expect(await syncNow({ fetch: server.fetch })).toEqual({ status: 'signed-out' })
})

test('O10 syncNow resolves signed-out when /api/sync answers 401', async () => {
  server.failures.set('/api/sync', 401)

  expect(await syncNow({ fetch: server.fetch })).toEqual({ status: 'signed-out' })
})

test('O10 syncNow resolves signed-out when /api/me answers an opaque redirect to the Access login', async () => {
  server.failures.set('/api/me', 'opaqueredirect')

  expect(await syncNow({ fetch: server.fetch })).toEqual({ status: 'signed-out' })
})

test('O10 syncNow resolves signed-out when /api/sync answers an opaque redirect to the Access login', async () => {
  server.failures.set('/api/sync', 'opaqueredirect')

  expect(await syncNow({ fetch: server.fetch })).toEqual({ status: 'signed-out' })
})

test('O10 a signed-out sync leaves local sessions and synced settings unchanged', async () => {
  await seedLocalState()
  const sessionsBefore = await localSessions()
  const settingsBefore = await localSyncedSettings()
  server.failures.set('/api/sync', 'opaqueredirect')

  await syncNow({ fetch: server.fetch })

  expect(await localSessions()).toEqual(sessionsBefore)
  expect(await localSyncedSettings()).toEqual(settingsBefore)
})

// --- O11: the account a device belongs to ---------------------------------------------------

/** Binds this device to a@x through a first sync, then signs the browser into b@x. */
async function deviceOfASignedInAsB(): Promise<void> {
  await putLocalSession(session('a-1', T0 + 100))
  await putLocalSetting({ key: 'gymEquipment', value: ['barbell'], updatedAt: T0 + 100 })
  await syncNow({ fetch: server.fetch })
  server.seedSession('b@x', session('b-1', T0 + 200, [entry('squat', 0, 100, 5)]))
  server.seedSetting('b@x', { key: 'activeProgramId', value: 'full-body-starter', updatedAt: T0 + 200 })
  server.signedInEmail = 'b@x'
  server.requests = []
}

test('O11 a device that has never synced has no accountEmail and no lastSyncedAt', async () => {
  expect(await getSyncState()).toEqual({ accountEmail: null, lastSyncedAt: null })
})

test('O11 a device with no account adopts the first email it sees and pushes what it holds', async () => {
  await putLocalSession(session('s1', T0 + 100))

  await syncNow({ fetch: server.fetch })

  expect((await getSyncState()).accountEmail).toBe('a@x')
  expect(server.sessionsOf('a@x')).toEqual([session('s1', T0 + 100)])
})

test('O11 a device bound to a@x signed in as b@x resolves account-mismatch naming both emails', async () => {
  await deviceOfASignedInAsB()

  expect(await syncNow({ fetch: server.fetch })).toEqual({
    status: 'account-mismatch',
    deviceEmail: 'a@x',
    signedInEmail: 'b@x',
  })
})

test('O11 an account mismatch pushes and pulls nothing', async () => {
  await deviceOfASignedInAsB()
  const sessionsBefore = await localSessions()
  const settingsBefore = await localSyncedSettings()

  await syncNow({ fetch: server.fetch })

  expect(server.requests.filter((r) => r.url !== '/api/me')).toEqual([])
  expect(server.sessionsOf('b@x').map((s) => s.id)).toEqual(['b-1'])
  expect(await localSessions()).toEqual(sessionsBefore)
  expect(await localSyncedSettings()).toEqual(settingsBefore)
})

test('O11 adoptSignedInAccount clears the local sessions and synced settings', async () => {
  await deviceOfASignedInAsB()
  await syncNow({ fetch: server.fetch })

  await adoptSignedInAccount('b@x')

  expect(await localSessions()).toEqual([])
  expect(await localSyncedSettings()).toEqual([])
})

test('O11 adoptSignedInAccount makes the adopted email the device accountEmail', async () => {
  await deviceOfASignedInAsB()
  await syncNow({ fetch: server.fetch })

  await adoptSignedInAccount('b@x')

  expect((await getSyncState()).accountEmail).toBe('b@x')
})

test('O11 the sync after adopting b@x pulls all of b@x data from since 0 and pushes none of a@x', async () => {
  await deviceOfASignedInAsB()
  await syncNow({ fetch: server.fetch })
  await adoptSignedInAccount('b@x')

  const result = await syncNow({ fetch: server.fetch })

  expect(result.status).toBe('ok')
  const [request] = server.syncRequests()
  expect(request).toEqual({ since: 0, sessions: [], settings: [] })
  expect(await localSessions()).toEqual([session('b-1', T0 + 200, [entry('squat', 0, 100, 5)])])
  expect(await localSyncedSettings()).toEqual([
    { key: 'activeProgramId', value: 'full-body-starter', updatedAt: T0 + 200 },
  ])
  expect(server.sessionsOf('b@x').map((s) => s.id)).toEqual(['b-1'])
})
