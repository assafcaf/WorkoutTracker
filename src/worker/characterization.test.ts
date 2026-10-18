// @vitest-environment node
// Pins what the Worker answers today (status, Content-Type, JSON body) for a fixed request
// sequence, so the split into layers cannot change an answer. Uses only createHandler.
import { beforeAll, beforeEach, expect, test } from 'vitest'
import { MAX_BODY_BYTES, SYNCED_SETTING_KEYS } from '../contract'
import { createHandler } from './index'
import type { D1Database } from './d1'
import type { Env } from './env'
import { accessKeys, apiRequest, recordingAssets, type AccessKeys } from '../test/access'
import { createFakeD1 } from '../test/fakeD1'

const X = 'x@example.com'
const Y = 'y@example.com'
const JSON_TYPE = 'application/json; charset=utf-8'

let access: AccessKeys
let worker: ReturnType<typeof createHandler>
let db: D1Database
let env: Env
let assetResponse: Response

beforeAll(async () => {
  access = await accessKeys()
  worker = createHandler({ keys: access.keys })
})

beforeEach(async () => {
  db = await createFakeD1()
  assetResponse = new Response('asset-body', { status: 200, headers: { 'content-type': 'text/html' } })
  env = {
    DB: db,
    ASSETS: recordingAssets(assetResponse).assets,
    ACCESS_AUD: '4f2c9a1b7e3d4c5a8b6e0f1d2c3b4a59',
    ACCESS_TEAM_DOMAIN: 'myteam.cloudflareaccess.com',
  }
})

type Answer = { status: number; contentType: string | null; body: unknown }

async function call(
  method: string,
  path: string,
  options: { email?: string; body?: string; signedIn?: boolean } = {},
): Promise<Answer> {
  const token = options.signedIn === false ? undefined : await access.sign({ email: options.email ?? X })
  const init: RequestInit = { method }
  if (options.body !== undefined) init.body = options.body
  const response = await worker.fetch(apiRequest(path, token, init), env)
  const text = await response.text()
  return {
    status: response.status,
    contentType: response.headers.get('content-type'),
    body: text === '' ? null : (JSON.parse(text) as unknown),
  }
}

const sync = (body: unknown, email = X) => call('POST', '/api/sync', { email, body: JSON.stringify(body) })
const replace = (body: unknown, email = X) => call('POST', '/api/replace', { email, body: JSON.stringify(body) })

function session(id: string, updatedAt: number, reps = 8) {
  return {
    id,
    programId: 'assaf-ab',
    workoutId: 'A',
    startedAt: 1_758_800_000_000,
    finishedAt: 1_758_803_600_000,
    entries: [{ exerciseId: 'squat', setIndex: 0, weightKg: 100, reps, loggedAt: 1_758_800_300_000 }],
    updatedAt,
  }
}

const setting = (key: string, value: unknown, updatedAt: number) => ({ key, value, updatedAt })

const ok = (body: unknown): Answer => ({ status: 200, contentType: JSON_TYPE, body })
const refused = (status: number, error: string): Answer => ({ status, contentType: JSON_TYPE, body: { error } })

test('characterization: GET /api/me answers 200 JSON with the signed-in email', async () => {
  expect(await call('GET', '/api/me')).toEqual(ok({ email: X }))
  expect(await call('GET', '/api/me', { email: Y })).toEqual(ok({ email: Y }))
})

test('characterization: an /api request without a token answers 401 JSON unauthenticated', async () => {
  expect(await call('GET', '/api/me', { signedIn: false })).toEqual(refused(401, 'unauthenticated'))
})

test('characterization: GET /api/login answers 302 to / with no body', async () => {
  const response = await worker.fetch(apiRequest('/api/login', await access.sign()), env)

  expect(response.status).toBe(302)
  expect(response.headers.get('location')).toBe('/')
  expect(response.headers.get('content-type')).toBeNull()
  expect(await response.text()).toBe('')
})

test('characterization: an unknown route and a known path with the wrong method answer 404 JSON not found', async () => {
  expect(await call('GET', '/api/no-such-route')).toEqual(refused(404, 'not found'))
  expect(await call('DELETE', '/api/me')).toEqual(refused(404, 'not found'))
  expect(await call('GET', '/api/sync')).toEqual(refused(404, 'not found'))
  expect(await call('GET', '/api/replace')).toEqual(refused(404, 'not found'))
})

test('characterization: a path outside /api/ is the assets response, unchanged', async () => {
  const response = await worker.fetch(new Request('https://workout.example.com/history'), env)

  expect(response).toBe(assetResponse)
  expect(response.status).toBe(200)
  expect(response.headers.get('content-type')).toBe('text/html')
  expect(await response.text()).toBe('asset-body')
})

test('characterization: a first sync of a never-synced user answers cursor 0 and nothing', async () => {
  expect(await sync({ since: 0, sessions: [], settings: [] })).toEqual(ok({ cursor: 0, sessions: [], settings: [] }))
})

test('characterization: a push answers the pushed rows with the cursor counting them, and a pull by cursor answers only later rows', async () => {
  const first = await sync({
    since: 0,
    sessions: [session('s1', 1000)],
    settings: [setting('activeProgramId', 'assaf-ab', 1000)],
  })
  expect(first).toEqual(
    ok({ cursor: 2, sessions: [session('s1', 1000)], settings: [setting('activeProgramId', 'assaf-ab', 1000)] }),
  )

  expect(await sync({ since: 2, sessions: [], settings: [] })).toEqual(ok({ cursor: 2, sessions: [], settings: [] }))

  const later = await sync({ since: 2, sessions: [session('s2', 2000)], settings: [] })
  expect(later).toEqual(ok({ cursor: 3, sessions: [session('s2', 2000)], settings: [] }))

  expect(await sync({ since: 0, sessions: [], settings: [] })).toEqual(
    ok({
      cursor: 3,
      sessions: [session('s1', 1000), session('s2', 2000)],
      settings: [setting('activeProgramId', 'assaf-ab', 1000)],
    }),
  )
})

test('characterization: a stale push changes nothing and moves no cursor', async () => {
  await sync({ since: 0, sessions: [session('s1', 2000, 12)], settings: [] })

  expect(await sync({ since: 1, sessions: [session('s1', 1000, 8)], settings: [] })).toEqual(
    ok({ cursor: 1, sessions: [], settings: [] }),
  )
  expect(await sync({ since: 0, sessions: [], settings: [] })).toEqual(
    ok({ cursor: 1, sessions: [session('s1', 2000, 12)], settings: [] }),
  )
})

test('characterization: two users never see each other\'s rows', async () => {
  await sync({ since: 0, sessions: [session('shared', 1000, 8)], settings: [setting('weekStart', 1, 1000)] })

  expect(await sync({ since: 0, sessions: [], settings: [] }, Y)).toEqual(ok({ cursor: 0, sessions: [], settings: [] }))
  expect(await sync({ since: 0, sessions: [session('shared', 500, 3)], settings: [] }, Y)).toEqual(
    ok({ cursor: 1, sessions: [session('shared', 500, 3)], settings: [] }),
  )
  expect(await sync({ since: 0, sessions: [], settings: [] })).toEqual(
    ok({ cursor: 2, sessions: [session('shared', 1000, 8)], settings: [setting('weekStart', 1, 1000)] }),
  )
})

test('characterization: a replace answers the new cursor, and a sync after it answers exactly the replaced rows', async () => {
  await sync({ since: 0, sessions: [session('a', 1000), session('b', 1000)], settings: [] })

  expect(await replace({ sessions: [session('c', 2000)], settings: [setting('gymEquipment', ['barbell'], 2000)] })).toEqual(
    ok({ cursor: 4 }),
  )
  expect(await sync({ since: 0, sessions: [], settings: [] })).toEqual(
    ok({ cursor: 4, sessions: [session('c', 2000)], settings: [setting('gymEquipment', ['barbell'], 2000)] }),
  )
})

test('characterization: replacing with nothing empties the user and still moves the cursor by one', async () => {
  await sync({ since: 0, sessions: [session('a', 1000)], settings: [] })

  expect(await replace({ sessions: [], settings: [] })).toEqual(ok({ cursor: 2 }))
  expect(await sync({ since: 0, sessions: [], settings: [] })).toEqual(ok({ cursor: 2, sessions: [], settings: [] }))
})

const settingsMessage = `every setting needs a key in ${SYNCED_SETTING_KEYS.join(', ')}, a value and a numeric updatedAt`
const sessionMessage = 'every session needs a string id and a numeric updatedAt'

const malformedSync: Array<[string, string, Answer]> = [
  ['not JSON', '{"since":0,', refused(400, 'body is not valid JSON')],
  ['empty', '', refused(400, 'body is not valid JSON')],
  ['a JSON array', '[]', refused(400, 'body must be a JSON object')],
  ['JSON null', 'null', refused(400, 'body must be a JSON object')],
  ['a string since', JSON.stringify({ since: '0', sessions: [], settings: [] }), refused(400, 'since must be a number')],
  ['no sessions', JSON.stringify({ since: 0, settings: [] }), refused(400, 'sessions must be an array')],
  ['no settings', JSON.stringify({ since: 0, sessions: [] }), refused(400, 'settings must be an array')],
  [
    'a session without an id',
    JSON.stringify({ since: 0, sessions: [{ ...session('s', 1), id: undefined }], settings: [] }),
    refused(400, sessionMessage),
  ],
  [
    'a session with a string updatedAt',
    JSON.stringify({ since: 0, sessions: [{ ...session('s', 1), updatedAt: '1' }], settings: [] }),
    refused(400, sessionMessage),
  ],
  [
    'a setting outside the synced keys',
    JSON.stringify({ since: 0, sessions: [], settings: [setting('accountEmail', X, 1)] }),
    refused(400, settingsMessage),
  ],
]

for (const [name, body, expected] of malformedSync) {
  test(`characterization: /api/sync with ${name} answers ${expected.status} JSON and writes nothing`, async () => {
    expect(await call('POST', '/api/sync', { body })).toEqual(expected)
    expect(await sync({ since: 0, sessions: [], settings: [] })).toEqual(ok({ cursor: 0, sessions: [], settings: [] }))
  })
}

test('characterization: /api/replace with malformed bodies answers 400 JSON and deletes nothing', async () => {
  await sync({ since: 0, sessions: [session('a', 1000)], settings: [] })

  expect(await call('POST', '/api/replace', { body: 'nope' })).toEqual(refused(400, 'body is not valid JSON'))
  expect(await call('POST', '/api/replace', { body: '[]' })).toEqual(refused(400, 'body must be a JSON object'))
  expect(await replace({ settings: [] })).toEqual(refused(400, 'sessions must be an array'))
  expect(await replace({ sessions: [] })).toEqual(refused(400, 'settings must be an array'))
  expect(await replace({ sessions: [], settings: [setting('syncCursor', 5, 1)] })).toEqual(refused(400, settingsMessage))

  expect(await sync({ since: 0, sessions: [], settings: [] })).toEqual(
    ok({ cursor: 1, sessions: [session('a', 1000)], settings: [] }),
  )
})

test('characterization: a body over MAX_BODY_BYTES answers 413 JSON on /api/sync and /api/replace', async () => {
  const body = 'a'.repeat(MAX_BODY_BYTES + 1)
  const expected = refused(413, `body exceeds ${MAX_BODY_BYTES} bytes`)

  expect(await call('POST', '/api/sync', { body })).toEqual(expected)
  expect(await call('POST', '/api/replace', { body })).toEqual(expected)
})
