import { afterEach, expect, test } from 'vitest'
import { formatDay } from './dates'

// 13 Oct 2026 is a Tuesday. Hand-checked: 1 Jan 2026 is a Thursday.
const NOW = new Date(2026, 9, 13, 9, 0)
const originalTz = process.env.TZ

afterEach(() => {
  if (originalTz === undefined) delete process.env.TZ
  else process.env.TZ = originalTz
})

test('O21 formatDay reads a date in the current year as weekday, day and month', () => {
  expect(formatDay(new Date(2026, 9, 13, 23, 30), NOW)).toBe('Tue 13 Oct')
})

test('O21 formatDay leaves a single-digit day unpadded', () => {
  expect(formatDay('2026-03-05', NOW)).toBe('Thu 5 Mar')
})

test('O21 formatDay reads a date in another year as day, month and year, with no weekday', () => {
  expect(formatDay(new Date(2025, 9, 13, 12, 0), NOW)).toBe('13 Oct 2025')
})

test('O21 formatDay treats a day in a later year as another year too', () => {
  expect(formatDay('2027-01-02', NOW)).toBe('2 Jan 2027')
})

test('O21 formatDay compares years against now, not the real clock', () => {
  expect(formatDay('2025-12-31', new Date(2025, 11, 31, 8, 0))).toBe('Wed 31 Dec')
  expect(formatDay('2025-12-31', new Date(2026, 0, 1, 8, 0))).toBe('31 Dec 2025')
})

test('O21 formatDay reads an ISO string as a local calendar day, in a zone behind UTC', () => {
  process.env.TZ = 'America/Los_Angeles'
  expect(formatDay('2026-10-13', new Date(2026, 9, 14, 9, 0))).toBe('Tue 13 Oct')
})

test('O21 formatDay reads an ISO string as a local calendar day, in a zone ahead of UTC', () => {
  process.env.TZ = 'Pacific/Kiritimati'
  expect(formatDay('2026-10-13', new Date(2026, 9, 14, 9, 0))).toBe('Tue 13 Oct')
})
