import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { db } from './db'
import {
  ACTIVE_PROGRAM_ID_KEY,
  GYM_EQUIPMENT_KEY,
  getActiveProgramId,
  getGymEquipment,
  setActiveProgramId,
  setGymEquipment,
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
