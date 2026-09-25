// @vitest-environment node
import { beforeAll, beforeEach, expect, test } from 'vitest'
import { createHandler } from './index'
import type { D1Database } from './d1'
import type { Env } from './env'
import { HttpError, handleReplace, handleSync, nextSeq, parseSessions, parseSettings, readJsonBody } from './sync'
import {
  MAX_BODY_BYTES,
  type ReplaceResponse,
  type SyncResponse,
  type SyncedSession,
  type SyncedSetting,
} from '../sync/protocol'
import { accessKeys, apiRequest, recordingAssets, type AccessKeys } from '../test/access'
import { createFakeD1 } from '../test/fakeD1'

const X = 'x@example.com'
const Y = 'y@example.com'

let access: AccessKeys
let worker: ReturnType<typeof createHandler>
let db: D1Database
let env: Env

beforeAll(async () => {
  access = await accessKeys()
  worker = createHandler({ keys: access.keys })
})

beforeEach(async () => {
  db = await createFakeD1()
  env = {
    DB: db,
    ASSETS: recordingAssets(new Response('asset')).assets,
    ACCESS_AUD: '4f2c9a1b7e3d4c5a8b6e0f1d2c3b4a59',
    ACCESS_TEAM_DOMAIN: 'myteam.cloudflareaccess.com',
  }
})

function session(id: string, updatedAt: number, reps = 8): SyncedSession {
  return {
    id,
    programId: 'assaf-ab',
    workoutId: 'A',
    startedAt: 1_758_800_000_000,
    finishedAt: 1_758_803_600_000,
    entries: [
      { exerciseId: 'squat', setIndex: 0, weightKg: 100, reps, loggedAt: 1_758_800_300_000 },
      { exerciseId: 'pull-up', setIndex: 0, weightKg: null, reps: 10, loggedAt: 1_758_800_600_000 },
    ],
    swaps: { 'bench-press': 'dumbbell-bench-press' },
    updatedAt,
  }
}

function setting(key: SyncedSetting['key'], value: unknown, updatedAt: number): SyncedSetting {
  return { key, value, updatedAt } as SyncedSetting
}

type Body = { since: number; sessions: SyncedSession[]; settings: SyncedSetting[] }

async function post(email: string, body: string): Promise<Response> {
  const token = await access.sign({ email })
  return worker.fetch(
    apiRequest('/api/sync', token, {
      method: 'POST',
      body,
      headers: { 'Content-Type': 'application/json' },
    }),
    env,
  )
}

async function sync(email: string, body: Partial<Body> = {}): Promise<SyncResponse> {
  const response = await post(email, JSON.stringify({ since: 0, sessions: [], settings: [], ...body }))
  expect(response.status).toBe(200)
  return (await response.json()) as SyncResponse
}

const byId = (a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id)
const byKey = (a: { key: string }, b: { key: string }) => a.key.localeCompare(b.key)

// --- O4: newer-wins storage per user, and the delta since a cursor ---

test('O4 POST /api/sync answers 200 JSON with cursor 0 and nothing for a user who has never synced', async () => {
  const response = await post(X, '{"since":0,"sessions":[],"settings":[]}')

  expect(response.status).toBe(200)
  expect(response.headers.get('content-type')).toMatch(/^application\/json/)
  expect(await response.json()).toEqual({ cursor: 0, sessions: [], settings: [] })
})

test('O4 pushed sessions and settings come back whole in the same sync with a positive cursor', async () => {
  const pushed = {
    sessions: [session('s1', 1000), session('s2', 1100, 5)],
    settings: [
      setting('activeProgramId', 'assaf-ab', 1200),
      setting('gymEquipment', { barbell: true, cables: false, plates: [20, 10, 5] }, 1300),
    ],
  }

  const answer = await sync(X, pushed)

  expect(answer.sessions.sort(byId)).toEqual([session('s1', 1000), session('s2', 1100, 5)])
  expect(answer.settings.sort(byKey)).toEqual([
    setting('activeProgramId', 'assaf-ab', 1200),
    setting('gymEquipment', { barbell: true, cables: false, plates: [20, 10, 5] }, 1300),
  ])
  expect(typeof answer.cursor).toBe('number')
  expect(answer.cursor).toBeGreaterThan(0)
})

test('O4 a pushed session with a newer updatedAt replaces the stored one', async () => {
  await sync(X, { sessions: [session('s1', 1000, 8)] })
  await sync(X, { sessions: [session('s1', 2000, 12)] })

  const answer = await sync(X, { since: 0 })

  expect(answer.sessions).toEqual([session('s1', 2000, 12)])
})

test('O4 a pushed session with an older updatedAt leaves the stored one in place', async () => {
  await sync(X, { sessions: [session('s1', 2000, 12)] })
  await sync(X, { sessions: [session('s1', 1000, 8)] })

  const answer = await sync(X, { since: 0 })

  expect(answer.sessions).toEqual([session('s1', 2000, 12)])
})

test('O4 a pushed session with the same updatedAt keeps the stored copy', async () => {
  await sync(X, { sessions: [session('s1', 1000, 8)] })
  await sync(X, { sessions: [session('s1', 1000, 12)] })

  const answer = await sync(X, { since: 0 })

  expect(answer.sessions).toEqual([session('s1', 1000, 8)])
})

test('O4 a pushed setting with a newer updatedAt replaces the stored one', async () => {
  await sync(X, { settings: [setting('activeProgramId', 'assaf-ab', 1000)] })
  await sync(X, { settings: [setting('activeProgramId', 'ppl', 2000)] })

  const answer = await sync(X, { since: 0 })

  expect(answer.settings).toEqual([setting('activeProgramId', 'ppl', 2000)])
})

test('O4 a pushed setting with an older updatedAt leaves the stored one in place', async () => {
  await sync(X, { settings: [setting('activeProgramId', 'ppl', 2000)] })
  await sync(X, { settings: [setting('activeProgramId', 'assaf-ab', 1000)] })

  const answer = await sync(X, { since: 0 })

  expect(answer.settings).toEqual([setting('activeProgramId', 'ppl', 2000)])
})

test('O4 a pushed setting with the same updatedAt keeps the stored copy', async () => {
  await sync(X, { settings: [setting('activeProgramId', 'assaf-ab', 1000)] })
  await sync(X, { settings: [setting('activeProgramId', 'ppl', 1000)] })

  const answer = await sync(X, { since: 0 })

  expect(answer.settings).toEqual([setting('activeProgramId', 'assaf-ab', 1000)])
})

test('O4 a sync passing the previous cursor as since gets nothing back when nothing changed', async () => {
  const first = await sync(X, {
    sessions: [session('s1', 1000)],
    settings: [setting('activeProgramId', 'assaf-ab', 1000)],
  })

  const second = await sync(X, { since: first.cursor })

  expect(second).toEqual({ cursor: first.cursor, sessions: [], settings: [] })
})

test('O4 a sync passing the previous cursor as since gets only the sessions and settings changed after it', async () => {
  const phone = await sync(X, {
    sessions: [session('s1', 1000)],
    settings: [setting('activeProgramId', 'assaf-ab', 1000)],
  })
  // Another device of the same user pushes after the phone's sync.
  await sync(X, {
    sessions: [session('s2', 3000)],
    settings: [setting('gymEquipment', ['barbell'], 3000)],
  })

  const answer = await sync(X, { since: phone.cursor })

  expect(answer.sessions).toEqual([session('s2', 3000)])
  expect(answer.settings).toEqual([setting('gymEquipment', ['barbell'], 3000)])
  expect(answer.cursor).toBeGreaterThan(phone.cursor)
})

test('O4 a session updated after the cursor comes back in its new version', async () => {
  const phone = await sync(X, { sessions: [session('s1', 1000, 8), session('s2', 1000)] })
  await sync(X, { sessions: [session('s1', 2000, 12)] })

  const answer = await sync(X, { since: phone.cursor })

  expect(answer.sessions).toEqual([session('s1', 2000, 12)])
})

test('O4 a stale push is not returned as a change past the cursor', async () => {
  const phone = await sync(X, { sessions: [session('s1', 2000, 12)] })

  const answer = await sync(X, { since: phone.cursor, sessions: [session('s1', 1000, 8)] })

  expect(answer.sessions).toEqual([])
})

test('O4 a sync from another device gets the rows pushed before it together with its own', async () => {
  await sync(X, { sessions: [session('s1', 1000)] })

  const answer = await sync(X, { since: 0, sessions: [session('s2', 2000)] })

  expect(answer.sessions.sort(byId)).toEqual([session('s1', 1000), session('s2', 2000)])
})

test('O4 the cursor grows with every sync that stores something', async () => {
  const first = await sync(X, { sessions: [session('s1', 1000)] })
  const second = await sync(X, { since: first.cursor, settings: [setting('activeProgramId', 'ppl', 1000)] })
  const third = await sync(X, { since: second.cursor, sessions: [session('s1', 2000)] })

  expect(second.cursor).toBeGreaterThan(first.cursor)
  expect(third.cursor).toBeGreaterThan(second.cursor)
})

test('O4 nextSeq reserves count consecutive seqs and returns the first of them', async () => {
  const first = await nextSeq(db, X, 3)
  const next = await nextSeq(db, X, 2)
  const after = await nextSeq(db, X, 1)

  expect(first).toBeGreaterThan(0)
  expect(next).toBe(first + 3)
  expect(after).toBe(next + 2)
})

test('O4 nextSeq counts each user separately', async () => {
  const xFirst = await nextSeq(db, X, 5)
  const yFirst = await nextSeq(db, Y, 1)

  expect(yFirst).toBe(xFirst)
  expect(await nextSeq(db, X, 1)).toBe(xFirst + 5)
})

// --- O5: one user never sees or overwrites another's rows ---

test('O5 a user syncing since 0 receives none of another user\'s sessions or settings', async () => {
  await sync(X, {
    sessions: [session('s1', 1000), session('s2', 1000)],
    settings: [setting('activeProgramId', 'assaf-ab', 1000), setting('gymEquipment', ['barbell'], 1000)],
  })

  const answer = await sync(Y, { since: 0 })

  expect(answer).toEqual({ cursor: 0, sessions: [], settings: [] })
})

test('O5 a session pushed by one user with an id another user also uses leaves the other\'s copy unchanged', async () => {
  await sync(X, { sessions: [session('shared-id', 1000, 8)] })

  const yAnswer = await sync(Y, { since: 0, sessions: [session('shared-id', 9000, 3)] })
  const xAnswer = await sync(X, { since: 0 })

  expect(yAnswer.sessions).toEqual([session('shared-id', 9000, 3)])
  expect(xAnswer.sessions).toEqual([session('shared-id', 1000, 8)])
})

test('O5 a session with an older updatedAt than another user\'s copy of the same id is still stored for its own user', async () => {
  await sync(X, { sessions: [session('shared-id', 9000, 8)] })

  await sync(Y, { sessions: [session('shared-id', 1000, 3)] })
  const yAnswer = await sync(Y, { since: 0 })

  expect(yAnswer.sessions).toEqual([session('shared-id', 1000, 3)])
})

test('O5 a setting pushed by one user leaves another user\'s same setting unchanged', async () => {
  await sync(X, { settings: [setting('activeProgramId', 'assaf-ab', 1000)] })

  await sync(Y, { settings: [setting('activeProgramId', 'ppl', 9000)] })
  const xAnswer = await sync(X, { since: 0 })

  expect(xAnswer.settings).toEqual([setting('activeProgramId', 'assaf-ab', 1000)])
})

test('O5 another user\'s writes do not show up as changes past a user\'s cursor', async () => {
  const x = await sync(X, { sessions: [session('s1', 1000)] })
  await sync(Y, { sessions: [session('s9', 2000)], settings: [setting('gymEquipment', [], 2000)] })

  const answer = await sync(X, { since: x.cursor })

  expect(answer).toEqual({ cursor: x.cursor, sessions: [], settings: [] })
})

// --- O6: a malformed or oversized body is refused and nothing is written ---

async function tableCounts(): Promise<Record<string, number>> {
  const counts: Record<string, number> = {}
  for (const table of ['sessions', 'settings', 'counters']) {
    const row = await db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first<{ n: number }>()
    counts[table] = row?.n ?? -1
  }
  return counts
}

const EMPTY = { sessions: 0, settings: 0, counters: 0 }

function syncRequest(body: string): Request {
  return new Request('https://workout.example.com/api/sync', {
    method: 'POST',
    body,
    headers: { 'Content-Type': 'application/json' },
  })
}

async function expectRefused(response: Response, status: number) {
  expect(response.status).toBe(status)
  expect(response.headers.get('content-type')).toMatch(/^application\/json/)
  const body = (await response.json()) as { error?: unknown }
  expect(typeof body.error).toBe('string')
  expect((body.error as string).length).toBeGreaterThan(0)
}

const valid = { since: 0, sessions: [session('s1', 1000)], settings: [setting('activeProgramId', 'assaf-ab', 1000)] }
const { updatedAt: _dropped, ...sessionWithoutUpdatedAt } = session('s1', 1000)
const { id: _droppedId, ...sessionWithoutId } = session('s1', 1000)

const badBodies: Array<[string, string]> = [
  ['a body that is not JSON', '{"since":0,"sessions":[],'],
  ['an empty body', ''],
  ['a JSON array', '[]'],
  ['JSON null', 'null'],
  ['a JSON number', '42'],
  ['a body without since', JSON.stringify({ sessions: valid.sessions, settings: valid.settings })],
  ['a string since', JSON.stringify({ ...valid, since: '0' })],
  ['a null since', JSON.stringify({ ...valid, since: null })],
  ['a body without sessions', JSON.stringify({ since: 0, settings: valid.settings })],
  ['sessions that are an object', JSON.stringify({ ...valid, sessions: { s1: session('s1', 1000) } })],
  ['a body without settings', JSON.stringify({ since: 0, sessions: valid.sessions })],
  ['settings that are an object', JSON.stringify({ ...valid, settings: { activeProgramId: 'x' } })],
  ['a session without an id', JSON.stringify({ ...valid, sessions: [sessionWithoutId] })],
  ['a session with a numeric id', JSON.stringify({ ...valid, sessions: [{ ...session('s1', 1000), id: 7 }] })],
  ['a session without updatedAt', JSON.stringify({ ...valid, sessions: [sessionWithoutUpdatedAt] })],
  ['a session with a string updatedAt', JSON.stringify({ ...valid, sessions: [{ ...session('s1', 1000), updatedAt: '1000' }] })],
  ['a session that is null', JSON.stringify({ ...valid, sessions: [null] })],
  ['a session that is a string', JSON.stringify({ ...valid, sessions: ['s1'] })],
  ['a setting keyed accountEmail', JSON.stringify({ ...valid, settings: [{ key: 'accountEmail', value: X, updatedAt: 1000 }] })],
  ['a setting keyed syncCursor', JSON.stringify({ ...valid, settings: [{ key: 'syncCursor', value: 5, updatedAt: 1000 }] })],
  ['a setting without a key', JSON.stringify({ ...valid, settings: [{ value: 'ppl', updatedAt: 1000 }] })],
  ['a setting that is null', JSON.stringify({ ...valid, settings: [null] })],
]

for (const [name, body] of badBodies) {
  test(`O6 ${name} is refused with 400 and an error, and nothing is written`, async () => {
    await expectRefused(await handleSync(syncRequest(body), env, X), 400)

    expect(await tableCounts()).toEqual(EMPTY)
  })
}

test('O6 a body with one valid and one malformed session is refused whole, storing neither', async () => {
  const body = JSON.stringify({ ...valid, sessions: [session('s1', 1000), { ...session('s2', 1000), updatedAt: 'late' }] })

  await expectRefused(await handleSync(syncRequest(body), env, X), 400)

  expect(await tableCounts()).toEqual(EMPTY)
})

test('O6 a malformed body leaves the rows already stored for the user unchanged', async () => {
  const before = await sync(X, { sessions: [session('s1', 1000, 8)] })
  const body = JSON.stringify({
    since: before.cursor,
    sessions: [session('s1', 5000, 12)],
    settings: [{ key: 'accountEmail', value: Y, updatedAt: 5000 }],
  })

  await expectRefused(await handleSync(syncRequest(body), env, X), 400)

  expect(await sync(X, { since: 0 })).toEqual({ cursor: before.cursor, sessions: [session('s1', 1000, 8)], settings: [] })
})

test('O6 a malformed body posted through the router is refused with 400', async () => {
  await expectRefused(await post(X, 'not json'), 400)

  expect(await tableCounts()).toEqual(EMPTY)
})

/** A valid sync body padded with ASCII to exactly `bytes` UTF-8 bytes. */
function bodyOfBytes(bytes: number, pad = 'a'): string {
  const shell = (padding: string) => JSON.stringify({ ...valid, sessions: [{ ...session('s1', 1000), note: padding }] })
  const overhead = new TextEncoder().encode(shell('')).length
  const padBytes = new TextEncoder().encode(pad).length
  const body = shell(pad.repeat(Math.floor((bytes - overhead) / padBytes)) + 'a'.repeat((bytes - overhead) % padBytes))
  expect(new TextEncoder().encode(body).length).toBe(bytes)
  return body
}

test('O6 a body one byte over MAX_BODY_BYTES is refused with 413 and an error, and nothing is written', async () => {
  await expectRefused(await handleSync(syncRequest(bodyOfBytes(MAX_BODY_BYTES + 1)), env, X), 413)

  expect(await tableCounts()).toEqual(EMPTY)
})

test('O6 a body over MAX_BODY_BYTES in UTF-8 bytes but not in characters is refused with 413', async () => {
  // Hebrew letters are two bytes each in UTF-8, so this body is ~1.5x MAX_BODY_BYTES in bytes
  // while its string length stays under MAX_BODY_BYTES.
  const body = bodyOfBytes(MAX_BODY_BYTES + 2 * 1024 * 1024 / 2, 'א')
  expect(body.length).toBeLessThan(MAX_BODY_BYTES)

  await expectRefused(await handleSync(syncRequest(body), env, X), 413)

  expect(await tableCounts()).toEqual(EMPTY)
})

test('O6 a valid body of exactly MAX_BODY_BYTES is accepted', async () => {
  const response = await handleSync(syncRequest(bodyOfBytes(MAX_BODY_BYTES)), env, X)

  expect(response.status).toBe(200)
})

test('O6 readJsonBody throws HttpError 413 for a body over MAX_BODY_BYTES', async () => {
  const error = await readJsonBody(syncRequest(bodyOfBytes(MAX_BODY_BYTES + 1))).catch((e: unknown) => e)

  expect(error).toBeInstanceOf(HttpError)
  expect((error as HttpError).status).toBe(413)
})

test('O6 readJsonBody throws HttpError 400 for a body that is not JSON', async () => {
  const error = await readJsonBody(syncRequest('{"since":')).catch((e: unknown) => e)

  expect(error).toBeInstanceOf(HttpError)
  expect((error as HttpError).status).toBe(400)
})

test('O6 readJsonBody returns the parsed body', async () => {
  expect(await readJsonBody(syncRequest('{"since":3,"sessions":[],"settings":[]}'))).toEqual({
    since: 3,
    sessions: [],
    settings: [],
  })
})

test('O6 parseSessions throws HttpError 400 for a session without a string id', () => {
  let error: unknown
  try {
    parseSessions([{ ...session('s1', 1000), id: 7 }])
  } catch (e) {
    error = e
  }

  expect(error).toBeInstanceOf(HttpError)
  expect((error as HttpError).status).toBe(400)
})

test('O6 parseSessions returns well-formed sessions whole', () => {
  expect(parseSessions([session('s1', 1000), session('s2', 2000, 3)])).toEqual([
    session('s1', 1000),
    session('s2', 2000, 3),
  ])
})

test('O6 parseSettings throws HttpError 400 for a key outside SYNCED_SETTING_KEYS', () => {
  let error: unknown
  try {
    parseSettings([{ key: 'accountEmail', value: X, updatedAt: 1000 }])
  } catch (e) {
    error = e
  }

  expect(error).toBeInstanceOf(HttpError)
  expect((error as HttpError).status).toBe(400)
})

test('O6 parseSettings returns settings with synced keys whole', () => {
  expect(
    parseSettings([setting('activeProgramId', 'ppl', 1000), setting('gymEquipment', { barbell: true }, 2000)]),
  ).toEqual([setting('activeProgramId', 'ppl', 1000), setting('gymEquipment', { barbell: true }, 2000)])
})

// --- O7 POST /api/replace makes the caller's stored data exactly what was posted ---

function replaceRequest(body: string): Request {
  return new Request('https://workout.example.com/api/replace', {
    method: 'POST',
    body,
    headers: { 'Content-Type': 'application/json' },
  })
}

async function storedSessions(email: string): Promise<SyncedSession[]> {
  const { results } = await db
    .prepare('SELECT doc FROM sessions WHERE user = ?1 ORDER BY id')
    .bind(email)
    .all<{ doc: string }>()
  return results.map((row) => JSON.parse(row.doc) as SyncedSession)
}

async function storedSettings(email: string): Promise<SyncedSetting[]> {
  const { results } = await db
    .prepare('SELECT key, value, updated_at FROM settings WHERE user = ?1 ORDER BY key')
    .bind(email)
    .all<{ key: SyncedSetting['key']; value: string; updated_at: number }>()
  return results.map((row) => ({ key: row.key, value: JSON.parse(row.value) as unknown, updatedAt: row.updated_at }))
}

test("O7 a replace makes the caller's stored sessions and settings exactly the posted ones, dropping what was there before", async () => {
  await sync(X, {
    sessions: [session('a', 1000), session('b', 1000)],
    settings: [setting('activeProgramId', 'assaf-ab', 1000)],
  })

  const body = JSON.stringify({
    sessions: [session('c', 2000)],
    settings: [setting('gymEquipment', ['barbell'], 2000)],
  })
  const response = await handleReplace(replaceRequest(body), env, X)

  expect(response.status).toBe(200)
  expect(await storedSessions(X)).toEqual([session('c', 2000)])
  expect(await storedSettings(X)).toEqual([setting('gymEquipment', ['barbell'], 2000)])
})

test('O7 a successful replace answers 200 with a numeric, positive cursor', async () => {
  const body = JSON.stringify({ sessions: [session('c', 2000)], settings: [] })

  const response = await handleReplace(replaceRequest(body), env, X)

  expect(response.status).toBe(200)
  const parsed = (await response.json()) as ReplaceResponse
  expect(typeof parsed.cursor).toBe('number')
  expect(parsed.cursor).toBeGreaterThan(0)
})

test("O7 a replace leaves another user's stored sessions and settings untouched", async () => {
  await sync(Y, {
    sessions: [session('y1', 1000)],
    settings: [setting('activeProgramId', 'ppl', 1000)],
  })

  const body = JSON.stringify({ sessions: [session('c', 2000)], settings: [] })
  await handleReplace(replaceRequest(body), env, X)

  expect(await storedSessions(Y)).toEqual([session('y1', 1000)])
  expect(await storedSettings(Y)).toEqual([setting('activeProgramId', 'ppl', 1000)])
})

test('O7 a later /api/sync with since 0 after a replace returns just the replaced session and settings', async () => {
  await sync(X, { sessions: [session('a', 1000), session('b', 1000)] })

  const body = JSON.stringify({
    sessions: [session('c', 2000)],
    settings: [setting('gymEquipment', ['barbell'], 2000)],
  })
  await handleReplace(replaceRequest(body), env, X)

  const answer = await sync(X, { since: 0 })

  expect(answer.sessions).toEqual([session('c', 2000)])
  expect(answer.settings).toEqual([setting('gymEquipment', ['barbell'], 2000)])
})

test('O7 a malformed replace body is refused with 400 and nothing is deleted', async () => {
  await sync(X, {
    sessions: [session('a', 1000), session('b', 1000)],
    settings: [setting('activeProgramId', 'assaf-ab', 1000)],
  })
  const body = JSON.stringify({ sessions: { c: session('c', 2000) }, settings: [] })

  const response = await handleReplace(replaceRequest(body), env, X)

  await expectRefused(response, 400)
  expect(await storedSessions(X)).toEqual([session('a', 1000), session('b', 1000)])
  expect(await storedSettings(X)).toEqual([setting('activeProgramId', 'assaf-ab', 1000)])
})

test('O7 a malformed replace body posted through the router is refused with 400', async () => {
  const token = await access.sign({ email: X })

  const response = await worker.fetch(
    apiRequest('/api/replace', token, {
      method: 'POST',
      body: 'not json',
      headers: { 'Content-Type': 'application/json' },
    }),
    env,
  )

  await expectRefused(response, 400)
})

test('O3 parseSettings accepts weightSteps and volumeBaseline and returns them whole', () => {
  expect(
    parseSettings([
      setting('weightSteps', { 'back-squat': 5 }, 3000),
      setting('volumeBaseline', { period: '3m', aggregate: 'max' }, 4000),
    ]),
  ).toEqual([
    setting('weightSteps', { 'back-squat': 5 }, 3000),
    setting('volumeBaseline', { period: '3m', aggregate: 'max' }, 4000),
  ])
})
