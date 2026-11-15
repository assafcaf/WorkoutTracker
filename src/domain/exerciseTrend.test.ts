import { expect, test } from 'vitest'
import { loadCatalog } from '../data/catalog'
import { exerciseTrend, trendSummary, trendValueText } from './exerciseTrend'
import { epley } from './series'
import type { Exercise, Session, SetEntry } from '../types'

const catalog = loadCatalog()
const squat = catalog.get('back-squat') as Exercise
const assisted = catalog.get('assisted-pull-ups') as Exercise

const DAY = 24 * 3600_000
const T0 = Date.UTC(2026, 7, 10, 12)

function set(exerciseId: string, setIndex: number, weightKg: number | null, reps: number, extra: Partial<SetEntry> = {}): SetEntry {
  return { exerciseId, setIndex, weightKg, reps, loggedAt: setIndex, ...extra }
}

function session(id: string, startedAt: number, entries: SetEntry[], finished = true): Session {
  return { id, programId: 'p', workoutId: 'w', startedAt, finishedAt: finished ? startedAt + 3600_000 : null, entries }
}

test('a loaded lift trends the Epley e1RM of its best working set, warm-ups ignored', () => {
  const s = session('a', T0, [
    set('back-squat', 1, 100, 5, { kind: 'warmup' }),
    set('back-squat', 2, 70, 8),
    set('back-squat', 3, 75, 5),
  ])

  const trend = exerciseTrend(squat, [s])

  expect(trend.kind).toBe('e1rm')
  expect(trend.points).toHaveLength(1)
  // 70 x 8 -> 88.67 beats 75 x 5 -> 87.5; the 100 kg warm-up never counts.
  expect(trend.points[0].value).toBeCloseTo(epley(70, 8))
  expect(trend.points[0].best).toMatchObject({ weightKg: 70, reps: 8 })
})

test('points run oldest first, only finished Sessions count, and a point beating every earlier one is a record', () => {
  const trend = exerciseTrend(squat, [
    session('c', T0 + 14 * DAY, [set('back-squat', 1, 80, 8)]),
    session('a', T0, [set('back-squat', 1, 70, 8)]),
    session('b', T0 + 7 * DAY, [set('back-squat', 1, 65, 8)]),
    session('open', T0 + 21 * DAY, [set('back-squat', 1, 120, 8)], false),
  ])

  expect(trend.points.map((p) => p.sessionId)).toEqual(['a', 'b', 'c'])
  expect(trend.points.map((p) => p.record)).toEqual([false, false, true])
})

test('the summary reads where the estimated max went and over how long', () => {
  const trend = exerciseTrend(squat, [
    session('a', T0, [set('back-squat', 1, 60, 8)]),
    session('b', T0 + 56 * DAY, [set('back-squat', 1, 64.5, 8)]),
  ])

  // 60 x 8 -> 76.0, 64.5 x 8 -> 81.7: up 5.7 kg over 8 weeks.
  expect(trendSummary(trend)).toBe('Estimated max up 5.7 kg over 8 weeks')
  expect(trendValueText(trend, trend.points[1].value)).toBe('81.7 kg')
})

test('an assisted lift trends its signed Load, and less assistance reads as assistance down', () => {
  const trend = exerciseTrend(assisted, [
    session('a', T0, [set('assisted-pull-ups', 1, null, 8, { loadKg: -27 })]),
    session('b', T0 + 21 * DAY, [set('assisted-pull-ups', 1, null, 6, { loadKg: -20 }), set('assisted-pull-ups', 2, null, 8, { loadKg: -27 })]),
  ])

  expect(trend.kind).toBe('load')
  expect(trend.points.map((p) => p.value)).toEqual([-27, -20])
  expect(trend.points[1].best).toMatchObject({ loadKg: -20, reps: 6 })
  expect(trend.points[1].record).toBe(true)
  expect(trendValueText(trend, -20)).toBe('20 kg assistance')
  expect(trendSummary(trend)).toBe('Assistance down 7 kg over 3 weeks')
})

test('a bodyweight lift with no Load trends its working reps added up', () => {
  const trend = exerciseTrend(assisted, [
    session('a', T0, [set('assisted-pull-ups', 1, null, 8), set('assisted-pull-ups', 2, null, 6)]),
    session('b', T0 + 3 * DAY, [set('assisted-pull-ups', 1, null, 10), set('assisted-pull-ups', 2, null, 8)]),
  ])

  expect(trend.kind).toBe('reps')
  expect(trend.points.map((p) => p.value)).toEqual([14, 18])
  expect(trend.points[1].best.reps).toBe(10)
  expect(trendSummary(trend)).toBe('Total reps up 4 reps over 3 days')
})

test('one Session reads its value and that it is the only one', () => {
  const trend = exerciseTrend(squat, [session('a', T0, [set('back-squat', 1, 60, 10)])])

  expect(trendSummary(trend)).toBe('Estimated max 80 kg, one session so far')
})
