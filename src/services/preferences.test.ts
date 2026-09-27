import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { db } from '../storage/db'
import { createChangeBus } from './changes'
import { ServiceError } from './errors'
import { createPreferenceService } from './preferences'
import type { ServiceDeps } from './deps'

// O5: createPreferenceService(deps) has exactly the six preference operations, each round-
// tripped over fake-indexeddb. O7/O8: a setter stamps its row with the fixed `now` and notifies
// one 'preferences' subscriber once; a failed write rejects with ServiceError 'storage-failed'
// and does not notify.

function deps(overrides: Partial<ServiceDeps> = {}): ServiceDeps {
  return { now: () => 1_700_000_000_000, bus: createChangeBus(), storageAvailable: true, ...overrides }
}

beforeEach(async () => {
  await db.open()
  await db.settings.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

test('O5 createPreferenceService exposes exactly the preference operations', () => {
  const service = createPreferenceService(deps())

  expect(Object.keys(service).sort()).toEqual(
    [
      'gymEquipment',
      'lastExportedAt',
      'setGymEquipment',
      'setVolumeBaseline',
      'setWeightStep',
      'volumeBaseline',
      'weightStep',
    ].sort(),
  )
})

test('O5 gymEquipment resolves null when nothing has been saved', async () => {
  const service = createPreferenceService(deps())

  expect(await service.gymEquipment()).toBeNull()
})

test('O5 setGymEquipment then gymEquipment returns the newly saved list', async () => {
  const service = createPreferenceService(deps())

  await service.setGymEquipment(['barbell', 'bench'])

  expect(await service.gymEquipment()).toEqual(['barbell', 'bench'])
})

test('O5 weightStep resolves null for an exercise with no saved step', async () => {
  const service = createPreferenceService(deps())

  expect(await service.weightStep('deadlift')).toBeNull()
})

test('O5 setWeightStep then weightStep returns the newly saved step, leaving other exercises null', async () => {
  const service = createPreferenceService(deps())

  await service.setWeightStep('deadlift', 2.5)

  expect(await service.weightStep('deadlift')).toBe(2.5)
  expect(await service.weightStep('back-squat')).toBeNull()
})

test('O5 volumeBaseline defaults to the last-session baseline when nothing has been saved', async () => {
  const service = createPreferenceService(deps())

  expect(await service.volumeBaseline()).toEqual({ period: 'last' })
})

test('O5 setVolumeBaseline then volumeBaseline returns the newly saved baseline', async () => {
  const service = createPreferenceService(deps())

  await service.setVolumeBaseline({ period: '1m', aggregate: 'avg' })

  expect(await service.volumeBaseline()).toEqual({ period: '1m', aggregate: 'avg' })
})

test('O5 lastExportedAt resolves null when nothing has ever been exported', async () => {
  const service = createPreferenceService(deps())

  expect(await service.lastExportedAt()).toBeNull()
})

test('O5 lastExportedAt resolves the row backup.export stamped, with no setter of its own on the service', async () => {
  await db.settings.put({ key: 'lastExportedAt', value: 1_690_000_000_000 })
  const service = createPreferenceService(deps())

  expect(await service.lastExportedAt()).toBe(1_690_000_000_000)
  expect((service as Record<string, unknown>).setLastExportedAt).toBeUndefined()
})

test('O7 setGymEquipment stamps the row with the fixed now and notifies a preferences subscriber exactly once', async () => {
  const bus = createChangeBus()
  const subscriber = vi.fn()
  bus.subscribe('preferences', subscriber)
  const service = createPreferenceService(deps({ bus }))

  await service.setGymEquipment(['barbell'])

  const row = await db.settings.get('gymEquipment')
  expect(row?.updatedAt).toBe(1_700_000_000_000)
  expect(subscriber).toHaveBeenCalledTimes(1)
})

test('O7 setWeightStep stamps the row with the fixed now and notifies a preferences subscriber exactly once', async () => {
  const bus = createChangeBus()
  const subscriber = vi.fn()
  bus.subscribe('preferences', subscriber)
  const service = createPreferenceService(deps({ bus }))

  await service.setWeightStep('deadlift', 5)

  const row = await db.settings.get('weightSteps')
  expect(row?.updatedAt).toBe(1_700_000_000_000)
  expect(subscriber).toHaveBeenCalledTimes(1)
})

test('O7 setVolumeBaseline stamps the row with the fixed now and notifies a preferences subscriber exactly once', async () => {
  const bus = createChangeBus()
  const subscriber = vi.fn()
  bus.subscribe('preferences', subscriber)
  const service = createPreferenceService(deps({ bus }))

  await service.setVolumeBaseline({ period: 'last' })

  const row = await db.settings.get('volumeBaseline')
  expect(row?.updatedAt).toBe(1_700_000_000_000)
  expect(subscriber).toHaveBeenCalledTimes(1)
})

test('O8 a failed setGymEquipment write rejects with ServiceError storage-failed and does not notify a preferences subscriber', async () => {
  vi.spyOn(db.settings, 'put').mockRejectedValueOnce(new Error('disk full'))
  const bus = createChangeBus()
  const subscriber = vi.fn()
  bus.subscribe('preferences', subscriber)
  const service = createPreferenceService(deps({ bus }))

  const rejection = service.setGymEquipment(['barbell'])

  await expect(rejection).rejects.toBeInstanceOf(ServiceError)
  await expect(rejection).rejects.toMatchObject({ code: 'storage-failed' })
  expect(subscriber).not.toHaveBeenCalled()
})
