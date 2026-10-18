import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { db } from '../../storage/db'
import { listSessions, putSessions } from '../../storage/sessionStore'
import { getCustomExercises } from '../../storage/settingsStore'
import { createBackupService } from '../../services/backup'
import { createCatalogService } from '../../services/catalog'
import { createChangeBus } from '../../services/changes'
import { createPreferenceService } from '../../services/preferences'
import { createProgramService } from '../../services/programs'
import { createSessionService } from '../../services/sessions'
import { createTransferService } from '../../services/transfer'
import type { Services, SyncResult, SyncService } from '../../services'
import type { Session } from '../../types'
import { ServicesProvider } from '../ServicesProvider'
import { DataTransfer } from './DataTransfer'

const NOW = new Date(2026, 9, 18, 12, 0, 0).getTime()
const SETTLE = { timeout: 3000 }

beforeEach(async () => {
  await db.open()
  await db.sessions.clear()
  await db.settings.clear()
})

let anchorClick: { mockRestore(): void } | null = null

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
  Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), configurable: true, writable: true })
  anchorClick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  return blobs
}

afterEach(() => {
  anchorClick?.mockRestore()
  anchorClick = null
  delete (URL as unknown as { createObjectURL?: unknown }).createObjectURL
  delete (URL as unknown as { revokeObjectURL?: unknown }).revokeObjectURL
})

function buildServices(): Services {
  const ok: SyncResult = { status: 'ok', at: NOW, pushed: 0, pulled: 0 }
  const sync: SyncService = {
    state: async () => ({ accountEmail: null, lastSyncedAt: null }),
    syncNow: async () => ok,
    replaceRemote: async () => ok,
    adoptAccount: async () => {},
  }
  const bus = createChangeBus()
  const deps = { now: () => NOW, bus, storageAvailable: true }
  const catalog = createCatalogService(deps)
  return {
    sessions: createSessionService(deps),
    programs: createProgramService(deps),
    preferences: createPreferenceService(deps),
    catalog,
    backup: createBackupService({ ...deps, replaceRemote: sync.replaceRemote }),
    transfer: createTransferService({ ...deps, catalog }),
    sync,
    bus,
  }
}

function renderData(): void {
  render(
    <ServicesProvider services={buildServices()}>
      <DataTransfer />
    </ServicesProvider>,
  )
}

async function bytesOf(blob: Blob): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer))
    reader.onerror = () => reject(reader.error)
    reader.readAsArrayBuffer(blob)
  })
}

function squatSession(id: string, startedAt: number, warmup = false): Session {
  return {
    id,
    programId: 'assaf-ab-2026',
    workoutId: 'workout-a',
    startedAt,
    finishedAt: startedAt + 3_600_000,
    updatedAt: startedAt,
    entries: [
      ...(warmup
        ? [{ exerciseId: 'back-squat', setIndex: 1, weightKg: 40, reps: 8, kind: 'warmup' as const, loggedAt: startedAt + 30_000 }]
        : []),
      { exerciseId: 'back-squat', setIndex: warmup ? 2 : 1, weightKg: 100, reps: 5, loggedAt: startedAt + 60_000 },
    ],
  }
}

const STRONG_HEADER = 'Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Reps,Distance,Seconds,Notes,Workout Notes,RPE'
function strongRow(date: string, workout: string, exercise: string, order: string, weight: number, reps: number): string {
  return `${date},${workout},45m,${exercise},${order},${weight},${reps},0,0,,,`
}

function strongFile(exercise: string): string {
  return [
    STRONG_HEADER,
    strongRow('2026-03-02 18:05:00', 'Push Day', exercise, '1', 100, 5),
    strongRow('2026-03-04 18:05:00', 'Pull Day', exercise, '1', 90, 5),
    strongRow('2026-03-06 18:05:00', 'Leg Day', exercise, '1', 110, 5),
    '2026-03-06 18:05:00,Leg Day,45m,Rest Timer,Rest Timer,0,0,0,90,,,',
  ].join('\n')
}

async function pickFile(text: string): Promise<void> {
  const input = screen.getByLabelText(/import from strong or hevy/i)
  await userEvent.upload(input, new File([text], 'export.csv', { type: 'text/csv' }))
}

test('[O19] Your data offers Export sets (CSV) and Import from Strong or Hevy', () => {
  renderData()
  expect(screen.getByText('Your data')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Export sets (CSV)' })).toBeTruthy()
  expect(screen.getByLabelText(/import from strong or hevy/i)).toBeTruthy()
})

test('[O19] Export sets (CSV) shares workout-sets-<date>.csv with the BOM, a header and a row per Set', async () => {
  await putSessions([
    squatSession('s1', new Date(2026, 2, 1, 18, 0).getTime(), true),
    squatSession('s2', new Date(2026, 2, 3, 18, 0).getTime()),
  ])
  const blobs = captureDownloads()
  renderData()
  await userEvent.click(screen.getByRole('button', { name: 'Export sets (CSV)' }))
  await waitFor(() => expect(blobs).toHaveLength(1), SETTLE)
  const bytes = await bytesOf(blobs[0])
  expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
  const text = new TextDecoder('utf-8', { ignoreBOM: true }).decode(bytes)
  const lines = text.trim().split('\r\n')
  expect(lines).toHaveLength(1 + 3)
  expect(lines.some((l) => l.includes(',warmup,'))).toBe(true)
})

test('[O20] a picked Strong file opens the review; Import shows the result line inline', async () => {
  // Push Day is already stored: same start minute, same Exercise.
  await putSessions([squatSession('stored', new Date(2026, 2, 2, 18, 5).getTime())])
  renderData()
  await pickFile(strongFile('Squat (Barbell)'))
  const review = await screen.findByRole('dialog', { name: 'Review import' }, SETTLE)
  await userEvent.click(within(review).getByRole('button', { name: /^Import 3 Sessions$/ }))
  const line = await screen.findByText(
    'Added 2 Sessions · 1 already here, skipped · 1 row left out',
    undefined,
    SETTLE,
  )
  expect(line).toBeTruthy()
  expect(screen.queryByRole('dialog')).toBeNull()
  const stored = await listSessions()
  expect(stored.map((s) => s.workoutId).sort()).toEqual(['Leg Day', 'Pull Day', 'workout-a'])
})

test('[O20] a file that is not an export shows the refusal inline and opens no review', async () => {
  renderData()
  await pickFile('hello,world\n1,2\n')
  expect(await screen.findByText('This file is not a Strong or Hevy export.', undefined, SETTLE)).toBeTruthy()
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(await listSessions()).toHaveLength(0)
})

test('[O21] Create custom exercise is saved at once, mapped, used by Import, and kept on cancel', async () => {
  renderData()
  await pickFile(strongFile('Belt Squat (Machine)'))
  const review = await screen.findByRole('dialog', { name: 'Review import' }, SETTLE)
  await userEvent.click(within(review).getByRole('button', { name: 'Create custom exercise' }))
  const form = await screen.findByRole('dialog', { name: 'Edit exercise' })
  const primary = within(form).getByRole('group', { name: 'Primary muscles' })
  await userEvent.click(within(primary).getAllByRole('button')[0])
  await userEvent.click(within(form).getByRole('button', { name: 'Save' }))
  await waitFor(async () => expect(await getCustomExercises()).toHaveLength(1), SETTLE)
  const custom = (await getCustomExercises())[0]
  expect(custom.name).toBe('Belt Squat (Machine)')
  await userEvent.click(await within(review).findByRole('button', { name: /^Import 3 Sessions$/ }))
  await waitFor(async () => expect(await listSessions()).toHaveLength(3), SETTLE)
  const sessions = await listSessions()
  expect(sessions.every((s) => s.entries.every((e) => e.exerciseId === custom.id))).toBe(true)
})

test('[O21] cancelling the import after creating a Custom Exercise keeps it and writes no Session', async () => {
  renderData()
  await pickFile(strongFile('Belt Squat (Machine)'))
  const review = await screen.findByRole('dialog', { name: 'Review import' }, SETTLE)
  await userEvent.click(within(review).getByRole('button', { name: 'Create custom exercise' }))
  const form = await screen.findByRole('dialog', { name: 'Edit exercise' })
  await userEvent.click(within(within(form).getByRole('group', { name: 'Primary muscles' })).getAllByRole('button')[0])
  await userEvent.click(within(form).getByRole('button', { name: 'Save' }))
  await waitFor(async () => expect(await getCustomExercises()).toHaveLength(1), SETTLE)
  await userEvent.click(within(review).getByRole('button', { name: 'Cancel' }))
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(await getCustomExercises()).toHaveLength(1)
  expect(await listSessions()).toHaveLength(0)
})
