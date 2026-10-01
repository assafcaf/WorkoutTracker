import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { db, isStorageAvailable } from './db'
import {
  allSessions,
  clearSwap,
  discardSession,
  finishSession,
  finishStaleSession,
  getActiveSession,
  getLastEntriesFor,
  getLastSwap,
  isLive,
  listSessions,
  logSet,
  deleteSet,
  restoreSet,
  updateSet,
  setRest,
  putSessions,
  replaceAllSessions,
  saveSession,
  sessionsChangedSince,
  setSwap,
  startOrResumeSession,
} from './sessionStore'
import { inTransaction } from './transaction'
import type { Session, SetEntry } from '../types'

// `fake-indexeddb/auto` is installed globally in src/test/setup.ts, because Dexie binds the
// global `indexedDB` when db.ts is evaluated. Do not import it here.
//
// The fake database outlives a test, so every test starts from an empty `sessions` table.
// Four later tasks read this store; copy this beforeEach rather than relying on test order.
beforeEach(async () => {
  await db.open()
  await db.sessions.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const SECOND = 1_000
const DAY = 24 * 60 * 60 * SECOND
// A fixed wall-clock base, so every timestamp below is a literal derived by hand.
const BASE = 1_700_000_000_000

function entry(
  exerciseId: string,
  setIndex: number,
  weightKg: number | null,
  reps: number,
  loggedAt: number,
): SetEntry {
  return { exerciseId, setIndex, weightKg, reps, loggedAt }
}

/** A stored session. Finished by default; pass `finishedAt: null` for one in progress. */
function storedSession(over: Partial<Session> & { id: string }): Session {
  return {
    programId: 'assaf-ab-2026',
    workoutId: 'workout-a',
    startedAt: BASE,
    finishedAt: BASE + 3600 * SECOND,
    entries: [],
    ...over,
  }
}

/**
 * `count` finished sessions, one per day, newest first: index 0 is the most recent. Sessions
 * never overlap here, so `startedAt` and `finishedAt` put them in the same order. Every
 * session carries a filler entry; `entriesByIndex` replaces the entries of the given index.
 */
function history(count: number, entriesByIndex: Map<number, SetEntry[]> = new Map()): Session[] {
  return Array.from({ length: count }, (_unused, index) => {
    const startedAt = BASE - index * DAY
    return storedSession({
      id: `session-${index}`,
      startedAt,
      finishedAt: startedAt + 3600 * SECOND,
      entries: entriesByIndex.get(index) ?? [entry('lunges', 0, 20, 10, startedAt + 60 * SECOND)],
    })
  })
}

// --- startOrResumeSession / getActiveSession ----------------------------------------------

test('O3 choosing a workout with nothing in progress persists one session for that workout', async () => {
  const session = await startOrResumeSession('assaf-ab-2026', 'workout-a', BASE)

  expect(session.programId).toBe('assaf-ab-2026')
  expect(session.workoutId).toBe('workout-a')
  expect(session.startedAt).toBe(BASE)
  expect(session.finishedAt).toBeNull()
  expect(session.entries).toEqual([])
  expect(typeof session.id).toBe('string')
  expect(session.id.length).toBeGreaterThan(0)
})

test('O3 the session a workout starts is stored, not only returned', async () => {
  const session = await startOrResumeSession('assaf-ab-2026', 'workout-a', BASE)

  expect(await db.sessions.count()).toBe(1)
  expect(await db.sessions.get(session.id)).toEqual(session)
})

test('O3 choosing the same workout again resumes the session instead of starting a second', async () => {
  const first = await startOrResumeSession('assaf-ab-2026', 'workout-a', BASE)

  const second = await startOrResumeSession('assaf-ab-2026', 'workout-a', BASE + 60 * SECOND)

  expect(second.id).toBe(first.id)
  expect(second.startedAt).toBe(BASE)
  expect(await db.sessions.count()).toBe(1)
})

test('O3 choosing a different workout resumes the session in progress rather than starting a second', async () => {
  const first = await startOrResumeSession('assaf-ab-2026', 'workout-a', BASE)

  const second = await startOrResumeSession('full-body-starter', 'full-body', BASE + 60 * SECOND)

  expect(second.id).toBe(first.id)
  expect(second.programId).toBe('assaf-ab-2026')
  expect(second.workoutId).toBe('workout-a')
  expect(await db.sessions.count()).toBe(1)
})

test('O3 a session left in the database by an earlier visit is resumed after a reload', async () => {
  const logged = entry('back-squat', 0, 60, 8, BASE + 120 * SECOND)
  await db.sessions.put(
    storedSession({ id: 'left-behind', startedAt: BASE, finishedAt: null, entries: [logged] }),
  )
  // A reload: drop the open connection, and with it every bit of in-memory state.
  db.close()
  await db.open()

  // Within E8-T6's 4 h of the last Set, so the Session is still resumable, not stale.
  const resumed = await startOrResumeSession('assaf-ab-2026', 'workout-a', BASE + 3600 * SECOND)

  expect(resumed.id).toBe('left-behind')
  expect(resumed.startedAt).toBe(BASE)
  expect(resumed.entries).toEqual([logged])
  expect(await db.sessions.count()).toBe(1)
})

test('O3 getActiveSession returns null when nothing has been started', async () => {
  expect(await getActiveSession()).toBeNull()
})

test('O3 getActiveSession returns the session in progress', async () => {
  const started = await startOrResumeSession('assaf-ab-2026', 'workout-b', BASE)

  expect(await getActiveSession()).toEqual(started)
})

test('O3 getActiveSession ignores finished sessions', async () => {
  await db.sessions.bulkPut(history(3))

  expect(await getActiveSession()).toBeNull()
})

test('O3 getActiveSession returns null once the session is finished', async () => {
  const started = await startOrResumeSession('assaf-ab-2026', 'workout-a', BASE)
  await finishSession(started.id, BASE + 3600 * SECOND)

  expect(await getActiveSession()).toBeNull()
})

test('O3 choosing a workout after finishing the previous session starts a new one', async () => {
  const first = await startOrResumeSession('assaf-ab-2026', 'workout-a', BASE)
  await finishSession(first.id, BASE + 3600 * SECOND)

  const second = await startOrResumeSession('assaf-ab-2026', 'workout-b', BASE + DAY)

  expect(second.id).not.toBe(first.id)
  expect(second.workoutId).toBe('workout-b')
  expect(second.startedAt).toBe(BASE + DAY)
  expect(second.finishedAt).toBeNull()
  expect(await db.sessions.count()).toBe(2)
})

// --- logSet -------------------------------------------------------------------------------

test('O3 logSet stores the entry on the session', async () => {
  const started = await startOrResumeSession('assaf-ab-2026', 'workout-a', BASE)
  const first = entry('back-squat', 0, 60, 8, BASE + 120 * SECOND)

  const updated = await logSet(started.id, first)

  expect(updated.entries).toEqual([first])
  expect((await db.sessions.get(started.id))?.entries).toEqual([first])
})

test('O3 logSet replaces the entry with the same exercise and set index instead of appending', async () => {
  const started = await startOrResumeSession('assaf-ab-2026', 'workout-a', BASE)
  await logSet(started.id, entry('back-squat', 0, 60, 8, BASE + 120 * SECOND))

  const corrected = entry('back-squat', 0, 62.5, 10, BASE + 200 * SECOND)
  const updated = await logSet(started.id, corrected)

  expect(updated.entries).toEqual([corrected])
  expect((await db.sessions.get(started.id))?.entries).toEqual([corrected])
})

test('O3 logSet keeps entries for the same exercise at different set indexes', async () => {
  const started = await startOrResumeSession('assaf-ab-2026', 'workout-a', BASE)
  const setOne = entry('back-squat', 0, 60, 8, BASE + 120 * SECOND)
  const setTwo = entry('back-squat', 1, 60, 8, BASE + 300 * SECOND)

  await logSet(started.id, setOne)
  const updated = await logSet(started.id, setTwo)

  expect(updated.entries).toEqual([setOne, setTwo])
})

test('O3 logSet keeps entries for other exercises at the same set index', async () => {
  const started = await startOrResumeSession('assaf-ab-2026', 'workout-a', BASE)
  const squat = entry('back-squat', 0, 60, 8, BASE + 120 * SECOND)
  const lunges = entry('lunges', 0, 20, 10, BASE + 400 * SECOND)

  await logSet(started.id, squat)
  const updated = await logSet(started.id, lunges)

  expect(updated.entries).toEqual([squat, lunges])
})

test('O3 logSet writes the whole session document, leaving no field half written', async () => {
  const started = await startOrResumeSession('assaf-ab-2026', 'workout-a', BASE)

  const updated = await logSet(started.id, entry('back-squat', 0, 60, 8, BASE + 120 * SECOND))

  expect(await db.sessions.get(started.id)).toEqual(updated)
  expect(updated.id).toBe(started.id)
  expect(updated.programId).toBe('assaf-ab-2026')
  expect(updated.workoutId).toBe('workout-a')
  expect(updated.startedAt).toBe(BASE)
  expect(updated.finishedAt).toBeNull()
})

test('O3 logSet stores a bodyweight set with no weight', async () => {
  const started = await startOrResumeSession('assaf-ab-2026', 'workout-a', BASE)
  const pushUps = entry('push-ups', 0, null, 15, BASE + 600 * SECOND)

  const updated = await logSet(started.id, pushUps)

  expect(updated.entries).toEqual([pushUps])
  expect((await db.sessions.get(started.id))?.entries[0].weightKg).toBeNull()
})

test('O3 logSet rejects for a session id that does not exist rather than dropping the set', async () => {
  await expect(
    logSet('no-such-session', entry('back-squat', 0, 60, 8, BASE)),
  ).rejects.toThrow(/no-such-session/)

  expect(await db.sessions.count()).toBe(0)
})

// --- finishSession ------------------------------------------------------------------------

test('O3 finishSession stamps the session with the time it ended', async () => {
  const started = await startOrResumeSession('assaf-ab-2026', 'workout-a', BASE)
  const logged = entry('back-squat', 0, 60, 8, BASE + 120 * SECOND)
  await logSet(started.id, logged)

  const finished = await finishSession(started.id, BASE + 3600 * SECOND)

  expect(finished.finishedAt).toBe(BASE + 3600 * SECOND)
  expect(finished.startedAt).toBe(BASE)
  expect(finished.entries).toEqual([logged])
  expect(await db.sessions.get(started.id)).toEqual(finished)
})

test('O3 finishSession rejects for a session id that does not exist', async () => {
  await expect(finishSession('no-such-session', BASE)).rejects.toThrow(/no-such-session/)
})

// --- listSessions -------------------------------------------------------------------------

test('O3 listSessions returns an empty list when nothing has been finished', async () => {
  expect(await listSessions()).toEqual([])
})

test('O3 listSessions returns finished sessions newest first', async () => {
  const [newest, middle, oldest] = history(3)
  await db.sessions.bulkPut([middle, oldest, newest])

  const listed = await listSessions()

  expect(listed.map((session) => session.id)).toEqual([newest.id, middle.id, oldest.id])
  expect(listed[0]).toEqual(newest)
})

test('O3 listSessions omits the session still in progress', async () => {
  const [newest, middle] = history(2)
  await db.sessions.bulkPut([newest, middle])
  await db.sessions.put(
    storedSession({ id: 'in-progress', startedAt: BASE + DAY, finishedAt: null }),
  )

  const listed = await listSessions()

  expect(listed.map((session) => session.id)).toEqual([newest.id, middle.id])
})

test('O3 listSessions returns sessions from every program', async () => {
  const [newest, older] = history(2)
  await db.sessions.bulkPut([
    { ...newest, programId: 'full-body-starter', workoutId: 'full-body' },
    older,
  ])

  const listed = await listSessions()

  expect(listed.map((session) => session.programId)).toEqual([
    'full-body-starter',
    'assaf-ab-2026',
  ])
})

// --- setSwap / clearSwap / getLastSwap (E5-T11) -------------------------------------------

test('S16 setSwap records the swap on the session, keyed by the planned exercise id', async () => {
  const started = await startOrResumeSession('assaf-ab-2026', 'workout-a', BASE)

  await setSwap(started.id, 'back-squat', 'leg-press')

  const stored = await db.sessions.get(started.id)
  expect(stored?.swaps).toEqual({ 'back-squat': 'leg-press' })
})

test('S16 a swap survives closing and reopening the database', async () => {
  const started = await startOrResumeSession('assaf-ab-2026', 'workout-a', BASE)
  await setSwap(started.id, 'back-squat', 'leg-press')

  db.close()
  await db.open()

  const stored = await db.sessions.get(started.id)
  expect(stored?.swaps).toEqual({ 'back-squat': 'leg-press' })
})

test('S16 setSwap keeps swaps for other planned exercises on the same session', async () => {
  const started = await startOrResumeSession('assaf-ab-2026', 'workout-a', BASE)
  await setSwap(started.id, 'back-squat', 'leg-press')

  await setSwap(started.id, 'lunges', 'step-ups')

  const stored = await db.sessions.get(started.id)
  expect(stored?.swaps).toEqual({ 'back-squat': 'leg-press', lunges: 'step-ups' })
})

test('S16 clearSwap removes the entry for the planned exercise', async () => {
  const started = await startOrResumeSession('assaf-ab-2026', 'workout-a', BASE)
  await setSwap(started.id, 'back-squat', 'leg-press')

  await clearSwap(started.id, 'back-squat')

  const stored = await db.sessions.get(started.id)
  expect(stored?.swaps?.['back-squat']).toBeUndefined()
})

test('S16 clearSwap rejects when the session already has a logged entry for the done id', async () => {
  const started = await startOrResumeSession('assaf-ab-2026', 'workout-a', BASE)
  await setSwap(started.id, 'back-squat', 'leg-press')
  await logSet(started.id, entry('leg-press', 0, 40, 10, BASE + 120 * SECOND))

  await expect(clearSwap(started.id, 'back-squat')).rejects.toThrow(/leg-press/)

  const stored = await db.sessions.get(started.id)
  expect(stored?.swaps).toEqual({ 'back-squat': 'leg-press' })
})

test('S16 getLastSwap returns null when no finished session of that workout has a swap for the planned id', async () => {
  await db.sessions.bulkPut(history(3))

  expect(await getLastSwap('assaf-ab-2026', 'workout-a', 'back-squat')).toBeNull()
})

test('S16 getLastSwap returns the swap from the most recent finished session of that workout', async () => {
  const older = storedSession({
    id: 'older',
    startedAt: BASE - DAY,
    finishedAt: BASE - DAY + 3600 * SECOND,
    swaps: { 'back-squat': 'hack-squat' },
  })
  const newest = storedSession({
    id: 'newest',
    startedAt: BASE,
    finishedAt: BASE + 3600 * SECOND,
    swaps: { 'back-squat': 'leg-press' },
  })
  await db.sessions.bulkPut([older, newest])

  expect(await getLastSwap('assaf-ab-2026', 'workout-a', 'back-squat')).toBe('leg-press')
})

test('S16 getLastSwap ignores the session still in progress', async () => {
  const finished = storedSession({
    id: 'finished',
    startedAt: BASE - DAY,
    finishedAt: BASE - DAY + 3600 * SECOND,
    swaps: { 'back-squat': 'hack-squat' },
  })
  await db.sessions.bulkPut([finished])
  await db.sessions.put(
    storedSession({
      id: 'in-progress',
      startedAt: BASE,
      finishedAt: null,
      swaps: { 'back-squat': 'leg-press' },
    }),
  )

  expect(await getLastSwap('assaf-ab-2026', 'workout-a', 'back-squat')).toBe('hack-squat')
})

test('S16 getLastSwap only considers sessions of the given program and workout', async () => {
  const otherWorkout = storedSession({
    id: 'other-workout',
    workoutId: 'workout-b',
    startedAt: BASE,
    finishedAt: BASE + 3600 * SECOND,
    swaps: { 'back-squat': 'leg-press' },
  })
  await db.sessions.bulkPut([otherWorkout])

  expect(await getLastSwap('assaf-ab-2026', 'workout-a', 'back-squat')).toBeNull()
})

// --- getLastEntriesFor --------------------------------------------------------------------

test('O3 getLastEntriesFor returns an empty list when the exercise was never logged', async () => {
  await db.sessions.bulkPut(history(3))

  expect(await getLastEntriesFor('back-squat')).toEqual([])
})

test('O3 getLastEntriesFor returns an empty list when nothing has been logged at all', async () => {
  expect(await getLastEntriesFor('back-squat')).toEqual([])
})

test('O3 getLastEntriesFor returns the entries of the most recent session containing the exercise', async () => {
  const recent = [
    entry('back-squat', 0, 62.5, 8, BASE - DAY + 120 * SECOND),
    entry('back-squat', 1, 62.5, 8, BASE - DAY + 300 * SECOND),
  ]
  const older = [entry('back-squat', 0, 60, 8, BASE - 3 * DAY + 120 * SECOND)]
  await db.sessions.bulkPut(history(4, new Map([[1, recent], [3, older]])))

  expect(await getLastEntriesFor('back-squat')).toEqual(recent)
})

test('O3 getLastEntriesFor stops at the first session containing the exercise instead of merging older ones', async () => {
  const recent = [entry('back-squat', 0, 62.5, 8, BASE - DAY + 120 * SECOND)]
  const older = [
    entry('back-squat', 0, 60, 8, BASE - 3 * DAY + 120 * SECOND),
    entry('back-squat', 1, 60, 8, BASE - 3 * DAY + 300 * SECOND),
    entry('back-squat', 2, 60, 7, BASE - 3 * DAY + 480 * SECOND),
  ]
  await db.sessions.bulkPut(history(4, new Map([[1, recent], [3, older]])))

  expect(await getLastEntriesFor('back-squat')).toEqual(recent)
})

test('O3 getLastEntriesFor returns the entries for the requested exercise only', async () => {
  const squat = entry('back-squat', 0, 60, 8, BASE + 120 * SECOND)
  const lunges = entry('lunges', 0, 20, 10, BASE + 400 * SECOND)
  await db.sessions.bulkPut(history(1, new Map([[0, [lunges, squat]]])))

  expect(await getLastEntriesFor('back-squat')).toEqual([squat])
})

test('O3 getLastEntriesFor returns the entries in set index order', async () => {
  const shuffled = [
    entry('back-squat', 2, 60, 7, BASE + 480 * SECOND),
    entry('back-squat', 0, 60, 8, BASE + 120 * SECOND),
    entry('back-squat', 1, 60, 8, BASE + 300 * SECOND),
  ]
  await db.sessions.bulkPut(history(1, new Map([[0, shuffled]])))

  const entries = await getLastEntriesFor('back-squat')

  expect(entries.map((item) => item.setIndex)).toEqual([0, 1, 2])
  expect(entries).toEqual([shuffled[1], shuffled[2], shuffled[0]])
})

test('O3 getLastEntriesFor finds a session recorded under a different program', async () => {
  const underAssaf = [entry('back-squat', 0, 60, 8, BASE - DAY + 120 * SECOND)]
  const sessions = history(2, new Map([[1, underAssaf]]))
  // The newest session is a full-body-starter one that never touched the squat; the squat was
  // last done under assaf-ab-2026. Looking it up must cross the program boundary.
  await db.sessions.bulkPut([
    { ...sessions[0], programId: 'full-body-starter', workoutId: 'full-body' },
    sessions[1],
  ])

  expect(await getLastEntriesFor('back-squat')).toEqual(underAssaf)
})

test('O3 getLastEntriesFor ignores the session still in progress', async () => {
  const finished = [entry('back-squat', 0, 60, 8, BASE - DAY + 120 * SECOND)]
  await db.sessions.bulkPut(history(2, new Map([[1, finished]])))
  await db.sessions.put(
    storedSession({
      id: 'in-progress',
      startedAt: BASE + DAY,
      finishedAt: null,
      entries: [entry('back-squat', 0, 65, 5, BASE + DAY + 120 * SECOND)],
    }),
  )

  expect(await getLastEntriesFor('back-squat')).toEqual(finished)
})

test('O3 getLastEntriesFor ignores a session older than the two hundredth most recent', async () => {
  const tooOld = [entry('back-squat', 0, 60, 8, BASE - 200 * DAY + 120 * SECOND)]
  // 201 sessions; only the very oldest holds the squat, so it falls outside the 200 scanned.
  await db.sessions.bulkPut(history(201, new Map([[200, tooOld]])))

  expect(await getLastEntriesFor('back-squat')).toEqual([])
})

test('O3 getLastEntriesFor still reaches the two hundredth most recent session', async () => {
  const justInside = [entry('back-squat', 0, 60, 8, BASE - 199 * DAY + 120 * SECOND)]
  // 201 sessions; the squat is in the 200th most recent, the last one still scanned.
  await db.sessions.bulkPut(history(201, new Map([[199, justInside]])))

  expect(await getLastEntriesFor('back-squat')).toEqual(justInside)
})

// --- isStorageAvailable, the boundary O19's banner hangs on -------------------------------

type OpenFailure = 'throws' | 'errors'

/**
 * Replaces `globalThis.indexedDB` with a factory that cannot open a database: `throws` is
 * Safari with storage blocked, `errors` is Firefox private browsing, where the open request
 * fails asynchronously. Dexie bound the working fake factory when db.ts was evaluated, so
 * only a check that reads the global at call time sees this.
 */
function stubUnavailableIndexedDB(failure: OpenFailure): void {
  const factory = {
    open(): IDBOpenDBRequest {
      if (failure === 'throws') {
        throw new DOMException('IndexedDB is disabled in this context', 'SecurityError')
      }
      const listeners: Array<(event: Event) => void> = []
      const request = {
        result: undefined,
        error: new DOMException('internal error opening backing store', 'UnknownError'),
        readyState: 'pending' as IDBRequestReadyState,
        source: null,
        transaction: null,
        onsuccess: null as ((event: Event) => void) | null,
        onerror: null as ((event: Event) => void) | null,
        onupgradeneeded: null,
        onblocked: null,
        addEventListener(type: string, handler: (event: Event) => void) {
          if (type === 'error') listeners.push(handler)
        },
        removeEventListener(type: string, handler: (event: Event) => void) {
          const at = listeners.indexOf(handler)
          if (type === 'error' && at >= 0) listeners.splice(at, 1)
        },
        dispatchEvent: () => true,
      }
      setTimeout(() => {
        request.readyState = 'done'
        const event = new Event('error')
        Object.defineProperty(event, 'target', { value: request })
        request.onerror?.(event)
        for (const handler of [...listeners]) handler(event)
      }, 0)
      return request as unknown as IDBOpenDBRequest
    },
    deleteDatabase(): IDBOpenDBRequest {
      throw new DOMException('IndexedDB is disabled in this context', 'SecurityError')
    },
    cmp: () => 0,
    databases: async () => [],
  }
  vi.stubGlobal('indexedDB', factory as unknown as IDBFactory)
}

test('O19 isStorageAvailable is true when IndexedDB works', async () => {
  expect(await isStorageAvailable()).toBe(true)
})

test('O19 isStorageAvailable is false when the browser exposes no IndexedDB', async () => {
  vi.stubGlobal('indexedDB', undefined)

  expect(await isStorageAvailable()).toBe(false)
})

test('O19 isStorageAvailable is false when opening a database throws', async () => {
  stubUnavailableIndexedDB('throws')

  expect(await isStorageAvailable()).toBe(false)
})

test('O19 isStorageAvailable is false when the open request fails', async () => {
  stubUnavailableIndexedDB('errors')

  expect(await isStorageAvailable()).toBe(false)
})

test('O19 isStorageAvailable leaves the stored sessions alone', async () => {
  const stored = history(2)
  await db.sessions.bulkPut(stored)

  await isStorageAvailable()

  expect(await db.sessions.count()).toBe(2)
  expect(await db.sessions.get(stored[0].id)).toEqual(stored[0])
})

// --- updatedAt on every write (E7-T2) --------------------------------------------------------

describe('O8 every session write stamps updatedAt', () => {
  // The device clock, pinned so the stamp a write should carry is a literal. It is far from
  // BASE on purpose: a write that takes a `now` must stamp that, not the clock.
  const CLOCK = BASE + 10 * DAY

  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(CLOCK)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('O8 a session startOrResumeSession creates is stored with updatedAt equal to its now', async () => {
    const session = await startOrResumeSession('assaf-ab-2026', 'workout-a', BASE)

    expect((await db.sessions.get(session.id))?.updatedAt).toBe(BASE)
  })

  test('O8 logSet stores the session with updatedAt equal to the time of the write', async () => {
    await db.sessions.put(storedSession({ id: 'in-progress', finishedAt: null, updatedAt: BASE }))

    await logSet('in-progress', entry('back-squat', 0, 60, 8, BASE + 120 * SECOND))

    expect((await db.sessions.get('in-progress'))?.updatedAt).toBe(CLOCK)
  })

  test('O8 logSet stamps updatedAt on a session stored before this epic without one', async () => {
    await db.sessions.put(storedSession({ id: 'legacy', finishedAt: null }))

    await logSet('legacy', entry('back-squat', 0, 60, 8, BASE + 120 * SECOND))

    expect((await db.sessions.get('legacy'))?.updatedAt).toBe(CLOCK)
  })

  test('O8 finishSession stores the session with updatedAt equal to its now', async () => {
    await db.sessions.put(storedSession({ id: 'in-progress', finishedAt: null, updatedAt: BASE }))

    await finishSession('in-progress', BASE + 3600 * SECOND)

    expect((await db.sessions.get('in-progress'))?.updatedAt).toBe(BASE + 3600 * SECOND)
  })

  test('O8 setSwap stores the session with updatedAt equal to the time of the write', async () => {
    await db.sessions.put(storedSession({ id: 'in-progress', finishedAt: null, updatedAt: BASE }))

    await setSwap('in-progress', 'back-squat', 'leg-press')

    expect((await db.sessions.get('in-progress'))?.updatedAt).toBe(CLOCK)
  })

  test('O8 clearSwap stores the session with updatedAt equal to the time of the write', async () => {
    await db.sessions.put(
      storedSession({
        id: 'in-progress',
        finishedAt: null,
        updatedAt: BASE,
        swaps: { 'back-squat': 'leg-press' },
      }),
    )

    await clearSwap('in-progress', 'back-squat')

    expect((await db.sessions.get('in-progress'))?.updatedAt).toBe(CLOCK)
  })
})

// --- a forgotten Session finishes itself (E8-T6) ---------------------------------------------

describe('E8-T6 a Session left in progress for 4 hours finishes itself', () => {
  const HOUR = 60 * 60 * SECOND
  const FOUR_HOURS = 4 * HOUR

  // The latest Set is logged at LAST_SET; it is deliberately not the last one in `entries`,
  // so "last activity" has to be the latest `loggedAt`, not the last entry stored.
  const STARTED = BASE
  const LAST_SET = BASE + 50 * 60 * SECOND
  const staleEntries: SetEntry[] = [
    entry('back-squat', 1, 40, 10, BASE + 10 * 60 * SECOND),
    entry('back-squat', 2, 50, 10, LAST_SET),
    entry('lunges', 1, 20, 10, BASE + 30 * 60 * SECOND),
  ]

  function inProgressWithSets(): Session {
    return storedSession({
      id: 'forgotten',
      startedAt: STARTED,
      finishedAt: null,
      entries: staleEntries,
      updatedAt: LAST_SET,
    })
  }

  function inProgressEmpty(): Session {
    return storedSession({
      id: 'forgotten-empty',
      startedAt: STARTED,
      finishedAt: null,
      entries: [],
      updatedAt: STARTED,
    })
  }

  // --- O1 ---

  test('O1 startOrResumeSession 4 h after the latest Set stores the old Session finished at that Set', async () => {
    await db.sessions.put(inProgressWithSets())

    await startOrResumeSession('assaf-ab-2026', 'workout-b', LAST_SET + FOUR_HOURS)

    expect(await db.sessions.get('forgotten')).toEqual({
      ...inProgressWithSets(),
      finishedAt: LAST_SET,
      updatedAt: LAST_SET + FOUR_HOURS,
    })
  })

  test('O1 startOrResumeSession 4 h after the latest Set returns a new Session for the requested Workout', async () => {
    await db.sessions.put(inProgressWithSets())
    const now = LAST_SET + FOUR_HOURS

    const session = await startOrResumeSession('full-body-starter', 'full-body', now)

    expect(session.id).not.toBe('forgotten')
    expect(session.programId).toBe('full-body-starter')
    expect(session.workoutId).toBe('full-body')
    expect(session.startedAt).toBe(now)
    expect(session.finishedAt).toBeNull()
    expect(session.entries).toEqual([])
    expect(await db.sessions.count()).toBe(2)
    expect(await getActiveSession()).toEqual(session)
  })

  test('O1 the finished forgotten Session is in history and presets its lifts', async () => {
    await db.sessions.put(inProgressWithSets())

    await startOrResumeSession('assaf-ab-2026', 'workout-a', LAST_SET + 5 * HOUR)

    expect((await listSessions()).map((session) => session.id)).toEqual(['forgotten'])
    expect(await getLastEntriesFor('back-squat')).toEqual([
      entry('back-squat', 1, 40, 10, BASE + 10 * 60 * SECOND),
      entry('back-squat', 2, 50, 10, LAST_SET),
    ])
  })

  test('O1 startOrResumeSession 1 ms short of 4 h after the latest Set resumes the Session unchanged', async () => {
    await db.sessions.put(inProgressWithSets())

    const resumed = await startOrResumeSession(
      'assaf-ab-2026',
      'workout-b',
      LAST_SET + FOUR_HOURS - 1,
    )

    expect(resumed).toEqual(inProgressWithSets())
    expect(await db.sessions.get('forgotten')).toEqual(inProgressWithSets())
    expect(await db.sessions.count()).toBe(1)
  })

  test('O1 a Session started over 4 h ago whose latest Set is recent is resumed, not finished', async () => {
    // Started 4 h 50 min before now, but its latest Set was logged 1 h before now.
    await db.sessions.put(inProgressWithSets())

    const resumed = await startOrResumeSession('assaf-ab-2026', 'workout-a', LAST_SET + HOUR)

    expect(resumed.id).toBe('forgotten')
    expect((await db.sessions.get('forgotten'))?.finishedAt).toBeNull()
  })

  test('O1 finishStaleSession stores a stale Session finished at its latest Set with updatedAt now', async () => {
    await db.sessions.put(inProgressWithSets())

    await finishStaleSession(LAST_SET + 6 * HOUR)

    expect(await db.sessions.get('forgotten')).toEqual({
      ...inProgressWithSets(),
      finishedAt: LAST_SET,
      updatedAt: LAST_SET + 6 * HOUR,
    })
    expect(await getActiveSession()).toBeNull()
  })

  test('O1 finishStaleSession leaves a Session 1 ms short of stale untouched', async () => {
    await db.sessions.put(inProgressWithSets())

    await finishStaleSession(LAST_SET + FOUR_HOURS - 1)

    expect(await db.sessions.get('forgotten')).toEqual(inProgressWithSets())
  })

  test('O1 finishStaleSession with nothing in progress leaves finished Sessions as they are', async () => {
    const stored = history(2)
    await db.sessions.bulkPut(stored)

    await finishStaleSession(BASE + 30 * DAY)

    expect(await db.sessions.count()).toBe(2)
    expect(await db.sessions.get('session-0')).toEqual(stored[0])
    expect(await db.sessions.get('session-1')).toEqual(stored[1])
  })

  test('O1 finishStaleSession on an empty database stores nothing', async () => {
    await finishStaleSession(BASE)

    expect(await db.sessions.count()).toBe(0)
  })

  // --- O2 ---

  test('O2 startOrResumeSession 4 h after an empty Session started deletes it rather than finishing it', async () => {
    await db.sessions.put(inProgressEmpty())

    await startOrResumeSession('assaf-ab-2026', 'workout-a', STARTED + FOUR_HOURS)

    // E12-T1 O5: "deletes" is now a mark, so sync can carry it; it is never finished.
    expect(await db.sessions.get('forgotten-empty')).toEqual({
      ...inProgressEmpty(),
      deletedAt: STARTED + FOUR_HOURS,
      updatedAt: STARTED + FOUR_HOURS,
    })
    expect(await listSessions()).toEqual([])
  })

  test('O2 startOrResumeSession 4 h after an empty Session started returns a new Session for the requested Workout', async () => {
    await db.sessions.put(inProgressEmpty())
    const now = STARTED + FOUR_HOURS

    const session = await startOrResumeSession('assaf-ab-2026', 'workout-b', now)

    expect(session.id).not.toBe('forgotten-empty')
    expect(session.workoutId).toBe('workout-b')
    expect(session.startedAt).toBe(now)
    expect(session.finishedAt).toBeNull()
    // E12-T1 O5: the stale empty Session stays stored, marked deleted, beside the new one.
    expect(await db.sessions.count()).toBe(2)
    expect(await db.sessions.get(session.id)).toEqual(session)
    expect(await getActiveSession()).toEqual(session)
  })

  test('O2 startOrResumeSession 1 ms short of 4 h after an empty Session started resumes it unchanged', async () => {
    await db.sessions.put(inProgressEmpty())

    const resumed = await startOrResumeSession(
      'assaf-ab-2026',
      'workout-b',
      STARTED + FOUR_HOURS - 1,
    )

    expect(resumed).toEqual(inProgressEmpty())
    expect(await db.sessions.count()).toBe(1)
  })

  test('O2 finishStaleSession deletes a stale empty Session and leaves finished ones alone', async () => {
    const stored = history(1)
    await db.sessions.bulkPut([...stored, inProgressEmpty()])

    await finishStaleSession(STARTED + 5 * HOUR)

    // E12-T1 O5: marked deleted with the stamp at now, not removed and not finished.
    expect(await db.sessions.get('forgotten-empty')).toEqual({
      ...inProgressEmpty(),
      deletedAt: STARTED + 5 * HOUR,
      updatedAt: STARTED + 5 * HOUR,
    })
    expect(await db.sessions.count()).toBe(2)
    expect(await db.sessions.get('session-0')).toEqual(stored[0])
  })
})

// --- whole-table reads and writes for sync and backup (E11-T2) -------------------------------

function byId(sessions: Session[]): Session[] {
  return [...sessions].sort((one, other) => one.id.localeCompare(other.id))
}

describe('D2 sync and backup read and write Sessions through the store', () => {
  const SINCE = BASE + DAY

  const older = storedSession({ id: 'older', updatedAt: SINCE - 1 })
  const atSince = storedSession({ id: 'at-since', updatedAt: SINCE })
  const newer = storedSession({ id: 'newer', updatedAt: SINCE + 1 })
  const unstamped = storedSession({ id: 'unstamped' })
  const inProgressNewer = storedSession({ id: 'in-progress', finishedAt: null, updatedAt: SINCE + 60 * SECOND })

  test('D2 sessionsChangedSince returns Sessions stamped after since, finished or in progress', async () => {
    await db.sessions.bulkPut([older, atSince, newer, inProgressNewer])

    expect(byId(await sessionsChangedSince(SINCE))).toEqual([inProgressNewer, newer])
  })

  test('D2 sessionsChangedSince includes Sessions never stamped, as syncClient does', async () => {
    await db.sessions.bulkPut([older, unstamped])

    expect(await sessionsChangedSince(SINCE)).toEqual([unstamped])
  })

  test('D2 sessionsChangedSince leaves out a Session stamped exactly at since', async () => {
    await db.sessions.bulkPut([atSince])

    expect(await sessionsChangedSince(SINCE)).toEqual([])
  })

  test('D2 sessionsChangedSince(0) returns every stamped and unstamped Session', async () => {
    await db.sessions.bulkPut([older, atSince, newer, unstamped])

    expect(byId(await sessionsChangedSince(0))).toEqual([atSince, newer, older, unstamped])
  })

  test('D2 sessionsChangedSince on an empty database returns no Sessions', async () => {
    expect(await sessionsChangedSince(SINCE)).toEqual([])
  })

  test('D2 allSessions returns every stored Session, finished, in progress and unstamped', async () => {
    await db.sessions.bulkPut([older, newer, unstamped, inProgressNewer])

    expect(byId(await allSessions())).toEqual([inProgressNewer, newer, older, unstamped])
  })

  test('D2 allSessions on an empty database returns no Sessions', async () => {
    expect(await allSessions()).toEqual([])
  })

  test('D2 putSessions stores each Session exactly as given, updatedAt included', async () => {
    await putSessions([newer, unstamped])

    expect(await db.sessions.get('newer')).toEqual(newer)
    expect(await db.sessions.get('unstamped')).toEqual(unstamped)
  })

  test('D2 putSessions replaces a stored Session with the same id and keeps the others', async () => {
    await db.sessions.bulkPut([older, newer])
    const rewritten = { ...older, workoutId: 'workout-b', updatedAt: SINCE + 5 }

    await putSessions([rewritten])

    expect(byId(await db.sessions.toArray())).toEqual([newer, rewritten])
  })

  test('D2 putSessions with no Sessions leaves the database as it was', async () => {
    await db.sessions.bulkPut([older])

    await putSessions([])

    expect(await db.sessions.toArray()).toEqual([older])
  })

  test('D2 replaceAllSessions leaves exactly the given Sessions stored', async () => {
    await db.sessions.bulkPut([older, atSince, inProgressNewer])

    await replaceAllSessions([newer, unstamped])

    expect(byId(await db.sessions.toArray())).toEqual([newer, unstamped])
  })

  test('D2 replaceAllSessions with no Sessions clears every stored Session', async () => {
    await db.sessions.bulkPut([older, inProgressNewer])

    await replaceAllSessions([])

    expect(await db.sessions.count()).toBe(0)
  })

  test('D2 replaceAllSessions that fails part-way keeps every Session stored before it', async () => {
    await db.sessions.bulkPut([older, atSince])
    // A Session with no id cannot be stored under the `id` key, so the write fails after the clear.
    const keyless = { ...newer, id: undefined } as unknown as Session

    const failure = await replaceAllSessions([newer, keyless]).then(
      () => null,
      (error: unknown) => error as Error,
    )

    expect(failure).not.toBeNull()
    expect(failure?.message).not.toMatch(/not implemented/)
    expect(byId(await db.sessions.toArray())).toEqual([atSince, older])
  })
})

describe('D4 a time-taking Session write stamps the now it is given', () => {
  // The device clock, pinned far from NOW: a write given a `now` must stamp that, not the clock.
  const CLOCK = BASE + 10 * DAY
  const NOW = BASE + 2 * DAY

  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(CLOCK)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('D4 logSet given now stores the Session with updatedAt equal to it', async () => {
    await db.sessions.put(storedSession({ id: 'in-progress', finishedAt: null, updatedAt: BASE }))

    const returned = await logSet('in-progress', entry('back-squat', 0, 60, 8, BASE + 120 * SECOND), NOW)

    expect(returned.updatedAt).toBe(NOW)
    expect((await db.sessions.get('in-progress'))?.updatedAt).toBe(NOW)
  })

  test('D4 setSwap given now stores the Session with updatedAt equal to it', async () => {
    await db.sessions.put(storedSession({ id: 'in-progress', finishedAt: null, updatedAt: BASE }))

    await setSwap('in-progress', 'back-squat', 'leg-press', NOW)

    const stored = await db.sessions.get('in-progress')
    expect(stored?.swaps).toEqual({ 'back-squat': 'leg-press' })
    expect(stored?.updatedAt).toBe(NOW)
  })

  test('D4 clearSwap given now stores the Session with updatedAt equal to it', async () => {
    await db.sessions.put(
      storedSession({
        id: 'in-progress',
        finishedAt: null,
        updatedAt: BASE,
        swaps: { 'back-squat': 'leg-press' },
      }),
    )

    await clearSwap('in-progress', 'back-squat', NOW)

    const stored = await db.sessions.get('in-progress')
    expect(stored?.swaps).toEqual({})
    expect(stored?.updatedAt).toBe(NOW)
  })
})

describe('D4 inTransaction commits the writes inside it together or not at all', () => {
  beforeEach(async () => {
    await db.settings.clear()
  })

  test('D4 inTransaction rw commits a Session write and a setting write made inside it', async () => {
    const session = storedSession({ id: 'kept', updatedAt: BASE })

    await inTransaction('rw', async () => {
      await db.sessions.put(session)
      await db.settings.put({ key: 'gymEquipment', value: ['barbell'], updatedAt: BASE })
    })

    expect(await db.sessions.get('kept')).toEqual(session)
    expect(await db.settings.get('gymEquipment')).toEqual({
      key: 'gymEquipment',
      value: ['barbell'],
      updatedAt: BASE,
    })
  })

  test('D4 inTransaction resolves to what its function returns', async () => {
    await db.sessions.put(storedSession({ id: 'read-me', updatedAt: BASE }))

    const count = await inTransaction('r', async () => db.sessions.count())

    expect(count).toBe(1)
  })

  test('D4 inTransaction rw whose function throws rejects with that error and keeps no write from it', async () => {
    const before = storedSession({ id: 'before', updatedAt: BASE })
    await db.sessions.put(before)
    await db.settings.put({ key: 'gymEquipment', value: ['barbell'], updatedAt: BASE })

    await expect(
      inTransaction('rw', async () => {
        await db.sessions.put(storedSession({ id: 'rolled-back', updatedAt: BASE + 1 }))
        await db.sessions.delete('before')
        await db.settings.put({ key: 'gymEquipment', value: ['dumbbell'], updatedAt: BASE + 1 })
        throw new Error('fails part-way')
      }),
    ).rejects.toThrow('fails part-way')

    expect(await db.sessions.toArray()).toEqual([before])
    expect(await db.settings.get('gymEquipment')).toEqual({
      key: 'gymEquipment',
      value: ['barbell'],
      updatedAt: BASE,
    })
  })

  test('D4 store writes called inside inTransaction roll back with it', async () => {
    await db.sessions.put(storedSession({ id: 'in-progress', finishedAt: null, updatedAt: BASE }))

    await expect(
      inTransaction('rw', async () => {
        await logSet('in-progress', entry('back-squat', 0, 60, 8, BASE + 120 * SECOND))
        await putSessions([storedSession({ id: 'rolled-back', updatedAt: BASE + 1 })])
        throw new Error('fails part-way')
      }),
    ).rejects.toThrow('fails part-way')

    expect(await db.sessions.toArray()).toEqual([
      storedSession({ id: 'in-progress', finishedAt: null, updatedAt: BASE }),
    ])
  })
})

// --- E12-T2: updateSet, deleteSet, restoreSet ------------------------------------------------

describe('E12-T2 editing a logged Set', () => {
  const squat1 = entry('back-squat', 1, 60, 8, BASE + 100 * SECOND)
  const squat2 = entry('back-squat', 2, 62.5, 6, BASE + 200 * SECOND)
  const squat3 = entry('back-squat', 3, 65, 5, BASE + 300 * SECOND)
  const press1 = entry('press', 1, 30, 10, BASE + 150 * SECOND)

  async function seed(): Promise<string> {
    await db.sessions.put(
      storedSession({
        id: 'editing',
        finishedAt: null,
        entries: [squat1, press1, squat2, squat3],
        updatedAt: BASE + 400 * SECOND,
      }),
    )
    return 'editing'
  }

  test('O1 updateSet stores the new weight and reps, keeping setIndex and loggedAt', async () => {
    const id = await seed()

    const updated = await updateSet(id, 'back-squat', 2, { weightKg: 70, reps: 4 }, BASE + 900 * SECOND)

    const expected = [squat1, press1, entry('back-squat', 2, 70, 4, BASE + 200 * SECOND), squat3]
    expect(updated.entries).toEqual(expected)
    expect((await db.sessions.get(id))?.entries).toEqual(expected)
  })

  test('O1 updateSet advances the Session updatedAt to now', async () => {
    const id = await seed()

    const updated = await updateSet(id, 'back-squat', 2, { weightKg: 70, reps: 4 }, BASE + 900 * SECOND)

    expect(updated.updatedAt).toBe(BASE + 900 * SECOND)
    expect((await db.sessions.get(id))?.updatedAt).toBe(BASE + 900 * SECOND)
  })

  test('O1 updateSet accepts a null weight', async () => {
    const id = await seed()

    const updated = await updateSet(id, 'back-squat', 1, { weightKg: null, reps: 12 }, BASE + 900 * SECOND)

    expect(updated.entries[0]).toEqual(entry('back-squat', 1, null, 12, BASE + 100 * SECOND))
  })

  test('O1 updateSet on a missing Session rejects naming the id', async () => {
    await expect(updateSet('nope', 'back-squat', 1, { weightKg: 1, reps: 1 })).rejects.toThrow(
      'no session nope is stored',
    )
  })

  test('O1 updateSet on a Set that is not logged rejects and writes nothing', async () => {
    const id = await seed()

    await expect(
      updateSet(id, 'back-squat', 9, { weightKg: 1, reps: 1 }, BASE + 900 * SECOND),
    ).rejects.toThrow(/no set/i)

    expect((await db.sessions.get(id))?.updatedAt).toBe(BASE + 400 * SECOND)
  })

  test('O2 deleteSet renumbers the later Sets down, keeps loggedAt and other Exercises untouched', async () => {
    const id = await seed()

    const { session, removed } = await deleteSet(id, 'back-squat', 2, BASE + 900 * SECOND)

    expect(removed).toEqual(squat2)
    const expected = [squat1, press1, entry('back-squat', 2, 65, 5, BASE + 300 * SECOND)]
    expect(session.entries).toEqual(expected)
    expect((await db.sessions.get(id))?.entries).toEqual(expected)
  })

  test('O2 deleteSet advances the Session updatedAt to now', async () => {
    const id = await seed()

    const { session } = await deleteSet(id, 'back-squat', 2, BASE + 900 * SECOND)

    expect(session.updatedAt).toBe(BASE + 900 * SECOND)
    expect((await db.sessions.get(id))?.updatedAt).toBe(BASE + 900 * SECOND)
  })

  test('O2 deleteSet on a missing Session rejects naming the id', async () => {
    await expect(deleteSet('nope', 'back-squat', 1)).rejects.toThrow('no session nope is stored')
  })

  test('O2 deleteSet on a Set that is not logged rejects and writes nothing', async () => {
    const id = await seed()

    await expect(deleteSet(id, 'press', 2, BASE + 900 * SECOND)).rejects.toThrow(/no set/i)

    expect((await db.sessions.get(id))?.updatedAt).toBe(BASE + 400 * SECOND)
    expect((await db.sessions.get(id))?.entries).toHaveLength(4)
  })

  test('O3 restoreSet puts the removed Set back so the Exercise equals the original Sets 1, 2 and 3', async () => {
    const id = await seed()
    const { removed } = await deleteSet(id, 'back-squat', 2, BASE + 900 * SECOND)

    const restored = await restoreSet(id, removed, BASE + 1000 * SECOND)

    const byIndex = (entries: SetEntry[]) =>
      entries.filter((one) => one.exerciseId === 'back-squat').sort((a, b) => a.setIndex - b.setIndex)
    expect(byIndex(restored.entries)).toEqual([squat1, squat2, squat3])
    expect(restored.entries.filter((one) => one.exerciseId === 'press')).toEqual([press1])
    expect(restored.updatedAt).toBe(BASE + 1000 * SECOND)
    expect(byIndex((await db.sessions.get(id))!.entries)).toEqual([squat1, squat2, squat3])
  })

  test('O3 restoreSet on a missing Session rejects naming the id', async () => {
    await expect(restoreSet('nope', squat1)).rejects.toThrow('no session nope is stored')
  })
})

// --- E12-T6: saveSession, the History editor's single write --------------------------------

describe('E12-T6 saveSession stores an edited finished Session', () => {
  const squat1 = entry('back-squat', 1, 60, 8, BASE + 100 * SECOND)
  const squat2 = entry('back-squat', 2, 62.5, 6, BASE + 200 * SECOND)
  const original = (): Session =>
    storedSession({
      id: 'done',
      startedAt: BASE,
      finishedAt: BASE + 3600 * SECOND,
      entries: [squat1, squat2],
      updatedAt: BASE + 3600 * SECOND,
    })
  const NOW = BASE + 5 * DAY

  test('O14 saveSession stores the edited Sets and times and stamps updatedAt to now', async () => {
    await db.sessions.put(original())
    const draft: Session = {
      ...original(),
      startedAt: BASE + 60 * SECOND,
      finishedAt: BASE + 5400 * SECOND,
      entries: [entry('back-squat', 1, 70, 5, BASE + 100 * SECOND)],
    }

    const saved = await saveSession(draft, NOW)

    const expected: Session = { ...draft, updatedAt: NOW }
    expect(saved).toEqual(expected)
    expect(await db.sessions.get('done')).toEqual(expected)
  })

  test('O14 saveSession leaves every other stored Session untouched', async () => {
    const other = storedSession({ id: 'other', entries: [squat1], updatedAt: BASE + 7 * SECOND })
    await db.sessions.bulkPut([original(), other])

    await saveSession({ ...original(), entries: [squat1] }, NOW)

    expect(await db.sessions.get('other')).toEqual(other)
  })

  test('O15 saveSession with the end before the start rejects with the O15 message and writes nothing', async () => {
    await db.sessions.put(original())

    await expect(
      saveSession({ ...original(), finishedAt: BASE - SECOND }, NOW),
    ).rejects.toThrow('End time must be after the start time.')

    expect(await db.sessions.get('done')).toEqual(original())
  })

  test('O15 saveSession accepts an end equal to the start', async () => {
    await db.sessions.put(original())

    const saved = await saveSession({ ...original(), finishedAt: BASE }, NOW)

    expect(saved.finishedAt).toBe(BASE)
    expect((await db.sessions.get('done'))?.finishedAt).toBe(BASE)
  })

  test('O15 saveSession with no Sets rejects with the O15 message and writes nothing', async () => {
    await db.sessions.put(original())

    await expect(saveSession({ ...original(), entries: [] }, NOW)).rejects.toThrow(
      'A workout needs at least one set. Delete the workout instead.',
    )

    expect(await db.sessions.get('done')).toEqual(original())
  })

  test('O14 saveSession on a Session no longer stored rejects naming the id and creates nothing', async () => {
    await expect(saveSession({ ...original(), id: 'nope' }, NOW)).rejects.toThrow(
      'no session nope is stored',
    )

    expect(await db.sessions.get('nope')).toBeUndefined()
  })
})

// --- a deleted Session is a marked document (E12-T1) ------------------------------------------

describe('E12-T1 a discarded Session stays stored but no reader returns it', () => {
  const DISCARDED_AT = BASE + 2 * DAY

  test('O4 isLive is true for a Session with no deletedAt', () => {
    expect(isLive(storedSession({ id: 'live', updatedAt: BASE }))).toBe(true)
  })

  test('O4 isLive is false for a Session with deletedAt set', () => {
    expect(isLive(storedSession({ id: 'gone', updatedAt: BASE, deletedAt: DISCARDED_AT }))).toBe(false)
  })

  test('O4 discardSession stores the Session with deletedAt and updatedAt at now, entries and finishedAt kept', async () => {
    const original = storedSession({
      id: 'done',
      entries: [entry('back-squat', 0, 60, 8, BASE + 60 * SECOND)],
      swaps: { 'back-squat': 'leg-press' },
      updatedAt: BASE + 3600 * SECOND,
    })
    await db.sessions.put(original)

    await discardSession('done', DISCARDED_AT)

    expect(await db.sessions.get('done')).toEqual({
      ...original,
      deletedAt: DISCARDED_AT,
      updatedAt: DISCARDED_AT,
    })
    expect(await db.sessions.count()).toBe(1)
  })

  test('O4 discardSession on a Session in progress keeps it unfinished and marks it deleted', async () => {
    const original = storedSession({
      id: 'in-progress',
      finishedAt: null,
      entries: [entry('lunges', 0, 20, 10, BASE + 60 * SECOND)],
      updatedAt: BASE + 60 * SECOND,
    })
    await db.sessions.put(original)

    await discardSession('in-progress', DISCARDED_AT)

    expect(await db.sessions.get('in-progress')).toEqual({
      ...original,
      deletedAt: DISCARDED_AT,
      updatedAt: DISCARDED_AT,
    })
  })

  test('O4 discardSession leaves the other stored Sessions as they are', async () => {
    const [kept, target] = history(2)
    await db.sessions.bulkPut([kept, target])

    await discardSession(target.id, DISCARDED_AT)

    expect(await db.sessions.get(kept.id)).toEqual(kept)
  })

  test('O4 discardSession of an unknown id rejects naming the id and stores nothing', async () => {
    await expect(discardSession('missing', DISCARDED_AT)).rejects.toThrow('no session missing is stored')
    expect(await db.sessions.count()).toBe(0)
  })

  test('O4 getActiveSession does not return a discarded Session in progress', async () => {
    await db.sessions.put(storedSession({ id: 'in-progress', finishedAt: null, updatedAt: BASE }))

    await discardSession('in-progress', DISCARDED_AT)

    expect(await getActiveSession()).toBeNull()
  })

  test('O4 getActiveSession skips a stored deleted Session in progress for an older live one', async () => {
    const live = storedSession({ id: 'live', startedAt: BASE, finishedAt: null, updatedAt: BASE })
    const deleted = storedSession({
      id: 'deleted',
      startedAt: BASE + DAY,
      finishedAt: null,
      updatedAt: DISCARDED_AT,
      deletedAt: DISCARDED_AT,
    })
    await db.sessions.bulkPut([live, deleted])

    expect(await getActiveSession()).toEqual(live)
  })

  test('O4 a discarded Session in progress no longer blocks startOrResumeSession from starting a new one', async () => {
    await db.sessions.put(
      storedSession({ id: 'in-progress', startedAt: BASE, finishedAt: null, updatedAt: BASE }),
    )
    await discardSession('in-progress', BASE + 60 * SECOND)
    const now = BASE + 120 * SECOND

    const session = await startOrResumeSession('assaf-ab-2026', 'workout-b', now)

    expect(session.id).not.toBe('in-progress')
    expect(session.workoutId).toBe('workout-b')
    expect(session.startedAt).toBe(now)
    expect(session.finishedAt).toBeNull()
    expect(await getActiveSession()).toEqual(session)
  })

  test('O4 startOrResumeSession leaves a discarded Session in progress as it was marked', async () => {
    await db.sessions.put(
      storedSession({ id: 'in-progress', startedAt: BASE, finishedAt: null, updatedAt: BASE }),
    )
    await discardSession('in-progress', BASE + 60 * SECOND)
    const marked = await db.sessions.get('in-progress')

    await startOrResumeSession('assaf-ab-2026', 'workout-b', BASE + 5 * 60 * 60 * SECOND)

    expect(await db.sessions.get('in-progress')).toEqual(marked)
  })

  test('O4 listSessions does not return a discarded finished Session', async () => {
    const stored = history(3)
    await db.sessions.bulkPut(stored)

    await discardSession('session-1', DISCARDED_AT)

    expect((await listSessions()).map((session) => session.id)).toEqual(['session-0', 'session-2'])
  })

  test('O4 listSessions returns nothing when the only finished Session is discarded', async () => {
    await db.sessions.bulkPut(history(1))

    await discardSession('session-0', DISCARDED_AT)

    expect(await listSessions()).toEqual([])
  })

  test('O4 getLastEntriesFor skips a discarded newer Session and answers from the older live one', async () => {
    const stored = history(
      2,
      new Map([
        [0, [entry('back-squat', 0, 80, 5, BASE + 60 * SECOND)]],
        [1, [entry('back-squat', 0, 60, 8, BASE - DAY + 60 * SECOND)]],
      ]),
    )
    await db.sessions.bulkPut(stored)

    await discardSession('session-0', DISCARDED_AT)

    expect(await getLastEntriesFor('back-squat')).toEqual([
      entry('back-squat', 0, 60, 8, BASE - DAY + 60 * SECOND),
    ])
  })

  test('O4 getLastEntriesFor returns no entries when the only Session holding the Exercise is discarded', async () => {
    await db.sessions.bulkPut(
      history(1, new Map([[0, [entry('back-squat', 0, 80, 5, BASE + 60 * SECOND)]]])),
    )

    await discardSession('session-0', DISCARDED_AT)

    expect(await getLastEntriesFor('back-squat')).toEqual([])
  })

  test('O4 getLastSwap skips a discarded newer Session and answers from the older live one', async () => {
    await db.sessions.bulkPut([
      storedSession({
        id: 'newer',
        startedAt: BASE,
        finishedAt: BASE + 3600 * SECOND,
        swaps: { 'back-squat': 'leg-press' },
      }),
      storedSession({
        id: 'older',
        startedAt: BASE - DAY,
        finishedAt: BASE - DAY + 3600 * SECOND,
        swaps: { 'back-squat': 'hack-squat' },
      }),
    ])

    await discardSession('newer', DISCARDED_AT)

    expect(await getLastSwap('assaf-ab-2026', 'workout-a', 'back-squat')).toBe('hack-squat')
  })

  test('O4 getLastSwap returns null when the only Session with the swap is discarded', async () => {
    await db.sessions.put(storedSession({ id: 'only', swaps: { 'back-squat': 'leg-press' } }))

    await discardSession('only', DISCARDED_AT)

    expect(await getLastSwap('assaf-ab-2026', 'workout-a', 'back-squat')).toBeNull()
  })

  test('O4 sessionsChangedSince still returns a discarded Session, so sync pushes it', async () => {
    await db.sessions.put(storedSession({ id: 'done', updatedAt: BASE }))

    await discardSession('done', DISCARDED_AT)

    expect(await sessionsChangedSince(BASE)).toEqual([
      storedSession({ id: 'done', updatedAt: DISCARDED_AT, deletedAt: DISCARDED_AT }),
    ])
  })

  test('O4 allSessions still returns a discarded Session', async () => {
    await db.sessions.put(storedSession({ id: 'done', updatedAt: BASE }))

    await discardSession('done', DISCARDED_AT)

    expect((await allSessions()).map((session) => session.id)).toEqual(['done'])
  })
})

describe('E12-T1 a stale empty Session is marked deleted, not removed', () => {
  const HOUR = 60 * 60 * SECOND
  const STARTED = BASE

  function inProgressEmpty(): Session {
    return storedSession({
      id: 'forgotten-empty',
      startedAt: STARTED,
      finishedAt: null,
      entries: [],
      updatedAt: STARTED,
    })
  }

  test('O5 finishStaleSession stores a stale empty Session with deletedAt and updatedAt at now', async () => {
    const now = STARTED + 5 * HOUR
    await db.sessions.put(inProgressEmpty())

    await finishStaleSession(now)

    expect(await db.sessions.get('forgotten-empty')).toEqual({
      ...inProgressEmpty(),
      deletedAt: now,
      updatedAt: now,
    })
  })

  test('O5 finishStaleSession stores the stale empty Session the way discardSession would', async () => {
    const now = STARTED + 5 * HOUR
    await db.sessions.put(inProgressEmpty())
    await discardSession('forgotten-empty', now)
    const discarded = await db.sessions.get('forgotten-empty')
    await db.sessions.put(inProgressEmpty())

    await finishStaleSession(now)

    expect(await db.sessions.get('forgotten-empty')).toEqual(discarded)
  })

  test('O5 after a stale empty Session is marked, getActiveSession and listSessions return nothing', async () => {
    await db.sessions.put(inProgressEmpty())

    await finishStaleSession(STARTED + 5 * HOUR)

    expect(await getActiveSession()).toBeNull()
    expect(await listSessions()).toEqual([])
  })

  test('O5 finishStaleSession leaves an already-deleted Session in progress as stored', async () => {
    const deleted = { ...inProgressEmpty(), deletedAt: STARTED + HOUR, updatedAt: STARTED + HOUR }
    await db.sessions.put(deleted)

    await finishStaleSession(STARTED + 10 * HOUR)

    expect(await db.sessions.get('forgotten-empty')).toEqual(deleted)
  })
})

// --- E13-T5: setRest -------------------------------------------------------------------------

describe('E13-T5 storing a changed rest on a logged Set', () => {
  const squat1 = entry('back-squat', 1, 60, 8, BASE + 100 * SECOND)
  const squat2 = entry('back-squat', 2, 62.5, 6, BASE + 200 * SECOND)
  const press1 = entry('press', 1, 30, 10, BASE + 150 * SECOND)

  async function seed(entries = [squat1, press1, squat2]): Promise<string> {
    await db.sessions.put(
      storedSession({ id: 'resting', finishedAt: null, entries, updatedAt: BASE + 400 * SECOND }),
    )
    return 'resting'
  }

  test('O3 setRest stores restSeconds on that Set only and changes no other field or entry', async () => {
    const id = await seed()

    const updated = await setRest(id, 'back-squat', 2, 150, BASE + 900 * SECOND)

    const expected = [squat1, press1, { ...squat2, restSeconds: 150 }]
    expect(updated.entries).toEqual(expected)
    expect((await db.sessions.get(id))?.entries).toEqual(expected)
  })

  test('O3 setRest advances the Session updatedAt to now and leaves other Session fields', async () => {
    const id = await seed()
    const before = await db.sessions.get(id)

    const updated = await setRest(id, 'back-squat', 2, 150, BASE + 900 * SECOND)

    expect(updated.updatedAt).toBe(BASE + 900 * SECOND)
    expect(await db.sessions.get(id)).toEqual({
      ...before,
      entries: updated.entries,
      updatedAt: BASE + 900 * SECOND,
    })
  })

  test('O3 setRest replaces an earlier restSeconds', async () => {
    const id = await seed([{ ...squat1, restSeconds: 90 }])

    const updated = await setRest(id, 'back-squat', 1, 120, BASE + 900 * SECOND)

    expect(updated.entries).toEqual([{ ...squat1, restSeconds: 120 }])
  })

  test('O3 a Set stored without restSeconds still has none after another Set gets one', async () => {
    const id = await seed()

    await setRest(id, 'press', 1, 75, BASE + 900 * SECOND)

    const stored = (await db.sessions.get(id))?.entries.find((e) => e.exerciseId === 'back-squat')
    expect(stored).toEqual(squat1)
    expect(stored && 'restSeconds' in stored).toBe(false)
  })

  test('O3 updateSet keeps the restSeconds of the Set it edits', async () => {
    const id = await seed([{ ...squat1, restSeconds: 90 }])

    const updated = await updateSet(id, 'back-squat', 1, { weightKg: 65, reps: 5 }, BASE + 900 * SECOND)

    expect(updated.entries).toEqual([{ ...squat1, weightKg: 65, reps: 5, restSeconds: 90 }])
  })

  test('O3 setRest on a missing Session rejects naming the id', async () => {
    await expect(setRest('nope', 'back-squat', 1, 60)).rejects.toThrow('no session nope is stored')
  })

  test('O3 setRest on a Set that is not logged rejects and writes nothing', async () => {
    const id = await seed()

    await expect(setRest(id, 'back-squat', 9, 60, BASE + 900 * SECOND)).rejects.toThrow(/no set/i)

    expect((await db.sessions.get(id))?.updatedAt).toBe(BASE + 400 * SECOND)
  })
})
