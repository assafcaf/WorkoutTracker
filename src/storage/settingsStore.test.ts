import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { db } from './db'
import {
  ACTIVE_PROGRAM_ID_KEY,
  GYM_EQUIPMENT_KEY,
  getActiveProgramId,
  getGymEquipment,
  getVolumeBaseline,
  getWeightStep,
  getWeightSteps,
  setActiveProgramId,
  setGymEquipment,
  setVolumeBaseline,
  setWeightStep,
} from './settingsStore'
import type { Program } from '../types'

// settingsStore only needs a program's id, so the fixtures below are the minimal shape rather
// than the full bundled catalog/program fixtures other test files use.
function program(id: string, name = id): Program {
  return { id, name, units: 'kg', workouts: [], sessionsPerWeek: 3 }
}

beforeEach(async () => {
  await db.open()
  await db.settings.clear()
})

test('O18 getActiveProgramId defaults to the only program when there is one and nothing is stored', async () => {
  const solo = [program('only-program')]

  expect(await getActiveProgramId(solo)).toBe('only-program')
})

test('O18 getActiveProgramId defaults to the first program in the list when nothing is stored', async () => {
  const programs = [program('assaf-ab-2026'), program('full-body-starter')]

  expect(await getActiveProgramId(programs)).toBe('assaf-ab-2026')
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
