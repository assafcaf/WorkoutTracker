import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { db } from '../storage/db'
import { allSessions, putSessions } from '../storage/sessionStore'
import { readRow, LAST_EXPORTED_AT_KEY } from '../storage/settingsStore'
import type { Session } from '../types'
import { createServices, ServiceError, type Services } from './index'

const NOW = 1_700_000_000_000

beforeEach(async () => {
  await db.open()
  await db.sessions.clear()
  await db.settings.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
  delete (navigator as unknown as { share?: unknown }).share
  delete (navigator as unknown as { canShare?: unknown }).canShare
  delete (URL as unknown as { createObjectURL?: unknown }).createObjectURL
  delete (URL as unknown as { revokeObjectURL?: unknown }).revokeObjectURL
})

function services(): Services {
  return createServices({ now: () => NOW, storageAvailable: true })
}

function readText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(r.error)
    r.readAsText(blob)
  })
}

function readBytes(blob: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as ArrayBuffer)
    r.onerror = () => reject(r.error)
    r.readAsArrayBuffer(blob)
  })
}

const stored: Session = {
  id: 's1',
  programId: 'p',
  workoutId: 'w',
  startedAt: new Date(2026, 2, 2, 18, 5).getTime(),
  finishedAt: new Date(2026, 2, 2, 19, 0).getTime(),
  updatedAt: 1,
  entries: [
    { exerciseId: 'back-squat', setIndex: 1, weightKg: 100, reps: 5, loggedAt: 1 },
    { kind: 'warmup', exerciseId: 'back-squat', setIndex: 2, weightKg: 60, reps: 5, loggedAt: 2 },
  ],
}

const STRONG = [
  'Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Reps,Distance,Seconds,Notes,Workout Notes,RPE',
  '2026-03-02 18:05:00,Push Day,1h,Squat (Barbell),1,100,5,0,0,,,',
  '2026-03-04 18:05:00,Pull Day,45m,Zercher Carry Thing,1,50,8,0,0,,,',
  '2026-03-04 18:05:00,Pull Day,45m,Squat (Barbell),2,90,8,0,0,,,',
  '2026-03-06 18:05:00,Run,30m,Treadmill,1,0,0,5,1800,,,',
].join('\n')

describe('O15 exportCsv', () => {
  test('O15 exportCsv shares workout-sets-<date>.csv as text/csv when canShare allows it, writing nothing', async () => {
    await putSessions([stored])
    const share = vi.fn(async () => undefined)
    Object.assign(navigator, { canShare: () => true, share })

    await services().transfer.exportCsv()

    expect(share).toHaveBeenCalledTimes(1)
    const file = (share.mock.calls[0] as unknown as [{ files: File[] }])[0].files[0]
    const d = new Date(NOW)
    const p = (n: number) => String(n).padStart(2, '0')
    expect(file.name).toBe(`workout-sets-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.csv`)
    expect(file.type).toBe('text/csv')
    const text = await readText(file)
    const bytes = new Uint8Array(await readBytes(file))
    expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf])
    expect(text.startsWith('date,program,workout')).toBe(true)
    expect(text.trim().split('\r\n')).toHaveLength(3)
    expect(await readRow(LAST_EXPORTED_AT_KEY)).toBeUndefined()
    expect(await allSessions()).toHaveLength(1)
  })

  test('O15 exportCsv downloads through an object-URL anchor when sharing is unavailable', async () => {
    await putSessions([stored])
    const created = vi.fn(() => 'blob:x')
    Object.assign(URL, { createObjectURL: created, revokeObjectURL: vi.fn() })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)

    await services().transfer.exportCsv()

    expect(created).toHaveBeenCalledTimes(1)
    expect(click).toHaveBeenCalledTimes(1)
  })

  test('O15 exportCsv does nothing and throws nothing when neither sharing nor object URLs exist', async () => {
    await expect(services().transfer.exportCsv()).resolves.toBeUndefined()
  })
})

describe('O16 readImport', () => {
  test('O16 readImport answers the pending import with proposals and writes nothing', async () => {
    const pending = await services().transfer.readImport(STRONG)

    expect(pending.format).toBe('strong')
    expect(pending.unitStated).toBe(false)
    expect(pending.sessionCount).toBe(2)
    expect(pending.leftOut).toBe(1)
    const squat = pending.names.find((n) => n.source === 'Squat (Barbell)')
    expect(squat?.sets).toBe(2)
    expect(squat?.proposal?.id).toBe('back-squat')
    expect(pending.names.find((n) => n.source === 'Zercher Carry Thing')?.proposal).toBeNull()
    expect(await allSessions()).toEqual([])
  })

  test('O16 readImport refuses text that is not a Strong or Hevy export as invalid-import', async () => {
    const err = await services().transfer.readImport('{"schemaVersion":1}').catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ServiceError)
    expect((err as ServiceError).code).toBe('invalid-import')
    expect((err as ServiceError).message).toBe('This file is not a Strong or Hevy export.')
    expect(await allSessions()).toEqual([])
  })
})

describe('O17 confirmImport', () => {
  test('O17 confirmImport appends the non-duplicate Sessions in one write and announces Sessions once', async () => {
    await putSessions([stored])
    const s = services()
    const topics: string[] = []
    s.bus.subscribe('sessions', () => topics.push('sessions'))
    s.bus.subscribe('programs', () => topics.push('programs'))
    s.bus.subscribe('preferences', () => topics.push('preferences'))
    const pending = await s.transfer.readImport(STRONG)
    const bulk = vi.spyOn(db.sessions, 'bulkPut')

    const result = await s.transfer.confirmImport(pending, {
      'Squat (Barbell)': 'back-squat',
      'Zercher Carry Thing': null,
    })

    expect(result).toEqual({ added: 1, skipped: 1, leftOut: 2 })
    expect(bulk).toHaveBeenCalledTimes(1)
    expect(topics).toEqual(['sessions'])
    const all = await allSessions()
    expect(all).toHaveLength(2)
    expect(all.find((x) => x.id === 's1')).toEqual(stored)
    const added = all.find((x) => x.id !== 's1')!
    expect(added.programId).toBe('Strong')
    expect(added.workoutId).toBe('Pull Day')
    expect(added.updatedAt).toBe(NOW)
  })

  test('O17 confirmImport run twice with the same file adds 0 the second time and skips them all', async () => {
    const s = services()
    const choices = { 'Squat (Barbell)': 'back-squat', 'Zercher Carry Thing': null }
    const first = await s.transfer.confirmImport(await s.transfer.readImport(STRONG), choices)
    const second = await s.transfer.confirmImport(await s.transfer.readImport(STRONG), choices)

    expect(first.added).toBe(2)
    expect(second).toEqual({ added: 0, skipped: 2, leftOut: 2 })
    expect(await allSessions()).toHaveLength(2)
  })
})
