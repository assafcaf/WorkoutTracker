// E18-T4 [O13] [O14] [O15] and the engine half of [O25]: the 12-muscle table over R-K weeks.
import { beforeAll, expect, test } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import {
  muscleContributors,
  muscleWeeks,
  plannedPerWeek,
  STATS_MUSCLES,
  thisWeekMuscles,
  windowAverage,
} from './muscles'
import { loadCatalog, loadPrograms } from '../../data/catalog'
import { loadLibrary } from '../../data/library'
import type { LibraryExercise, Muscle, Program, Session } from '../../types'

process.env.TZ = 'Asia/Jerusalem' // the zone the fixture was written in

const root = resolve(__dirname, '..', '..', '..')
const readJson = <T>(rel: string): T => JSON.parse(readFileSync(join(root, rel), 'utf8')) as T
const fixture = readJson<Session[]>('src/test/fixtures/stats/sessions.json')
const brief = readJson<{
  weeks: { weekOf: string; muscleSets: Record<string, number> }[]
  plannedMuscleSetsPerWeek: Record<string, number>
  muscleSetsAvgLast2FullWeeks: Record<string, number>
}>('docs/design/stats-2026-10/brief-data.json')

const catalog = loadCatalog()
const resolveExercise = (id: string) => catalog.get(id)
const program = loadPrograms().find((p) => p.id === 'assaf-ab-2026') as Program
let library: Map<string, LibraryExercise>
beforeAll(async () => {
  library = await loadLibrary()
})

const local = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min).getTime()
const NOW = local(2026, 10, 15, 18, 5) // Thu 15 Oct 2026
const day = (ms: number) => new Date(ms).toLocaleDateString('sv-SE')
// The Sessions that exist at `now`: the fixture holds later ones too.
const until = (now: number) => fixture.filter((s) => s.startedAt <= now)

// The 12 of R-M plus the two counted but shown only in drill-downs.
const COUNTED: Muscle[] = [
  'chest', 'shoulders', 'triceps', 'lats', 'middle back', 'biceps', 'quadriceps',
  'hamstrings', 'glutes', 'calves', 'lower back', 'abdominals', 'forearms', 'traps',
]
const asRecord = (m: Map<Muscle, number>) => Object.fromEntries(COUNTED.map((k) => [k, m.get(k) ?? 0]))

test('O25 the muscle table has the 12 muscles of R-M, Lats and Mid back apart', () => {
  expect([...STATS_MUSCLES]).toEqual([
    'chest', 'shoulders', 'triceps', 'lats', 'middle back', 'biceps',
    'quadriceps', 'hamstrings', 'glutes', 'calves', 'lower back', 'abdominals',
  ])
})

test('O13 per-week muscle sets equal the brief for all 17 R-K weeks, warm-ups never counted', () => {
  const weeks = muscleWeeks(fixture, NOW, resolveExercise, library)
  expect(weeks.map((w) => day(w.start))).toEqual(brief.weeks.map((w) => w.weekOf))
  weeks.forEach((w, i) => {
    expect(asRecord(w.sets), brief.weeks[i].weekOf).toEqual(brief.weeks[i].muscleSets)
  })
})

test('O25 only the week now falls in is marked in progress', () => {
  const weeks = muscleWeeks(fixture, NOW, resolveExercise, library)
  expect(weeks.filter((w) => w.inProgress).map((w) => day(w.start))).toEqual(['2026-10-12'])
})

test('O13 planned per week equals the brief, plan sets x sessionsPerWeek / workouts', () => {
  expect(asRecord(plannedPerWeek(program, resolveExercise, library))).toEqual(brief.plannedMuscleSetsPerWeek)
})

test('O13 the 2-week window is the average of 28 Sep and 5 Oct, not the week in progress', () => {
  expect(asRecord(windowAverage(fixture, NOW, resolveExercise, library))).toEqual(
    brief.muscleSetsAvgLast2FullWeeks,
  )
  // Lats: (25 + 12.5) / 2; Mid back: (17 + 8.5) / 2.
  const win = windowAverage(fixture, NOW, resolveExercise, library)
  expect(win.get('lats')).toBe(18.75)
  expect(win.get('middle back')).toBe(12.75)
})

test('O13 a window of 1 week is the last complete week alone', () => {
  const win = windowAverage(fixture, NOW, resolveExercise, library, 1)
  expect(win.get('lats')).toBe(12.5)
  expect(win.get('chest')).toBe(14)
})

test('O14 on Thu 15 Oct Lats are 12.5 done + 12.5 still planned, Mid back 8.5 + 8.5, Chest 7 + 0', () => {
  const week = thisWeekMuscles(fixture, program, NOW, resolveExercise, library)
  expect(week.get('lats')).toEqual({ done: 12.5, stillPlanned: 12.5 })
  expect(week.get('middle back')).toEqual({ done: 8.5, stillPlanned: 8.5 })
  expect(week.get('chest')).toEqual({ done: 7, stillPlanned: 0 })
})

test('O14 this week done so far equals the brief week of 12 Oct for every muscle', () => {
  const week = thisWeekMuscles(fixture, program, NOW, resolveExercise, library)
  const done = Object.fromEntries(COUNTED.map((m) => [m, week.get(m)?.done ?? 0]))
  expect(done).toEqual(brief.weeks[16].muscleSets)
})

test('O14 after Monday 5 Oct only A is done: B then A are still owed, continuing the rotation', () => {
  const week = thisWeekMuscles(until(local(2026, 10, 5, 23)), program, local(2026, 10, 5, 23),resolveExercise, library)
  expect(week.get('chest')).toEqual({ done: 7, stillPlanned: 7 })
  expect(week.get('lats')).toEqual({ done: 0, stillPlanned: 12.5 })
})

test('O14 a week with all 3 Sessions done has nothing still planned', () => {
  const week = thisWeekMuscles(until(local(2026, 10, 11, 20)), program, local(2026, 10, 11, 20),resolveExercise, library)
  for (const m of STATS_MUSCLES) expect(week.get(m)?.stillPlanned, m).toBe(0)
  expect(week.get('chest')?.done).toBe(14)
})

test('O14 a week with no Session yet still plans the rotation after the latest Session', () => {
  // Mon 12 Oct 08:00: latest Session is Fri 9 Oct (A), so B, A, B are owed.
  const week = thisWeekMuscles(until(local(2026, 10, 12, 8)), program, local(2026, 10, 12, 8),resolveExercise, library)
  expect(week.get('lats')).toEqual({ done: 0, stillPlanned: 25 })
  expect(week.get('chest')).toEqual({ done: 0, stillPlanned: 7 })
})

test('O15 Workout B of Mon 12 Oct lists its lifts for Lats, summing to the week total 12.5', () => {
  const list = muscleContributors(fixture, 'lats', local(2026, 10, 12), local(2026, 10, 13), resolveExercise, library)
  expect(list.length).toBeGreaterThan(0)
  expect(new Set(list.map((c) => c.exerciseId)).size).toBe(list.length)
  expect(list.reduce((sum, c) => sum + c.sets, 0)).toBe(12.5)
  for (const c of list) expect(c.name.length).toBeGreaterThan(0)
})

test('O15 contributors over a 2-week window sum to the muscle total, never counting warm-ups', () => {
  const list = muscleContributors(fixture, 'middle back', local(2026, 9, 28), local(2026, 10, 12), resolveExercise, library)
  expect(list.reduce((sum, c) => sum + c.sets, 0)).toBe(25.5) // 17 + 8.5
})

test('O15 a muscle nothing trained in the window has no contributors', () => {
  expect(muscleContributors(fixture, 'chest', local(2026, 8, 10), local(2026, 8, 17), resolveExercise, library)).toEqual([])
})

test('E19 O4 muscleWeeks with Wednesday runs Wednesday weeks, the one from Wed 14 Oct in progress', () => {
  const weeks = muscleWeeks(fixture, NOW, resolveExercise, library, 3)
  expect(day(weeks[0].start)).toBe('2026-06-17')
  expect(day(weeks[weeks.length - 1].start)).toBe('2026-10-14')
  expect(weeks.filter((w) => w.inProgress).map((w) => day(w.start))).toEqual(['2026-10-14'])
  expect(weeks.every((w) => new Date(w.start).getDay() === 3)).toBe(true)
})

test('E19 O4 thisWeekMuscles with Wednesday has only Wed 14 Oct done: Chest 7 + 7 still planned, Lats 0 + 12.5', () => {
  const week = thisWeekMuscles(fixture, program, NOW, resolveExercise, library, 3)
  expect(week.get('chest')).toEqual({ done: 7, stillPlanned: 7 })
  expect(week.get('lats')).toEqual({ done: 0, stillPlanned: 12.5 })
})

test('E19 O4 windowAverage with Wednesday takes the last complete Wednesday week, 7 Oct to 13 Oct: Chest 7', () => {
  // Wed 7 (B), Fri 9 (A), Mon 12 (B): one chest session of 7. Monday weeks give 14.
  expect(windowAverage(fixture, NOW, resolveExercise, library, 1, 3).get('chest')).toBe(7)
})
