// @vitest-environment node
import { beforeAll, describe, expect, test } from 'vitest'
import { VERSION_HEADER } from '../contract'
import { createHandler } from './index'
import type { D1Database } from './d1'
import type { Env } from './env'
import { pushToUser, subscribe } from './services/push'
import { accessKeys, apiRequest, testEnv, type AccessKeys } from '../test/access'
import { createFakeD1 } from '../test/fakeD1'
import { createFakePushService, type FakePushService } from '../test/fakePushService'

const EP_A = 'https://fcm.googleapis.com/fcm/send/aaa'
const EP_B = 'https://updates.push.services.mozilla.com/wpush/v2/bbb'
const EP_C = 'https://web.push.apple.com/ccc'

let access: AccessKeys
let worker: ReturnType<typeof createHandler>
let vapidJson: string
let vapidPublic: string
let svc: FakePushService

function b64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

beforeAll(async () => {
  access = await accessKeys()
  worker = createHandler({ keys: access.keys })
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
  const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey)
  vapidJson = JSON.stringify({ kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y, d: jwk.d })
  vapidPublic = b64url(new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey)))
})

async function envWithDb(vars: Partial<Env> = {}): Promise<Env> {
  const { env } = testEnv()
  return { ...env, DB: await createFakeD1(), ...vars }
}

async function call(env: Env, method: string, path: string, email: string, body?: unknown): Promise<Response> {
  const token = await access.sign({ email })
  return worker.fetch(
    apiRequest(path, token, { method, body: body === undefined ? undefined : JSON.stringify(body) }),
    env,
  )
}

type Row = { user: string; endpoint: string; p256dh: string; auth: string }

async function subscriptionRows(db: D1Database): Promise<Row[]> {
  try {
    const result = await db
      .prepare('SELECT user, endpoint, p256dh, auth FROM push_subscriptions ORDER BY user, endpoint')
      .all<Row>()
    return result.results
  } catch {
    return []
  }
}

async function tableNames(db: D1Database): Promise<string[]> {
  const result = await db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all<{ name: string }>()
  return result.results.map((r) => r.name)
}

function subscription(endpoint: string, keys = svc.keys) {
  return { endpoint, keys }
}

describe('O9: the push migration', () => {
  test('O9 the fake D1 has push_subscriptions and reminder_log next to the E20 tables', async () => {
    const names = await tableNames(await createFakeD1())
    expect(names).toEqual(expect.arrayContaining(['push_subscriptions', 'reminder_log', 'sessions', 'settings', 'counters']))
  })

  test('O9 push_subscriptions has a primary key on (user, endpoint): a duplicate pair is refused', async () => {
    const db = await createFakeD1()
    const insert = () =>
      db
        .prepare('INSERT INTO push_subscriptions (user, endpoint, p256dh, auth, created_at) VALUES (?1, ?2, ?3, ?4, ?5)')
        .bind('a@x.com', EP_A, 'p', 'a', 1)
        .run()
    await insert()
    await expect(insert()).rejects.toThrow()
  })

  test('O9 reminder_log has a primary key on (user, day): a duplicate pair is refused', async () => {
    const db = await createFakeD1()
    const insert = () => db.prepare('INSERT INTO reminder_log (user, day) VALUES (?1, ?2)').bind('a@x.com', '2026-10-18').run()
    await insert()
    await expect(insert()).rejects.toThrow()
  })
})

describe('O10: GET /api/push/key', () => {
  test('O10 answers 200 with the public key derived from VAPID_PRIVATE_KEY', async () => {
    const env = await envWithDb({ VAPID_PRIVATE_KEY: vapidJson })
    const response = await call(env, 'GET', '/api/push/key', 'a@x.com')
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ publicKey: vapidPublic })
  })

  test('O10 answers 503 push not configured when the secret is unset', async () => {
    const env = await envWithDb()
    const response = await call(env, 'GET', '/api/push/key', 'a@x.com')
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ error: 'push not configured' })
  })

  test.each(['not json', '{"kty":"EC"}', '[]'])('O10 answers 503 when the secret is invalid: %s', async (secret) => {
    const env = await envWithDb({ VAPID_PRIVATE_KEY: secret })
    const response = await call(env, 'GET', '/api/push/key', 'a@x.com')
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ error: 'push not configured' })
  })

  test('O10 answers 401 without Access', async () => {
    const env = await envWithDb({ VAPID_PRIVATE_KEY: vapidJson })
    const response = await worker.fetch(apiRequest('/api/push/key'), env)
    expect(response.status).toBe(401)
  })

  test('O10 answers 426 for an unsupported version header', async () => {
    const env = await envWithDb({ VAPID_PRIVATE_KEY: vapidJson })
    const token = await access.sign()
    const response = await worker.fetch(apiRequest('/api/push/key', token, { headers: { [VERSION_HEADER]: '3' } }), env)
    expect(response.status).toBe(426)
  })
})

describe('O11: /api/push/subscription', () => {
  beforeAll(async () => {
    svc = await createFakePushService()
  })

  test('O11 POST stores the subscription for the caller', async () => {
    const env = await envWithDb()
    const response = await call(env, 'POST', '/api/push/subscription', 'a@x.com', subscription(EP_A))
    expect(response.status).toBe(200)
    expect(await subscriptionRows(env.DB)).toEqual([
      { user: 'a@x.com', endpoint: EP_A, p256dh: svc.keys.p256dh, auth: svc.keys.auth },
    ])
  })

  test('O11 posting the same endpoint twice leaves one row', async () => {
    const env = await envWithDb()
    await call(env, 'POST', '/api/push/subscription', 'a@x.com', subscription(EP_A))
    const again = await call(env, 'POST', '/api/push/subscription', 'a@x.com', subscription(EP_A))
    expect(again.status).toBe(200)
    expect(await subscriptionRows(env.DB)).toHaveLength(1)
  })

  test('O11 an endpoint held by another user moves to the caller', async () => {
    const env = await envWithDb()
    await call(env, 'POST', '/api/push/subscription', 'a@x.com', subscription(EP_A))
    const moved = await call(env, 'POST', '/api/push/subscription', 'b@x.com', subscription(EP_A))
    expect(moved.status).toBe(200)
    expect((await subscriptionRows(env.DB)).map((r) => [r.user, r.endpoint])).toEqual([['b@x.com', EP_A]])
  })

  test('O11 DELETE removes only the caller row, leaving the same endpoint of another user and the caller other endpoints', async () => {
    const env = await envWithDb()
    await call(env, 'POST', '/api/push/subscription', 'a@x.com', subscription(EP_A))
    await call(env, 'POST', '/api/push/subscription', 'a@x.com', subscription(EP_B))
    await subscribe(env.DB, 'b@x.com', subscription(EP_C))
    const removed = await call(env, 'DELETE', '/api/push/subscription', 'a@x.com', { endpoint: EP_A })
    expect(removed.status).toBe(200)
    expect((await subscriptionRows(env.DB)).map((r) => [r.user, r.endpoint])).toEqual([
      ['a@x.com', EP_B],
      ['b@x.com', EP_C],
    ])
  })

  test('O11 DELETE of an endpoint held by another user removes nothing', async () => {
    const env = await envWithDb()
    await call(env, 'POST', '/api/push/subscription', 'b@x.com', subscription(EP_A))
    await call(env, 'DELETE', '/api/push/subscription', 'a@x.com', { endpoint: EP_A })
    expect((await subscriptionRows(env.DB)).map((r) => [r.user, r.endpoint])).toEqual([['b@x.com', EP_A]])
  })

  test.each([
    ['a non-https endpoint', () => subscription('http://fcm.googleapis.com/x')],
    ['a host that is not a push service', () => subscription('https://evil.example/x')],
    ['missing keys', () => ({ endpoint: EP_A })],
    ['an auth of the wrong length', () => ({ endpoint: EP_A, keys: { p256dh: svc.keys.p256dh, auth: 'short' } })],
    ['not an object', () => 'nope'],
  ])('O11 POST with %s answers 400 and writes nothing', async (_name, makeBody) => {
    const env = await envWithDb()
    const response = await call(env, 'POST', '/api/push/subscription', 'a@x.com', makeBody())
    expect(response.status).toBe(400)
    expect(await subscriptionRows(env.DB)).toEqual([])
  })

  test('O11 DELETE with a malformed body answers 400 and leaves the row', async () => {
    const env = await envWithDb()
    await call(env, 'POST', '/api/push/subscription', 'a@x.com', subscription(EP_A))
    const response = await call(env, 'DELETE', '/api/push/subscription', 'a@x.com', {})
    expect(response.status).toBe(400)
    expect(await subscriptionRows(env.DB)).toHaveLength(1)
  })
})

describe('O12: pushToUser', () => {
  beforeAll(async () => {
    svc = await createFakePushService()
  })

  async function setup(): Promise<{ env: Env; svc: FakePushService }> {
    svc = await createFakePushService()
    const env = await envWithDb({ VAPID_PRIVATE_KEY: vapidJson, VAPID_SUBJECT: 'mailto:ops@example.com' })
    return { env, svc }
  }

  test('O12 sends the message to exactly that user subscriptions, each decrypting to the JSON payload', async () => {
    const { env, svc } = await setup()
    await subscribe(env.DB, 'a@x.com', subscription(EP_A, svc.keys))
    await subscribe(env.DB, 'a@x.com', subscription(EP_B, svc.keys))
    await subscribe(env.DB, 'b@x.com', subscription(EP_C, svc.keys))
    await pushToUser(env, 'a@x.com', { title: 'Rest over' }, { fetch: svc.fetch })
    expect(svc.requests.map((r) => r.endpoint).sort()).toEqual([EP_A, EP_B])
    for (const request of svc.requests) {
      expect(request.method).toBe('POST')
      expect(JSON.parse(request.plaintext ?? 'null')).toEqual({ title: 'Rest over' })
    }
  })

  test('O12 an endpoint answering 410 is deleted and the others stay', async () => {
    const { env, svc } = await setup()
    await subscribe(env.DB, 'a@x.com', subscription(EP_A, svc.keys))
    await subscribe(env.DB, 'a@x.com', subscription(EP_B, svc.keys))
    svc.setStatus(EP_A, 410)
    await pushToUser(env, 'a@x.com', { title: 'x' }, { fetch: svc.fetch })
    expect((await subscriptionRows(env.DB)).map((r) => r.endpoint)).toEqual([EP_B])
  })

  test('O12 a failing endpoint does not stop the others and its row is kept', async () => {
    const { env, svc } = await setup()
    await subscribe(env.DB, 'a@x.com', subscription(EP_A, svc.keys))
    await subscribe(env.DB, 'a@x.com', subscription(EP_B, svc.keys))
    svc.setNetworkError(EP_A)
    await pushToUser(env, 'a@x.com', { title: 'x' }, { fetch: svc.fetch })
    expect(svc.requests.map((r) => r.endpoint)).toEqual([EP_B])
    expect((await subscriptionRows(env.DB)).map((r) => r.endpoint)).toEqual([EP_A, EP_B])
  })

  test('O12 with no subscriptions it makes no request', async () => {
    const { env, svc } = await setup()
    await subscribe(env.DB, 'b@x.com', subscription(EP_C, svc.keys))
    await pushToUser(env, 'a@x.com', { title: 'x' }, { fetch: svc.fetch })
    expect(svc.requests).toEqual([])
  })
})
