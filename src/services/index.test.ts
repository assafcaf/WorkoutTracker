import { beforeEach, describe, expect, test, vi } from 'vitest'
import { db } from '../storage/db'
import { createBackupService } from './backup'
import { createServices, ServiceError, type Services } from './index'

// `fake-indexeddb/auto` is installed globally in src/test/setup.ts; the real repositories run
// underneath. `createBackupService` is wrapped, never replaced, so the deps `createServices`
// hands it can be read back.
vi.mock('./backup', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./backup')>()
  return { ...actual, createBackupService: vi.fn(actual.createBackupService) }
})

beforeEach(async () => {
  vi.mocked(createBackupService).mockClear()
  await db.open()
  await db.sessions.clear()
  await db.settings.clear()
})

const NOW = 1_700_000_000_000

/** A fetch that is never expected to be reached; a call fails the operation loudly. */
const unreachableFetch = vi.fn(async () => {
  throw new Error('no network in this test')
}) as unknown as typeof fetch

function services(storageAvailable = true): Services {
  return createServices({ now: () => NOW, storageAvailable, fetch: unreachableFetch })
}

function ownKeys(value: object): string[] {
  return Object.keys(value).sort()
}

describe('O5 createServices returns exactly the service API', () => {
  test('O5 createServices returns exactly sessions, programs, preferences, catalog, backup, sync and the bus', () => {
    expect(ownKeys(services())).toEqual(
      ['backup', 'bus', 'catalog', 'preferences', 'programs', 'sessions', 'sync'],
    )
  })

  test('O5 the sessions service has exactly the SessionService operations', () => {
    expect(ownKeys(services().sessions)).toEqual([
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

  test('O5 the programs service has exactly the ProgramService operations', () => {
    expect(ownKeys(services().programs)).toEqual(['load', 'remove', 'reset', 'save', 'setActive'])
  })

  test('O5 the preferences service has exactly the PreferenceService operations', () => {
    expect(ownKeys(services().preferences)).toEqual([
      'exerciseNote',
      'gymEquipment',
      'lastExportedAt',
      'setExerciseNote',
      'setGymEquipment',
      'setTrackEffort',
      'setVolumeBaseline',
      'setWeightStep',
      'trackEffort',
      'volumeBaseline',
      'weightStep',
    ])
  })

  test('O5 the catalog service has exactly the CatalogService operations', () => {
    expect(ownKeys(services().catalog)).toEqual(['load', 'resolve'])
  })

  test('O5 the backup service has exactly the BackupService operations', () => {
    expect(ownKeys(services().backup)).toEqual(['confirmImport', 'export', 'read'])
  })

  test('O5 the sync service has exactly the SyncService operations', () => {
    expect(ownKeys(services().sync)).toEqual(['adoptAccount', 'replaceRemote', 'state', 'syncNow'])
  })

  test('O5 the bus has exactly emit and subscribe', () => {
    expect(ownKeys(services().bus)).toEqual(['emit', 'subscribe'])
  })
})

describe('O5 createServices wires the services together', () => {
  test("O5 backup's replaceRemote is sync.replaceRemote", () => {
    const built = services()

    expect(createBackupService).toHaveBeenCalledTimes(1)
    const deps = vi.mocked(createBackupService).mock.calls[0][0]
    expect(deps.replaceRemote).toBe(built.sync.replaceRemote)
  })

  test("O5 backup is built on the same bus as the services' own bus", () => {
    const built = services()

    const deps = vi.mocked(createBackupService).mock.calls[0][0]
    expect(deps.bus).toBe(built.bus)
  })

  test('O5 a preferences write is announced on the services bus', async () => {
    const built = services()
    const heard = vi.fn()
    built.bus.subscribe('preferences', heard)

    await built.preferences.setGymEquipment(['barbell'])

    expect(heard).toHaveBeenCalledTimes(1)
  })

  test('O5 a sessions write is announced on the services bus', async () => {
    const built = services()
    const heard = vi.fn()
    built.bus.subscribe('sessions', heard)

    await built.sessions.start('assaf-ab-2026', 'workout-a')

    expect(heard).toHaveBeenCalledTimes(1)
  })

  test('O5 a programs write is announced on the services bus', async () => {
    const built = services()
    const heard = vi.fn()
    built.bus.subscribe('programs', heard)

    await built.programs.setActive('assaf-ab-2026')

    expect(heard).toHaveBeenCalledTimes(1)
  })

  test('O5 adopting an account through sync announces every topic on the services bus', async () => {
    const built = services()
    const heard: string[] = []
    built.bus.subscribe('sessions', () => heard.push('sessions'))
    built.bus.subscribe('programs', () => heard.push('programs'))
    built.bus.subscribe('preferences', () => heard.push('preferences'))

    await built.sync.adoptAccount('trainee@example.com')

    expect(heard.sort()).toEqual(['preferences', 'programs', 'sessions'])
  })

  test('O5 the services stamp writes with the injected now', async () => {
    const started = await services().sessions.start('assaf-ab-2026', 'workout-a')

    expect(started.startedAt).toBe(NOW)
  })

  test('O5 with storage unavailable a read rejects as storage-unavailable', async () => {
    const read = services(false).preferences.gymEquipment()

    await expect(read).rejects.toBeInstanceOf(ServiceError)
    await expect(read).rejects.toMatchObject({ code: 'storage-unavailable' })
  })
})
