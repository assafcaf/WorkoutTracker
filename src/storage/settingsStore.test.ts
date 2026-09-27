import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { db } from './db'
import {
  ACTIVE_PROGRAM_ID_KEY,
  GYM_EQUIPMENT_KEY,
  USER_PROGRAMS_KEY,
  deleteKeys,
  deleteProgram,
  getActiveProgramId,
  getUserPrograms,
  getGymEquipment,
  getVolumeBaseline,
  getWeightStep,
  getWeightSteps,
  putRows,
  readRow,
  resetProgram,
  saveUserProgram,
  setActiveProgramId,
  setGymEquipment,
  setLastExportedAt,
  setUserPrograms,
  setVolumeBaseline,
  setWeightStep,
  setWeightSteps,
} from './settingsStore'
import { mergePrograms } from '../domain/programs'
import { loadPrograms } from '../data/catalog'
import type { Program, Session, UserProgram } from '../types'

// settingsStore only needs a program's id, so the fixtures below are the minimal shape rather
// than the full bundled catalog/program fixtures other test files use.
function program(id: string, name = id): Program {
  return { id, name, units: 'kg', workouts: [], sessionsPerWeek: 3 }
}

beforeEach(async () => {
  await db.open()
  await db.settings.clear()
})

// E9-T2 O19 replaced O18's "defaults to a program when nothing is stored": with no stored id and
// no Session there is no active Program, so the same two setups now resolve null. The titles are
// kept as they were on purpose (the merge's weakened-tests check matches titles); the bodies are
// the O19 contract.

test('O19 getActiveProgramId resolves null for the only program when nothing is stored and there is no Session', async () => {
  await db.sessions.clear()
  const solo = [program('only-program')]

  expect(await getActiveProgramId(solo)).toBeNull()
})

test('O19 getActiveProgramId resolves null, not the first program in the list, when nothing is stored and there is no Session', async () => {
  await db.sessions.clear()
  const programs = [program('assaf-ab-2026'), program('full-body-starter')]

  expect(await getActiveProgramId(programs)).toBeNull()
})

test('O18 setActiveProgramId then getActiveProgramId returns the newly chosen program', async () => {
  const programs = [program('assaf-ab-2026'), program('full-body-starter')]

  await setActiveProgramId('full-body-starter')

  expect(await getActiveProgramId(programs)).toBe('full-body-starter')
})

test('O18 the active program choice survives closing and reopening the database', async () => {
  const programs = [program('assaf-ab-2026'), program('full-body-starter')]
  await setActiveProgramId('full-body-starter')

  // A restart: drop the open connection, and with it every bit of in-memory state, before
  // asking again. A value only held in React state, never written through, would not survive
  // this.
  db.close()
  await db.open()

  expect(await getActiveProgramId(programs)).toBe('full-body-starter')
})

test('O18 getActiveProgramId falls back to the first program when the stored id names a program that no longer exists', async () => {
  const programs = [program('assaf-ab-2026'), program('full-body-starter')]
  await setActiveProgramId('retired-program')

  expect(await getActiveProgramId(programs)).toBe('assaf-ab-2026')
})

// --- a new user starts with no Program (E9-T2 O19, O20) --------------------------------------

describe('E9-T2 getActiveProgramId with no stored choice', () => {
  const DAY_MS = 24 * 60 * 60 * 1000
  const BASE = 1_700_000_000_000

  /** A Session on `programId`, started `startedAt`; finished an hour later unless `inProgress`. */
  function session(id: string, programId: string, startedAt: number, inProgress = false): Session {
    return {
      id,
      programId,
      workoutId: 'workout-a',
      startedAt,
      finishedAt: inProgress ? null : startedAt + 3_600_000,
      entries: [],
      updatedAt: startedAt,
    }
  }

  beforeEach(async () => {
    await db.sessions.clear()
  })

  test('O20 getActiveProgramId adopts the Program of the Session with the latest startedAt', async () => {
    const programs = [program('assaf-ab-2026'), program('full-body-starter')]
    await db.sessions.bulkPut([
      session('s-old', 'assaf-ab-2026', BASE),
      session('s-new', 'full-body-starter', BASE + 3 * DAY_MS),
      session('s-mid', 'assaf-ab-2026', BASE + DAY_MS),
    ])

    expect(await getActiveProgramId(programs)).toBe('full-body-starter')
  })

  test('O20 getActiveProgramId stores the adopted Program as activeProgramId', async () => {
    const programs = [program('assaf-ab-2026'), program('full-body-starter')]
    await db.sessions.bulkPut([
      session('s-old', 'assaf-ab-2026', BASE),
      session('s-new', 'full-body-starter', BASE + DAY_MS),
    ])

    await getActiveProgramId(programs)

    expect((await db.settings.get(ACTIVE_PROGRAM_ID_KEY))?.value).toBe('full-body-starter')
  })

  test('O20 a Session still in progress counts as the latest Session', async () => {
    const programs = [program('assaf-ab-2026'), program('full-body-starter')]
    await db.sessions.bulkPut([
      session('s-done', 'assaf-ab-2026', BASE),
      session('s-open', 'full-body-starter', BASE + DAY_MS, true),
    ])

    expect(await getActiveProgramId(programs)).toBe('full-body-starter')
  })

  test('O20 a lone Session in progress is enough to adopt its Program', async () => {
    const programs = [program('assaf-ab-2026'), program('full-body-starter')]
    await db.sessions.put(session('s-open', 'full-body-starter', BASE, true))

    expect(await getActiveProgramId(programs)).toBe('full-body-starter')
  })

  test('O20 the latest Session on a Program no longer offered falls back to the first Program and stores it', async () => {
    const programs = [program('assaf-ab-2026'), program('full-body-starter')]
    await db.sessions.bulkPut([
      session('s-old', 'full-body-starter', BASE),
      session('s-new', 'retired-program', BASE + DAY_MS),
    ])

    expect(await getActiveProgramId(programs)).toBe('assaf-ab-2026')
    expect((await db.settings.get(ACTIVE_PROGRAM_ID_KEY))?.value).toBe('assaf-ab-2026')
  })

  test('O20 a stored id among the Programs wins over the latest Session', async () => {
    const programs = [program('assaf-ab-2026'), program('full-body-starter')]
    await setActiveProgramId('assaf-ab-2026')
    await db.sessions.put(session('s-new', 'full-body-starter', BASE + DAY_MS))

    expect(await getActiveProgramId(programs)).toBe('assaf-ab-2026')
  })

  test('O20 a stored id no longer among the Programs falls back to the first Program, not the latest Session', async () => {
    const programs = [program('assaf-ab-2026'), program('full-body-starter')]
    await setActiveProgramId('retired-program')
    await db.sessions.put(session('s-new', 'full-body-starter', BASE + DAY_MS))

    expect(await getActiveProgramId(programs)).toBe('assaf-ab-2026')
  })
})

// --- getGymEquipment / setGymEquipment (E5-T11) --------------------------------------------

test('S16 getGymEquipment returns null when nothing has been stored, meaning everything is available', async () => {
  expect(await getGymEquipment()).toBeNull()
})

test('S16 setGymEquipment then getGymEquipment returns the newly saved list', async () => {
  await setGymEquipment(['barbell', 'dumbbell', 'bench'])

  expect(await getGymEquipment()).toEqual(['barbell', 'dumbbell', 'bench'])
})

test('S16 the gym equipment list survives closing and reopening the database', async () => {
  await setGymEquipment(['barbell', 'dumbbell'])

  db.close()
  await db.open()

  expect(await getGymEquipment()).toEqual(['barbell', 'dumbbell'])
})

// --- updatedAt on every synced setting (E7-T2) ----------------------------------------------

describe('O8 every synced setting write stamps updatedAt', () => {
  // The device clock, pinned so the stamp is a literal.
  const CLOCK = 1_700_000_000_000

  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(CLOCK)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('O8 setActiveProgramId stores its row with updatedAt equal to the time of the write', async () => {
    await setActiveProgramId('full-body-starter')

    expect(await db.settings.get(ACTIVE_PROGRAM_ID_KEY)).toEqual({
      key: ACTIVE_PROGRAM_ID_KEY,
      value: 'full-body-starter',
      updatedAt: CLOCK,
    })
  })

  test('O8 setGymEquipment stores its row with updatedAt equal to the time of the write', async () => {
    await setGymEquipment(['barbell', 'bench'])

    expect(await db.settings.get(GYM_EQUIPMENT_KEY)).toEqual({
      key: GYM_EQUIPMENT_KEY,
      value: ['barbell', 'bench'],
      updatedAt: CLOCK,
    })
  })

  test('O8 overwriting a synced setting restamps updatedAt with the later write time', async () => {
    await setGymEquipment(['barbell'])
    vi.spyOn(Date, 'now').mockReturnValue(CLOCK + 60_000)

    await setGymEquipment(['barbell', 'bench'])

    expect((await db.settings.get(GYM_EQUIPMENT_KEY))?.updatedAt).toBe(CLOCK + 60_000)
  })
})

// --- weight steps (E8-T3 O1) -----------------------------------------------------------------

test('O1 getWeightStep returns null for an Exercise with no stored step', async () => {
  expect(await getWeightStep('back-squat')).toBeNull()
})

test('O1 getWeightSteps returns an empty record when no step has been stored', async () => {
  expect(await getWeightSteps()).toEqual({})
})

test('O1 setWeightStep then getWeightStep returns the stored step for that Exercise', async () => {
  await setWeightStep('back-squat', 5)

  expect(await getWeightStep('back-squat')).toBe(5)
})

test('O1 a step stored for one Exercise leaves another Exercise with no stored step', async () => {
  await setWeightStep('back-squat', 5)

  expect(await getWeightStep('bench-press')).toBeNull()
})

test('O1 steps stored for two Exercises are both kept and listed by getWeightSteps', async () => {
  await setWeightStep('back-squat', 5)
  await setWeightStep('bench-press', 1.25)

  expect(await getWeightSteps()).toEqual({ 'back-squat': 5, 'bench-press': 1.25 })
})

test('O1 overwriting one Exercise step replaces it and keeps the others', async () => {
  await setWeightStep('back-squat', 5)
  await setWeightStep('bench-press', 1.25)

  await setWeightStep('back-squat', 2.5)

  expect(await getWeightSteps()).toEqual({ 'back-squat': 2.5, 'bench-press': 1.25 })
})

test('O1 every weight step is kept in the one weightSteps settings row', async () => {
  await setWeightStep('back-squat', 5)
  await setWeightStep('bench-press', 1.25)

  expect((await db.settings.get('weightSteps'))?.value).toEqual({
    'back-squat': 5,
    'bench-press': 1.25,
  })
  expect(await db.settings.count()).toBe(1)
})

test('O1 a stored weight step survives closing and reopening the database', async () => {
  await setWeightStep('back-squat', 5)

  db.close()
  await db.open()

  expect(await getWeightStep('back-squat')).toBe(5)
})

// --- volume baseline (E8-T3 O2) --------------------------------------------------------------

test('O2 getVolumeBaseline defaults to the last Session when no choice is stored', async () => {
  expect(await getVolumeBaseline()).toEqual({ period: 'last' })
})

test('O2 setVolumeBaseline then getVolumeBaseline reads back a period with an aggregate', async () => {
  await setVolumeBaseline({ period: '3m', aggregate: 'max' })

  expect(await getVolumeBaseline()).toEqual({ period: '3m', aggregate: 'max' })
})

test('O2 setVolumeBaseline then getVolumeBaseline reads back a since date with an aggregate', async () => {
  await setVolumeBaseline({ period: 'since', since: 1_700_000_000_000, aggregate: 'avg' })

  expect(await getVolumeBaseline()).toEqual({
    period: 'since',
    since: 1_700_000_000_000,
    aggregate: 'avg',
  })
})

test('O2 choosing the last Session again after another baseline reads back the last Session', async () => {
  await setVolumeBaseline({ period: '1w', aggregate: 'avg' })

  await setVolumeBaseline({ period: 'last' })

  expect(await getVolumeBaseline()).toEqual({ period: 'last' })
})

test('O2 the volume baseline survives closing and reopening the database', async () => {
  await setVolumeBaseline({ period: '3m', aggregate: 'max' })

  db.close()
  await db.open()

  expect(await getVolumeBaseline()).toEqual({ period: '3m', aggregate: 'max' })
})

// --- updatedAt on the E8 synced settings (E8-T3 O3) ------------------------------------------

describe('O3 the weight step and volume baseline writes stamp updatedAt', () => {
  const CLOCK = 1_700_000_000_000

  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(CLOCK)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('O3 setWeightStep stores the weightSteps row with updatedAt equal to the time of the write', async () => {
    await setWeightStep('back-squat', 5)

    expect(await db.settings.get('weightSteps')).toEqual({
      key: 'weightSteps',
      value: { 'back-squat': 5 },
      updatedAt: CLOCK,
    })
  })

  test('O3 setWeightStep for a second Exercise restamps updatedAt with the later write time', async () => {
    await setWeightStep('back-squat', 5)
    vi.spyOn(Date, 'now').mockReturnValue(CLOCK + 60_000)

    await setWeightStep('bench-press', 1.25)

    expect((await db.settings.get('weightSteps'))?.updatedAt).toBe(CLOCK + 60_000)
  })

  test('O3 setVolumeBaseline stores the volumeBaseline row with updatedAt equal to the time of the write', async () => {
    await setVolumeBaseline({ period: '3m', aggregate: 'max' })

    expect(await db.settings.get('volumeBaseline')).toEqual({
      key: 'volumeBaseline',
      value: { period: '3m', aggregate: 'max' },
      updatedAt: CLOCK,
    })
  })
})

// --- User Programs (E9-T5 O5) ----------------------------------------------------------------

/** A minimal User Program: the store keeps whatever it is handed, so no Workouts are needed. */
function userProgram(id: string, overrides: Partial<UserProgram> = {}): UserProgram {
  return {
    id,
    name: id,
    units: 'kg',
    workouts: [],
    sessionsPerWeek: 3,
    createdAt: 1_700_000_000_000,
    ...overrides,
  }
}

test('O5 getUserPrograms returns an empty list when no User Program has been stored', async () => {
  expect(await getUserPrograms()).toEqual([])
})

test('O5 saveUserProgram into an empty store then getUserPrograms reads back exactly that Program', async () => {
  const mine = userProgram('my-push-pull', { name: 'Push pull' })

  await saveUserProgram(mine)

  expect(await getUserPrograms()).toEqual([
    {
      id: 'my-push-pull',
      name: 'Push pull',
      units: 'kg',
      workouts: [],
      sessionsPerWeek: 3,
      createdAt: 1_700_000_000_000,
    },
  ])
})

test('O5 saving a Program with a new id appends it after the ones already stored', async () => {
  await saveUserProgram(userProgram('first'))
  await saveUserProgram(userProgram('second', { createdAt: 1_700_000_100_000 }))

  expect((await getUserPrograms()).map((p) => p.id)).toEqual(['first', 'second'])
})

test('O5 saving a Program again with a change replaces the stored copy with that id, keeping the others', async () => {
  await saveUserProgram(userProgram('first'))
  await saveUserProgram(userProgram('second'))

  await saveUserProgram(userProgram('first', { name: 'Renamed', sessionsPerWeek: 4 }))

  const stored = await getUserPrograms()
  expect(stored).toHaveLength(2)
  expect(stored.find((p) => p.id === 'first')).toEqual(
    userProgram('first', { name: 'Renamed', sessionsPerWeek: 4 }),
  )
  expect(stored.find((p) => p.id === 'second')).toEqual(userProgram('second'))
})

test('O5 resetProgram removes the user copy of a bundled Program so mergePrograms shows the bundled one again', async () => {
  const bundled = loadPrograms()
  const original = bundled.find((p) => p.id === 'assaf-ab-2026')!
  await saveUserProgram({ ...original, name: 'My edited AB', createdAt: 1_700_000_000_000 })

  await resetProgram('assaf-ab-2026')

  expect(await getUserPrograms()).toEqual([])
  const shown = mergePrograms(bundled, await getUserPrograms()).find((p) => p.id === 'assaf-ab-2026')
  expect(shown?.name).toBe(original.name)
  expect(shown?.name).not.toBe('My edited AB')
})

test('O5 resetProgram leaves every other User Program stored', async () => {
  await saveUserProgram(userProgram('assaf-ab-2026'))
  await saveUserProgram(userProgram('my-push-pull'))

  await resetProgram('assaf-ab-2026')

  expect(await getUserPrograms()).toEqual([userProgram('my-push-pull')])
})

test('O5 resetProgram for an id with no user copy changes nothing stored', async () => {
  await saveUserProgram(userProgram('my-push-pull'))

  await resetProgram('assaf-ab-2026')

  expect(await getUserPrograms()).toEqual([userProgram('my-push-pull')])
})

test('O5 deleteProgram keeps the user copy, marked hidden: true', async () => {
  await saveUserProgram(userProgram('my-push-pull'))

  await deleteProgram('my-push-pull')

  expect(await getUserPrograms()).toEqual([userProgram('my-push-pull', { hidden: true })])
})

test('O5 deleteProgram hides only the Program with that id', async () => {
  await saveUserProgram(userProgram('first'))
  await saveUserProgram(userProgram('second'))

  await deleteProgram('first')

  const stored = await getUserPrograms()
  expect(stored.find((p) => p.id === 'first')?.hidden).toBe(true)
  expect(stored.find((p) => p.id === 'second')).toEqual(userProgram('second'))
})

test('O5 every User Program is kept in the one userPrograms settings row', async () => {
  await saveUserProgram(userProgram('first'))
  await saveUserProgram(userProgram('second'))

  expect(USER_PROGRAMS_KEY).toBe('userPrograms')
  expect((await db.settings.get('userPrograms'))?.value).toEqual([
    userProgram('first'),
    userProgram('second'),
  ])
  expect(await db.settings.count()).toBe(1)
})

test('O5 stored User Programs survive closing and reopening the database', async () => {
  await saveUserProgram(userProgram('my-push-pull'))

  db.close()
  await db.open()

  expect(await getUserPrograms()).toEqual([userProgram('my-push-pull')])
})

describe('O5 every User Program write stamps updatedAt', () => {
  const CLOCK = 1_700_000_000_000

  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(CLOCK)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('O5 saveUserProgram stores the userPrograms row with updatedAt equal to the time of the write', async () => {
    await saveUserProgram(userProgram('my-push-pull'))

    expect(await db.settings.get('userPrograms')).toEqual({
      key: 'userPrograms',
      value: [userProgram('my-push-pull')],
      updatedAt: CLOCK,
    })
  })

  test('O5 resetProgram restamps the userPrograms row with the later write time', async () => {
    await saveUserProgram(userProgram('assaf-ab-2026'))
    await saveUserProgram(userProgram('my-push-pull'))
    vi.spyOn(Date, 'now').mockReturnValue(CLOCK + 60_000)

    await resetProgram('assaf-ab-2026')

    expect((await db.settings.get('userPrograms'))?.updatedAt).toBe(CLOCK + 60_000)
  })

  test('O5 deleteProgram restamps the userPrograms row with the later write time', async () => {
    await saveUserProgram(userProgram('my-push-pull'))
    vi.spyOn(Date, 'now').mockReturnValue(CLOCK + 60_000)

    await deleteProgram('my-push-pull')

    expect((await db.settings.get('userPrograms'))?.updatedAt).toBe(CLOCK + 60_000)
  })
})

// --- whole rows for sync and backup (E11-T2) -------------------------------------------------

describe('D3 sync and backup read, write and delete whole setting rows', () => {
  // The device clock, pinned far from every stamp below: a whole-row write keeps the stamp given.
  const CLOCK = 1_800_000_000_000

  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(CLOCK)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('D3 readRow returns the stored row whole, updatedAt included', async () => {
    await db.settings.put({ key: 'gymEquipment', value: ['barbell'], updatedAt: 1_700_000_000_000 })

    expect(await readRow('gymEquipment')).toEqual({
      key: 'gymEquipment',
      value: ['barbell'],
      updatedAt: 1_700_000_000_000,
    })
  })

  test('D3 readRow returns a device-local row that has no updatedAt', async () => {
    await db.settings.put({ key: 'syncCursor', value: 42 })

    expect(await readRow('syncCursor')).toEqual({ key: 'syncCursor', value: 42 })
  })

  test('D3 readRow of a key with nothing stored returns undefined', async () => {
    expect(await readRow('volumeBaseline')).toBeUndefined()
  })

  test('D3 putRows stores each row with the updatedAt it is given, not the clock', async () => {
    await putRows([
      { key: 'gymEquipment', value: ['barbell'], updatedAt: 1_700_000_000_005 },
      { key: 'weightSteps', value: { 'back-squat': 2.5 }, updatedAt: 1_700_000_000_007 },
    ])

    expect(await db.settings.get('gymEquipment')).toEqual({
      key: 'gymEquipment',
      value: ['barbell'],
      updatedAt: 1_700_000_000_005,
    })
    expect(await db.settings.get('weightSteps')).toEqual({
      key: 'weightSteps',
      value: { 'back-squat': 2.5 },
      updatedAt: 1_700_000_000_007,
    })
  })

  test('D3 putRows stores a row given without updatedAt without one', async () => {
    await putRows([{ key: 'lastSyncedAt', value: 1_700_000_000_009 }])

    expect(await db.settings.get('lastSyncedAt')).toEqual({ key: 'lastSyncedAt', value: 1_700_000_000_009 })
  })

  test('D3 putRows replaces a stored row whole and leaves other rows alone', async () => {
    await db.settings.bulkPut([
      { key: 'gymEquipment', value: ['barbell', 'rack'], updatedAt: 1_700_000_000_000 },
      { key: 'activeProgramId', value: 'assaf-ab-2026', updatedAt: 1_700_000_000_000 },
    ])

    await putRows([{ key: 'gymEquipment', value: ['dumbbell'], updatedAt: 1_700_000_000_001 }])

    expect(await db.settings.toArray()).toEqual([
      { key: 'activeProgramId', value: 'assaf-ab-2026', updatedAt: 1_700_000_000_000 },
      { key: 'gymEquipment', value: ['dumbbell'], updatedAt: 1_700_000_000_001 },
    ])
  })

  test('D3 putRows with no rows leaves the settings as they were', async () => {
    await db.settings.put({ key: 'gymEquipment', value: ['barbell'], updatedAt: 1_700_000_000_000 })

    await putRows([])

    expect(await db.settings.toArray()).toEqual([
      { key: 'gymEquipment', value: ['barbell'], updatedAt: 1_700_000_000_000 },
    ])
  })

  test('D3 deleteKeys deletes the named rows and keeps every other row', async () => {
    await db.settings.bulkPut([
      { key: 'activeProgramId', value: 'assaf-ab-2026', updatedAt: 1_700_000_000_000 },
      { key: 'gymEquipment', value: ['barbell'], updatedAt: 1_700_000_000_000 },
      { key: 'syncCursor', value: 42 },
      { key: 'accountEmail', value: 'lifter@example.com' },
    ])

    await deleteKeys(['activeProgramId', 'syncCursor'])

    expect(await db.settings.toArray()).toEqual([
      { key: 'accountEmail', value: 'lifter@example.com' },
      { key: 'gymEquipment', value: ['barbell'], updatedAt: 1_700_000_000_000 },
    ])
  })

  test('D3 deleteKeys naming a key with nothing stored deletes the others and does not fail', async () => {
    await db.settings.put({ key: 'gymEquipment', value: ['barbell'], updatedAt: 1_700_000_000_000 })

    await deleteKeys(['volumeBaseline', 'gymEquipment'])

    expect(await db.settings.count()).toBe(0)
  })
})

describe('D4 every settings setter given now stamps updatedAt with it', () => {
  // The device clock, pinned far from NOW: a setter given a `now` must stamp that, not the clock.
  const CLOCK = 1_800_000_000_000
  const NOW = 1_750_000_000_000

  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(CLOCK)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('D4 setActiveProgramId given now stamps the activeProgramId row with it', async () => {
    await setActiveProgramId('assaf-ab-2026', NOW)

    expect(await db.settings.get('activeProgramId')).toEqual({
      key: 'activeProgramId',
      value: 'assaf-ab-2026',
      updatedAt: NOW,
    })
  })

  test('D4 setLastExportedAt given now stamps the lastExportedAt row with it', async () => {
    await setLastExportedAt(1_740_000_000_000, NOW)

    expect(await db.settings.get('lastExportedAt')).toEqual({
      key: 'lastExportedAt',
      value: 1_740_000_000_000,
      updatedAt: NOW,
    })
  })

  test('D4 setGymEquipment given now stamps the gymEquipment row with it', async () => {
    await setGymEquipment(['barbell'], NOW)

    expect(await db.settings.get('gymEquipment')).toEqual({
      key: 'gymEquipment',
      value: ['barbell'],
      updatedAt: NOW,
    })
  })

  test('D4 setWeightStep given now stamps the weightSteps row with it', async () => {
    await setWeightStep('back-squat', 2.5, NOW)

    expect(await db.settings.get('weightSteps')).toEqual({
      key: 'weightSteps',
      value: { 'back-squat': 2.5 },
      updatedAt: NOW,
    })
  })

  test('D4 setWeightSteps given now stamps the weightSteps row with it', async () => {
    await setWeightSteps({ 'back-squat': 2.5, 'bench-press': 1.25 }, NOW)

    expect(await db.settings.get('weightSteps')).toEqual({
      key: 'weightSteps',
      value: { 'back-squat': 2.5, 'bench-press': 1.25 },
      updatedAt: NOW,
    })
  })

  test('D4 setVolumeBaseline given now stamps the volumeBaseline row with it', async () => {
    await setVolumeBaseline({ period: '1m', aggregate: 'max' }, NOW)

    expect(await db.settings.get('volumeBaseline')).toEqual({
      key: 'volumeBaseline',
      value: { period: '1m', aggregate: 'max' },
      updatedAt: NOW,
    })
  })

  test('D4 setUserPrograms given now stamps the userPrograms row with it', async () => {
    await setUserPrograms([userProgram('my-push-pull')], NOW)

    expect(await db.settings.get('userPrograms')).toEqual({
      key: 'userPrograms',
      value: [userProgram('my-push-pull')],
      updatedAt: NOW,
    })
  })

  test('D4 saveUserProgram given now stamps the userPrograms row with it', async () => {
    await saveUserProgram(userProgram('my-push-pull'), NOW)

    expect(await db.settings.get('userPrograms')).toEqual({
      key: 'userPrograms',
      value: [userProgram('my-push-pull')],
      updatedAt: NOW,
    })
  })

  test('D4 resetProgram given now stamps the userPrograms row with it', async () => {
    await db.settings.put({
      key: 'userPrograms',
      value: [userProgram('assaf-ab-2026'), userProgram('my-push-pull')],
      updatedAt: 1_700_000_000_000,
    })

    await resetProgram('assaf-ab-2026', NOW)

    expect(await db.settings.get('userPrograms')).toEqual({
      key: 'userPrograms',
      value: [userProgram('my-push-pull')],
      updatedAt: NOW,
    })
  })

  test('D4 deleteProgram given now stamps the userPrograms row with it', async () => {
    await db.settings.put({
      key: 'userPrograms',
      value: [userProgram('my-push-pull')],
      updatedAt: 1_700_000_000_000,
    })

    await deleteProgram('my-push-pull', NOW)

    expect(await db.settings.get('userPrograms')).toEqual({
      key: 'userPrograms',
      value: [userProgram('my-push-pull', { hidden: true })],
      updatedAt: NOW,
    })
  })
})
