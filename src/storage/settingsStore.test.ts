import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { db } from './db'
import {
  ACTIVE_PROGRAM_ID_KEY,
  GYM_EQUIPMENT_KEY,
  USER_PROGRAMS_KEY,
  deleteProgram,
  getActiveProgramId,
  getUserPrograms,
  getGymEquipment,
  getVolumeBaseline,
  getWeightStep,
  getWeightSteps,
  resetProgram,
  saveUserProgram,
  setActiveProgramId,
  setGymEquipment,
  setVolumeBaseline,
  setWeightStep,
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

// E9-T2 replaced the O18 "defaults to the first program when nothing is stored" rule: with no
// stored id and no Session there is no active Program (O19, below).

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

  test('O19 getActiveProgramId resolves null for an empty database', async () => {
    const programs = [program('assaf-ab-2026'), program('full-body-starter')]

    expect(await getActiveProgramId(programs)).toBeNull()
  })

  test('O19 getActiveProgramId resolves null with no Session even when only one Program is offered', async () => {
    expect(await getActiveProgramId([program('only-program')])).toBeNull()
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
