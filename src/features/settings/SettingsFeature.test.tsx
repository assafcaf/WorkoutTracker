import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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
import { ExercisesFeature } from '../exercises/ExercisesFeature'
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
  await db.photos.clear()
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
    photos: {} as Services['photos'],
    catalog: createCatalogService(deps),
    backup: createBackupService({ ...deps, replaceRemote: sync.replaceRemote }),
    transfer: {} as Services['transfer'],
    sync,
    push: {} as Services['push'],
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

/** The "My gym's equipment" fieldset (on Program › Exercises since V2-09). */
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
  // V2-09: the Program tab switches the active Program (ProgramFeature); Settings offers no
  // Program list, and opening it leaves the stored choice as it was.
  await saveUserProgram(SECOND_PROGRAM, NOW)
  const services = buildServices(fakeSync())
  const before = (await services.programs.load()).activeProgramId
  renderFeature(services)

  await screen.findByRole('group', { name: 'Workout' }, SETTLE)

  expect(screen.queryByRole('group', { name: 'Active program' })).toBeNull()
  expect(screen.queryByRole('radio', { name: 'Second Program' })).toBeNull()
  expect((await services.programs.load()).activeProgramId).toBe(before)
})

// --- O13: saves gym equipment ----------------------------------------------------------------

test('O13 SettingsFeature saves the next gym equipment list when a type is unticked', async () => {
  // V2-09: the switches moved to Program › Exercises, behind the "My gym only" chip they feed;
  // they save through the same preference as before.
  const user = userEvent.setup()
  const services = buildServices(fakeSync())
  render(
    <ServicesProvider services={services}>
      <ExercisesFeature initialMuscles={null} navigate={vi.fn()} />
    </ServicesProvider>,
  )
  // DX-08: the switches sit on the gym's own page, behind the quiet "Edit" beside the chip.
  await user.click(await screen.findByRole('button', { name: "Edit my gym's equipment" }, SETTLE))
  await waitFor(() => {
    expect(within(gymEquipmentGroup()).getAllByRole('switch').length).toBeGreaterThan(0)
  }, SETTLE)
  const firstCheckbox = within(gymEquipmentGroup()).getAllByRole('switch')[0]
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
  // V2-09: "Compare volume with" is no longer offered; a baseline stored before stays stored.
  const services = buildServices(fakeSync())
  await services.preferences.setVolumeBaseline({ period: '1w', aggregate: 'avg' })
  renderFeature(services)
  await screen.findByRole('group', { name: 'Workout' }, SETTLE)

  expect(screen.queryByRole('combobox', { name: /compare volume with/i })).toBeNull()
  expect(await getVolumeBaseline()).toEqual({ period: '1w', aggregate: 'avg' })
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

// --- E26-T9 O4: photos in the export ------------------------------------------------------------

async function storePhoto(): Promise<void> {
  await db.photos.put({
    id: 'p-1',
    day: '2026-11-01',
    angle: 'front',
    data: new Uint8Array([1, 2, 3, 255]).buffer,
    type: 'image/jpeg',
    width: 30,
    height: 40,
    align: null,
    createdAt: NOW,
  })
}

test('E26-T9 O4 Export asks whether to include photos when photos exist, and Include photos puts them in the file', async () => {
  const user = userEvent.setup()
  await db.photos.clear()
  await storePhoto()
  const downloads = captureDownloads()
  renderFeature(buildServices(fakeSync()))

  await user.click(await screen.findByRole('button', { name: 'Export' }, SETTLE))
  await user.click(await screen.findByRole('button', { name: 'Include photos' }, SETTLE))

  await waitFor(() => {
    expect(downloads).toHaveLength(1)
  }, SETTLE)
  const handed = JSON.parse(await downloads[0].text()) as BackupFile
  expect(handed.photos?.map((p) => p.id)).toEqual(['p-1'])
})

test('E26-T9 O4 answering Without photos exports the backup with no photos in it', async () => {
  const user = userEvent.setup()
  await db.photos.clear()
  await storePhoto()
  const downloads = captureDownloads()
  renderFeature(buildServices(fakeSync()))

  await user.click(await screen.findByRole('button', { name: 'Export' }, SETTLE))
  await user.click(await screen.findByRole('button', { name: 'Without photos' }, SETTLE))

  await waitFor(() => {
    expect(downloads).toHaveLength(1)
  }, SETTLE)
  const handed = JSON.parse(await downloads[0].text()) as BackupFile
  expect('photos' in handed).toBe(false)
})

test('E26-T9 O4 Export with photos waits for the answer before handing over any file', async () => {
  const user = userEvent.setup()
  await db.photos.clear()
  await storePhoto()
  const downloads = captureDownloads()
  renderFeature(buildServices(fakeSync()))

  await user.click(await screen.findByRole('button', { name: 'Export' }, SETTLE))

  expect(await screen.findByRole('button', { name: 'Include photos' }, SETTLE)).toBeInTheDocument()
  expect(downloads).toHaveLength(0)
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

// --- E14-T10: Track effort ------------------------------------------------------------------

test('O9 SettingsFeature shows Track effort unticked when nothing is stored', async () => {
  renderFeature(buildServices(fakeSync()))

  const box = await screen.findByRole('switch', { name: 'Track effort' }, SETTLE)
  expect(box).not.toBeChecked()
})

test('O9 SettingsFeature shows Track effort ticked when it is stored on', async () => {
  await db.settings.put({ key: 'effortTracking', value: true, updatedAt: NOW })
  renderFeature(buildServices(fakeSync()))

  await waitFor(() => {
    expect(screen.getByRole('switch', { name: 'Track effort' })).toBeChecked()
  }, SETTLE)
})

test('O9 ticking Track effort stores true under effortTracking and shows it ticked', async () => {
  const user = userEvent.setup()
  renderFeature(buildServices(fakeSync()))
  await user.click(await screen.findByRole('switch', { name: 'Track effort' }, SETTLE))

  await waitFor(async () => {
    expect((await db.settings.get('effortTracking'))?.value).toBe(true)
  }, SETTLE)
  await waitFor(() => {
    expect(screen.getByRole('switch', { name: 'Track effort' })).toBeChecked()
  }, SETTLE)
})

// --- E15-T5: Bar and plates ------------------------------------------------------------------

const STORED_RACK = { barKg: 20, plates: [{ kg: 25, pairs: 4 }, { kg: 2.5, pairs: 2 }] }

function barAndPlatesGroup(): HTMLElement {
  return screen.getByRole('group', { name: 'Bar and plates' })
}

function stepped(label: string): string {
  return within(barAndPlatesGroup()).getByRole('group', { name: label }).querySelector('output')?.textContent ?? ''
}

/** DX-23: Bar and plates is a row that pushes its page. */
async function openPlates(): Promise<void> {
  await userEvent.click(await screen.findByRole('button', { name: /^Bar and plates/ }, SETTLE))
}

test('O7 SettingsFeature shows the stored bar and a pair count per plate', async () => {
  await db.settings.put({ key: 'plateInventory', value: STORED_RACK, updatedAt: NOW })
  renderFeature(buildServices(fakeSync()))
  await waitFor(() => expect(screen.getByRole('button', { name: /^Bar and plates/ })).toHaveTextContent('20 kg bar'), SETTLE)

  await openPlates()

  expect(stepped('Pairs of 25 kg')).toBe('4')
  expect(stepped('Bar weight')).toBe('20 kg')
})

test('O7 stepping the bar weight in Settings stores the inventory at once', async () => {
  await db.settings.put({ key: 'plateInventory', value: STORED_RACK, updatedAt: NOW })
  renderFeature(buildServices(fakeSync()))
  await waitFor(() => expect(screen.getByRole('button', { name: /^Bar and plates/ })).toHaveTextContent('20 kg bar'), SETTLE)
  await openPlates()

  await userEvent.click(screen.getByRole('button', { name: 'Decrease Bar weight' }))
  await waitFor(() => expect(stepped('Bar weight')).toBe('17.5 kg'), SETTLE)
  await userEvent.click(screen.getByRole('button', { name: 'Decrease Bar weight' }))

  await waitFor(async () => {
    expect((await db.settings.get('plateInventory'))?.value).toEqual({ ...STORED_RACK, barKg: 15 })
  }, SETTLE)
})

test('O7 Reset to defaults in Settings stores DEFAULT_PLATE_INVENTORY', async () => {
  const user = userEvent.setup()
  await db.settings.put({ key: 'plateInventory', value: STORED_RACK, updatedAt: NOW })
  renderFeature(buildServices(fakeSync()))
  await openPlates()

  await user.click(await screen.findByRole('button', { name: 'Reset to defaults' }, SETTLE))

  await waitFor(async () => {
    expect((await db.settings.get('plateInventory'))?.value).toEqual({
      barKg: 20,
      plates: [
        { kg: 25, pairs: 10 },
        { kg: 20, pairs: 10 },
        { kg: 15, pairs: 10 },
        { kg: 10, pairs: 10 },
        { kg: 5, pairs: 10 },
        { kg: 2.5, pairs: 10 },
        { kg: 1.25, pairs: 10 },
      ],
    })
  }, SETTLE)
})

test('O7 a refused plate shows the service message inline and leaves the stored inventory as it was', async () => {
  await db.settings.put({ key: 'plateInventory', value: STORED_RACK, updatedAt: NOW })
  renderFeature(buildServices(fakeSync()))
  await waitFor(() => expect(screen.getByRole('button', { name: /^Bar and plates/ })).toHaveTextContent('20 kg bar'), SETTLE)
  await openPlates()

  // A second 25 kg plate is refused by the service.
  fireEvent.change(screen.getByRole('spinbutton', { name: 'New plate weight (kg)' }), { target: { value: '25' } })
  await userEvent.click(screen.getByRole('button', { name: 'Add plate' }))

  const alert = await screen.findByRole('alert', {}, SETTLE)
  expect(alert).toHaveTextContent('Two plates cannot weigh the same.')
  expect((await db.settings.get('plateInventory'))?.value).toEqual(STORED_RACK)
  expect(stepped('Pairs of 25 kg')).toBe('4')
})

test('O7 a plate inventory synced in from another device shows without leaving the tab', async () => {
  const services = buildServices(fakeSync())
  renderFeature(services)
  await openPlates()
  await waitFor(() => expect(stepped('Pairs of 25 kg')).toBe('10'), SETTLE)

  await db.settings.put({
    key: 'plateInventory',
    value: { barKg: 15, plates: [{ kg: 25, pairs: 3 }] },
    updatedAt: NOW + 1000,
  })
  services.bus.emit('preferences')

  await waitFor(() => expect(stepped('Pairs of 25 kg')).toBe('3'), SETTLE)
  expect(stepped('Bar weight')).toBe('15 kg')
})

// --- Body (coordinator): Height (cm) moved here from the Body page ----------------------------

test('Body Settings shows a Body group with Height (cm), empty when nothing is stored', async () => {
  renderFeature(buildServices(fakeSync()))

  const body = await screen.findByRole('region', { name: 'Body' }, SETTLE)
  expect(within(body).getByRole('spinbutton', { name: 'Height (cm)' })).toHaveValue(null)
})

test('Body a height typed in Settings is stored through setHeightCm when the field is left', async () => {
  const services = buildServices(fakeSync())
  renderFeature(services)
  const field = await screen.findByRole('spinbutton', { name: 'Height (cm)' }, SETTLE)

  await userEvent.type(field, '178')
  await userEvent.tab()

  await waitFor(async () => expect(await services.preferences.heightCm()).toBe(178), SETTLE)
})

test('Body a height outside 100 to 250 says so and stores nothing', async () => {
  const services = buildServices(fakeSync())
  renderFeature(services)
  const field = await screen.findByRole('spinbutton', { name: 'Height (cm)' }, SETTLE)

  await userEvent.type(field, '90')
  await userEvent.tab()

  expect(await screen.findByText('Height is a whole number from 100 to 250 cm.')).toBeVisible()
  expect(field).toHaveAttribute('aria-invalid', 'true')
  expect(await services.preferences.heightCm()).toBeNull()
})

test('Body a stored height shows, and clearing the field clears it', async () => {
  const services = buildServices(fakeSync())
  await services.preferences.setHeightCm(181)
  renderFeature(services)
  const field = await screen.findByRole('spinbutton', { name: 'Height (cm)' }, SETTLE)
  await waitFor(() => expect(field).toHaveValue(181), SETTLE)

  await userEvent.clear(field)
  await userEvent.tab()

  await waitFor(async () => expect(await services.preferences.heightCm()).toBeNull(), SETTLE)
})

test('O9 unticking Track effort stores false under effortTracking', async () => {
  const user = userEvent.setup()
  await db.settings.put({ key: 'effortTracking', value: true, updatedAt: NOW })
  renderFeature(buildServices(fakeSync()))
  await waitFor(() => {
    expect(screen.getByRole('switch', { name: 'Track effort' })).toBeChecked()
  }, SETTLE)

  await user.click(screen.getByRole('switch', { name: 'Track effort' }))

  await waitFor(async () => {
    expect((await db.settings.get('effortTracking'))?.value).toBe(false)
  }, SETTLE)
})

// --- E19-T3: Week starts on, Keep screen on during rest ---------------------------------------

test('O5 SettingsFeature shows Week starts on as Monday when nothing is stored', async () => {
  renderFeature(buildServices(fakeSync()))

  const picker = await screen.findByRole('combobox', { name: 'Week starts on' }, SETTLE)
  expect(picker).toHaveValue('1')
})

test('O5 choosing a day in Week starts on stores it under weekStart and keeps it shown', async () => {
  const user = userEvent.setup()
  renderFeature(buildServices(fakeSync()))
  const picker = await screen.findByRole('combobox', { name: 'Week starts on' }, SETTLE)
  await user.selectOptions(picker, 'Sunday')

  await waitFor(async () => {
    expect((await db.settings.get('weekStart'))?.value).toBe(0)
  }, SETTLE)
  await waitFor(() => {
    expect(screen.getByRole('combobox', { name: 'Week starts on' })).toHaveValue('0')
  }, SETTLE)
})

test('O14 SettingsFeature shows Keep screen on during rest on when nothing is stored', async () => {
  renderFeature(buildServices(fakeSync()))

  const box = await screen.findByRole('switch', { name: 'Keep screen on during rest' }, SETTLE)
  expect(box).toBeChecked()
})

test('O14 turning Keep screen on during rest off stores false and shows it off', async () => {
  const user = userEvent.setup()
  renderFeature(buildServices(fakeSync()))
  await user.click(await screen.findByRole('switch', { name: 'Keep screen on during rest' }, SETTLE))

  await waitFor(async () => {
    expect((await db.settings.get('keepScreenOnDuringRest'))?.value).toBe(false)
  }, SETTLE)
  await waitFor(() => {
    expect(screen.getByRole('switch', { name: 'Keep screen on during rest' })).not.toBeChecked()
  }, SETTLE)
})

// --- V2-09: three groups, and the Last backup line (V1-30) ------------------------------------

test('V2-09 Settings reads as Workout, Reminders and Data & sync, in that order', async () => {
  const services = buildServices(fakeSync())
  services.push = {
    status: async () => 'off',
    reminders: async () => null,
  } as unknown as Services['push']
  renderFeature(services)

  const reminders = await screen.findByRole('region', { name: 'Reminders' }, SETTLE)
  const workout = screen.getByRole('group', { name: 'Workout' })
  const data = screen.getByRole('region', { name: 'Data & sync' })
  expect(workout.compareDocumentPosition(reminders) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(reminders.compareDocumentPosition(data) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(screen.queryByRole('region', { name: 'Notifications' })).toBeNull()
  for (const name of ['Track effort', 'Keep screen on during rest']) {
    expect(within(workout).getByRole('switch', { name })).toBeInTheDocument()
  }
  expect(within(workout).getByRole('combobox', { name: 'Week starts on' })).toBeInTheDocument()
  expect(within(data).getByRole('button', { name: 'Sync now' })).toBeInTheDocument()
  expect(within(data).getByRole('button', { name: 'Export' })).toBeInTheDocument()
  expect(within(data).getByLabelText(/import backup/i)).toBeInTheDocument()
})

test('V1-30 Data & sync says Last backup: never before any export, and no reminder with nothing logged', async () => {
  renderFeature(buildServices(fakeSync()))

  const data = await screen.findByRole('region', { name: 'Data & sync' }, SETTLE)
  expect(await within(data).findByText('Last backup: never', {}, SETTLE)).toBeInTheDocument()
  expect(screen.queryByText(/Back up your data/)).toBeNull()
})

test('V1-30 with Sessions logged and no export, the backup reminder shows under Data & sync', async () => {
  await db.sessions.bulkPut(loggedSessions(1, 'session', NOW))
  renderFeature(buildServices(fakeSync()))

  const data = await screen.findByRole('region', { name: 'Data & sync' }, SETTLE)
  expect(await within(data).findByText(/Back up your data/, {}, SETTLE)).toBeInTheDocument()
  expect(within(data).getByText('Last backup: never')).toBeInTheDocument()
})

test('V1-30 after an export the Last backup line names its day', async () => {
  const user = userEvent.setup()
  await db.sessions.bulkPut(loggedSessions(1, 'session', NOW))
  captureDownloads()
  renderFeature(buildServices(fakeSync()))

  await user.click(await screen.findByRole('button', { name: 'Export' }, SETTLE))

  const data = screen.getByRole('region', { name: 'Data & sync' })
  await waitFor(() => {
    expect(within(data).getByText(/^Last backup: (?!never)/)).toBeInTheDocument()
  }, SETTLE)
})
