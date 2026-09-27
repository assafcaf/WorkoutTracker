import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeEach, expect, test } from 'vitest'
import { db } from '../storage/db'
import { allSessions, putSessions } from '../storage/sessionStore'
import { putRows, readRow } from '../storage/settingsStore'
import type { SyncedSession } from '../sync/protocol'
import { FakeSyncServer } from '../test/fakeSyncServer'
import type { Session } from '../types'
import { createChangeBus, type ChangeTopic } from './changes'
import { createSyncService, type SyncService } from './sync'

// fake-indexeddb is installed globally in src/test/setup.ts. Only the network is faked, through
// the service's `fetch`; the real storage runs underneath.

const T0 = 1_700_000_000_000
const HOUR = 60 * 60 * 1_000
/** The injected clock's reading, far from every fixture stamp. */
const NOW = T0 + 5 * HOUR

function session(id: string, updatedAt: number): SyncedSession {
  return {
    id,
    programId: 'assaf-ab-2026',
    workoutId: 'A',
    startedAt: T0,
    finishedAt: T0 + HOUR,
    entries: [{ exerciseId: 'bench', setIndex: 0, weightKg: 60, reps: 8, loggedAt: T0 + 1_000 }],
    updatedAt,
  }
}

type Harness = {
  service: SyncService
  server: FakeSyncServer
  /** How many times each topic has fired since the harness was built. */
  fired: () => Record<ChangeTopic, number>
  onSessions: (fn: () => void) => void
}

function harness(): Harness {
  const server = new FakeSyncServer()
  const bus = createChangeBus()
  const counts: Record<ChangeTopic, number> = { sessions: 0, programs: 0, preferences: 0 }
  for (const topic of ['sessions', 'programs', 'preferences'] as const) {
    bus.subscribe(topic, () => {
      counts[topic] += 1
    })
  }
  const service = createSyncService({
    now: () => NOW,
    bus,
    storageAvailable: true,
    fetch: server.fetch,
  })
  return {
    service,
    server,
    fired: () => ({ ...counts }),
    onSessions: (fn) => {
      bus.subscribe('sessions', fn)
    },
  }
}

const NOTHING_FIRED = { sessions: 0, programs: 0, preferences: 0 }

beforeEach(async () => {
  await db.open()
  await db.sessions.clear()
  await db.settings.clear()
})

/** Source text with comments removed, so a comment naming `db` is not a reference to it. */
function codeOf(repoPath: string): string {
  return readFileSync(resolve(__dirname, '../..', repoPath), 'utf-8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
}

// --- O5: the service's shape, and the engine off raw Dexie ------------------------------

test('O5 createSyncService hands out exactly state, syncNow, replaceRemote and adoptAccount', () => {
  const { service } = harness()

  expect(Object.keys(service).sort()).toEqual(['adoptAccount', 'replaceRemote', 'state', 'syncNow'])
})

test('O5 src/sync/syncClient.ts references neither the Dexie db nor dexie', () => {
  const code = codeOf('src/sync/syncClient.ts')

  expect(code).not.toMatch(/from\s+['"][^'"]*storage\/db['"]/)
  expect(code).not.toMatch(/\bdb\s*\./)
  expect(code).not.toMatch(/dexie/i)
})

test('O5 src/sync/syncClient.ts writes through inTransaction from the storage layer', () => {
  const code = codeOf('src/sync/syncClient.ts')

  expect(code).toMatch(/import\s*\{[^}]*\binTransaction\b[^}]*\}\s*from\s*['"]\.\.\/storage\/transaction['"]/)
})

test('O5 syncNow through the service pushes local Sessions and stores the server ones', async () => {
  const { service, server } = harness()
  await putSessions([session('mine', T0 + 100)])
  server.seedSession('a@x', session('theirs', T0 + 200))

  const result = await service.syncNow()

  expect(result).toEqual({ status: 'ok', at: NOW, pushed: 1, pulled: 1 })
  expect(server.sessionsOf('a@x').map((s) => s.id)).toEqual(['mine', 'theirs'])
  expect((await allSessions()).map((s: Session) => s.id).sort()).toEqual(['mine', 'theirs'])
})

test('O5 state reports no account and no sync time before the first sync', async () => {
  const { service } = harness()

  expect(await service.state()).toEqual({ accountEmail: null, lastSyncedAt: null })
})

test('O5 state reports the adopted account and the injected clock time after a sync', async () => {
  const { service } = harness()

  await service.syncNow()

  expect(await service.state()).toEqual({ accountEmail: 'a@x', lastSyncedAt: NOW })
})

test('O5 adoptAccount clears local Sessions and synced settings and binds the device to the email', async () => {
  const { service } = harness()
  await putSessions([session('old', T0 + 100)])
  await putRows([{ key: 'gymEquipment', value: ['barbell'], updatedAt: T0 + 100 }])
  await service.syncNow()

  await service.adoptAccount('b@x')

  expect(await allSessions()).toEqual([])
  expect(await readRow('gymEquipment')).toBeUndefined()
  expect(await service.state()).toEqual({ accountEmail: 'b@x', lastSyncedAt: null })
})

test('O5 replaceRemote through the service leaves the server holding exactly the local Sessions', async () => {
  const { service, server } = harness()
  server.seedSession('a@x', session('only-on-server', T0 + 100))
  await putSessions([session('local', T0 + 200)])

  const result = await service.replaceRemote()

  expect(result).toEqual({ status: 'ok', at: NOW, pushed: 1, pulled: 0 })
  expect(server.sessionsOf('a@x').map((s) => s.id)).toEqual(['local'])
})

test('O5 syncNow through the service resolves offline when the network is down', async () => {
  const { service, server } = harness()
  server.failures.set('/api/me', 'network-down')

  expect(await service.syncNow()).toEqual({ status: 'offline' })
})

// --- O8: a pull that brings rows tells each touched topic ------------------------------

test('O8 a syncNow that pulls one Session fires sessions once and no other topic', async () => {
  const { service, server, fired } = harness()
  server.seedSession('a@x', session('s1', T0 + 100))

  await service.syncNow()

  expect(fired()).toEqual({ sessions: 1, programs: 0, preferences: 0 })
})

test('O8 a syncNow that pulls several Sessions fires sessions once', async () => {
  const { service, server, fired } = harness()
  server.seedSession('a@x', session('s1', T0 + 100))
  server.seedSession('a@x', session('s2', T0 + 200))
  server.seedSession('a@x', session('s3', T0 + 300))

  await service.syncNow()

  expect(fired().sessions).toBe(1)
})

test('O8 a sessions subscriber reading on the signal already sees the pulled Session', async () => {
  const { service, server, onSessions } = harness()
  server.seedSession('a@x', session('s1', T0 + 100))
  let read: Promise<Session[]> | null = null
  onSessions(() => {
    read = allSessions()
  })

  await service.syncNow()

  expect(read).not.toBeNull()
  expect((await read!).map((s) => s.id)).toEqual(['s1'])
})

test('O8 a syncNow that pulls a preferences setting fires preferences once and no other topic', async () => {
  const { service, server, fired } = harness()
  server.seedSetting('a@x', { key: 'gymEquipment', value: ['barbell'], updatedAt: T0 + 100 })

  await service.syncNow()

  expect(fired()).toEqual({ sessions: 0, programs: 0, preferences: 1 })
})

test('O8 a syncNow that pulls a programs setting fires programs once and no other topic', async () => {
  const { service, server, fired } = harness()
  server.seedSetting('a@x', { key: 'userPrograms', value: [], updatedAt: T0 + 100 })

  await service.syncNow()

  expect(fired()).toEqual({ sessions: 0, programs: 1, preferences: 0 })
})

test('O8 a syncNow that pulls two settings of one topic fires that topic once', async () => {
  const { service, server, fired } = harness()
  server.seedSetting('a@x', { key: 'activeProgramId', value: 'assaf-ab-2026', updatedAt: T0 + 100 })
  server.seedSetting('a@x', { key: 'userPrograms', value: [], updatedAt: T0 + 200 })

  await service.syncNow()

  expect(fired()).toEqual({ sessions: 0, programs: 1, preferences: 0 })
})

test('O8 a syncNow that pulls a Session and settings of both topics fires each topic once', async () => {
  const { service, server, fired } = harness()
  server.seedSession('a@x', session('s1', T0 + 100))
  server.seedSetting('a@x', { key: 'userPrograms', value: [], updatedAt: T0 + 200 })
  server.seedSetting('a@x', { key: 'weightSteps', value: { bench: 2.5 }, updatedAt: T0 + 300 })

  await service.syncNow()

  expect(fired()).toEqual({ sessions: 1, programs: 1, preferences: 1 })
})

test('O8 a syncNow against an empty server with nothing local fires nothing', async () => {
  const { service, fired } = harness()

  await service.syncNow()

  expect(fired()).toEqual(NOTHING_FIRED)
})

test('O8 a syncNow whose answer only echoes the pushed rows fires nothing', async () => {
  const { service, server, fired } = harness()
  await putSessions([session('mine', T0 + 100)])
  await putRows([{ key: 'gymEquipment', value: ['barbell'], updatedAt: T0 + 100 }])

  const result = await service.syncNow()

  expect(server.sessionsOf('a@x').map((s) => s.id)).toEqual(['mine'])
  expect(result).toMatchObject({ status: 'ok', pulled: 0 })
  expect(fired()).toEqual(NOTHING_FIRED)
})

test('O8 a pulled Session older than the local copy is not stored and fires nothing', async () => {
  const { service, server, fired } = harness()
  server.seedSession('a@x', session('s1', T0 + 100))
  await putSessions([session('s1', T0 + 200)])

  await service.syncNow()

  expect(fired()).toEqual(NOTHING_FIRED)
})

test('O8 an offline syncNow fires nothing', async () => {
  const { service, server, fired } = harness()
  server.seedSession('a@x', session('s1', T0 + 100))
  server.failures.set('/api/sync', 'network-down')

  await service.syncNow()

  expect(fired()).toEqual(NOTHING_FIRED)
})
