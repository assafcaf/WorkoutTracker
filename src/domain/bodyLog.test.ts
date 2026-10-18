import { describe, expect, test } from 'vitest'
import {
  bodySeries,
  bodyweightOn,
  dayOf,
  removeBodyEntry,
  upsertBodyEntry,
  validateBodyEntry,
  validateBodyLog,
} from './bodyLog'
import type { BodyLog } from '../types'

// Local-time moments, so the tests hold in any time zone.
const NOW = new Date(2026, 9, 15, 12, 0).getTime()
const at = (m: number, d: number, h = 0) => new Date(2026, m, d, h).getTime()

describe('validateBodyEntry (O1)', () => {
  test('accepts a real day with one value', () => {
    expect(validateBodyEntry({ day: '2026-10-15', weightKg: 80 }, NOW)).toEqual({
      day: '2026-10-15',
      weightKg: 80,
    })
  })
  test('accepts all five metrics', () => {
    const e = { day: '2026-10-10', weightKg: 79, waistCm: 85, chestCm: 100, armsCm: 35, thighsCm: 58 }
    expect(validateBodyEntry(e, NOW)).toEqual(e)
  })
  test('accepts an entry of one measurement only', () => {
    expect(validateBodyEntry({ day: '2026-10-10', armsCm: 35 }, NOW)).toEqual({
      day: '2026-10-10',
      armsCm: 35,
    })
  })
  test('rounds values to 0.1', () => {
    expect(validateBodyEntry({ day: '2026-10-15', weightKg: 80.26, waistCm: 85.04 }, NOW)).toEqual({
      day: '2026-10-15',
      weightKg: 80.3,
      waistCm: 85,
    })
  })
  test('accepts the range edges', () => {
    expect(validateBodyEntry({ day: '2026-10-15', weightKg: 20, waistCm: 300 }, NOW)).not.toBeNull()
    expect(validateBodyEntry({ day: '2026-10-15', weightKg: 400, armsCm: 10 }, NOW)).not.toBeNull()
  })
  test('refuses an entry with no value', () => {
    expect(validateBodyEntry({ day: '2026-10-15' }, NOW)).toBeNull()
  })
  test('refuses a weight out of 20-400', () => {
    expect(validateBodyEntry({ day: '2026-10-15', weightKg: 19.9 }, NOW)).toBeNull()
    expect(validateBodyEntry({ day: '2026-10-15', weightKg: 400.1 }, NOW)).toBeNull()
  })
  test('refuses a measurement out of 10-300', () => {
    expect(validateBodyEntry({ day: '2026-10-15', waistCm: 9.9 }, NOW)).toBeNull()
    expect(validateBodyEntry({ day: '2026-10-15', thighsCm: 300.1 }, NOW)).toBeNull()
  })
  test('refuses a value that is not a finite number', () => {
    expect(validateBodyEntry({ day: '2026-10-15', weightKg: NaN }, NOW)).toBeNull()
    expect(validateBodyEntry({ day: '2026-10-15', weightKg: Infinity }, NOW)).toBeNull()
    expect(validateBodyEntry({ day: '2026-10-15', weightKg: '80' }, NOW)).toBeNull()
  })
  test('refuses a malformed day', () => {
    for (const day of ['2026-1-5', '15/10/2026', '', 'today', '2026-10-15T00:00']) {
      expect(validateBodyEntry({ day, weightKg: 80 }, NOW)).toBeNull()
    }
    expect(validateBodyEntry({ weightKg: 80 }, NOW)).toBeNull()
  })
  test('refuses a day that is not on the calendar', () => {
    expect(validateBodyEntry({ day: '2026-02-30', weightKg: 80 }, NOW)).toBeNull()
    expect(validateBodyEntry({ day: '2026-13-01', weightKg: 80 }, NOW)).toBeNull()
  })
  test('refuses a day after today, accepts today', () => {
    expect(validateBodyEntry({ day: '2026-10-16', weightKg: 80 }, NOW)).toBeNull()
    expect(validateBodyEntry({ day: '2026-10-15', weightKg: 80 }, NOW)).not.toBeNull()
  })
  test('refuses what is not an object', () => {
    expect(validateBodyEntry(null, NOW)).toBeNull()
    expect(validateBodyEntry('2026-10-15', NOW)).toBeNull()
  })
})

describe('validateBodyLog (O1)', () => {
  test('keeps valid entries one per day, oldest first', () => {
    const raw = [
      { day: '2026-10-15', weightKg: 78.5 },
      { day: 'bad', weightKg: 80 },
      { day: '2026-10-01', weightKg: 80 },
      { day: '2026-10-10' },
      { day: '2026-10-10', waistCm: 85 },
    ]
    const out = validateBodyLog(raw, NOW)
    expect(out.map((e) => e.day)).toEqual(['2026-10-01', '2026-10-10', '2026-10-15'])
    expect(out[1]).toEqual({ day: '2026-10-10', waistCm: 85 })
  })
  test('answers [] for anything that is not an array', () => {
    for (const raw of [undefined, null, 'x', 5, { day: '2026-10-01', weightKg: 80 }]) {
      expect(validateBodyLog(raw, NOW)).toEqual([])
    }
  })
})

describe('upsert and remove (O2)', () => {
  const log: BodyLog = [
    { day: '2026-10-01', weightKg: 80 },
    { day: '2026-10-15', weightKg: 78.5 },
  ]
  test('inserts a new day in day order', () => {
    expect(upsertBodyEntry(log, { day: '2026-10-10', waistCm: 85 }).map((e) => e.day)).toEqual([
      '2026-10-01',
      '2026-10-10',
      '2026-10-15',
    ])
  })
  test('replaces the entry on the same day, whole', () => {
    expect(upsertBodyEntry(log, { day: '2026-10-01', waistCm: 85 })).toEqual([
      { day: '2026-10-01', waistCm: 85 },
      { day: '2026-10-15', weightKg: 78.5 },
    ])
  })
  test('upsert at the ends and into an empty log', () => {
    expect(upsertBodyEntry(log, { day: '2026-09-01', weightKg: 81 })[0].day).toBe('2026-09-01')
    expect(upsertBodyEntry(log, { day: '2026-10-20', weightKg: 78 }).at(-1)?.day).toBe('2026-10-20')
    expect(upsertBodyEntry([], { day: '2026-10-20', weightKg: 78 })).toEqual([
      { day: '2026-10-20', weightKg: 78 },
    ])
  })
  test('remove drops that day only; an absent day changes nothing', () => {
    expect(removeBodyEntry(log, '2026-10-01')).toEqual([{ day: '2026-10-15', weightKg: 78.5 }])
    expect(removeBodyEntry(log, '2026-10-02')).toEqual(log)
  })
  test('neither mutates its input', () => {
    const frozen = Object.freeze(log.map((e) => Object.freeze({ ...e }))) as BodyLog
    expect(upsertBodyEntry(frozen, { day: '2026-10-01', weightKg: 81 })).toHaveLength(2)
    expect(upsertBodyEntry(frozen, { day: '2026-10-05', weightKg: 79 })).toHaveLength(3)
    expect(removeBodyEntry(frozen, '2026-10-01')).toHaveLength(1)
    expect(frozen).toEqual(log)
  })
})

describe('bodyweightOn and bodySeries (O3)', () => {
  const log: BodyLog = [
    { day: '2026-10-01', weightKg: 80 },
    { day: '2026-10-10', waistCm: 85 },
    { day: '2026-10-15', weightKg: 78.5, waistCm: 84 },
  ]
  test('the latest weighed day on or before the moment', () => {
    expect(bodyweightOn(log, at(9, 12, 19))).toEqual({ kg: 80, day: '2026-10-01' })
  })
  test('a weigh-in earlier the same day counts', () => {
    expect(bodyweightOn(log, at(9, 15, 6))).toEqual({ kg: 78.5, day: '2026-10-15' })
  })
  test('before the first weighed day answers null', () => {
    expect(bodyweightOn(log, at(8, 30, 12))).toBeNull()
    expect(bodyweightOn([], NOW)).toBeNull()
  })
  test('a log with measurements only answers null', () => {
    expect(bodyweightOn([{ day: '2026-10-10', waistCm: 85 }], NOW)).toBeNull()
  })
  test('series: one point per entry holding the metric, at local midnight, oldest first', () => {
    expect(bodySeries(log, 'weightKg')).toEqual([
      { at: at(9, 1), value: 80 },
      { at: at(9, 15), value: 78.5 },
    ])
    expect(bodySeries(log, 'waistCm')).toEqual([
      { at: at(9, 10), value: 85 },
      { at: at(9, 15), value: 84 },
    ])
    expect(bodySeries(log, 'armsCm')).toEqual([])
  })
  test('dayOf is the local YYYY-MM-DD', () => {
    expect(dayOf(at(9, 5, 23))).toBe('2026-10-05')
    expect(dayOf(new Date(2026, 0, 1, 0, 0).getTime())).toBe('2026-01-01')
  })
})
