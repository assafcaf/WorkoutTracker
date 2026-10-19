// @vitest-environment node
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { CONTRACT_VERSION, VERSION_HEADER } from '../contract'
import { createHandler } from './index'
import type { Env } from './env'
import { RestAlarm } from './restAlarm'
import { subscribe } from './services/push'
import { sendDueReminders } from './services/reminders'
import { accessKeys, apiRequest, testEnv, type AccessKeys } from '../test/access'
import { createFakeD1 } from '../test/fakeD1'
import { createFakeDurableObjectNamespace, type FakeDurableObjectNamespace } from '../test/fakeDurableObject'
import { createFakePushService, type FakePushService } from '../test/fakePushService'

const EP_A = 'https://fcm.googleapis.com/fcm/send/aaa-secret-path'
const EP_B = 'https://web.push.apple.com/bbb-secret-path'
const T0 = 1_800_000_000_000
const DUE = Date.UTC(2026, 0, 14, 16, 30) // Wed 18:30 in Asia/Jerusalem

let access: AccessKeys
let worker: ReturnType<typeof createHandler>
let vapidJson: string
let privateD: string
let logSpy: ReturnType<typeof vi.spyOn>

beforeAll(async () => {
  access = await accessKeys()
  worker = createHandler({ keys: access.keys })
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
  const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey)
  privateD = jwk.d as string
  vapidJson = JSON.stringify({ kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y, d: jwk.d })
})

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(T0)
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  logSpy.mockRestore()
})

async function setup(vapid = true): Promise<{ env: Env; rest: FakeDurableObjectNamespace; svc: FakePushService }> {
  const { env: base } = testEnv()
  const env: Env = {
    ...base,
    DB: await createFakeD1(),
    ...(vapid ? { VAPID_PRIVATE_KEY: vapidJson } : {}),
    VAPID_SUBJECT: 'mailto:ops@example.com',
  }
  const rest = createFakeDurableObjectNamespace<Env>(RestAlarm, () => env)
  env.REST_ALARM = rest
  const svc = await createFakePushService()
  vi.stubGlobal('fetch', svc.fetch)
  return { env, rest, svc }
}

async function call(env: Env, method: string, path: string, email: string, body?: unknown, version = true) {
  const token = await access.sign({ email, exp: Math.floor(T0 / 1000) + 3600 })
  return worker.fetch(
    apiRequest(path, token, {
      method,
      headers: version ? { [VERSION_HEADER]: String(CONTRACT_VERSION) } : {},
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
    env,
  )
}

/** Every console.log first argument that is a JSON object line, parsed. */
function lines(): Record<string, unknown>[] {
  return logSpy.mock.calls.flatMap((args: unknown[]) => {
    try {
      const parsed = JSON.parse(String(args[0]))
      return typeof parsed === 'object' && parsed !== null ? [parsed as Record<string, unknown>] : []
    } catch {
      return []
    }
  })
}
/** The lines whose `event` field is the given name, e.g. { event: 'push.send', host, result, status, reason }. */
const named = (event: string) => lines().filter((l) => l.event === event)
const everythingLogged = () => logSpy.mock.calls.map((args: unknown[]) => args.map(String).join(' ')).join('\n')

describe('O2: POST /api/push/test', () => {
  test('O2 sends the test notification at once to every subscription and answers per device with host only', async () => {
    const { env, svc } = await setup()
    await subscribe(env.DB, 'a@x.com', { endpoint: EP_A, keys: svc.keys })
    await subscribe(env.DB, 'a@x.com', { endpoint: EP_B, keys: svc.keys })
    svc.setStatus(EP_B, 403)
    const response = await call(env, 'POST', '/api/push/test', 'a@x.com')
    expect(response.status).toBe(200)
    const answer = (await response.json()) as { subscriptions: number; results: Record<string, unknown>[] }
    expect(answer.subscriptions).toBe(2)
    const byHost = Object.fromEntries(answer.results.map((r) => [r.host as string, r]))
    expect(Object.keys(byHost).sort()).toEqual(['fcm.googleapis.com', 'web.push.apple.com'])
    expect(byHost['fcm.googleapis.com']).toMatchObject({ result: 'sent', status: 201 })
    expect(byHost['web.push.apple.com']).toMatchObject({ result: 'failed', status: 403 })
    expect(JSON.stringify(answer)).not.toContain('secret-path')
    expect(svc.requests.map((r) => r.endpoint).sort()).toEqual([EP_A, EP_B])
    const payload = JSON.parse(svc.requests[0].plaintext ?? 'null')
    expect(payload.title).toBe('Test notification')
    expect(payload.body).toBe('If you see this, push works.')
  })

  test('O2 sends at once: no alarm is set for the user', async () => {
    const { env, rest, svc } = await setup()
    await subscribe(env.DB, 'a@x.com', { endpoint: EP_A, keys: svc.keys })
    await call(env, 'POST', '/api/push/test', 'a@x.com')
    expect(svc.requests).toHaveLength(1)
    expect(rest.alarmAt('a@x.com')).toBeNull()
  })

  test("O2 reaches only the caller's own subscriptions", async () => {
    const { env, svc } = await setup()
    await subscribe(env.DB, 'a@x.com', { endpoint: EP_A, keys: svc.keys })
    await subscribe(env.DB, 'b@x.com', { endpoint: EP_B, keys: svc.keys })
    const response = await call(env, 'POST', '/api/push/test', 'a@x.com')
    expect(((await response.json()) as { subscriptions: number }).subscriptions).toBe(1)
    expect(svc.requests.map((r) => r.endpoint)).toEqual([EP_A])
  })

  test('O2 with no subscription answers 200 with zero subscriptions and no results', async () => {
    const { env, svc } = await setup()
    const response = await call(env, 'POST', '/api/push/test', 'a@x.com')
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ subscriptions: 0, results: [] })
    expect(svc.requests).toEqual([])
  })

  test('O2 with no VAPID key answers 503', async () => {
    const { env, svc } = await setup(false)
    await subscribe(env.DB, 'a@x.com', { endpoint: EP_A, keys: svc.keys })
    const response = await call(env, 'POST', '/api/push/test', 'a@x.com')
    expect(response.status).toBe(503)
    expect(svc.requests).toEqual([])
  })

  test('O2 without a contract version answers 426', async () => {
    const { env } = await setup()
    expect((await call(env, 'POST', '/api/push/test', 'a@x.com', undefined, false)).status).toBe(426)
  })

  test('O2 without Access answers 401', async () => {
    const { env } = await setup()
    const response = await worker.fetch(
      apiRequest('/api/push/test', undefined, {
        method: 'POST',
        headers: { [VERSION_HEADER]: String(CONTRACT_VERSION) },
      }),
      env,
    )
    expect(response.status).toBe(401)
  })

  test('O2 a subscription the push service reports gone is deleted', async () => {
    const { env, svc } = await setup()
    await subscribe(env.DB, 'a@x.com', { endpoint: EP_A, keys: svc.keys })
    svc.setStatus(EP_A, 410)
    expect((await call(env, 'POST', '/api/push/test', 'a@x.com')).status).toBe(200)
    const second = await call(env, 'POST', '/api/push/test', 'a@x.com')
    expect(((await second.json()) as { subscriptions: number }).subscriptions).toBe(0)
  })
})

describe('O3: Worker log lines', () => {
  test('O3 scheduling a rest push logs push.rest.schedule with the delay', async () => {
    const { env } = await setup()
    await call(env, 'POST', '/api/push/rest', 'a@x.com', { delayMs: 90_000, title: 'Rest over', body: 'Go' })
    expect(named('push.rest.schedule')).toEqual([expect.objectContaining({ delayMs: 90_000 })])
  })

  test('O3 cancelling logs push.rest.cancel', async () => {
    const { env } = await setup()
    await call(env, 'DELETE', '/api/push/rest', 'a@x.com')
    expect(named('push.rest.cancel')).toHaveLength(1)
  })

  test('O3 an alarm firing logs push.alarm.fire with the subscription count and push.send per device', async () => {
    const { env, rest, svc } = await setup()
    await subscribe(env.DB, 'a@x.com', { endpoint: EP_A, keys: svc.keys })
    await subscribe(env.DB, 'a@x.com', { endpoint: EP_B, keys: svc.keys })
    svc.setStatus(EP_B, 403)
    await call(env, 'POST', '/api/push/rest', 'a@x.com', { delayMs: 1000, title: 'Rest over', body: 'Go' })
    await rest.fireAlarm('a@x.com')
    expect(named('push.alarm.fire')).toEqual([expect.objectContaining({ subscriptions: 2 })])
    const sends = named('push.send')
    expect(sends).toHaveLength(2)
    expect(sends).toContainEqual(expect.objectContaining({ host: 'fcm.googleapis.com', result: 'sent', status: 201 }))
    expect(sends).toContainEqual(expect.objectContaining({ host: 'web.push.apple.com', result: 'failed', status: 403 }))
  })

  test('O3 an alarm firing with nothing pending logs push.alarm.empty', async () => {
    const { rest } = await setup()
    await rest.fireAlarm('a@x.com')
    expect(named('push.alarm.empty')).toHaveLength(1)
    expect(named('push.alarm.fire')).toEqual([])
  })

  test('O3 the test route logs push.send for every send', async () => {
    const { env, svc } = await setup()
    await subscribe(env.DB, 'a@x.com', { endpoint: EP_A, keys: svc.keys })
    await call(env, 'POST', '/api/push/test', 'a@x.com')
    expect(named('push.send')).toEqual([
      expect.objectContaining({ host: 'fcm.googleapis.com', result: 'sent', status: 201 }),
    ])
  })

  test('O3 the reminders run logs push.send for every send', async () => {
    const { env, svc } = await setup()
    await subscribe(env.DB, 'a@x.com', { endpoint: EP_A, keys: svc.keys })
    const value = JSON.stringify({ days: [0, 1, 2, 3, 4, 5, 6], time: '18:30', timeZone: 'Asia/Jerusalem' })
    await env.DB.prepare('INSERT INTO settings (user, key, value, updated_at, seq) VALUES (?1, ?2, ?3, 1, 1)')
      .bind('a@x.com', 'workoutReminders', value)
      .run()
    await sendDueReminders(env, DUE)
    expect(named('push.send')).toEqual([
      expect.objectContaining({ host: 'fcm.googleapis.com', result: 'sent', status: 201 }),
    ])
  })

  test('O3 no line carries a key, an endpoint path or the payload', async () => {
    const { env, rest, svc } = await setup()
    await subscribe(env.DB, 'a@x.com', { endpoint: EP_A, keys: svc.keys })
    await call(env, 'POST', '/api/push/rest', 'a@x.com', {
      delayMs: 1000,
      title: 'Rest over — Squat',
      body: 'Tap to log it.',
    })
    await rest.fireAlarm('a@x.com')
    await call(env, 'POST', '/api/push/test', 'a@x.com')
    expect(named('push.send').length).toBeGreaterThan(0)
    const text = everythingLogged()
    const secrets = ['secret-path', privateD, svc.keys.auth, svc.keys.p256dh, 'Squat', 'Tap to log it', 'Test notification']
    for (const secret of secrets) expect(text).not.toContain(secret)
  })
})
