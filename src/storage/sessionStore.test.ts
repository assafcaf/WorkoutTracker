import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { db, isStorageAvailable } from './db'
import {
  clearSwap,
  finishSession,
  finishStaleSession,
  getActiveSession,
  getLastEntriesFor,
  getLastSwap,
  listSessions,
  logSet,
  setSwap,
  startOrResumeSession,
} from './sessionStore'
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

  const resumed = await startOrResumeSession('assaf-ab-2026', 'workout-a', BASE + DAY)

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

    expect(await db.sessions.get('forgotten-empty')).toBeUndefined()
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
    expect(await db.sessions.count()).toBe(1)
    expect(await db.sessions.get(session.id)).toEqual(session)
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

    expect(await db.sessions.get('forgotten-empty')).toBeUndefined()
    expect(await db.sessions.count()).toBe(1)
    expect(await db.sessions.get('session-0')).toEqual(stored[0])
  })
})
