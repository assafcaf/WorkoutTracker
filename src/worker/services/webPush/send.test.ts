// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeAll, describe, expect, test } from 'vitest'
import { sendPush } from './send'
import { vapidPublicKey, type VapidJwk } from './vapid'
import { createFakePushService, type FakePushService } from '../../../test/fakePushService'

const ENDPOINT = 'https://push.example/send/abc'
const NOW = Date.UTC(2026, 9, 18, 12, 0, 0)
let jwk: VapidJwk
let svc: FakePushService

beforeAll(async () => {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
  jwk = (await crypto.subtle.exportKey('jwk', pair.privateKey)) as VapidJwk
})

async function send(
  extra: { topic?: string; ttl?: number } = {},
  fetchImpl?: typeof fetch,
): Promise<{ result: string; svc: FakePushService }> {
  svc = await createFakePushService()
  const result = await sendPush({ endpoint: ENDPOINT, keys: svc.keys }, 'Rest over', {
    jwk,
    subject: 'mailto:ops@example.com',
    now: NOW,
    fetch: fetchImpl ?? svc.fetch,
    ...extra,
  })
  return { result, svc }
}

describe('O8: sendPush', () => {
  test('POSTs an aes128gcm body with TTL, Urgency high and the VAPID header, answering sent for a 2xx', async () => {
    const { result, svc } = await send({ ttl: 120 })
    expect(result).toBe('sent')
    expect(svc.requests).toHaveLength(1)
    const r = svc.requests[0]
    expect(r.endpoint).toBe(ENDPOINT)
    expect(r.method).toBe('POST')
    expect(r.headers['content-encoding']).toBe('aes128gcm')
    expect(r.headers['ttl']).toBe('120')
    expect(r.headers['urgency']).toBe('high')
    expect(r.headers['authorization']).toMatch(/^vapid t=[^,\s]+, k=[^,\s]+$/)
    expect(r.headers['authorization']).toContain(`k=${vapidPublicKey(jwk)}`)
    expect(r.plaintext).toBe('Rest over')
  })

  test('sends a Topic header when one is given and none otherwise', async () => {
    const withTopic = await send({ topic: 'rest-over' })
    expect(withTopic.svc.requests[0].headers['topic']).toBe('rest-over')
    const without = await send()
    expect(without.svc.requests[0].headers['topic']).toBeUndefined()
  })

  test('answers sent for any 2xx', async () => {
    svc = await createFakePushService()
    svc.setStatus(ENDPOINT, 202)
    const result = await sendPush({ endpoint: ENDPOINT, keys: svc.keys }, 'x', {
      jwk,
      subject: 'mailto:a@b.co',
      now: NOW,
      fetch: svc.fetch,
    })
    expect(result).toBe('sent')
  })

  test.each([404, 410])('answers gone for %i', async (status) => {
    svc = await createFakePushService()
    svc.setStatus(ENDPOINT, status)
    const result = await sendPush({ endpoint: ENDPOINT, keys: svc.keys }, 'x', {
      jwk,
      subject: 'mailto:a@b.co',
      now: NOW,
      fetch: svc.fetch,
    })
    expect(result).toBe('gone')
  })

  test.each([400, 401, 403, 413, 429, 500, 503])('answers failed for %i', async (status) => {
    svc = await createFakePushService()
    svc.setStatus(ENDPOINT, status)
    const result = await sendPush({ endpoint: ENDPOINT, keys: svc.keys }, 'x', {
      jwk,
      subject: 'mailto:a@b.co',
      now: NOW,
      fetch: svc.fetch,
    })
    expect(result).toBe('failed')
  })

  test('answers failed, not a throw, when fetch throws', async () => {
    svc = await createFakePushService()
    svc.setNetworkError(ENDPOINT)
    const result = await sendPush({ endpoint: ENDPOINT, keys: svc.keys }, 'x', {
      jwk,
      subject: 'mailto:a@b.co',
      now: NOW,
      fetch: svc.fetch,
    })
    expect(result).toBe('failed')
  })

  test('nothing under services/webPush imports a node: module', () => {
    const dir = __dirname
    const files = readdirSync(dir).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
    expect(files.sort()).toEqual(expect.arrayContaining(['encrypt.ts', 'send.ts', 'vapid.ts']))
    for (const f of files) {
      expect(readFileSync(join(dir, f), 'utf8'), f).not.toMatch(/(?:from|import\s*\(|require\()\s*['"]node:/)
    }
  })
})
