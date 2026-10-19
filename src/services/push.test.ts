import { beforeEach, describe, expect, test, vi } from 'vitest'
import { db } from '../storage/db'
import { createChangeBus } from './changes'
import { ServiceError } from './errors'
import { createPushService, type PushEnv, type PushSubscriptionLike } from './push'

const NOW = 1_700_000_000_000
const KEY_B64URL = 'BAEC' // bytes 04 01 02
const SUB_JSON = { endpoint: 'https://web.push.apple.com/abc', keys: { p256dh: 'p', auth: 'a' } }

beforeEach(async () => {
  await db.open()
  await db.settings.clear()
})

function sub(): PushSubscriptionLike & { unsubscribe: ReturnType<typeof vi.fn> } {
  return { endpoint: SUB_JSON.endpoint, toJSON: () => SUB_JSON, unsubscribe: vi.fn(async () => true) }
}

type Env = PushEnv & { subscribed: PushSubscriptionLike | null; subscribe: ReturnType<typeof vi.fn> }

function makeEnv(
  over: Partial<{ permission: NotificationPermission; subscribed: PushSubscriptionLike | null; standalone: boolean }> = {},
): Env {
  const state = { subscribed: over.subscribed ?? null }
  const notification = {
    permission: over.permission ?? ('default' as NotificationPermission),
    requestPermission: vi.fn(async () => notification.permission),
  }
  const subscribe = vi.fn(async () => {
    const created = sub()
    // a subscription the fake browser keeps, whose unsubscribe clears it
    created.unsubscribe = vi.fn(async () => {
      state.subscribed = null
      return true
    })
    state.subscribed = created
    return created
  })
  const env = {
    hasPushManager: true,
    standalone: over.standalone ?? true,
    notification,
    serviceWorker: {
      ready: Promise.resolve({ pushManager: { getSubscription: async () => state.subscribed, subscribe } }),
    },
    get subscribed() {
      return state.subscribed
    },
    subscribe,
  }
  return env as unknown as Env
}

type Call = { url: string; method: string; headers: Record<string, string>; body?: unknown }

function makeFetch(answers: Record<string, number | 'offline'> = {}) {
  const calls: Call[] = []
  const fn = vi.fn(async (url: string, init: RequestInit = {}) => {
    const method = init.method ?? 'GET'
    calls.push({
      url,
      method,
      headers: init.headers as Record<string, string>,
      body: typeof init.body === 'string' ? JSON.parse(init.body) : undefined,
    })
    const answer = answers[`${method} ${url}`] ?? 200
    if (answer === 'offline') throw new TypeError('offline')
    const payload = url === '/api/push/key' && answer === 200 ? { publicKey: KEY_B64URL } : {}
    return new Response(JSON.stringify(payload), { status: answer })
  })
  return { calls, fetch: fn as unknown as typeof fetch }
}

function build(env: PushEnv, fetch: typeof globalThis.fetch, bus = createChangeBus()) {
  return { service: createPushService({ now: () => NOW, bus, storageAvailable: true, fetch, env }), bus }
}

describe('O22 status', () => {
  test('O22 unsupported without a service worker, PushManager or Notification', async () => {
    const f = makeFetch()
    const a = makeEnv()
    delete (a as { serviceWorker?: unknown }).serviceWorker
    expect(await build(a, f.fetch).service.status()).toBe('unsupported')
    expect(await build({ ...makeEnv(), hasPushManager: false }, f.fetch).service.status()).toBe('unsupported')
    const c = makeEnv()
    delete (c as { notification?: unknown }).notification
    expect(await build(c, f.fetch).service.status()).toBe('unsupported')
  })

  test('O22 not-installed when the app is not standalone', async () => {
    expect(await build(makeEnv({ standalone: false }), makeFetch().fetch).service.status()).toBe('not-installed')
  })

  test('O22 denied when permission is denied', async () => {
    expect(await build(makeEnv({ permission: 'denied' }), makeFetch().fetch).service.status()).toBe('denied')
  })

  test('O22 on when a subscription exists, else off', async () => {
    const f = makeFetch()
    expect(await build(makeEnv({ subscribed: sub() }), f.fetch).service.status()).toBe('on')
    expect(await build(makeEnv(), f.fetch).service.status()).toBe('off')
  })
})

describe('O23 enable and disable', () => {
  test('O23 enable asks permission, reads the key, subscribes with it and posts the subscription', async () => {
    const env = makeEnv({ permission: 'granted' })
    const f = makeFetch()
    expect(await build(env, f.fetch).service.enable()).toBe('on')
    expect(env.notification!.requestPermission).toHaveBeenCalledTimes(1)
    expect(f.calls.map((c) => `${c.method} ${c.url}`)).toEqual(['GET /api/push/key', 'POST /api/push/subscription'])
    const options = env.subscribe.mock.calls[0][0] as { userVisibleOnly: boolean; applicationServerKey: Uint8Array }
    expect(options.userVisibleOnly).toBe(true)
    expect(Array.from(options.applicationServerKey)).toEqual([4, 1, 2])
    expect(f.calls[1].body).toEqual(SUB_JSON)
    for (const c of f.calls) expect(c.headers['X-Contract-Version']).toBe('2')
  })

  test('O23 denied answers denied and posts nothing', async () => {
    const env = makeEnv({ permission: 'denied' })
    const f = makeFetch()
    expect(await build(env, f.fetch).service.enable()).toBe('denied')
    expect(f.calls).toEqual([])
    expect(env.subscribe).not.toHaveBeenCalled()
  })

  test('O23 a 503 answers unconfigured and a 401 signed-out, leaving no local subscription', async () => {
    const a = makeEnv({ permission: 'granted' })
    expect(await build(a, makeFetch({ 'GET /api/push/key': 503 }).fetch).service.enable()).toBe('unconfigured')
    expect(a.subscribed).toBeNull()

    const b = makeEnv({ permission: 'granted' })
    expect(await build(b, makeFetch({ 'GET /api/push/key': 401 }).fetch).service.enable()).toBe('signed-out')
    expect(b.subscribed).toBeNull()

    const c = makeEnv({ permission: 'granted' })
    const answer = await build(c, makeFetch({ 'POST /api/push/subscription': 401 }).fetch).service.enable()
    expect(answer).toBe('signed-out')
    expect(c.subscribed).toBeNull()
  })

  test('O23 disable sends DELETE and unsubscribes locally', async () => {
    const s = sub()
    const env = makeEnv({ subscribed: s })
    const f = makeFetch()
    expect(await build(env, f.fetch).service.disable()).toBe('off')
    expect(f.calls[0]).toMatchObject({ method: 'DELETE', url: '/api/push/subscription', body: { endpoint: SUB_JSON.endpoint } })
    expect(f.calls[0].headers['X-Contract-Version']).toBe('2')
    expect(s.unsubscribe).toHaveBeenCalledTimes(1)
  })

  test('O23 offline, disable still unsubscribes locally and answers off', async () => {
    const s = sub()
    const f = makeFetch({ 'DELETE /api/push/subscription': 'offline' })
    expect(await build(makeEnv({ subscribed: s }), f.fetch).service.disable()).toBe('off')
    expect(s.unsubscribe).toHaveBeenCalledTimes(1)
  })
})

describe('O24 rest push and reminders', () => {
  test('O24 scheduleRest posts the delay, title and body when on', async () => {
    const f = makeFetch()
    await build(makeEnv({ subscribed: sub() }), f.fetch).service.scheduleRest(NOW + 90_000, 'Bench press')
    expect(f.calls).toHaveLength(1)
    expect(f.calls[0]).toMatchObject({
      method: 'POST',
      url: '/api/push/rest',
      body: { delayMs: 90_000, title: 'Rest over — Bench press', body: 'Tap to log it.' },
    })
    expect(f.calls[0].headers['X-Contract-Version']).toBe('2')
  })

  test('O24 scheduleRest clamps a past end to a zero delay', async () => {
    const f = makeFetch()
    await build(makeEnv({ subscribed: sub() }), f.fetch).service.scheduleRest(NOW - 5_000, 'Squat')
    expect((f.calls[0].body as { delayMs: number }).delayMs).toBe(0)
  })

  test('O24 cancelRest sends DELETE /api/push/rest when on', async () => {
    const f = makeFetch()
    await build(makeEnv({ subscribed: sub() }), f.fetch).service.cancelRest()
    expect(f.calls.map((c) => `${c.method} ${c.url}`)).toEqual(['DELETE /api/push/rest'])
  })

  test('O24 when not on, neither makes a request', async () => {
    const f = makeFetch()
    const { service } = build(makeEnv(), f.fetch)
    await service.scheduleRest(NOW + 1000, 'x')
    await service.cancelRest()
    expect(f.calls).toEqual([])
  })

  test('O24 a failure resolves quietly', async () => {
    const f = makeFetch({ 'POST /api/push/rest': 'offline', 'DELETE /api/push/rest': 500 })
    const { service } = build(makeEnv({ subscribed: sub() }), f.fetch)
    await expect(service.scheduleRest(NOW + 1000, 'x')).resolves.toBeUndefined()
    await expect(service.cancelRest()).resolves.toBeUndefined()
  })

  test('O24 setReminders writes one announced row and reminders() reads it back; null turns it off', async () => {
    const { service, bus } = build(makeEnv(), makeFetch().fetch)
    const seen = vi.fn()
    bus.subscribe('preferences', seen)
    expect(await service.reminders()).toBeNull()
    const value = { days: [1, 3], time: '18:30', timeZone: 'Asia/Jerusalem' }
    await service.setReminders(value)
    expect(seen).toHaveBeenCalledTimes(1)
    expect(await service.reminders()).toEqual(value)
    expect((await db.settings.get('workoutReminders'))?.updatedAt).toBe(NOW)
    await service.setReminders(null)
    expect(await service.reminders()).toBeNull()
  })

  test('O24 an invalid reminders value is refused with a ServiceError', async () => {
    const { service, bus } = build(makeEnv(), makeFetch().fetch)
    const seen = vi.fn()
    bus.subscribe('preferences', seen)
    const bad = { days: [], time: '25:00', timeZone: 'Nowhere' }
    await expect(service.setReminders(bad)).rejects.toBeInstanceOf(ServiceError)
    expect(seen).not.toHaveBeenCalled()
    expect(await db.settings.get('workoutReminders')).toBeUndefined()
  })
})
