import { expect, test } from 'vitest'
import {
  calendarWeeks,
  dayMonth,
  formatSetCount,
  HEAT_ROWS,
  heatRowsFor,
  sessionsByWeek,
  sessionsInWeeks,
  startOfWeek,
  weeklyRegionSets,
} from './sessionsView'
import type { Region, Resolve } from './muscles'
import type { Exercise, LibraryExercise, Session } from '../types'

// Local-time fixtures: Tue 13 Oct 2026, 18:00 is "now", so this week runs Mon 12 Oct to Sun 18 Oct.
const at = (month: number, day: number, hour = 18): number => new Date(2026, month - 1, day, hour).getTime()
const NOW = at(10, 13)

function session(id: string, startedAt: number, entries: Session['entries'] = []): Session {
  return { id, programId: 'p', workoutId: 'a', startedAt, finishedAt: startedAt + 3_000_000, entries }
}

test('S6a startOfWeek is local Monday midnight', () => {
  expect(startOfWeek(NOW)).toBe(new Date(2026, 9, 12).getTime())
  expect(startOfWeek(at(10, 18, 23))).toBe(new Date(2026, 9, 12).getTime())
  expect(startOfWeek(at(10, 12, 0))).toBe(new Date(2026, 9, 12).getTime())
})

test('S6a dayMonth reads 7 Sep this year and 7 Sep 2025 in another', () => {
  expect(dayMonth(at(9, 7), NOW)).toBe('7 Sep')
  expect(dayMonth(new Date(2025, 8, 7).getTime(), NOW)).toBe('7 Sep 2025')
})

test('S6a calendarWeeks gives six Monday-first weeks ending this week, marking trained days, today and the future', () => {
  const weeks = calendarWeeks([session('mon', at(10, 12)), session('fri', at(10, 9)), session('old', at(8, 1))], NOW, 6)

  expect(weeks).toHaveLength(6)
  expect(weeks.map((week) => dayMonth(week.start, NOW))).toEqual(['7 Sep', '14 Sep', '21 Sep', '28 Sep', '5 Oct', '12 Oct'])
  for (const week of weeks) expect(week.days).toHaveLength(7)

  const last = weeks[5].days
  expect(last[0]).toMatchObject({ trained: true, today: false, future: false })
  expect(last[1]).toMatchObject({ trained: false, today: true, future: false })
  expect(last.slice(2).every((day) => day.future)).toBe(true)
  expect(weeks[4].days[4].trained).toBe(true)
  expect(weeks.flatMap((week) => week.days).filter((day) => day.trained)).toHaveLength(2)
})

test('S6a sessionsInWeeks counts the Sessions from the first calendar week up to now', () => {
  const sessions = [session('a', at(10, 13, 9)), session('b', at(9, 7, 9)), session('c', at(9, 6, 9))]
  expect(sessionsInWeeks(sessions, NOW, 6)).toBe(2)
})

test('S6a sessionsByWeek groups newest first as This week, Last week, then Week of', () => {
  const groups = sessionsByWeek(
    [session('fri', at(10, 9)), session('tue', at(10, 13, 9)), session('mon', at(10, 12)), session('old', at(9, 23))],
    NOW,
  )

  expect(groups.map((group) => group.label)).toEqual(['This week', 'Last week', 'Week of 21 Sep'])
  expect(groups[0].sessions.map((s) => s.id)).toEqual(['tue', 'mon'])
  expect(groups[1].sessions.map((s) => s.id)).toEqual(['fri'])
})

const LIBRARY = new Map<string, LibraryExercise>([
  [
    'Lib_Squat',
    {
      id: 'Lib_Squat',
      name: 'Squat',
      force: null,
      level: 'beginner',
      mechanic: null,
      equipment: null,
      primaryMuscles: ['quadriceps'],
      secondaryMuscles: ['glutes'],
      instructions: [],
      category: 'strength',
      images: [],
    },
  ],
])
const SQUAT: Exercise = { id: 'squat', name: 'Squat', weightStep: 2.5, startWeight: 20, bodyweight: false, libraryId: 'Lib_Squat' }
const resolve: Resolve = (id) => (id === 'squat' ? SQUAT : undefined)

test('S6a weeklyRegionSets counts each week’s Sessions into Regions, warm-ups left out', () => {
  const sets = (startedAt: number, count: number, kind?: 'warmup') =>
    Array.from({ length: count }, (_, index) => ({
      exerciseId: 'squat',
      setIndex: index,
      weightKg: 60,
      reps: 8,
      loggedAt: startedAt + index,
      ...(kind ? { kind } : {}),
    }))
  const weeks = weeklyRegionSets(
    [
      session('this', at(10, 13, 9), [...sets(at(10, 13, 9), 3), ...sets(at(10, 13, 9), 2, 'warmup')]),
      session('last', at(10, 9), sets(at(10, 9), 4)),
    ],
    NOW,
    4,
    resolve,
    LIBRARY,
  )

  expect(weeks.map((week) => dayMonth(week.start, NOW))).toEqual(['21 Sep', '28 Sep', '5 Oct', '12 Oct'])
  expect(weeks[3].counts.get('quadriceps')).toBe(3)
  expect(weeks[3].counts.get('gluteal')).toBe(1.5)
  expect(weeks[2].counts.get('quadriceps')).toBe(4)
  expect(weeks[0].counts.size).toBe(0)
})

test('S6a heatRowsFor shows the eleven core rows always and an extra Region only once counted', () => {
  expect(HEAT_ROWS.map((row) => row.label)).toEqual([
    'Chest',
    'Shoulders',
    'Triceps',
    'Lats',
    'Biceps',
    'Quads',
    'Lower back',
    'Hamstrings',
    'Glutes',
    'Calves',
    'Abs',
  ])
  expect(heatRowsFor([new Map()])).toHaveLength(11)
  const withForearm = heatRowsFor([new Map<Region, number>([['forearm', 0.5]])])
  expect(withForearm.map((row) => row.label)).toContain('Forearms')
  expect(withForearm).toHaveLength(12)
})

test('S6a formatSetCount keeps a half set and drops a whole one’s decimals', () => {
  expect(formatSetCount(7)).toBe('7')
  expect(formatSetCount(2.5)).toBe('2.5')
  expect(formatSetCount(0)).toBe('0')
})
