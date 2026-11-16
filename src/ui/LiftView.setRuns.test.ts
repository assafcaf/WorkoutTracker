// v7 (study §3 Numerals): a Session's Sets on the Lift page as runs -- one figure per load, the
// repeated reps after it, a Set of another kind alone, and the PR Set ending its run.
import { expect, test } from 'vitest'
import type { SetEntry } from '../types'
import { setRuns } from './LiftView'

const set = (setIndex: number, weightKg: number, reps: number, extra: Partial<SetEntry> = {}): SetEntry => ({
  exerciseId: 'deadlift',
  setIndex,
  weightKg,
  reps,
  loggedAt: setIndex,
  ...extra,
})

const shape = (runs: ReturnType<typeof setRuns>) => runs.map((r) => [r.first.weightKg, r.first.reps, ...r.more, r.kind ?? '', r.pr])

test('v7 consecutive Sets at one load share a run; a new load starts one', () => {
  expect(shape(setRuns([set(1, 46.25, 9), set(2, 46.25, 8), set(3, 46.25, 8)], null))).toEqual([[46.25, 9, 8, 8, '', false]])
  expect(shape(setRuns([set(1, 60, 10), set(2, 70, 7), set(3, 70, 7)], null))).toEqual([
    [60, 10, '', false],
    [70, 7, 7, '', false],
  ])
})

test('v7 the PR Set ends its run, so its tag follows the Set that earned it', () => {
  expect(shape(setRuns([set(1, 60, 10), set(2, 70, 7), set(3, 70, 7)], 2))).toEqual([
    [60, 10, '', false],
    [70, 7, '', true],
    [70, 7, '', false],
  ])
  expect(shape(setRuns([set(1, 80, 8), set(2, 80, 9)], 2))).toEqual([[80, 8, 9, '', true]])
})

test('v7 a Set of another kind stands alone with its marker', () => {
  expect(shape(setRuns([set(1, 80, 8), set(2, 80, 9, { kind: 'failure' }), set(3, 80, 6)], null))).toEqual([
    [80, 8, '', false],
    [80, 9, 'failure', false],
    [80, 6, '', false],
  ])
})
