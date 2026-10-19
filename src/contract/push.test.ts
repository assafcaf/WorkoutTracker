import { describe, expect, it } from 'vitest'
import {
  CONTRACT_VERSION,
  HttpError,
  checkPushKeyResponse,
  checkPushTestResponse,
  checkRestPushRequest,
  checkSubscriptionRequest,
  checkUnsubscribeRequest,
  parseReminders,
} from './index'

function b64url(bytes: number[]): string {
  return Buffer.from(bytes).toString('base64url')
}
const P256DH = b64url([4, ...Array.from({ length: 64 }, (_, i) => i + 1)])
const AUTH = b64url(Array.from({ length: 16 }, (_, i) => i + 1))
const ENDPOINT = 'https://fcm.googleapis.com/fcm/send/abc123'

function sub(over: Record<string, unknown> = {}, keys: Record<string, unknown> = {}) {
  return { endpoint: ENDPOINT, keys: { p256dh: P256DH, auth: AUTH, ...keys }, ...over }
}

function thrown(fn: () => unknown): unknown {
  try {
    fn()
  } catch (e) {
    return e
  }
  return undefined
}

function rejects(fn: () => unknown, field: string) {
  const err = thrown(fn)
  expect(err).toBeInstanceOf(HttpError)
  expect((err as HttpError).status).toBe(400)
  expect((err as HttpError).message).toContain(field)
}

function rejects400(fn: () => unknown) {
  const err = thrown(fn)
  expect(err).toBeInstanceOf(HttpError)
  expect((err as HttpError).status).toBe(400)
}

describe('checkSubscriptionRequest', () => {
  it('answers a well-formed subscription whole', () => {
    const body = sub()
    expect(checkSubscriptionRequest(body)).toEqual(body)
  })

  it.each([
    'https://web.push.apple.com/QAbc',
    'https://fcm.googleapis.com/fcm/send/x',
    'https://updates.push.services.mozilla.com/wpush/v2/x',
    'https://db5p.notify.windows.com/w/?token=x',
  ])('accepts the allowlisted push host %s', (endpoint) => {
    expect(checkSubscriptionRequest(sub({ endpoint })).endpoint).toBe(endpoint)
  })

  it.each([
    ['http scheme', 'http://fcm.googleapis.com/x'],
    ['host outside the allowlist', 'https://evil.example.com/x'],
    ['lookalike host', 'https://fcm.googleapis.com.evil.com/x'],
    ['bare windows suffix', 'https://notify.windows.com.evil.com/x'],
    ['not a url', 'nonsense'],
    ['empty', ''],
  ])('throws HttpError(400) naming endpoint for %s', (_n, endpoint) => {
    rejects(() => checkSubscriptionRequest(sub({ endpoint })), 'endpoint')
  })

  it('throws naming endpoint when it is longer than 1024 characters', () => {
    const endpoint = 'https://fcm.googleapis.com/' + 'a'.repeat(1024)
    rejects(() => checkSubscriptionRequest(sub({ endpoint })), 'endpoint')
  })

  it('throws naming endpoint when it is not a string', () => {
    rejects(() => checkSubscriptionRequest(sub({ endpoint: 5 })), 'endpoint')
  })

  it.each([
    ['not starting 0x04', b64url([5, ...Array.from({ length: 64 }, () => 1)])],
    ['64 bytes', b64url([4, ...Array.from({ length: 63 }, () => 1)])],
    ['66 bytes', b64url([4, ...Array.from({ length: 65 }, () => 1)])],
    ['not base64url', '+/===='],
    ['empty', ''],
  ])('throws naming p256dh when it is %s', (_n, p256dh) => {
    rejects(() => checkSubscriptionRequest(sub({}, { p256dh })), 'p256dh')
  })

  it.each([
    ['15 bytes', b64url(Array.from({ length: 15 }, () => 1))],
    ['17 bytes', b64url(Array.from({ length: 17 }, () => 1))],
    ['not base64url', '!!!!'],
    ['empty', ''],
  ])('throws naming auth when it is %s', (_n, auth) => {
    rejects(() => checkSubscriptionRequest(sub({}, { auth })), 'auth')
  })

  it.each([null, undefined, 'x', 3, [], {}, { endpoint: ENDPOINT }, { endpoint: ENDPOINT, keys: null }])(
    'throws HttpError(400) for a malformed body %j',
    (body) => {
      rejects400(() => checkSubscriptionRequest(body))
    },
  )
})

describe('checkUnsubscribeRequest', () => {
  it('answers { endpoint } whole', () => {
    expect(checkUnsubscribeRequest({ endpoint: ENDPOINT })).toEqual({ endpoint: ENDPOINT })
  })

  it.each([
    'http://fcm.googleapis.com/x',
    'https://evil.example.com/x',
    'https://fcm.googleapis.com/' + 'a'.repeat(1024),
    '',
  ])('throws naming endpoint for %s', (endpoint) => {
    rejects(() => checkUnsubscribeRequest({ endpoint }), 'endpoint')
  })

  it('throws HttpError(400) for a missing body', () => {
    rejects400(() => checkUnsubscribeRequest(null))
  })
})

describe('checkRestPushRequest', () => {
  const ok = { delayMs: 90_000, title: 'Rest over', body: 'Next set' }

  it('answers a valid request whole', () => {
    expect(checkRestPushRequest(ok)).toEqual(ok)
  })

  it('accepts the boundaries', () => {
    const lo = { delayMs: 0, title: 'x', body: '' }
    const hi = { delayMs: 3_600_000, title: 'a'.repeat(80), body: 'b'.repeat(160) }
    expect(checkRestPushRequest(lo)).toEqual(lo)
    expect(checkRestPushRequest(hi)).toEqual(hi)
  })

  it.each([-1, 3_600_001, 1.5, NaN, Infinity, '1000', null, undefined])(
    'throws naming delayMs for %j',
    (delayMs) => {
      rejects(() => checkRestPushRequest({ ...ok, delayMs }), 'delayMs')
    },
  )

  it.each(['', 'a'.repeat(81), 5, null, undefined])('throws naming title for %j', (title) => {
    rejects(() => checkRestPushRequest({ ...ok, title }), 'title')
  })

  it.each(['b'.repeat(161), 5, null, undefined])('throws naming body for %j', (body) => {
    rejects(() => checkRestPushRequest({ ...ok, body }), 'body')
  })

  it.each([null, undefined, 'x', []])('throws HttpError(400) for a malformed body %j', (body) => {
    rejects400(() => checkRestPushRequest(body))
  })
})

describe('checkPushKeyResponse', () => {
  it('answers { publicKey } whole', () => {
    expect(checkPushKeyResponse({ publicKey: 'BAbc' })).toEqual({ publicKey: 'BAbc' })
  })

  it.each([null, undefined, 'x', 3, [], {}, { publicKey: 5 }, { publicKey: '' }, { key: 'BAbc' }])(
    'answers null for %j',
    (body) => {
      expect(checkPushKeyResponse(body)).toBeNull()
    },
  )
})

describe('E25-T1 O2: checkPushTestResponse', () => {
  const device = { host: 'web.push.apple.com', result: 'failed', status: 403, reason: 'BadJwtToken' }

  it('answers the whole { subscriptions, results } body', () => {
    expect(checkPushTestResponse({ subscriptions: 1, results: [device] })).toEqual({ subscriptions: 1, results: [device] })
  })

  it('accepts an empty answer and null status and reason', () => {
    expect(checkPushTestResponse({ subscriptions: 0, results: [] })).toEqual({ subscriptions: 0, results: [] })
    const thrown = { host: 'fcm.googleapis.com', result: 'failed', status: null, reason: null }
    expect(checkPushTestResponse({ subscriptions: 1, results: [thrown] })?.results).toEqual([thrown])
  })

  it.each([
    ['null', null],
    ['a string', 'x'],
    ['an array', []],
    ['no results', { subscriptions: 1 }],
    ['a fractional count', { subscriptions: 1.5, results: [] }],
    ['a negative count', { subscriptions: -1, results: [] }],
    ['results not an array', { subscriptions: 1, results: {} }],
    ['an unknown result', { subscriptions: 1, results: [{ ...device, result: 'ok' }] }],
    ['a host that is not a string', { subscriptions: 1, results: [{ ...device, host: 5 }] }],
    ['a status that is a string', { subscriptions: 1, results: [{ ...device, status: '403' }] }],
    ['a reason that is a number', { subscriptions: 1, results: [{ ...device, reason: 5 }] }],
  ])('answers null for %s', (_name, body) => {
    expect(checkPushTestResponse(body)).toBeNull()
  })
})

describe('parseReminders', () => {
  const ok = { days: [1, 3, 5], time: '18:30', timeZone: 'Asia/Jerusalem' }

  it('answers a valid value', () => {
    expect(parseReminders(ok)).toEqual(ok)
  })

  it('sorts and de-duplicates days', () => {
    expect(parseReminders({ ...ok, days: [5, 1, 5, 0, 1] })?.days).toEqual([0, 1, 5])
  })

  it('accepts the time boundaries and days 0 and 6', () => {
    expect(parseReminders({ days: [0, 6], time: '00:00', timeZone: 'UTC' })).toEqual({
      days: [0, 6],
      time: '00:00',
      timeZone: 'UTC',
    })
    expect(parseReminders({ ...ok, time: '23:59' })?.time).toBe('23:59')
  })

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['a string', 'x'],
    ['empty object', {}],
    ['empty days', { ...ok, days: [] }],
    ['days not an array', { ...ok, days: 1 }],
    ['day 7', { ...ok, days: [7] }],
    ['day -1', { ...ok, days: [-1] }],
    ['fractional day', { ...ok, days: [1.5] }],
    ['string day', { ...ok, days: ['1'] }],
    ['time 24:00', { ...ok, time: '24:00' }],
    ['time 12:60', { ...ok, time: '12:60' }],
    ['time without zero pad', { ...ok, time: '9:30' }],
    ['time not a string', { ...ok, time: 1830 }],
    ['unknown timeZone', { ...ok, timeZone: 'Mars/Base' }],
    ['timeZone missing', { days: [1], time: '18:30' }],
    ['timeZone not a string', { ...ok, timeZone: 5 }],
  ])('answers null for %s', (_n, value) => {
    expect(parseReminders(value)).toBeNull()
  })

  it('leaves CONTRACT_VERSION at 2', () => {
    expect(CONTRACT_VERSION).toBe(2)
  })
})
