import Dexie from 'dexie'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { db } from './db'
import type { Session } from '../types'

// `fake-indexeddb/auto` is installed globally in src/test/setup.ts; see sessionStore.test.ts.
//
// These tests prove the version(2) upgrade on a genuine version-1 database: every test drops
// the app's database, recreates it with the schema this app shipped before E7 (Dexie version
// 1, sessions without `updatedAt`), and only then lets the app's `db` open it.

const DATABASE_NAME = 'workout-tracker'
const BASE = 1_700_000_000_000
const HOUR = 60 * 60 * 1_000

beforeEach(async () => {
  db.close()
  await Dexie.delete(DATABASE_NAME)
})

afterEach(() => {
  db.close()
})

/** A session exactly as a pre-E7 build stored it: no `updatedAt`. */
function legacySession(over: Partial<Session> & { id: string }): Session {
  return {
    programId: 'assaf-ab-2026',
    workoutId: 'workout-a',
    startedAt: BASE,
    finishedAt: BASE + HOUR,
    entries: [],
    ...over,
  }
}

/** Creates the database with the pre-E7 schema, stores `sessions`, closes it. */
async function seedVersion1(sessions: Session[]): Promise<void> {
  const legacy = new Dexie(DATABASE_NAME)
  legacy.version(1).stores({
    sessions: 'id, startedAt, finishedAt',
    settings: 'key',
  })
  await legacy.open()
  await legacy.table('sessions').bulkPut(sessions)
  legacy.close()
}

test('O8 opening a version-1 database stamps a finished session with updatedAt equal to its finishedAt', async () => {
  await seedVersion1([legacySession({ id: 'finished', startedAt: BASE, finishedAt: BASE + HOUR })])

  await db.open()

  expect((await db.sessions.get('finished'))?.updatedAt).toBe(BASE + HOUR)
})

test('O8 opening a version-1 database stamps an unfinished session with updatedAt equal to its startedAt', async () => {
  await seedVersion1([legacySession({ id: 'in-progress', startedAt: BASE, finishedAt: null })])

  await db.open()

  expect((await db.sessions.get('in-progress'))?.updatedAt).toBe(BASE)
})

test('O8 opening a version-1 database loses no session and changes nothing but updatedAt', async () => {
  const finished = legacySession({
    id: 'finished',
    startedAt: BASE,
    finishedAt: BASE + HOUR,
    entries: [
      { exerciseId: 'back-squat', setIndex: 0, weightKg: 60, reps: 8, loggedAt: BASE + 60_000 },
    ],
    swaps: { 'back-squat': 'leg-press' },
  })
  const older = legacySession({
    id: 'older',
    startedAt: BASE - 24 * HOUR,
    finishedAt: BASE - 23 * HOUR,
  })
  const inProgress = legacySession({ id: 'in-progress', startedAt: BASE + 2 * HOUR, finishedAt: null })
  await seedVersion1([finished, older, inProgress])

  await db.open()

  expect(await db.sessions.count()).toBe(3)
  expect(await db.sessions.get('finished')).toEqual({ ...finished, updatedAt: BASE + HOUR })
  expect(await db.sessions.get('older')).toEqual({ ...older, updatedAt: BASE - 23 * HOUR })
  expect(await db.sessions.get('in-progress')).toEqual({ ...inProgress, updatedAt: BASE + 2 * HOUR })
})

test('O8 after the upgrade, sessions can be queried by updatedAt', async () => {
  await seedVersion1([
    legacySession({ id: 'old', startedAt: BASE, finishedAt: BASE + HOUR }),
    legacySession({ id: 'new', startedAt: BASE + 48 * HOUR, finishedAt: BASE + 49 * HOUR }),
  ])

  await db.open()

  const changed = await db.sessions.where('updatedAt').above(BASE + 24 * HOUR).toArray()
  expect(changed.map((session) => session.id)).toEqual(['new'])
})

test('O8 a fresh database, created by this build, can be queried by updatedAt', async () => {
  await db.open()
  await db.sessions.put({ ...legacySession({ id: 'stamped' }), updatedAt: BASE + HOUR })

  const changed = await db.sessions.where('updatedAt').above(BASE).toArray()
  expect(changed.map((session) => session.id)).toEqual(['stamped'])
})
