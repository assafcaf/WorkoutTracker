// @vitest-environment node
import { beforeAll, beforeEach, expect, test } from 'vitest'
import { VERSION_HEADER } from '../contract'
import { db } from '../storage/db'
import { syncedSettingKeys } from '../storage/settingKeys'
import { createSyncClient } from '../sync/syncClient'
import type { SyncResponse } from '../sync/protocol'
import type { Session } from '../types'
import { createFakeD1 } from '../test/fakeD1'
import { recordingAssets } from '../test/access'
import { createHandler } from './index'
import type { D1Database } from './d1'
import type { Env } from './env'

// E20-T3 O11: the phone's sync client wired to the real Worker over the sql.js fake D1.

const EMAIL = 'dev@example.com'
const T0 = 1_758_800_000_000

let d1: D1Database
let env: Env
let sentVersions: (string | null)[]

beforeAll(async () => {
  await db.open()
})

beforeEach(async () => {
  await db.sessions.clear()
  await db.settings.clear()
  d1 = await createFakeD1()
  env = {
    DB: d1,
    ASSETS: recordingAssets(new Response('asset')).assets,
    DEV_USER_EMAIL: EMAIL,
  }
  sentVersions = []
  await db.settings.put({ key: 'accountEmail', value: EMAIL })
})

function routedFetch(): typeof fetch {
  const worker = createHandler()
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(`https://workout.example.com${String(input)}`, init)
    sentVersions.push(request.headers.get(VERSION_HEADER))
    return worker.fetch(request, env)
  }) as typeof fetch
}

function fullSession(): Session {
  return {
    id: 'full-1',
    programId: 'assaf-ab-2026',
    workoutId: 'A',
    startedAt: T0,
    finishedAt: T0 + 3_600_000,
    entries: [
      { exerciseId: 'squat', setIndex: 0, weightKg: 100, reps: 5, loggedAt: T0 + 1_000, kind: 'warmup', rir: 2, restSeconds: 120 },
      { exerciseId: 'pullup', setIndex: 0, weightKg: null, reps: 8, loggedAt: T0 + 2_000, loadKg: -10 },
    ],
    swaps: { squat: 'front-squat' },
    note: 'felt strong',
    deload: true,
    deletedAt: T0 + 4_000_000,
    updatedAt: T0 + 5_000_000,
  }
}

async function countRows(table: 'sessions' | 'settings'): Promise<number> {
  const row = await d1.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first<{ n: number }>()
  return row?.n ?? -1
}

test('O11 a Session with every optional field and every synced setting sync ok at version 2 and come back whole from since 0', async () => {
  const session = fullSession()
  await db.sessions.put(session)
  const settingRows = syncedSettingKeys().map((key, i) => ({
    key,
    value: { marker: key },
    updatedAt: T0 + 100 + i,
  }))
  await db.settings.bulkPut(settingRows)

  const fetchRouted = routedFetch()
  const result = await createSyncClient({ fetch: fetchRouted, now: () => T0 + 6_000_000 }).syncNow()

  expect(result.status).toBe('ok')
  expect(sentVersions.length).toBeGreaterThan(0)
  expect(sentVersions.every((v) => v === '2')).toBe(true)

  const response = await fetchRouted('/api/sync', {
    method: 'POST',
    headers: { [VERSION_HEADER]: '2' },
    body: JSON.stringify({ since: 0, sessions: [], settings: [] }),
  })
  expect(response.status).toBe(200)
  const body = (await response.json()) as SyncResponse
  expect(body.sessions).toEqual([session])
  expect([...body.settings].sort((a, b) => a.key.localeCompare(b.key))).toEqual(
    [...settingRows].sort((a, b) => a.key.localeCompare(b.key)),
  )
})

test('O11 a client at contract version 3 resolves update-required and D1 stays empty', async () => {
  await db.sessions.put(fullSession())
  await db.settings.put({ key: syncedSettingKeys()[0], value: { marker: 1 }, updatedAt: T0 + 100 })

  const result = await createSyncClient({ fetch: routedFetch(), contractVersion: 3, now: () => T0 }).syncNow()

  expect(result).toEqual({ status: 'update-required' })
  expect(sentVersions.every((v) => v === '3')).toBe(true)
  expect(await countRows('sessions')).toBe(0)
  expect(await countRows('settings')).toBe(0)
})
