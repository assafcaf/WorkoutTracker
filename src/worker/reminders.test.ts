// @vitest-environment node
import { readFileSync } from 'node:fs'
import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest'
import type { Reminders } from '../contract'
import worker from './index'
import type { Env } from './env'
import { isDue, sendDueReminders } from './services/reminders'
import { subscribe } from './services/push'
import { testEnv } from '../test/access'
import { createFakeD1 } from '../test/fakeD1'
import { createFakePushService, type FakePushService } from '../test/fakePushService'

const EP_A = 'https://fcm.googleapis.com/fcm/send/aaa'
const EP_B = 'https://web.push.apple.com/bbb'

let vapidJson: string

beforeAll(async () => {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
  const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey)
  vapidJson = JSON.stringify({ kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y, d: jwk.d })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const utc = (y: number, mo: number, d: number, h: number, mi: number, s = 0) => Date.UTC(y, mo - 1, d, h, mi, s)
const rem = (days: number[], time: string, timeZone: string): Reminders => ({ days, time, timeZone })

describe('O16: isDue', () => {
  const jerusalem = (days: number[], time = '18:30') => rem(days, time, 'Asia/Jerusalem')

  test('O16 is due from the reminder time up to but not including 30 minutes later (winter, UTC+2)', () => {
    const r = jerusalem([3]) // Wed 2026-01-14, 18:30 local = 16:30Z
    expect(isDue(r, utc(2026, 1, 14, 16, 29, 59))).toBe(false)
    expect(isDue(r, utc(2026, 1, 14, 16, 30))).toBe(true)
    expect(isDue(r, utc(2026, 1, 14, 16, 59, 59))).toBe(true)
    expect(isDue(r, utc(2026, 1, 14, 17, 0))).toBe(false)
  })

  test('O16 uses the time zone offset in summer (UTC+3)', () => {
    const r = jerusalem([3]) // Wed 2026-07-15, 18:30 local = 15:30Z
    expect(isDue(r, utc(2026, 7, 15, 15, 30))).toBe(true)
    expect(isDue(r, utc(2026, 7, 15, 16, 30))).toBe(false)
  })

  test('O16 a weekday not in days is not due', () => {
    expect(isDue(jerusalem([0, 1, 2, 4, 5, 6]), utc(2026, 1, 14, 16, 30))).toBe(false)
  })

  test('O16 the weekday is the local one, not the UTC one', () => {
    // Thu 2026-01-15 00:10 local = Wed 22:10Z
    expect(isDue(jerusalem([4], '00:00'), utc(2026, 1, 14, 22, 10))).toBe(true)
    expect(isDue(jerusalem([3], '00:00'), utc(2026, 1, 14, 22, 10))).toBe(false)
  })

  test('O16 America/New_York: the local weekday and offset decide, in winter and summer', () => {
    const r = rem([3], '20:00', 'America/New_York')
    // Wed 2026-01-14 20:00 EST = Thu 01:00Z
    expect(isDue(r, utc(2026, 1, 15, 1, 0))).toBe(true)
    expect(isDue(rem([4], '20:00', 'America/New_York'), utc(2026, 1, 15, 1, 0))).toBe(false)
    // Wed 2026-07-15 20:00 EDT = Thu 00:00Z
    expect(isDue(r, utc(2026, 7, 16, 0, 0))).toBe(true)
    expect(isDue(r, utc(2026, 7, 16, 1, 0))).toBe(false)
  })

  test('O16 Asia/Jerusalem spring change (Fri 2026-03-27): +2 before, +3 after', () => {
    // Thu 2026-03-26 18:30 local = 16:30Z; Sat 2026-03-28 18:30 local = 15:30Z
    expect(isDue(jerusalem([4]), utc(2026, 3, 26, 16, 30))).toBe(true)
    expect(isDue(jerusalem([4]), utc(2026, 3, 26, 15, 30))).toBe(false)
    expect(isDue(jerusalem([6]), utc(2026, 3, 28, 15, 30))).toBe(true)
    expect(isDue(jerusalem([6]), utc(2026, 3, 28, 16, 30))).toBe(false)
  })

  test('O16 Asia/Jerusalem autumn change (Sun 2026-10-25): +3 before, +2 after', () => {
    // Sat 2026-10-24 18:30 local = 15:30Z; Mon 2026-10-26 18:30 local = 16:30Z
    expect(isDue(jerusalem([6]), utc(2026, 10, 24, 15, 30))).toBe(true)
    expect(isDue(jerusalem([6]), utc(2026, 10, 24, 16, 30))).toBe(false)
    expect(isDue(jerusalem([1]), utc(2026, 10, 26, 16, 30))).toBe(true)
    expect(isDue(jerusalem([1]), utc(2026, 10, 26, 15, 30))).toBe(false)
  })

  test('O16 on the autumn change day the local time follows the new offset', () => {
    // Sun 2026-10-25 18:30 local (+2) = 16:30Z
    expect(isDue(jerusalem([0]), utc(2026, 10, 25, 16, 30))).toBe(true)
    expect(isDue(jerusalem([0]), utc(2026, 10, 25, 15, 30))).toBe(false)
    // Sun 2026-10-25 01:30 local (+3, before the change at 23:00Z) = Sat 22:30Z
    expect(isDue(jerusalem([0], '01:30'), utc(2026, 10, 24, 22, 30))).toBe(true)
    expect(isDue(jerusalem([6], '01:30'), utc(2026, 10, 24, 22, 30))).toBe(false)
  })

  test('O16 America/New_York spring and autumn changes (2026-03-08, 2026-11-01)', () => {
    const r = rem([1], '09:00', 'America/New_York')
    // Mon 2026-03-09 09:00 EDT = 13:00Z; Mon 2026-03-02 09:00 EST = 14:00Z
    expect(isDue(r, utc(2026, 3, 9, 13, 0))).toBe(true)
    expect(isDue(r, utc(2026, 3, 9, 14, 0))).toBe(false)
    expect(isDue(r, utc(2026, 3, 2, 14, 0))).toBe(true)
    // Mon 2026-11-02 09:00 EST = 14:00Z; Mon 2026-10-26 09:00 EDT = 13:00Z
    expect(isDue(r, utc(2026, 11, 2, 14, 0))).toBe(true)
    expect(isDue(r, utc(2026, 11, 2, 13, 0))).toBe(false)
    expect(isDue(r, utc(2026, 10, 26, 13, 0))).toBe(true)
  })
})

// 2026-01-14 is a Wednesday; Asia/Jerusalem is UTC+2, so 18:30 local is 16:30Z.
const DUE = utc(2026, 1, 14, 16, 30)
const EVERY_DAY = rem([0, 1, 2, 3, 4, 5, 6], '18:30', 'Asia/Jerusalem')

async function setup(): Promise<{ env: Env; svc: FakePushService }> {
  const { env: base } = testEnv()
  const env: Env = {
    ...base,
    DB: await createFakeD1(),
    VAPID_PRIVATE_KEY: vapidJson,
    VAPID_SUBJECT: 'mailto:ops@example.com',
  }
  const svc = await createFakePushService()
  vi.stubGlobal('fetch', svc.fetch)
  return { env, svc }
}

async function putSetting(env: Env, user: string, value: unknown, key = 'workoutReminders'): Promise<void> {
  const text = typeof value === 'string' ? value : JSON.stringify(value)
  await env.DB.prepare('INSERT INTO settings (user, key, value, updated_at, seq) VALUES (?1, ?2, ?3, 1, 1)')
    .bind(user, key, text)
    .run()
}

async function putSession(env: Env, user: string, id: string, startedAt: number, deletedAt?: number): Promise<void> {
  const doc = JSON.stringify(deletedAt === undefined ? { id, startedAt } : { id, startedAt, deletedAt })
  await env.DB.prepare('INSERT INTO sessions (user, id, doc, updated_at, seq) VALUES (?1, ?2, ?3, 1, 1)')
    .bind(user, id, doc)
    .run()
}

const titles = (svc: FakePushService) => svc.requests.map((r) => JSON.parse(r.plaintext ?? 'null').title)

describe('O17: sendDueReminders', () => {
  test('O17 a due user with no session gets exactly one push: title, tag reminder, TTL 3600', async () => {
    const { env, svc } = await setup()
    await subscribe(env.DB, 'a@x.com', { endpoint: EP_A, keys: svc.keys })
    await putSetting(env, 'a@x.com', EVERY_DAY)
    await sendDueReminders(env, DUE)
    expect(svc.requests).toHaveLength(1)
    const [sent] = svc.requests
    expect(sent.endpoint).toBe(EP_A)
    const payload = JSON.parse(sent.plaintext ?? 'null')
    expect(payload.title).toBe('Time to train')
    expect(payload.tag).toBe('reminder')
    expect(sent.headers.ttl).toBe('3600')
  })

  test('O17 a second run in the same minute sends nothing more', async () => {
    const { env, svc } = await setup()
    await subscribe(env.DB, 'a@x.com', { endpoint: EP_A, keys: svc.keys })
    await putSetting(env, 'a@x.com', EVERY_DAY)
    await sendDueReminders(env, DUE)
    await sendDueReminders(env, DUE)
    expect(svc.requests).toHaveLength(1)
  })

  test('O17 a later run on the same local day, still in the window, sends nothing more', async () => {
    const { env, svc } = await setup()
    await subscribe(env.DB, 'a@x.com', { endpoint: EP_A, keys: svc.keys })
    await putSetting(env, 'a@x.com', EVERY_DAY)
    await sendDueReminders(env, DUE)
    await sendDueReminders(env, DUE + 10 * 60_000)
    await sendDueReminders(env, DUE + 29 * 60_000)
    expect(svc.requests).toHaveLength(1)
  })

  test('O17 the next day, a due user is reminded again', async () => {
    const { env, svc } = await setup()
    await subscribe(env.DB, 'a@x.com', { endpoint: EP_A, keys: svc.keys })
    await putSetting(env, 'a@x.com', EVERY_DAY)
    await sendDueReminders(env, DUE)
    await sendDueReminders(env, DUE + 24 * 3_600_000)
    expect(svc.requests).toHaveLength(2)
  })

  test('O17 a session started that local day suppresses the reminder', async () => {
    const { env, svc } = await setup()
    await subscribe(env.DB, 'a@x.com', { endpoint: EP_A, keys: svc.keys })
    await putSetting(env, 'a@x.com', EVERY_DAY)
    await putSession(env, 'a@x.com', 's1', utc(2026, 1, 14, 8, 0)) // 10:00 local, same day
    await sendDueReminders(env, DUE)
    expect(svc.requests).toEqual([])
  })

  test('O17 the day is the local one: a session at 00:30 local (22:30Z the day before) suppresses', async () => {
    const { env, svc } = await setup()
    await subscribe(env.DB, 'a@x.com', { endpoint: EP_A, keys: svc.keys })
    await putSetting(env, 'a@x.com', EVERY_DAY)
    await putSession(env, 'a@x.com', 's1', utc(2026, 1, 13, 22, 30))
    await sendDueReminders(env, DUE)
    expect(svc.requests).toEqual([])
  })

  test('O17 a session from the previous local day does not suppress', async () => {
    const { env, svc } = await setup()
    await subscribe(env.DB, 'a@x.com', { endpoint: EP_A, keys: svc.keys })
    await putSetting(env, 'a@x.com', EVERY_DAY)
    await putSession(env, 'a@x.com', 's1', utc(2026, 1, 13, 21, 59)) // 23:59 local on the 13th
    await sendDueReminders(env, DUE)
    expect(svc.requests).toHaveLength(1)
  })

  test("O17 another user's session does not suppress", async () => {
    const { env, svc } = await setup()
    await subscribe(env.DB, 'a@x.com', { endpoint: EP_A, keys: svc.keys })
    await putSetting(env, 'a@x.com', EVERY_DAY)
    await putSession(env, 'b@x.com', 's1', utc(2026, 1, 14, 8, 0))
    await sendDueReminders(env, DUE)
    expect(svc.requests).toHaveLength(1)
  })

  test('O17 a session with deletedAt does not suppress', async () => {
    const { env, svc } = await setup()
    await subscribe(env.DB, 'a@x.com', { endpoint: EP_A, keys: svc.keys })
    await putSetting(env, 'a@x.com', EVERY_DAY)
    await putSession(env, 'a@x.com', 's1', utc(2026, 1, 14, 8, 0), utc(2026, 1, 14, 9, 0))
    await sendDueReminders(env, DUE)
    expect(svc.requests).toHaveLength(1)
  })

  test.each([
    ['an absent setting', undefined],
    ['an invalid setting', { days: [], time: '18:30', timeZone: 'Asia/Jerusalem' }],
    ['a setting that is not JSON', 'not json {'],
    ['a null value', null],
  ])('O17 %s sends nothing', async (_name, value) => {
    const { env, svc } = await setup()
    await subscribe(env.DB, 'a@x.com', { endpoint: EP_A, keys: svc.keys })
    if (value !== undefined) await putSetting(env, 'a@x.com', value)
    await sendDueReminders(env, DUE)
    expect(svc.requests).toEqual([])
  })

  test('O17 a user whose reminder is not due now sends nothing', async () => {
    const { env, svc } = await setup()
    await subscribe(env.DB, 'a@x.com', { endpoint: EP_A, keys: svc.keys })
    await putSetting(env, 'a@x.com', rem([3], '07:00', 'Asia/Jerusalem'))
    await sendDueReminders(env, DUE)
    expect(svc.requests).toEqual([])
  })

  test('O17 only the setting key workoutReminders counts', async () => {
    const { env, svc } = await setup()
    await subscribe(env.DB, 'a@x.com', { endpoint: EP_A, keys: svc.keys })
    await putSetting(env, 'a@x.com', EVERY_DAY, 'restSeconds')
    await sendDueReminders(env, DUE)
    expect(svc.requests).toEqual([])
  })

  test('O17 two due users each get their own push to their own subscription', async () => {
    const { env, svc } = await setup()
    await subscribe(env.DB, 'a@x.com', { endpoint: EP_A, keys: svc.keys })
    await subscribe(env.DB, 'b@x.com', { endpoint: EP_B, keys: svc.keys })
    await putSetting(env, 'a@x.com', EVERY_DAY)
    await putSetting(env, 'b@x.com', EVERY_DAY)
    await sendDueReminders(env, DUE)
    expect(svc.requests.map((r) => r.endpoint).sort()).toEqual([EP_A, EP_B].sort())
    expect(titles(svc)).toEqual(['Time to train', 'Time to train'])
  })

  test('O17 a session for one user does not stop the other being reminded', async () => {
    const { env, svc } = await setup()
    await subscribe(env.DB, 'a@x.com', { endpoint: EP_A, keys: svc.keys })
    await subscribe(env.DB, 'b@x.com', { endpoint: EP_B, keys: svc.keys })
    await putSetting(env, 'a@x.com', EVERY_DAY)
    await putSetting(env, 'b@x.com', EVERY_DAY)
    await putSession(env, 'a@x.com', 's1', utc(2026, 1, 14, 8, 0))
    await sendDueReminders(env, DUE)
    expect(svc.requests.map((r) => r.endpoint)).toEqual([EP_B])
  })

  test('O17 the scheduled handler runs the reminders at the scheduled time', async () => {
    const { env, svc } = await setup()
    await subscribe(env.DB, 'a@x.com', { endpoint: EP_A, keys: svc.keys })
    await putSetting(env, 'a@x.com', EVERY_DAY)
    await worker.scheduled({ scheduledTime: DUE }, env)
    expect(titles(svc)).toEqual(['Time to train'])
  })
})

describe('O18: the cron trigger', () => {
  const toml = readFileSync(new URL('../../wrangler.toml', import.meta.url), 'utf-8')

  test('O18 wrangler.toml has a [triggers] table with crons = ["* * * * *"]', () => {
    expect(toml).toMatch(/^\[triggers\]/m)
    expect(toml).toMatch(/^crons\s*=\s*\[\s*"\* \* \* \* \*"\s*\]/m)
  })

  test('O18 the default export has a scheduled handler', () => {
    expect(typeof worker.scheduled).toBe('function')
  })
})
