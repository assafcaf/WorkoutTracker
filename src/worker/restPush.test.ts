// @vitest-environment node
import { readFileSync } from 'node:fs'
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { createHandler } from './index'
import * as workerModule from './index'
import type { Env } from './env'
import { RestAlarm } from './restAlarm'
import { subscribe } from './services/push'
import { accessKeys, apiRequest, testEnv, type AccessKeys } from '../test/access'
import { createFakeD1 } from '../test/fakeD1'
import { createFakeDurableObjectNamespace, type FakeDurableObjectNamespace } from '../test/fakeDurableObject'
import { createFakePushService, type FakePushService } from '../test/fakePushService'

const EP_A = 'https://fcm.googleapis.com/fcm/send/aaa'
const EP_B = 'https://web.push.apple.com/bbb'
const T0 = 1_800_000_000_000

let access: AccessKeys
let worker: ReturnType<typeof createHandler>
let vapidJson: string

beforeAll(async () => {
  access = await accessKeys()
  worker = createHandler({ keys: access.keys })
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
  const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey)
  vapidJson = JSON.stringify({ kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y, d: jwk.d })
})

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(T0)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

async function setup(): Promise<{ env: Env; rest: FakeDurableObjectNamespace; svc: FakePushService }> {
  const { env: base } = testEnv()
  const env: Env = {
    ...base,
    DB: await createFakeD1(),
    VAPID_PRIVATE_KEY: vapidJson,
    VAPID_SUBJECT: 'mailto:ops@example.com',
  }
  const rest = createFakeDurableObjectNamespace<Env>(RestAlarm, () => env)
  env.REST_ALARM = rest
  const svc = await createFakePushService()
  vi.stubGlobal('fetch', svc.fetch)
  return { env, rest, svc }
}

async function call(env: Env, method: string, email: string, body?: unknown): Promise<Response> {
  // The faked clock sits at T0, so the token must outlive T0, not the real now.
  const token = await access.sign({ email, exp: Math.floor(T0 / 1000) + 3600 })
  return worker.fetch(
    apiRequest('/api/push/rest', token, { method, body: body === undefined ? undefined : JSON.stringify(body) }),
    env,
  )
}

const message = (delayMs: number, title = 'Rest over', body = 'Time for your next set') => ({ delayMs, title, body })

describe('O13: POST and DELETE /api/push/rest', () => {
  test('O13 POST stores the message and sets the alarm to the server now plus delayMs', async () => {
    const { env, rest } = await setup()
    const response = await call(env, 'POST', 'a@x.com', message(90_000))
    expect(response.status).toBe(200)
    expect(rest.alarmAt('a@x.com')).toBe(T0 + 90_000)
    expect((await rest.storedKeys('a@x.com')).length).toBeGreaterThan(0)
  })

  test('O13 a second POST moves the alarm and replaces the message, leaving one pending', async () => {
    const { env, rest, svc } = await setup()
    await subscribe(env.DB, 'a@x.com', { endpoint: EP_A, keys: svc.keys })
    await call(env, 'POST', 'a@x.com', message(90_000, 'First'))
    vi.setSystemTime(T0 + 10_000)
    const again = await call(env, 'POST', 'a@x.com', message(30_000, 'Second', 'later'))
    expect(again.status).toBe(200)
    expect(rest.alarmAt('a@x.com')).toBe(T0 + 40_000)
    await rest.fireAlarm('a@x.com')
    expect(svc.requests.map((r) => JSON.parse(r.plaintext ?? 'null').title)).toEqual(['Second'])
  })

  test('O13 each user has an alarm of their own', async () => {
    const { env, rest } = await setup()
    await call(env, 'POST', 'a@x.com', message(60_000))
    await call(env, 'POST', 'b@x.com', message(5_000))
    expect(rest.alarmAt('a@x.com')).toBe(T0 + 60_000)
    expect(rest.alarmAt('b@x.com')).toBe(T0 + 5_000)
    const removed = await call(env, 'DELETE', 'a@x.com')
    expect(removed.status).toBe(200)
    expect(rest.alarmAt('a@x.com')).toBeNull()
    expect(rest.alarmAt('b@x.com')).toBe(T0 + 5_000)
  })

  test('O13 DELETE removes the alarm and the stored message', async () => {
    const { env, rest } = await setup()
    await call(env, 'POST', 'a@x.com', message(60_000))
    const removed = await call(env, 'DELETE', 'a@x.com')
    expect(removed.status).toBe(200)
    expect(rest.alarmAt('a@x.com')).toBeNull()
    expect(await rest.storedKeys('a@x.com')).toEqual([])
  })

  test('O13 DELETE with nothing pending answers 200', async () => {
    const { env } = await setup()
    expect((await call(env, 'DELETE', 'a@x.com')).status).toBe(200)
  })

  test.each([
    ['a negative delay', message(-1)],
    ['a fractional delay', message(1.5)],
    ['a delay that is not a number', { delayMs: '60', title: 'x', body: 'y' }],
    ['an empty title', message(1000, '')],
    ['a missing body', { delayMs: 1000, title: 'x' }],
    ['not an object', 'nope'],
  ])('O13 POST with %s answers 400 and schedules nothing', async (_name, payload) => {
    const { env, rest } = await setup()
    const response = await call(env, 'POST', 'a@x.com', payload)
    expect(response.status).toBe(400)
    expect(rest.alarmAt('a@x.com')).toBeNull()
    expect(await rest.storedKeys('a@x.com')).toEqual([])
  })

  test('O13 a malformed POST leaves the earlier pending alarm in place', async () => {
    const { env, rest } = await setup()
    await call(env, 'POST', 'a@x.com', message(60_000))
    expect((await call(env, 'POST', 'a@x.com', message(-1))).status).toBe(400)
    expect(rest.alarmAt('a@x.com')).toBe(T0 + 60_000)
  })
})

describe('O14: the alarm fires', () => {
  test('O14 sends title, body, tag rest and url / with Topic rest and TTL 60 to the user subscriptions only', async () => {
    const { env, rest, svc } = await setup()
    await subscribe(env.DB, 'a@x.com', { endpoint: EP_A, keys: svc.keys })
    await subscribe(env.DB, 'b@x.com', { endpoint: EP_B, keys: svc.keys })
    await call(env, 'POST', 'a@x.com', message(60_000, 'Rest over', 'Bench press next'))
    await rest.fireAlarm('a@x.com')
    expect(svc.requests).toHaveLength(1)
    const [sent] = svc.requests
    expect(sent.endpoint).toBe(EP_A)
    expect(JSON.parse(sent.plaintext ?? 'null')).toEqual({
      title: 'Rest over',
      body: 'Bench press next',
      tag: 'rest',
      url: '/',
    })
    expect(sent.headers.topic).toBe('rest')
    expect(sent.headers.ttl).toBe('60')
  })

  test('O14 the stored message is cleared after it fires, so a second firing sends nothing', async () => {
    const { env, rest, svc } = await setup()
    await subscribe(env.DB, 'a@x.com', { endpoint: EP_A, keys: svc.keys })
    await call(env, 'POST', 'a@x.com', message(60_000))
    await rest.fireAlarm('a@x.com')
    expect(svc.requests).toHaveLength(1)
    expect(await rest.storedKeys('a@x.com')).toEqual([])
    await rest.fireAlarm('a@x.com')
    expect(svc.requests).toHaveLength(1)
  })

  test('O14 a cancelled alarm sends nothing', async () => {
    const { env, rest, svc } = await setup()
    await subscribe(env.DB, 'a@x.com', { endpoint: EP_A, keys: svc.keys })
    expect((await call(env, 'POST', 'a@x.com', message(60_000))).status).toBe(200)
    expect((await call(env, 'DELETE', 'a@x.com')).status).toBe(200)
    await rest.fireAlarm('a@x.com')
    expect(svc.requests).toEqual([])
  })

  test('O14 an alarm that fires with no stored message sends nothing', async () => {
    const { env, rest, svc } = await setup()
    await subscribe(env.DB, 'a@x.com', { endpoint: EP_A, keys: svc.keys })
    await rest.fireAlarm('a@x.com')
    expect(svc.requests).toEqual([])
    expect((await call(env, 'POST', 'a@x.com', message(60_000))).status).toBe(200)
    expect(rest.alarmAt('a@x.com')).toBe(T0 + 60_000)
  })
})

describe('O15: the Durable Object binding', () => {
  const toml = readFileSync(new URL('../../wrangler.toml', import.meta.url), 'utf-8')
  const tables = (header: string) => toml.split(/^(?=\[)/m).filter((block) => block.startsWith(`[[${header}]]`))

  test('O15 wrangler.toml binds REST_ALARM to class RestAlarm', () => {
    const bindings = tables('durable_objects.bindings')
    expect(
      bindings.some((b) => /^name\s*=\s*"REST_ALARM"/m.test(b) && /^class_name\s*=\s*"RestAlarm"/m.test(b)),
    ).toBe(true)
  })

  test('O15 wrangler.toml migrates RestAlarm as a SQLite-backed class', () => {
    const migrations = tables('migrations')
    expect(migrations.some((m) => /^new_sqlite_classes\s*=\s*\[\s*"RestAlarm"\s*\]/m.test(m))).toBe(true)
    expect(toml).not.toMatch(/^new_classes\s*=/m)
  })

  test('O15 the Worker module exports RestAlarm', () => {
    expect((workerModule as Record<string, unknown>).RestAlarm).toBe(RestAlarm)
  })
})
