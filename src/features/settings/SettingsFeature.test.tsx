import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { db } from '../../storage/db'
import { getGymEquipment, getVolumeBaseline, saveUserProgram } from '../../storage/settingsStore'
import { listSessions } from '../../storage/sessionStore'
// A value import, not a type-only one: evaluating `storage/backup.ts` is also what installs the
// feature-detected `Blob.prototype.text` polyfill the export test below reads downloaded blobs
// through (see `src/App.test.tsx`'s own O14 tests).
import { BACKUP_SCHEMA_VERSION, type BackupFile } from '../../storage/backup'
import { createBackupService } from '../../services/backup'
import { createCatalogService } from '../../services/catalog'
import { createChangeBus } from '../../services/changes'
import { createPreferenceService } from '../../services/preferences'
import { createProgramService } from '../../services/programs'
import { createSessionService } from '../../services/sessions'
import type { Services, SyncResult, SyncService } from '../../services'
import type { Session, UserProgram } from '../../types'
import { ServicesProvider } from '../ServicesProvider'
import { SettingsFeature } from './SettingsFeature'

// fake-indexeddb is installed globally in src/test/setup.ts (see src/features/useServiceData.test.tsx),
// so every service below except `sync` is the real thing over the real repositories. `sync` is a
// double, matching the double `src/features/ServicesProvider.test.tsx` uses: SettingsFeature only
// reads it through `useSyncControls()`, never the network.

const NOW = 1_700_000_000_000
const SETTLE = { timeout: 2000 }

beforeEach(async () => {
  await db.open()
  await db.sessions.clear()
  await db.settings.clear()
})

let anchorClick: { mockRestore(): void } | null = null

/** Installs the object-URL download path `downloadOrShare` falls back to under jsdom, and
 * returns the blobs handed to the browser, in order (mirrors `src/App.test.tsx`'s O14 tests). */
function captureDownloads(): Blob[] {
  const blobs: Blob[] = []
  Object.defineProperty(URL, 'createObjectURL', {
    value: vi.fn((blob: Blob) => {
      blobs.push(blob)
      return 'blob:mock-url'
    }),
    configurable: true,
    writable: true,
  })
  Object.defineProperty(URL, 'revokeObjectURL', {
    value: vi.fn(),
    configurable: true,
    writable: true,
  })
  anchorClick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  return blobs
}

afterEach(() => {
  anchorClick?.mockRestore()
  anchorClick = null
  delete (URL as unknown as { createObjectURL?: unknown }).createObjectURL
  delete (URL as unknown as { revokeObjectURL?: unknown }).revokeObjectURL
})

/** A second visible Program, alongside the bundled `assaf-ab-2026` (the only other visible one;
 * `full-body-starter` is bundled hidden), so switching the active Program has somewhere to go. */
const SECOND_PROGRAM: UserProgram = {
  id: 'second-visible-program',
  name: 'Second Program',
  units: 'kg',
  sessionsPerWeek: 1,
  workouts: [
    {
      id: 'second-workout',
      name: 'Second Workout',
      exercises: [{ exerciseId: 'back-squat', sets: 3, repRange: [8, 10], restSeconds: 90 }],
    },
  ],
  createdAt: NOW,
}

function fakeSync(): SyncService & { syncNow: ReturnType<typeof vi.fn>; adoptAccount: ReturnType<typeof vi.fn> } {
  const ok: SyncResult = { status: 'ok', at: NOW, pushed: 0, pulled: 0 }
  return {
    state: async () => ({ accountEmail: 'trainee@example.com', lastSyncedAt: NOW }),
    syncNow: vi.fn(async () => ok),
    replaceRemote: async () => ok,
    adoptAccount: vi.fn(async () => {}),
  }
}

/** Every real service over one bus, built by hand so this test does not rest on `createServices`. */
function buildServices(sync: SyncService): Services {
  const bus = createChangeBus()
  const deps = { now: () => NOW, bus, storageAvailable: true }
  return {
    sessions: createSessionService(deps),
    programs: createProgramService(deps),
    preferences: createPreferenceService(deps),
    catalog: createCatalogService(deps),
    backup: createBackupService({ ...deps, replaceRemote: sync.replaceRemote }),
    sync,
    bus,
  }
}

function renderFeature(services: Services): { navigate: ReturnType<typeof vi.fn>; onInSession: ReturnType<typeof vi.fn> } {
  const navigate = vi.fn()
  const onInSession = vi.fn()
  render(
    <ServicesProvider services={services}>
      <SettingsFeature navigate={navigate} onInSession={onInSession} />
    </ServicesProvider>,
  )
  return { navigate, onInSession }
}

/** The "Active program" fieldset, whose accessible name comes from its `<legend>`. */
function activeProgramGroup(): HTMLElement {
  return screen.getByRole('group', { name: 'Active program' })
}

/** The "My gym's equipment" fieldset. */
function gymEquipmentGroup(): HTMLElement {
  return screen.getByRole('group', { name: /gym.s equipment/i })
}

function loggedSessions(count: number, idPrefix: string, newest: number): Session[] {
  return Array.from({ length: count }, (_unused, index) => {
    const startedAt = newest - index * 86_400_000
    return {
      id: `${idPrefix}-${index}`,
      programId: 'assaf-ab-2026',
      workoutId: 'workout-a',
      startedAt,
      finishedAt: startedAt + 3_600_000,
      entries: [
        { exerciseId: 'back-squat', setIndex: 1, weightKg: 60, reps: 10, loggedAt: startedAt + 60_000 },
      ],
    }
  })
}

// --- O13: switches the active Program -------------------------------------------------------

test('O13 SettingsFeature switches the active Program when another one is chosen', async () => {
  const user = userEvent.setup()
  await saveUserProgram(SECOND_PROGRAM, NOW)
  const services = buildServices(fakeSync())
  renderFeature(services)

  await waitFor(() => {
    expect(within(activeProgramGroup()).getByText('Second Program')).toBeInTheDocument()
  }, SETTLE)

  await user.click(within(activeProgramGroup()).getByRole('radio', { name: 'Second Program' }))

  await waitFor(() => {
    expect(within(activeProgramGroup()).getByRole('radio', { name: 'Second Program' })).toBeChecked()
  }, SETTLE)
  expect(within(activeProgramGroup()).getByRole('radio', { name: 'A/B Split' })).not.toBeChecked()
})

// --- O13: saves gym equipment ----------------------------------------------------------------

test('O13 SettingsFeature saves the next gym equipment list when a type is unticked', async () => {
  const user = userEvent.setup()
  const services = buildServices(fakeSync())
  renderFeature(services)
  await waitFor(() => {
    expect(within(gymEquipmentGroup()).getAllByRole('checkbox').length).toBeGreaterThan(0)
  }, SETTLE)
  const firstCheckbox = within(gymEquipmentGroup()).getAllByRole('checkbox')[0]
  const label = firstCheckbox.closest('label')
  const typeName = label?.textContent ?? ''
  expect(firstCheckbox).toBeChecked()

  await user.click(firstCheckbox)

  await waitFor(async () => {
    const stored = await getGymEquipment()
    expect(stored).not.toBeNull()
    expect(stored).not.toContain(typeName)
  }, SETTLE)
})

// --- O13: saves the volume baseline -----------------------------------------------------------

test('O13 SettingsFeature saves the volume baseline when "Compare volume with" changes', async () => {
  const user = userEvent.setup()
  const services = buildServices(fakeSync())
  renderFeature(services)
  await screen.findByRole('combobox', { name: /compare volume with/i }, SETTLE)

  await user.selectOptions(screen.getByRole('combobox', { name: /compare volume with/i }), 'Past week')

  await waitFor(async () => {
    const stored = await getVolumeBaseline()
    expect(stored).toEqual({ period: '1w', aggregate: 'avg' })
  }, SETTLE)
})

// --- O13: exports ------------------------------------------------------------------------------

test('O13 SettingsFeature exports hands the browser a backup holding every logged session', async () => {
  const user = userEvent.setup()
  const CURRENT = loggedSessions(2, 'session', NOW)
  await db.sessions.bulkPut(CURRENT)
  const downloads = captureDownloads()
  const services = buildServices(fakeSync())
  renderFeature(services)

  await user.click(await screen.findByRole('button', { name: 'Export' }, SETTLE))

  await waitFor(() => {
    expect(downloads).toHaveLength(1)
  }, SETTLE)
  const handed = JSON.parse(await downloads[0].text()) as BackupFile
  expect(handed.schemaVersion).toBe(BACKUP_SCHEMA_VERSION)
  expect(handed.sessions).toEqual(CURRENT)
})

// --- O13: imports with confirmation ------------------------------------------------------------

test('O13 SettingsFeature confirming an import replaces the database with the chosen file\'s sessions', async () => {
  const user = userEvent.setup()
  const CURRENT = loggedSessions(5, 'session', NOW)
  const IMPORTED = [CURRENT[0], ...loggedSessions(2, 'incoming', NOW - 10 * 86_400_000)]
  await db.sessions.bulkPut(CURRENT)
  captureDownloads()
  const services = buildServices(fakeSync())
  renderFeature(services)

  const file: BackupFile = {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: NOW,
    sessions: IMPORTED,
    settings: { activeProgramId: 'assaf-ab-2026', lastExportedAt: null },
  }
  const control = screen.getByLabelText(/import backup/i)
  await user.upload(control, new File([JSON.stringify(file)], 'backup.json', { type: 'application/json' }))
  const dialog = await screen.findByRole('alertdialog', {}, SETTLE)
  // Hand-checked: 5 on the phone, 3 in the file (1 shared), so 4 are removed by the confirm.
  expect((dialog.textContent ?? '').replace(/\s+/g, ' ')).toMatch(/5[^0-9]+3[^0-9]+4/)

  await user.click(within(dialog).getByRole('button', { name: 'Import' }))

  await waitFor(async () => {
    expect(await listSessions()).toEqual(IMPORTED)
  }, SETTLE)
})

test('O13 SettingsFeature shows the invalid-backup message and changes no session for a file that is not valid JSON', async () => {
  const user = userEvent.setup()
  const CURRENT = loggedSessions(2, 'session', NOW)
  await db.sessions.bulkPut(CURRENT)
  const downloads = captureDownloads()
  const services = buildServices(fakeSync())
  renderFeature(services)

  const control = screen.getByLabelText(/import backup/i)
  await user.upload(control, new File(['this is not a backup at all'], 'backup.json', { type: 'application/json' }))

  const alert = await screen.findByRole('alert', {}, SETTLE)
  expect(alert.textContent).toMatch(/JSON/i)
  expect(screen.queryByRole('alertdialog')).toBeNull()
  expect(await listSessions()).toEqual(CURRENT)
  expect(downloads).toHaveLength(0)
})

// --- O13: shows the sync status and Sync now ---------------------------------------------------

test('O13 SettingsFeature shows the sync status from useSyncControls()', async () => {
  const services = buildServices(fakeSync())
  renderFeature(services)

  await waitFor(() => {
    expect(screen.getByText('trainee@example.com')).toBeInTheDocument()
  }, SETTLE)
  expect(screen.getByRole('button', { name: 'Sync now' })).toBeInTheDocument()
})

test('O13 SettingsFeature pressing Sync now runs the sync service', async () => {
  const user = userEvent.setup()
  const sync = fakeSync()
  const services = buildServices(sync)
  renderFeature(services)
  await screen.findByRole('button', { name: 'Sync now' }, SETTLE)
  const before = sync.syncNow.mock.calls.length

  await user.click(screen.getByRole('button', { name: 'Sync now' }))

  await waitFor(() => {
    expect(sync.syncNow.mock.calls.length).toBeGreaterThan(before)
  }, SETTLE)
})
