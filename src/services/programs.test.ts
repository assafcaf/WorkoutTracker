import { beforeEach, expect, test, vi } from 'vitest'
import { db } from '../storage/db'
import { ACTIVE_PROGRAM_ID_KEY, getUserPrograms, saveUserProgram } from '../storage/settingsStore'
import { loadPrograms } from '../data/catalog'
import { mergePrograms } from '../domain/programs'
import { createChangeBus } from './changes'
import { ServiceError } from './errors'
import { createProgramService, IN_PROGRESS_MESSAGE } from './programs'
import type { Session, UserProgram } from '../types'

// createProgramService(deps) over fake-indexeddb (installed globally, src/test/setup.ts).
//
// The bundled catalog is fixed: `assaf-ab-2026` (workouts `workout-a`, `workout-b`) and
// `full-body-starter`. Every test below reads or writes against that real catalog, the way
// App.tsx's load and guard did before this service existed.

const NOW = 1_700_000_000_000

beforeEach(async () => {
  await db.open()
  await db.settings.clear()
  await db.sessions.clear()
})

function service(now: number = NOW) {
  return createProgramService({ now: () => now, bus: createChangeBus(), storageAvailable: true })
}

function inProgressSession(over: Partial<Session> & { id: string; programId: string; workoutId: string }): Session {
  return { startedAt: NOW - 1000, finishedAt: null, entries: [], ...over }
}

function userProgram(over: Partial<UserProgram> & { id: string }): UserProgram {
  return {
    name: over.id,
    units: 'kg',
    workouts: [],
    sessionsPerWeek: 3,
    createdAt: NOW,
    ...over,
  }
}

// --- O5: load ---------------------------------------------------------------------------------

test('O5 load resolves the bundled and user Programs merged, as App.tsx merged them', async () => {
  const edited = userProgram({ id: 'assaf-ab-2026', name: 'My AB' })
  await saveUserProgram(edited, NOW)

  const { programs, userPrograms } = await service().load()

  const bundled = loadPrograms()
  expect(programs).toEqual(mergePrograms(bundled, [edited]))
  expect(userPrograms).toEqual([edited])
})

test('O5 load resolves the stored active program id when one is stored', async () => {
  await db.settings.put({ key: ACTIVE_PROGRAM_ID_KEY, value: 'full-body-starter', updatedAt: NOW })

  const { activeProgramId, staleActiveProgramNotice } = await service().load()

  expect(activeProgramId).toBe('full-body-starter')
  expect(staleActiveProgramNotice).toBe(false)
})

test('O5 load falls back to the most recent Session’s program when nothing is stored', async () => {
  await db.sessions.put(
    inProgressSession({ id: 's1', programId: 'full-body-starter', workoutId: 'workout-a', finishedAt: NOW - 500 }),
  )

  const { activeProgramId } = await service().load()

  expect(activeProgramId).toBe('full-body-starter')
})

test('O5 load resolves a null active program id when nothing is stored and there is no Session', async () => {
  const { activeProgramId, staleActiveProgramNotice } = await service().load()

  expect(activeProgramId).toBeNull()
  expect(staleActiveProgramNotice).toBe(false)
})

test('O5 load reports a stale notice when the stored active id names a Program no longer offered', async () => {
  await db.settings.put({ key: ACTIVE_PROGRAM_ID_KEY, value: 'user-gone', updatedAt: NOW })

  const { staleActiveProgramNotice, activeProgramId } = await service().load()

  expect(staleActiveProgramNotice).toBe(true)
  expect(activeProgramId).toBe('assaf-ab-2026')
})

// --- O6/O7: the in-progress guard ------------------------------------------------------------

test('O6 remove rejects with ServiceError in-progress when the Session in progress runs on that Program', async () => {
  await db.sessions.put(inProgressSession({ id: 's1', programId: 'assaf-ab-2026', workoutId: 'workout-a' }))

  const rejection = service().remove('assaf-ab-2026')

  await expect(rejection).rejects.toBeInstanceOf(ServiceError)
  await expect(rejection).rejects.toMatchObject({ code: 'in-progress', message: IN_PROGRESS_MESSAGE })
  expect(await getUserPrograms()).toEqual([])
})

test('O6 remove hides the Program when no Session in progress runs on it', async () => {
  await service().remove('assaf-ab-2026')

  const saved = await getUserPrograms()
  expect(saved).toEqual([expect.objectContaining({ id: 'assaf-ab-2026', hidden: true })])
})

test('O7 save rejects with ServiceError in-progress when it hides the Workout the Session in progress runs on', async () => {
  await db.sessions.put(inProgressSession({ id: 's1', programId: 'assaf-ab-2026', workoutId: 'workout-a' }))
  const hidingA = userProgram({
    id: 'assaf-ab-2026',
    workouts: [{ id: 'workout-a', name: 'Workout A', exercises: [], hidden: true }],
  })

  const rejection = service().save(hidingA)

  await expect(rejection).rejects.toBeInstanceOf(ServiceError)
  await expect(rejection).rejects.toMatchObject({ code: 'in-progress', message: IN_PROGRESS_MESSAGE })
  expect(await getUserPrograms()).toEqual([])
})

test('O7 save stores the Program when it does not hide the Workout the Session in progress runs on', async () => {
  await db.sessions.put(inProgressSession({ id: 's1', programId: 'assaf-ab-2026', workoutId: 'workout-a' }))
  const keepingA = userProgram({
    id: 'assaf-ab-2026',
    workouts: [{ id: 'workout-a', name: 'Workout A', exercises: [] }],
  })

  await service().save(keepingA)

  expect(await getUserPrograms()).toEqual([keepingA])
})

// --- O6/O7: updatedAt is stamped with the given now --------------------------------------------

test('O6 setActive stamps the settings row updatedAt with the given now', async () => {
  await service(NOW).setActive('full-body-starter')

  const row = await db.settings.get(ACTIVE_PROGRAM_ID_KEY)
  expect(row?.updatedAt).toBe(NOW)
})

test('O6 save stamps the stored User Program row updatedAt with the given now', async () => {
  await service(NOW).save(userProgram({ id: 'assaf-ab-2026' }))

  const row = await db.settings.get('userPrograms')
  expect(row?.updatedAt).toBe(NOW)
})

test('O6 remove stamps the stored User Program row updatedAt with the given now', async () => {
  await service(NOW).remove('assaf-ab-2026')

  const row = await db.settings.get('userPrograms')
  expect(row?.updatedAt).toBe(NOW)
})

test('O6 reset stamps the stored User Program row updatedAt with the given now', async () => {
  await saveUserProgram(userProgram({ id: 'assaf-ab-2026' }), NOW - 10_000)

  await service(NOW).reset('assaf-ab-2026')

  const row = await db.settings.get('userPrograms')
  expect(row?.updatedAt).toBe(NOW)
})

// --- O8: the programs subscriber -----------------------------------------------------------

function serviceWithSubscriber(fn: () => void) {
  const bus = createChangeBus()
  bus.subscribe('programs', fn)
  return createProgramService({ now: () => NOW, bus, storageAvailable: true })
}

test('O8 a programs subscriber is called once when setActive succeeds', async () => {
  const fn = vi.fn()
  await serviceWithSubscriber(fn).setActive('full-body-starter')

  expect(fn).toHaveBeenCalledTimes(1)
})

test('O8 a programs subscriber is called once when save succeeds', async () => {
  const fn = vi.fn()
  await serviceWithSubscriber(fn).save(userProgram({ id: 'assaf-ab-2026' }))

  expect(fn).toHaveBeenCalledTimes(1)
})

test('O8 a programs subscriber is called once when remove succeeds', async () => {
  const fn = vi.fn()
  await serviceWithSubscriber(fn).remove('assaf-ab-2026')

  expect(fn).toHaveBeenCalledTimes(1)
})

test('O8 a programs subscriber is called once when reset succeeds', async () => {
  const fn = vi.fn()
  await saveUserProgram(userProgram({ id: 'assaf-ab-2026' }), NOW)

  await serviceWithSubscriber(fn).reset('assaf-ab-2026')

  expect(fn).toHaveBeenCalledTimes(1)
})

test('O8 a programs subscriber is not called when remove rejects with in-progress', async () => {
  await db.sessions.put(inProgressSession({ id: 's1', programId: 'assaf-ab-2026', workoutId: 'workout-a' }))
  const fn = vi.fn()

  await serviceWithSubscriber(fn)
    .remove('assaf-ab-2026')
    .catch(() => {})

  expect(fn).not.toHaveBeenCalled()
})
