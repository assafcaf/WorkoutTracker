import { beforeEach, describe, expect, test } from 'vitest'
import { allSessions, putSessions, replaceAllSessions } from '../storage/sessionStore'
import type { Program, Session, SetEntry } from '../types'
import { createChangeBus } from './changes'
import { ServiceError } from './errors'
import { createSessionService, type SessionService } from './sessions'

// `fake-indexeddb/auto` is installed globally in src/test/setup.ts. Every test starts from an
// empty `sessions` table, seeded through the storage layer rather than `db`.
beforeEach(async () => {
  await replaceAllSessions([])
})

const SECOND = 1_000
const HOUR = 60 * 60 * SECOND
const DAY = 24 * HOUR
// A fixed wall-clock base, so every timestamp below is a literal derived by hand.
const BASE = 1_700_000_000_000
/** The injected clock's reading: ten days after BASE, far from every fixture stamp. */
const NOW = BASE + 10 * DAY

function entry(
  exerciseId: string,
  setIndex: number,
  weightKg: number | null,
  reps: number,
  loggedAt: number,
): SetEntry {
  return { exerciseId, setIndex, weightKg, reps, loggedAt }
}

/** A stored Session. Finished by default; pass `finishedAt: null` for one in progress. */
function storedSession(over: Partial<Session> & { id: string }): Session {
  return {
    programId: 'p1',
    workoutId: 'w1',
    startedAt: BASE,
    finishedAt: BASE + HOUR,
    entries: [],
    updatedAt: BASE + HOUR,
    ...over,
  }
}

/** Program p1: Workout w1 plans bench and row, Workout w2 plans squat. */
const PROGRAM: Program = {
  id: 'p1',
  name: 'Program one',
  units: 'kg',
  sessionsPerWeek: 2,
  workouts: [
    {
      id: 'w1',
      name: 'Workout one',
      exercises: [
        { exerciseId: 'bench', sets: 3, repRange: [6, 8], restSeconds: 120 },
        { exerciseId: 'row', sets: 3, repRange: [8, 10], restSeconds: 90 },
      ],
    },
    {
      id: 'w2',
      name: 'Workout two',
      exercises: [{ exerciseId: 'squat', sets: 3, repRange: [5, 5], restSeconds: 180 }],
    },
  ],
}

type Harness = { service: SessionService; emitted: () => number }

/** A service over a fixed clock, with a counter on the `'sessions'` topic. */
function harness(now: number = NOW): Harness {
  const bus = createChangeBus()
  let count = 0
  bus.subscribe('sessions', () => {
    count += 1
  })
  const service = createSessionService({ now: () => now, bus, storageAvailable: true })
  return { service, emitted: () => count }
}

async function stored(id: string): Promise<Session | undefined> {
  return (await allSessions()).find((session) => session.id === id)
}

// --- O5: the operations -------------------------------------------------------------------

describe('O5 the session service', () => {
  test('O5 createSessionService has exactly the eleven session operations', () => {
    const { service } = harness()
    expect(Object.keys(service).sort()).toEqual([
      'applySwap',
      'deleteSet',
      'discard',
      'finish',
      'lastEntriesFor',
      'lastEntriesForSession',
      'lastSwapsForSession',
      'list',
      'logSet',
      'presetHistory',
      'restoreSet',
      'resumeActive',
      'save',
      'setEffort',
      'setNote',
      'setRest',
      'start',
      'undoSwap',
      'updateSet',
    ])
  })

  test('O5 resumeActive returns the Session in progress when it is fresh', async () => {
    const active = storedSession({
      id: 'active',
      startedAt: NOW - HOUR,
      finishedAt: null,
      entries: [entry('bench', 0, 60, 8, NOW - 30 * 60 * SECOND)],
      updatedAt: NOW - 30 * 60 * SECOND,
    })
    await putSessions([active, storedSession({ id: 'old' })])

    const { service } = harness()

    await expect(service.resumeActive()).resolves.toEqual(active)
    expect(await stored('active')).toEqual(active)
  })

  test('O5 resumeActive returns null when no Session is in progress', async () => {
    await putSessions([storedSession({ id: 'old' })])

    await expect(harness().service.resumeActive()).resolves.toBeNull()
  })

  test('O5 resumeActive finishes a stale Session at its last Set and returns null', async () => {
    // Last activity at BASE + 60s; the clock reads NOW, ten days later: well past four hours.
    await putSessions([
      storedSession({
        id: 'stale',
        startedAt: BASE,
        finishedAt: null,
        entries: [entry('bench', 0, 60, 8, BASE + 60 * SECOND)],
        updatedAt: BASE + 60 * SECOND,
      }),
    ])

    await expect(harness().service.resumeActive()).resolves.toBeNull()
    expect(await stored('stale')).toMatchObject({ finishedAt: BASE + 60 * SECOND })
  })

  test('O5 resumeActive deletes a stale Session that holds no Sets', async () => {
    await putSessions([
      storedSession({ id: 'empty', startedAt: BASE, finishedAt: null, entries: [], updatedAt: BASE }),
    ])

    await expect(harness().service.resumeActive()).resolves.toBeNull()
    // E12-T1 O5: "deletes" is now a mark at the service clock, so sync can carry it.
    expect(await stored('empty')).toEqual(
      storedSession({
        id: 'empty',
        startedAt: BASE,
        finishedAt: null,
        entries: [],
        updatedAt: NOW,
        deletedAt: NOW,
      }),
    )
  })

  test('O5 start creates a new Session in progress for the chosen Workout', async () => {
    const started = await harness().service.start('p1', 'w2')

    expect(started).toMatchObject({
      programId: 'p1',
      workoutId: 'w2',
      startedAt: NOW,
      finishedAt: null,
      entries: [],
    })
    expect(await stored(started.id)).toEqual(started)
  })

  test('O5 start resumes the Session already in progress instead of starting another', async () => {
    const active = storedSession({
      id: 'active',
      workoutId: 'w1',
      startedAt: NOW - 60 * SECOND,
      finishedAt: null,
      updatedAt: NOW - 60 * SECOND,
    })
    await putSessions([active])

    const resumed = await harness().service.start('p1', 'w2')

    expect(resumed.id).toBe('active')
    expect(resumed.workoutId).toBe('w1')
    expect((await allSessions()).length).toBe(1)
  })

  test('O5 logSet records a Set on the Session and returns the Session as stored', async () => {
    await putSessions([
      storedSession({ id: 'active', startedAt: NOW - HOUR, finishedAt: null, updatedAt: NOW - HOUR }),
    ])
    const set = entry('bench', 0, 60, 8, NOW)

    const logged = await harness().service.logSet('active', set)

    expect(logged.entries).toEqual([set])
    expect(await stored('active')).toEqual(logged)
  })

  test('O5 logSet replaces the Set with the same Exercise and set index', async () => {
    await putSessions([
      storedSession({
        id: 'active',
        startedAt: NOW - HOUR,
        finishedAt: null,
        entries: [entry('bench', 0, 60, 8, NOW - 10 * SECOND), entry('bench', 1, 60, 7, NOW - 5 * SECOND)],
        updatedAt: NOW - 5 * SECOND,
      }),
    ])

    const logged = await harness().service.logSet('active', entry('bench', 0, 62.5, 6, NOW))

    expect(logged.entries).toEqual([entry('bench', 0, 62.5, 6, NOW), entry('bench', 1, 60, 7, NOW - 5 * SECOND)])
  })

  test('O5 finish stamps the Session finished and returns it as stored', async () => {
    await putSessions([
      storedSession({
        id: 'active',
        startedAt: NOW - HOUR,
        finishedAt: null,
        entries: [entry('bench', 0, 60, 8, NOW - 60 * SECOND)],
        updatedAt: NOW - 60 * SECOND,
      }),
    ])

    const finished = await harness().service.finish('active')

    expect(finished.finishedAt).toBe(NOW)
    expect(await stored('active')).toEqual(finished)
  })

  test('O5 lastEntriesFor returns the newest finished Session that has the Exercise, by set index', async () => {
    await putSessions([
      storedSession({
        id: 'older',
        startedAt: BASE - DAY,
        finishedAt: BASE - DAY + HOUR,
        entries: [entry('bench', 0, 50, 8, BASE - DAY + 60 * SECOND)],
      }),
      storedSession({
        id: 'newer',
        startedAt: BASE,
        finishedAt: BASE + HOUR,
        entries: [entry('bench', 1, 55, 7, BASE + 120 * SECOND), entry('bench', 0, 55, 8, BASE + 60 * SECOND)],
      }),
      storedSession({
        id: 'newest-without-bench',
        startedAt: BASE + DAY,
        finishedAt: BASE + DAY + HOUR,
        entries: [entry('squat', 0, 100, 5, BASE + DAY + 60 * SECOND)],
      }),
      storedSession({
        id: 'in-progress',
        startedAt: NOW - HOUR,
        finishedAt: null,
        entries: [entry('bench', 0, 70, 8, NOW - 60 * SECOND)],
      }),
    ])

    await expect(harness().service.lastEntriesFor('bench')).resolves.toEqual([
      entry('bench', 0, 55, 8, BASE + 60 * SECOND),
      entry('bench', 1, 55, 7, BASE + 120 * SECOND),
    ])
  })

  test('O5 lastEntriesFor returns nothing for an Exercise never lifted', async () => {
    await putSessions([storedSession({ id: 'old', entries: [entry('bench', 0, 60, 8, BASE + 60 * SECOND)] })])

    await expect(harness().service.lastEntriesFor('deadlift')).resolves.toEqual([])
  })

  test("O5 lastEntriesForSession keys last time's Sets by every Plan and every swapped-in Exercise", async () => {
    await putSessions([
      storedSession({
        id: 'old',
        entries: [
          entry('bench', 0, 60, 8, BASE + 60 * SECOND),
          entry('curl', 0, 12, 10, BASE + 120 * SECOND),
          entry('squat', 0, 100, 5, BASE + 180 * SECOND),
        ],
      }),
    ])
    const current = storedSession({
      id: 'active',
      startedAt: NOW - HOUR,
      finishedAt: null,
      swaps: { row: 'curl' },
    })

    const found = await harness().service.lastEntriesForSession(current, [PROGRAM])

    expect(found).toEqual(
      new Map([
        ['bench', [entry('bench', 0, 60, 8, BASE + 60 * SECOND)]],
        ['row', []],
        ['curl', [entry('curl', 0, 12, 10, BASE + 120 * SECOND)]],
      ]),
    )
  })

  test('O5 lastEntriesForSession keys only the swapped-in Exercises when the Program is gone', async () => {
    await putSessions([storedSession({ id: 'old', entries: [entry('curl', 0, 12, 10, BASE + 60 * SECOND)] })])
    const current = storedSession({
      id: 'active',
      programId: 'deleted',
      startedAt: NOW - HOUR,
      finishedAt: null,
      swaps: { row: 'curl' },
    })

    const found = await harness().service.lastEntriesForSession(current, [PROGRAM])

    expect(found).toEqual(new Map([['curl', [entry('curl', 0, 12, 10, BASE + 60 * SECOND)]]]))
  })

  test('O5 lastEntriesForSession is empty without a Session', async () => {
    await expect(harness().service.lastEntriesForSession(null, [PROGRAM])).resolves.toEqual(new Map())
  })

  test("O5 lastSwapsForSession returns each Plan's swap from the last finished Session of that Workout", async () => {
    await putSessions([
      storedSession({ id: 'w1-older', startedAt: BASE - DAY, finishedAt: BASE - DAY + HOUR, swaps: { bench: 'dips' } }),
      storedSession({ id: 'w1-newer', startedAt: BASE, finishedAt: BASE + HOUR, swaps: { row: 'curl' } }),
      storedSession({
        id: 'w2',
        workoutId: 'w2',
        startedAt: BASE + DAY,
        finishedAt: BASE + DAY + HOUR,
        swaps: { squat: 'leg-press' },
      }),
    ])
    const current = storedSession({ id: 'active', startedAt: NOW - HOUR, finishedAt: null })

    // bench's newest recorded swap is the older session's: each Plan looks back on its own.
    await expect(harness().service.lastSwapsForSession(current, [PROGRAM])).resolves.toEqual({
      bench: 'dips',
      row: 'curl',
    })
  })

  test('O5 lastSwapsForSession is empty without a Session or when its Program is gone', async () => {
    await putSessions([storedSession({ id: 'old', swaps: { row: 'curl' } })])
    const orphan = storedSession({ id: 'active', programId: 'deleted', startedAt: NOW - HOUR, finishedAt: null })
    const { service } = harness()

    await expect(service.lastSwapsForSession(null, [PROGRAM])).resolves.toEqual({})
    await expect(service.lastSwapsForSession(orphan, [PROGRAM])).resolves.toEqual({})
  })

  test("O5 presetHistory lays today's Sets of the Exercise over last time's", () => {
    const history = [
      entry('bench', 0, 60, 8, BASE + 10 * SECOND),
      entry('bench', 1, 60, 8, BASE + 20 * SECOND),
      entry('bench', 2, 60, 6, BASE + 30 * SECOND),
    ]
    const session = storedSession({
      id: 'active',
      startedAt: NOW - HOUR,
      finishedAt: null,
      entries: [entry('row', 1, 40, 10, NOW - 20 * SECOND), entry('bench', 1, 65, 8, NOW - 10 * SECOND)],
    })

    expect(harness().service.presetHistory(history, session, 'bench')).toEqual([
      entry('bench', 0, 60, 8, BASE + 10 * SECOND),
      entry('bench', 2, 60, 6, BASE + 30 * SECOND),
      entry('bench', 1, 65, 8, NOW - 10 * SECOND),
    ])
  })

  test('O5 list returns the finished Sessions newest first, without the one in progress', async () => {
    await putSessions([
      storedSession({ id: 'older', startedAt: BASE - DAY, finishedAt: BASE - DAY + HOUR }),
      storedSession({ id: 'in-progress', startedAt: NOW - HOUR, finishedAt: null }),
      storedSession({ id: 'newer', startedAt: BASE, finishedAt: BASE + HOUR }),
    ])

    const listed = await harness().service.list()

    expect(listed.map((session) => session.id)).toEqual(['newer', 'older'])
  })

  test('O5 applySwap records the swapped-in Exercise for the Plan on the Session', async () => {
    await putSessions([
      storedSession({ id: 'active', startedAt: NOW - HOUR, finishedAt: null, swaps: { bench: 'dips' } }),
    ])

    await expect(harness().service.applySwap('active', 'row', 'curl')).resolves.toBeUndefined()
    expect((await stored('active'))?.swaps).toEqual({ bench: 'dips', row: 'curl' })
  })

  test("O5 undoSwap removes the Plan's swap from the Session", async () => {
    await putSessions([
      storedSession({
        id: 'active',
        startedAt: NOW - HOUR,
        finishedAt: null,
        swaps: { bench: 'dips', row: 'curl' },
      }),
    ])

    await expect(harness().service.undoSwap('active', 'row')).resolves.toBeUndefined()
    expect((await stored('active'))?.swaps).toEqual({ bench: 'dips' })
  })

  test('O5 undoSwap is refused once the swapped-in Exercise has a logged Set', async () => {
    await putSessions([
      storedSession({
        id: 'active',
        startedAt: NOW - HOUR,
        finishedAt: null,
        entries: [entry('curl', 0, 12, 10, NOW - 60 * SECOND)],
        swaps: { row: 'curl' },
      }),
    ])

    await expect(harness().service.undoSwap('active', 'row')).rejects.toBeInstanceOf(ServiceError)
    expect((await stored('active'))?.swaps).toEqual({ row: 'curl' })
  })
})

// --- O6: a missing Session ----------------------------------------------------------------

describe("O6 a missing Session is 'not-found'", () => {
  beforeEach(async () => {
    await putSessions([storedSession({ id: 'other', startedAt: NOW - HOUR, finishedAt: null })])
  })

  test("O6 logSet on a missing Session rejects with ServiceError 'not-found'", async () => {
    const rejection = harness().service.logSet('missing', entry('bench', 0, 60, 8, NOW))
    await expect(rejection).rejects.toBeInstanceOf(ServiceError)
    await expect(rejection).rejects.toMatchObject({ code: 'not-found' })
  })

  test("O6 finish on a missing Session rejects with ServiceError 'not-found'", async () => {
    const rejection = harness().service.finish('missing')
    await expect(rejection).rejects.toBeInstanceOf(ServiceError)
    await expect(rejection).rejects.toMatchObject({ code: 'not-found' })
  })

  test("O6 applySwap on a missing Session rejects with ServiceError 'not-found'", async () => {
    const rejection = harness().service.applySwap('missing', 'row', 'curl')
    await expect(rejection).rejects.toBeInstanceOf(ServiceError)
    await expect(rejection).rejects.toMatchObject({ code: 'not-found' })
  })

  test("O6 undoSwap on a missing Session rejects with ServiceError 'not-found'", async () => {
    const rejection = harness().service.undoSwap('missing', 'row')
    await expect(rejection).rejects.toBeInstanceOf(ServiceError)
    await expect(rejection).rejects.toMatchObject({ code: 'not-found' })
  })
})

// --- O7: every write is stamped with the injected clock ------------------------------------

describe('O7 every Session write stamps updatedAt with now()', () => {
  const inProgress = (): Session =>
    storedSession({
      id: 'active',
      startedAt: NOW - HOUR,
      finishedAt: null,
      entries: [entry('bench', 0, 60, 8, NOW - 60 * SECOND)],
      swaps: { bench: 'dips' },
      updatedAt: NOW - 60 * SECOND,
    })

  test('O7 start stamps the new Session with now()', async () => {
    const started = await harness().service.start('p1', 'w1')
    expect(started.updatedAt).toBe(NOW)
    expect((await stored(started.id))?.updatedAt).toBe(NOW)
  })

  test('O7 logSet stamps the Session with now(), not the wall clock', async () => {
    await putSessions([inProgress()])
    // The Set's own time is the wall clock's; the stamp must still be the injected one.
    await harness().service.logSet('active', entry('bench', 1, 60, 8, NOW - 5 * SECOND))
    expect((await stored('active'))?.updatedAt).toBe(NOW)
  })

  test('O7 finish stamps the Session with now()', async () => {
    await putSessions([inProgress()])
    await harness().service.finish('active')
    expect((await stored('active'))?.updatedAt).toBe(NOW)
  })

  test('O7 applySwap stamps the Session with now()', async () => {
    await putSessions([inProgress()])
    await harness().service.applySwap('active', 'row', 'curl')
    expect((await stored('active'))?.updatedAt).toBe(NOW)
  })

  test('O7 undoSwap stamps the Session with now()', async () => {
    await putSessions([inProgress()])
    await harness().service.undoSwap('active', 'bench')
    expect((await stored('active'))?.updatedAt).toBe(NOW)
  })

  test("O7 resumeActive's stale finish stamps the Session with now()", async () => {
    await putSessions([
      storedSession({
        id: 'stale',
        startedAt: BASE,
        finishedAt: null,
        entries: [entry('bench', 0, 60, 8, BASE + 60 * SECOND)],
        updatedAt: BASE + 60 * SECOND,
      }),
    ])
    await harness().service.resumeActive()
    expect((await stored('stale'))?.updatedAt).toBe(NOW)
  })

  test('O7 the stale finish is judged against now(), not the wall clock', async () => {
    // Stale by the wall clock (2023 fixture), fresh by the injected clock: one minute old.
    const clock = BASE + 2 * 60 * SECOND
    const active = storedSession({
      id: 'active',
      startedAt: BASE,
      finishedAt: null,
      entries: [entry('bench', 0, 60, 8, BASE + 60 * SECOND)],
      updatedAt: BASE + 60 * SECOND,
    })
    await putSessions([active])

    await expect(harness(clock).service.resumeActive()).resolves.toEqual(active)
  })
})

// --- O8: writes announce themselves on 'sessions' ------------------------------------------

describe("O8 each successful write emits 'sessions' once", () => {
  const inProgress = (): Session =>
    storedSession({
      id: 'active',
      startedAt: NOW - HOUR,
      finishedAt: null,
      swaps: { bench: 'dips' },
      updatedAt: NOW - HOUR,
    })

  test("O8 start emits 'sessions' once", async () => {
    const { service, emitted } = harness()
    await service.start('p1', 'w1')
    expect(emitted()).toBe(1)
  })

  test("O8 logSet emits 'sessions' once", async () => {
    await putSessions([inProgress()])
    const { service, emitted } = harness()
    await service.logSet('active', entry('bench', 0, 60, 8, NOW))
    expect(emitted()).toBe(1)
  })

  test("O8 finish emits 'sessions' once", async () => {
    await putSessions([inProgress()])
    const { service, emitted } = harness()
    await service.finish('active')
    expect(emitted()).toBe(1)
  })

  test("O8 applySwap emits 'sessions' once", async () => {
    await putSessions([inProgress()])
    const { service, emitted } = harness()
    await service.applySwap('active', 'row', 'curl')
    expect(emitted()).toBe(1)
  })

  test("O8 undoSwap emits 'sessions' once", async () => {
    await putSessions([inProgress()])
    const { service, emitted } = harness()
    await service.undoSwap('active', 'bench')
    expect(emitted()).toBe(1)
  })

  test("O8 resumeActive's stale finish emits 'sessions' once", async () => {
    await putSessions([
      storedSession({
        id: 'stale',
        startedAt: BASE,
        finishedAt: null,
        entries: [entry('bench', 0, 60, 8, BASE + 60 * SECOND)],
        updatedAt: BASE + 60 * SECOND,
      }),
    ])
    const { service, emitted } = harness()
    await service.resumeActive()
    expect(emitted()).toBe(1)
  })

  test('O8 a write to a missing Session does not emit', async () => {
    const { service, emitted } = harness()
    await expect(service.logSet('missing', entry('bench', 0, 60, 8, NOW))).rejects.toBeInstanceOf(ServiceError)
    await expect(service.finish('missing')).rejects.toBeInstanceOf(ServiceError)
    await expect(service.applySwap('missing', 'row', 'curl')).rejects.toBeInstanceOf(ServiceError)
    await expect(service.undoSwap('missing', 'row')).rejects.toBeInstanceOf(ServiceError)
    expect(emitted()).toBe(0)
  })

  test('O8 a refused undoSwap does not emit', async () => {
    await putSessions([
      storedSession({
        id: 'active',
        startedAt: NOW - HOUR,
        finishedAt: null,
        entries: [entry('curl', 0, 12, 10, NOW - 60 * SECOND)],
        swaps: { row: 'curl' },
      }),
    ])
    const { service, emitted } = harness()
    await expect(service.undoSwap('active', 'row')).rejects.toBeInstanceOf(ServiceError)
    expect(emitted()).toBe(0)
  })
})

// --- E12-T2: updateSet, deleteSet, restoreSet through the service --------------------------

describe('E12-T2 the session service edits a logged Set', () => {
  const squat1 = entry('squat', 1, 60, 8, NOW - 300 * SECOND)
  const squat2 = entry('squat', 2, 62.5, 6, NOW - 200 * SECOND)
  const squat3 = entry('squat', 3, 65, 5, NOW - 100 * SECOND)
  const seed = (): Session =>
    storedSession({
      id: 'active',
      startedAt: NOW - HOUR,
      finishedAt: null,
      entries: [squat1, squat2, squat3],
      updatedAt: NOW - 50 * SECOND,
    })

  test('O1 updateSet stores the values, stamps now() and announces sessions once', async () => {
    await putSessions([seed()])
    const { service, emitted } = harness()

    const updated = await service.updateSet('active', 'squat', 2, { weightKg: 70, reps: 4 })

    expect(updated.entries[1]).toEqual(entry('squat', 2, 70, 4, NOW - 200 * SECOND))
    expect((await stored('active'))?.updatedAt).toBe(NOW)
    expect(emitted()).toBe(1)
  })

  test("O1 updateSet on a missing Session rejects with ServiceError 'not-found' and announces nothing", async () => {
    const { service, emitted } = harness()
    const rejection = service.updateSet('missing', 'squat', 1, { weightKg: 1, reps: 1 })
    await expect(rejection).rejects.toBeInstanceOf(ServiceError)
    await expect(rejection).rejects.toMatchObject({ code: 'not-found' })
    expect(emitted()).toBe(0)
  })

  test('O2 deleteSet returns the Session and the removed entry, renumbers, and announces once', async () => {
    await putSessions([seed()])
    const { service, emitted } = harness()

    const { session, removed } = await service.deleteSet('active', 'squat', 2)

    expect(removed).toEqual(squat2)
    expect(session.entries).toEqual([squat1, entry('squat', 2, 65, 5, NOW - 100 * SECOND)])
    expect((await stored('active'))?.updatedAt).toBe(NOW)
    expect(emitted()).toBe(1)
  })

  test("O2 deleteSet on a missing Session rejects with ServiceError 'not-found'", async () => {
    const rejection = harness().service.deleteSet('missing', 'squat', 1)
    await expect(rejection).rejects.toBeInstanceOf(ServiceError)
    await expect(rejection).rejects.toMatchObject({ code: 'not-found' })
  })

  test('O3 restoreSet puts the deleted Set back so the Sets equal the original and announces', async () => {
    await putSessions([seed()])
    const { service, emitted } = harness()
    const { removed } = await service.deleteSet('active', 'squat', 2)

    const restored = await service.restoreSet('active', removed)

    expect(restored.entries.sort((a, b) => a.setIndex - b.setIndex)).toEqual([squat1, squat2, squat3])
    expect(emitted()).toBe(2)
  })

  test("O3 restoreSet on a missing Session rejects with ServiceError 'not-found'", async () => {
    const rejection = harness().service.restoreSet('missing', squat1)
    await expect(rejection).rejects.toBeInstanceOf(ServiceError)
    await expect(rejection).rejects.toMatchObject({ code: 'not-found' })
  })
})

// --- E12-T6: save, the History editor's single write ---------------------------------------

describe('E12-T6 the session service saves an edited finished Session', () => {
  const bench1 = entry('bench', 1, 60, 8, BASE + 100 * SECOND)
  const bench2 = entry('bench', 2, 62.5, 6, BASE + 200 * SECOND)
  const original = (): Session =>
    storedSession({ id: 'done', entries: [bench1, bench2], updatedAt: BASE + HOUR })

  test('O14 save stores the draft, stamps now() and announces sessions once', async () => {
    await putSessions([original()])
    const { service, emitted } = harness()
    const draft: Session = {
      ...original(),
      finishedAt: BASE + 2 * HOUR,
      entries: [entry('bench', 1, 65, 5, BASE + 100 * SECOND)],
    }

    const saved = await service.save(draft)

    expect(saved).toEqual({ ...draft, updatedAt: NOW })
    expect(await stored('done')).toEqual({ ...draft, updatedAt: NOW })
    expect(emitted()).toBe(1)
  })

  test("O14 save of a Session no longer stored rejects with ServiceError 'not-found' and announces nothing", async () => {
    const { service, emitted } = harness()
    const rejection = service.save(original())
    await expect(rejection).rejects.toBeInstanceOf(ServiceError)
    await expect(rejection).rejects.toMatchObject({ code: 'not-found' })
    expect(emitted()).toBe(0)
    expect(await stored('done')).toBeUndefined()
  })
})

// --- E12-T1: discard marks the Session deleted and announces it --------------------------------

describe('E12-T1 SessionService.discard', () => {
  test('O4 discard stores the Session with deletedAt and updatedAt at the service clock', async () => {
    const active = storedSession({
      id: 'active',
      startedAt: NOW - HOUR,
      finishedAt: null,
      entries: [entry('bench', 0, 60, 8, NOW - 30 * 60 * SECOND)],
      updatedAt: NOW - 30 * 60 * SECOND,
    })
    await putSessions([active])

    await harness().service.discard('active')

    expect(await stored('active')).toEqual({ ...active, deletedAt: NOW, updatedAt: NOW })
  })

  test('O4 after discard of the Session in progress, resumeActive returns null', async () => {
    await putSessions([
      storedSession({ id: 'active', startedAt: NOW - HOUR, finishedAt: null, updatedAt: NOW - HOUR }),
    ])
    const { service } = harness()

    await service.discard('active')

    await expect(service.resumeActive()).resolves.toBeNull()
  })

  test('O4 after discard of a finished Session, list leaves it out', async () => {
    await putSessions([
      storedSession({ id: 'done' }),
      storedSession({ id: 'kept', startedAt: BASE - DAY, finishedAt: BASE - DAY + HOUR }),
    ])
    const { service } = harness()

    await service.discard('done')

    expect((await service.list()).map((session) => session.id)).toEqual(['kept'])
  })

  test("O4 discard announces 'sessions' once", async () => {
    await putSessions([storedSession({ id: 'done' })])
    const { service, emitted } = harness()

    await service.discard('done')

    expect(emitted()).toBe(1)
  })

  test("O4 discard of a missing Session rejects with ServiceError 'not-found' and announces nothing", async () => {
    const { service, emitted } = harness()

    const rejection = service.discard('missing')

    await expect(rejection).rejects.toBeInstanceOf(ServiceError)
    await expect(rejection).rejects.toMatchObject({ code: 'not-found' })
    expect(emitted()).toBe(0)
  })
})

// --- E13-T5: setRest through the service ---------------------------------------------------

describe('E13-T5 the session service stores a changed rest', () => {
  const squat1 = entry('squat', 1, 60, 8, NOW - 300 * SECOND)
  const squat2 = entry('squat', 2, 62.5, 6, NOW - 200 * SECOND)
  const seed = (): Session =>
    storedSession({
      id: 'active',
      startedAt: NOW - HOUR,
      finishedAt: null,
      entries: [squat1, squat2],
      updatedAt: NOW - 50 * SECOND,
    })

  test('O3 setRest stores restSeconds, stamps now() and announces sessions once', async () => {
    await putSessions([seed()])
    const { service, emitted } = harness()

    const updated = await service.setRest('active', 'squat', 2, 150)

    expect(updated.entries).toEqual([squat1, { ...squat2, restSeconds: 150 }])
    expect((await stored('active'))?.entries).toEqual([squat1, { ...squat2, restSeconds: 150 }])
    expect((await stored('active'))?.updatedAt).toBe(NOW)
    expect(emitted()).toBe(1)
  })

  test("O3 setRest on a missing Session rejects with ServiceError 'not-found' and announces nothing", async () => {
    const { service, emitted } = harness()
    const rejection = service.setRest('missing', 'squat', 1, 60)
    await expect(rejection).rejects.toBeInstanceOf(ServiceError)
    await expect(rejection).rejects.toMatchObject({ code: 'not-found' })
    expect(emitted()).toBe(0)
  })
})

// --- E14-T4: setNote through the service ---------------------------------------------------

describe('E14-T4 the session service stores a Session note', () => {
  const seed = (): Session =>
    storedSession({
      id: 'active',
      startedAt: NOW - HOUR,
      finishedAt: null,
      entries: [entry('squat', 1, 60, 8, NOW - 300 * SECOND)],
      updatedAt: NOW - 50 * SECOND,
    })

  test('O12 setNote stores the note in one write, stamps now() and announces sessions once', async () => {
    await putSessions([seed()])
    const { service, emitted } = harness()

    const updated = await service.setNote('active', 'Felt strong')

    expect(updated).toEqual({ ...seed(), note: 'Felt strong', updatedAt: NOW })
    expect(await stored('active')).toEqual({ ...seed(), note: 'Felt strong', updatedAt: NOW })
    expect(emitted()).toBe(1)
  })

  test('O12 setNote with whitespace only removes an existing note', async () => {
    await putSessions([{ ...seed(), note: 'old' }])
    const { service } = harness()

    const updated = await service.setNote('active', '   ')

    expect('note' in updated).toBe(false)
    expect('note' in ((await stored('active')) as Session)).toBe(false)
  })

  test("O12 setNote on a missing Session rejects with ServiceError 'not-found' and announces nothing", async () => {
    const { service, emitted } = harness()
    const rejection = service.setNote('missing', 'x')
    await expect(rejection).rejects.toBeInstanceOf(ServiceError)
    await expect(rejection).rejects.toMatchObject({ code: 'not-found' })
    expect(emitted()).toBe(0)
  })
})

// --- E14-T2: setEffort through the service -------------------------------------------------

describe('E14-T2 the session service stores the effort of a Set', () => {
  const squat1 = entry('squat', 1, 60, 8, NOW - 300 * SECOND)
  const squat2 = entry('squat', 2, 62.5, 6, NOW - 200 * SECOND)
  const seed = (entries = [squat1, squat2]): Session =>
    storedSession({
      id: 'active',
      startedAt: NOW - HOUR,
      finishedAt: null,
      entries,
      updatedAt: NOW - 50 * SECOND,
    })

  test('O8 setEffort stores rir, stamps now() and announces sessions once', async () => {
    await putSessions([seed()])
    const { service, emitted } = harness()

    const updated = await service.setEffort('active', 'squat', 2, 1)

    expect(updated.entries).toEqual([squat1, { ...squat2, rir: 1 }])
    expect((await stored('active'))?.entries).toEqual([squat1, { ...squat2, rir: 1 }])
    expect((await stored('active'))?.updatedAt).toBe(NOW)
    expect(emitted()).toBe(1)
  })

  test('O8 setEffort with null removes rir, stamps now() and announces sessions once', async () => {
    await putSessions([seed([squat1, { ...squat2, rir: 2 }])])
    const { service, emitted } = harness()

    const updated = await service.setEffort('active', 'squat', 2, null)

    expect(updated.entries).toEqual([squat1, squat2])
    const second = (await stored('active'))?.entries[1]
    expect(second && 'rir' in second).toBe(false)
    expect((await stored('active'))?.updatedAt).toBe(NOW)
    expect(emitted()).toBe(1)
  })

  test("O8 setEffort on a missing Session rejects with ServiceError 'not-found' and announces nothing", async () => {
    const { service, emitted } = harness()
    const rejection = service.setEffort('missing', 'squat', 1, 2)
    await expect(rejection).rejects.toBeInstanceOf(ServiceError)
    await expect(rejection).rejects.toMatchObject({ code: 'not-found' })
    expect(emitted()).toBe(0)
  })
})

describe('E14-T9 the session service changes a Set kind', () => {
  const squat1 = entry('squat', 1, 60, 8, NOW - 300 * SECOND)
  const squat2 = { ...entry('squat', 2, 62.5, 6, NOW - 200 * SECOND), kind: 'failure' as const }
  const seed = (): Session =>
    storedSession({
      id: 'active',
      startedAt: NOW - HOUR,
      finishedAt: null,
      entries: [squat1, squat2],
      updatedAt: NOW - 50 * SECOND,
    })

  test('O6 updateSet with a kind stores it through the service', async () => {
    await putSessions([seed()])
    const { service } = harness()

    const updated = await service.updateSet('active', 'squat', 1, { weightKg: 60, reps: 8, kind: 'amrap' })

    expect(updated.entries[0]).toEqual({ ...squat1, kind: 'amrap' })
    expect((await stored('active'))?.entries[0]).toEqual({ ...squat1, kind: 'amrap' })
  })

  test('O6 updateSet with kind null removes the kind through the service', async () => {
    await putSessions([seed()])
    const { service } = harness()

    const updated = await service.updateSet('active', 'squat', 2, { weightKg: 62.5, reps: 6, kind: null })

    expect('kind' in updated.entries[1]).toBe(false)
  })
})

describe('E14-T14 the session service edits a Bodyweight Set Load', () => {
  const pushUp1 = entry('push-ups', 1, null, 12, NOW - 300 * SECOND)
  const pushUp2 = { ...entry('push-ups', 2, null, 8, NOW - 200 * SECOND), loadKg: 10 }
  const seed = (): Session =>
    storedSession({
      id: 'active',
      startedAt: NOW - HOUR,
      finishedAt: null,
      entries: [pushUp1, pushUp2],
      updatedAt: NOW - 50 * SECOND,
    })

  test('O17 updateSet with a loadKg stores it through the service and announces sessions once', async () => {
    await putSessions([seed()])
    const { service, emitted } = harness()

    const updated = await service.updateSet('active', 'push-ups', 2, { weightKg: null, reps: 8, loadKg: 15 })

    expect(updated.entries[1]).toEqual({ ...pushUp2, loadKg: 15 })
    expect((await stored('active'))?.entries[1]).toEqual({ ...pushUp2, loadKg: 15 })
    expect(emitted()).toBe(1)
  })

  test('O17 updateSet with loadKg null removes the Load through the service', async () => {
    await putSessions([seed()])
    const { service } = harness()

    const updated = await service.updateSet('active', 'push-ups', 2, { weightKg: null, reps: 8, loadKg: null })

    expect(updated.entries[1]).toEqual(entry('push-ups', 2, null, 8, NOW - 200 * SECOND))
    expect('loadKg' in updated.entries[1]).toBe(false)
  })

  test('O17 updateSet with a Load outside -60 to +100 rejects with a ServiceError, stores nothing and announces nothing', async () => {
    await putSessions([seed()])
    const { service, emitted } = harness()

    const rejection = service.updateSet('active', 'push-ups', 1, { weightKg: null, reps: 12, loadKg: 120 })

    await expect(rejection).rejects.toBeInstanceOf(ServiceError)
    expect((await stored('active'))?.entries).toEqual([pushUp1, pushUp2])
    expect(emitted()).toBe(0)
  })
})
