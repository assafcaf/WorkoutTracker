import { expect, test } from 'vitest'
import { usualRestSeconds } from './usualRest'
import type { Session, SetEntry } from '../types'

const T = 1_700_000_000_000

function set(exerciseId: string, setIndex: number, atSeconds: number, extra: Partial<SetEntry> = {}): SetEntry {
  return { exerciseId, setIndex, weightKg: 60, reps: 8, loggedAt: T + atSeconds * 1000, ...extra }
}

function session(id: string, entries: SetEntry[]): Session {
  return { id, programId: 'p', workoutId: 'w', startedAt: T, finishedAt: T + 3_600_000, entries }
}

test('S4 the usual rest is the median gap to the next Set, rounded to 5 s', () => {
  const sessions = [
    session('a', [set('squat', 1, 0), set('squat', 2, 150), set('squat', 3, 312), set('squat', 4, 480)]),
  ]
  // Gaps 150, 162, 168: the median 162 rounds to 160.
  expect(usualRestSeconds('squat', sessions)).toBe(160)
})

test('S4 a stored restSeconds counts as the rest taken after its Set', () => {
  const sessions = [
    session('a', [
      set('squat', 1, 0, { restSeconds: 100 }),
      set('squat', 2, 400, { restSeconds: 100 }),
      set('squat', 3, 800, { restSeconds: 100 }),
    ]),
  ]
  expect(usualRestSeconds('squat', sessions)).toBe(100)
})

test('S4 the gap to another Exercise counts, warm-ups and breaks over 15 min do not', () => {
  const sessions = [
    session('a', [
      set('squat', 1, 0, { kind: 'warmup' }),
      set('squat', 2, 60),
      set('lunges', 1, 180),
      set('squat', 3, 1200),
      set('squat', 4, 1380),
      set('squat', 5, 1560),
    ]),
  ]
  // Rests after working squat Sets: 120 (to lunges), 180, 180; the 1020 s gap is a break.
  expect(usualRestSeconds('squat', sessions)).toBe(180)
})

test('S4 under three rests there is no usual rest', () => {
  expect(usualRestSeconds('squat', [session('a', [set('squat', 1, 0), set('squat', 2, 150)])])).toBeNull()
  expect(usualRestSeconds('squat', [])).toBeNull()
})
