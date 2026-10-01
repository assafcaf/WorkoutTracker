import { expect, test } from 'vitest'
import { countsTowardStats, workingSets } from './setKind'
import type { SetEntry, SetKind } from '../types'

function entry(kind?: SetKind): SetEntry {
  const base: SetEntry = { exerciseId: 'back-squat', setIndex: 1, weightKg: 60, reps: 8, loggedAt: 1 }
  return kind === undefined ? base : { ...base, kind }
}

test('O1 a warm-up Set does not count toward stats', () => {
  expect(countsTowardStats(entry('warmup'))).toBe(false)
})

test('O1 a Set with no kind counts toward stats', () => {
  expect(countsTowardStats(entry())).toBe(true)
})

test('O1 drop, failure and amrap Sets count toward stats', () => {
  expect(countsTowardStats(entry('drop'))).toBe(true)
  expect(countsTowardStats(entry('failure'))).toBe(true)
  expect(countsTowardStats(entry('amrap'))).toBe(true)
})

test('O1 workingSets drops only the warm-ups and keeps order', () => {
  const a = { ...entry('warmup'), setIndex: 1 }
  const b = { ...entry(), setIndex: 2 }
  const c = { ...entry('drop'), setIndex: 3 }
  expect(workingSets([a, b, c])).toEqual([b, c])
  expect(workingSets([a])).toEqual([])
})
