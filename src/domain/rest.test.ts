import { expect, test } from 'vitest'
import type { SetEntry } from '../types'
import { adjustRest, formatOver, formatRest, latestSet, restAfter, restState } from './rest'

// back-squat's plan (src/data/programs/assaf-ab-2026.json, workout-a) prescribes
// restSeconds: 180, per the ticket. Timestamps are epoch milliseconds, as in SetEntry.loggedAt.
const restSeconds = 180

function entry(loggedAt: number, extra: Partial<SetEntry> = {}): SetEntry {
  return { exerciseId: 'back-squat', setIndex: 1, weightKg: 100, reps: 5, loggedAt, ...extra }
}

test('O14 restState shows 1:20 (80 seconds) remaining 100s into a 180s rest', () => {
  const lastLoggedAt = 0
  const now = 100_000 // 100s later, in ms

  expect(restState(lastLoggedAt, restSeconds, now)).toEqual({
    remainingSeconds: 80,
    overSeconds: 0,
    isOver: false,
  })
})

test('O14 restState shows 0:00 remaining and reports rest as over 200s into a 180s rest', () => {
  const lastLoggedAt = 0
  const now = 200_000 // 200s later, in ms

  expect(restState(lastLoggedAt, restSeconds, now)).toEqual({
    remainingSeconds: 0,
    overSeconds: 20,
    isOver: true,
  })
})

test('O14 restState is over exactly at the restSeconds boundary', () => {
  const lastLoggedAt = 0
  const now = 180_000 // exactly 180s later, in ms

  expect(restState(lastLoggedAt, restSeconds, now)).toEqual({
    remainingSeconds: 0,
    overSeconds: 0,
    isOver: true,
  })
})

test('O14 restState reports rest as over when no set has been logged', () => {
  expect(restState(null, restSeconds, 0)).toEqual({
    remainingSeconds: 0,
    overSeconds: 0,
    isOver: true,
  })
})

// E13-T1 O1
test('O1 restAfter counts down the Set\'s own restSeconds while the rest runs', () => {
  expect(restAfter(entry(0, { restSeconds: 90 }), 180, 30_000)).toEqual({
    remainingSeconds: 60,
    overSeconds: 0,
    isOver: false,
  })
})

test('O1 restAfter uses the Plan rest when the Set has no restSeconds', () => {
  expect(restAfter(entry(0), 180, 100_000)).toEqual({
    remainingSeconds: 80,
    overSeconds: 0,
    isOver: false,
  })
})

test('O1 restAfter is over at exactly t + r with overSeconds 0', () => {
  expect(restAfter(entry(5_000, { restSeconds: 90 }), 180, 95_000)).toEqual({
    remainingSeconds: 0,
    overSeconds: 0,
    isOver: true,
  })
})

test('O1 restAfter keeps growing overSeconds past the rest, from the Set\'s own length', () => {
  expect(restAfter(entry(0, { restSeconds: 90 }), 180, 100_000)).toEqual({
    remainingSeconds: 0,
    overSeconds: 10,
    isOver: true,
  })
  expect(restAfter(entry(0, { restSeconds: 90 }), 180, 400_000)).toEqual({
    remainingSeconds: 0,
    overSeconds: 310,
    isOver: true,
  })
})

test('O1 restAfter treats a Set restSeconds of 0 as its own rest, not the Plan fallback', () => {
  expect(restAfter(entry(0, { restSeconds: 0 }), 180, 10_000)).toEqual({
    remainingSeconds: 0,
    overSeconds: 10,
    isOver: true,
  })
})

test('O1 latestSet answers the entry with the greatest loggedAt, whatever the order', () => {
  const a = entry(3_000, { setIndex: 2 })
  const b = entry(9_000, { setIndex: 3 })
  const c = entry(1_000, { setIndex: 1 })

  expect(latestSet([a, b, c])).toBe(b)
  expect(latestSet([])).toBeNull()
})

// E13-T1 O2
test('O2 adjustRest skip answers the whole seconds elapsed so far', () => {
  expect(adjustRest(entry(0), 180, { kind: 'skip' }, 42_900)).toBe(42)
})

test('O2 adjustRest add +15 adds 15 to the Set\'s own rest, else to the Plan rest', () => {
  expect(adjustRest(entry(0, { restSeconds: 90 }), 180, { kind: 'add', seconds: 15 }, 10_000)).toBe(105)
  expect(adjustRest(entry(0), 180, { kind: 'add', seconds: 15 }, 10_000)).toBe(195)
})

test('O2 adjustRest add -15 subtracts 15 while time remains', () => {
  expect(adjustRest(entry(0), 180, { kind: 'add', seconds: -15 }, 10_000)).toBe(165)
})

test('O2 adjustRest add -15 never goes below the whole seconds elapsed', () => {
  // rest 90, 80.5s elapsed: 90 - 15 = 75 < 80, so it floors at 80 (remaining 0, not negative)
  expect(adjustRest(entry(0, { restSeconds: 90 }), 180, { kind: 'add', seconds: -15 }, 80_500)).toBe(80)
  // already over: rest 90, 200s elapsed -> floors at 200
  expect(adjustRest(entry(0, { restSeconds: 90 }), 180, { kind: 'add', seconds: -15 }, 200_000)).toBe(200)
})

test('O2 adjustRest set n answers n', () => {
  expect(adjustRest(entry(0), 180, { kind: 'set', seconds: 120 }, 10_000)).toBe(120)
})

test('O2 after skip the rest is already over', () => {
  const skipped = entry(0, { restSeconds: adjustRest(entry(0), 180, { kind: 'skip' }, 42_900) })

  expect(restAfter(skipped, 180, 42_900).isOver).toBe(true)
})

test('O1 formatRest shows m:ss, counting a part-second still to go as a whole one', () => {
  expect(formatRest(80)).toBe('1:20')
  expect(formatRest(0)).toBe('0:00')
  expect(formatRest(0.4)).toBe('0:01')
  expect(formatRest(179.2)).toBe('3:00')
})

test('O1 formatOver shows +m:ss', () => {
  expect(formatOver(0)).toBe('+0:00')
  expect(formatOver(75)).toBe('+1:15')
})
