import { beforeEach, describe, expect, test } from 'vitest'
import { db } from '../storage/db'
import type { Session } from '../types'
import { createSyncClient, type SyncResult } from './syncClient'

// E20-T4: the phone names its contract version on every request and checks the Worker's answers
// before it writes anything.

const T0 = 1_700_000_000_000

type Seen = { path: string; version: string | null; body: unknown }
type Answers = Record<string, () => Response>

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

/** A Worker that answers each path from `answers` and records what it was sent. */
function worker(answers: Answers) {
  const seen: Seen[] = []
  const fetchFake = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input)
    seen.push({
      path,
      version: new Headers(init?.headers).get('X-Contract-Version'),
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
    })
    const answer = answers[path]
    if (!answer) throw new Error(`unexpected ${path}`)
    return answer()
  }) as typeof fetch
  return { seen, fetch: fetchFake }
}

const okMe = () => json({ email: 'a@x' })
const okSync = () => json({ cursor: 7, sessions: [], settings: [] })
const okReplace = () => json({ cursor: 9 })

function aSession(id: string, updatedAt: number): Session & { updatedAt: number } {
  return {
    id,
    programId: 'assaf-ab-2026',
    workoutId: 'A',
    startedAt: T0,
    finishedAt: T0 + 3_600_000,
    entries: [{ exerciseId: 'squat', setIndex: 0, weightKg: 60, reps: 5, loggedAt: T0 + 1_000 }],
    updatedAt,
  }
}

/** A device bound to a@x that has synced before: a cursor, a watermark, a last-synced time, one session. */
async function syncedDevice(): Promise<void> {
  await db.settings.bulkPut([
    { key: 'accountEmail', value: 'a@x' },
    { key: 'syncCursor', value: 3 },
    { key: 'lastPushedAt', value: T0 + 100 },
    { key: 'lastSyncedAt', value: T0 + 50 },
    { key: 'weightSteps', value: { squat: 2.5 }, updatedAt: T0 + 10 },
  ])
  await db.sessions.put(aSession('old', T0 + 100))
}

async function snapshot() {
  return {
    sessions: await db.sessions.orderBy('id').toArray(),
    settings: (await db.settings.toArray()).sort((a, b) => a.key.localeCompare(b.key)),
  }
}

beforeEach(async () => {
  await db.open()
  await db.sessions.clear()
  await db.settings.clear()
})

describe('O12: every request carries the contract version', () => {
  test('O12 a sync sends X-Contract-Version 2 on /api/me and /api/sync', async () => {
    const w = worker({ '/api/me': okMe, '/api/sync': okSync })
    const result = await createSyncClient({ fetch: w.fetch, now: () => T0 }).syncNow()
    expect(result.status).toBe('ok')
    expect(w.seen.map((s) => [s.path, s.version])).toEqual([
      ['/api/me', '2'],
      ['/api/sync', '2'],
    ])
  })

  test('O12 a replace sends X-Contract-Version 2 on /api/me and /api/replace', async () => {
    const w = worker({ '/api/me': okMe, '/api/replace': okReplace })
    const result = await createSyncClient({ fetch: w.fetch, now: () => T0 }).replaceRemote()
    expect(result.status).toBe('ok')
    expect(w.seen.map((s) => [s.path, s.version])).toEqual([
      ['/api/me', '2'],
      ['/api/replace', '2'],
    ])
  })

  test('O12 SyncDeps.contractVersion overrides the version sent', async () => {
    const w = worker({ '/api/me': okMe, '/api/sync': okSync })
    await createSyncClient({ fetch: w.fetch, now: () => T0, contractVersion: 5 }).syncNow()
    expect(w.seen.map((s) => s.version)).toEqual(['5', '5'])
  })
})

describe('O13: a 426 resolves update-required and writes nothing', () => {
  const cases: [string, 'syncNow' | 'replaceRemote', Answers][] = [
    ['/api/me', 'syncNow', { '/api/me': () => json({ error: 'update' }, 426) }],
    ['/api/sync', 'syncNow', { '/api/me': okMe, '/api/sync': () => json({ error: 'update' }, 426) }],
    ['/api/replace', 'replaceRemote', { '/api/me': okMe, '/api/replace': () => json({ error: 'update' }, 426) }],
  ]

  for (const [path, call, answers] of cases) {
    test(`O13 a 426 from ${path} resolves update-required and changes no Session or setting`, async () => {
      await syncedDevice()
      await db.sessions.put(aSession('fresh', T0 + 500))
      const before = await snapshot()
      const w = worker(answers)
      const result: SyncResult = await createSyncClient({ fetch: w.fetch, now: () => T0 + 9_000 })[call]()
      expect(result).toEqual({ status: 'update-required' })
      expect(await snapshot()).toEqual(before)
    })
  }

  test('O13 a Set logged during an update-required sync is pushed by the next sync answering 200', async () => {
    await syncedDevice()
    const stale = worker({ '/api/me': okMe, '/api/sync': () => json({ error: 'update' }, 426) })
    const client = createSyncClient({ fetch: stale.fetch, now: () => T0 + 9_000 })
    expect((await client.syncNow()).status).toBe('update-required')

    await db.sessions.put(aSession('logged-meanwhile', T0 + 500))

    const fresh = worker({ '/api/me': okMe, '/api/sync': okSync })
    const next = await createSyncClient({ fetch: fresh.fetch, now: () => T0 + 10_000 }).syncNow()
    expect(next.status).toBe('ok')
    const pushed = fresh.seen.find((s) => s.path === '/api/sync')?.body as { sessions: { id: string }[] }
    expect(pushed.sessions.map((s) => s.id)).toEqual(['logged-meanwhile'])
  })
})

describe('O14: a malformed 200 from /api/sync resolves error and writes nothing', () => {
  const malformed: [string, unknown][] = [
    ['a cursor that is not a number', { cursor: 'x', sessions: [], settings: [] }],
    ['sessions that are not a list', { cursor: 8, sessions: 'nope', settings: [] }],
    ['a setting without a key', { cursor: 8, sessions: [], settings: [{ value: 1, updatedAt: T0 }] }],
  ]

  for (const [what, body] of malformed) {
    test(`O14 ${what} resolves error naming /api/sync and changes nothing`, async () => {
      await syncedDevice()
      await db.sessions.put(aSession('fresh', T0 + 500))
      const before = await snapshot()
      const w = worker({ '/api/me': okMe, '/api/sync': () => json(body) })
      const result = await createSyncClient({ fetch: w.fetch, now: () => T0 + 9_000 }).syncNow()
      expect(result.status).toBe('error')
      expect((result as { message: string }).message).toContain('/api/sync')
      expect(await snapshot()).toEqual(before)
    })
  }
})
