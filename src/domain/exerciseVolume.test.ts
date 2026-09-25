import { describe, expect, test } from 'vitest'
import { baselineVolume, exerciseVolume, volumePercent } from './exerciseVolume'
import type { Exercise, Session, SetEntry, VolumeBaseline } from '../types'

// Fixtures follow volume.test.ts's convention.
function exercise(overrides: Partial<Exercise> & { id: string }): Exercise {
  return {
    name: 'Fixture Exercise',
    weightStep: 2.5,
    startWeight: 20,
    bodyweight: false,
    invertProgress: false,
    libraryId: 'fixture-lib',
    ...overrides,
  }
}

function setEntry(overrides: Partial<SetEntry> & { exerciseId: string }): SetEntry {
  return {
    setIndex: 0,
    weightKg: 20,
    reps: 10,
    loggedAt: 0,
    ...overrides,
  }
}

function session(overrides: Partial<Session> & { id: string; entries: SetEntry[] }): Session {
  return {
    programId: 'fixture-program',
    workoutId: 'fixture-workout',
    startedAt: 0,
    finishedAt: null,
    ...overrides,
  }
}

const squat = exercise({ id: 'back-squat', bodyweight: false, invertProgress: false })
const pushup = exercise({ id: 'push-up', bodyweight: true, invertProgress: false })
const assistedDip = exercise({ id: 'assisted-dip', bodyweight: false, invertProgress: true })

// O1: exerciseVolume ----------------------------------------------------------------------------

describe('exerciseVolume (O1)', () => {
  test('a loaded Exercise sums reps times weightKg over its own entries only', () => {
    const entries = [
      setEntry({ exerciseId: 'back-squat', reps: 5, weightKg: 60 }),
      setEntry({ exerciseId: 'back-squat', reps: 3, weightKg: 100 }),
      setEntry({ exerciseId: 'push-up', reps: 20, weightKg: null }),
    ]

    // 5*60 + 3*100 = 600; the push-up entry (a different exerciseId) is excluded.
    expect(exerciseVolume(squat, entries)).toEqual({ amount: 600, unit: 'kg' })
  })

  test('a Bodyweight Exercise sums reps only, the same split as volumeSeries', () => {
    const entries = [
      setEntry({ exerciseId: 'push-up', reps: 20, weightKg: null }),
      setEntry({ exerciseId: 'push-up', reps: 15, weightKg: null }),
      setEntry({ exerciseId: 'back-squat', reps: 5, weightKg: 60 }),
    ]

    expect(exerciseVolume(pushup, entries)).toEqual({ amount: 35, unit: 'reps' })
  })

  test('an invertProgress Exercise sums reps only, the same split as volumeSeries', () => {
    const entries = [
      setEntry({ exerciseId: 'assisted-dip', reps: 8, weightKg: 15 }),
      setEntry({ exerciseId: 'assisted-dip', reps: 6, weightKg: 15 }),
    ]

    expect(exerciseVolume(assistedDip, entries)).toEqual({ amount: 14, unit: 'reps' })
  })
})

// O1: volumePercent -------------------------------------------------------------------------------

describe('volumePercent (O1)', () => {
  test('is round(100 x today / baseline)', () => {
    // 100 * 33 / 40 = 82.5, rounds up to 83.
    expect(volumePercent(33, 40)).toBe(83)
  })

  test('is null when baseline is null', () => {
    expect(volumePercent(1500, null)).toBeNull()
  })

  test('is null when baseline is 0', () => {
    expect(volumePercent(1500, 0)).toBeNull()
  })
})

// O2: baselineVolume ------------------------------------------------------------------------------

const DAY_MS = 24 * 60 * 60 * 1000
const NOW = Date.UTC(2026, 8, 25) // 2026-09-25, matching today's date in the run log.

function daysAgo(days: number): number {
  return NOW - days * DAY_MS
}

// Back squat sessions at volumes 1,000 kg (100 days ago), 1,800 kg (20 days ago) and 1,500 kg
// (3 days ago). Both startedAt and finishedAt are stamped at the same age, since the ticket
// does not say which field a Session's "days ago" is measured from.
function finishedSquatSession(id: string, daysBack: number, weightKg: number, reps: number): Session {
  const at = daysAgo(daysBack)
  return session({
    id,
    startedAt: at,
    finishedAt: at,
    entries: [setEntry({ exerciseId: 'back-squat', reps, weightKg })],
  })
}

const oldest = finishedSquatSession('session-100d', 100, 100, 10) // 100 * 10 = 1,000 kg
const middle = finishedSquatSession('session-20d', 20, 90, 20) // 90 * 20 = 1,800 kg
const latest = finishedSquatSession('session-3d', 3, 100, 15) // 100 * 15 = 1,500 kg

const threeSessions = [oldest, middle, latest]

describe('baselineVolume (O2)', () => {
  test.each<[string, VolumeBaseline, number]>([
    ['{ period: "last" } is the most recently started finished Session', { period: 'last' }, 1500],
    ['{ period: "1w", aggregate: "avg" } averages the one Session within 7 days', { period: '1w', aggregate: 'avg' }, 1500],
    ['{ period: "1m", aggregate: "avg" } averages the two Sessions within 30 days', { period: '1m', aggregate: 'avg' }, 1650],
    ['{ period: "1m", aggregate: "max" } takes the max of the two Sessions within 30 days', { period: '1m', aggregate: 'max' }, 1800],
    ['{ period: "6m", aggregate: "avg" } averages all three Sessions within 182 days', { period: '6m', aggregate: 'avg' }, 1433 + 1 / 3],
  ])('%s', (_label, baseline, expected) => {
    expect(baselineVolume(squat, threeSessions, baseline, NOW)).toBeCloseTo(expected, 6)
  })

  test('{ period: "since", since: <50 days ago>, aggregate: "max" } takes the max of Sessions since that date', () => {
    const baseline: VolumeBaseline = { period: 'since', since: daysAgo(50), aggregate: 'max' }

    expect(baselineVolume(squat, threeSessions, baseline, NOW)).toBe(1800)
  })

  test('a Session in progress never counts, even as the most recent one', () => {
    const inProgress = session({
      id: 'session-in-progress',
      startedAt: daysAgo(1),
      finishedAt: null,
      entries: [setEntry({ exerciseId: 'back-squat', reps: 1, weightKg: 999 })],
    })

    expect(baselineVolume(squat, [...threeSessions, inProgress], { period: 'last' }, NOW)).toBe(1500)
  })

  test('no Session in the period gives null', () => {
    expect(baselineVolume(squat, threeSessions, { period: '1w', aggregate: 'max' }, daysAgo(-90))).toBeNull()
  })
})
