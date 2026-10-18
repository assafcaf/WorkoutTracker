// E18-T4 [O12]: one calendar-week definition (R-K) and adherence (R-A) over the stats fixture.
import { expect, test } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { adherence, thisWeek, weekStart, weeksOf } from './weeks'
import type { Session } from '../../types'

process.env.TZ = 'Asia/Jerusalem' // the zone the fixture was written in

const root = resolve(__dirname, '..', '..', '..')
const fixture = JSON.parse(
  readFileSync(join(root, 'src/test/fixtures/stats/sessions.json'), 'utf8'),
) as Session[]
const NOW = new Date(2026, 9, 15, 18, 5).getTime() // Thu 15 Oct 2026

const local = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min).getTime()
const day = (ms: number) => new Date(ms).toLocaleDateString('sv-SE')

function session(id: string, startedAt: number): Session {
  return { id, programId: 'p', workoutId: 'w', startedAt, finishedAt: startedAt + 1000, entries: [] }
}

test('O12 the weeks of the fixture hold 3 3 3 3 3 3 3 0 3 3 3 3 1 3 3 3 2 Sessions', () => {
  const weeks = weeksOf(fixture, NOW)
  expect(weeks.map((w) => w.sessions.length)).toEqual([3, 3, 3, 3, 3, 3, 3, 0, 3, 3, 3, 3, 1, 3, 3, 3, 2])
  expect(day(weeks[0].start)).toBe('2026-06-22')
  expect(day(weeks[weeks.length - 1].start)).toBe('2026-10-12')
})

test('O12 only the week now falls in is in progress', () => {
  const weeks = weeksOf(fixture, NOW)
  expect(weeks.map((w) => w.inProgress)).toEqual([...Array(16).fill(false), true])
})

test('O12 this week is 2 of 3 so far on Thu 15 Oct', () => {
  expect(thisWeek(fixture, NOW, 3)).toEqual({ done: 2, planned: 3 })
})

test('O12 the last 4 full weeks are 10 of 12, the in-progress week left out', () => {
  expect(adherence(fixture, NOW, 3, 4)).toEqual({ done: 10, planned: 12 })
})

test('O12 the last 16 full weeks are 43 of 48', () => {
  expect(adherence(fixture, NOW, 3, 16)).toEqual({ done: 43, planned: 48 })
})

test('O12 a Session at Sunday 23:30 and one at Monday 00:10 fall in different weeks', () => {
  const sun = session('sun', local(2026, 10, 11, 23, 30))
  const mon = session('mon', local(2026, 10, 12, 0, 10))
  const weeks = weeksOf([sun, mon], NOW)
  expect(weeks.map((w) => w.sessions.map((s) => s.id))).toEqual([['sun'], ['mon']])
})

test('O12 weekStart is the Monday 00:00 local, for a Sunday, a Monday and a mid-week time', () => {
  expect(weekStart(local(2026, 10, 11, 23, 59))).toBe(local(2026, 10, 5))
  expect(weekStart(local(2026, 10, 12, 0, 0))).toBe(local(2026, 10, 12))
  expect(weekStart(local(2026, 10, 15, 18, 5))).toBe(local(2026, 10, 12))
})

test('O12 no Sessions yields no weeks and no axis', () => {
  expect(weeksOf([], NOW)).toEqual([])
})

test('O12 a deleted Session is not counted in its week', () => {
  const live = session('live', local(2026, 10, 13, 9))
  const gone = { ...session('gone', local(2026, 10, 14, 9)), deletedAt: local(2026, 10, 14, 10) }
  expect(thisWeek([live, gone], NOW, 3)).toEqual({ done: 1, planned: 3 })
})

test('O12 a single Session today leaves this week the only week, in progress', () => {
  const weeks = weeksOf([session('a', local(2026, 10, 15, 8))], NOW)
  expect(weeks).toHaveLength(1)
  expect(weeks[0].inProgress).toBe(true)
})

// E19-T2 [O4]: a configurable week start, default Monday.
test('E19 O4 weekStart with Saturday answers the latest Saturday midnight on or before the time', () => {
  expect(weekStart(local(2026, 10, 17, 10), 6)).toBe(local(2026, 10, 17))
  expect(weekStart(local(2026, 10, 16, 23, 59), 6)).toBe(local(2026, 10, 10))
  expect(weekStart(local(2026, 10, 19, 8), 6)).toBe(local(2026, 10, 17))
})

test('E19 O4 weekStart with Monday or no weekday puts Sat 17 Oct in the week of Mon 12 Oct', () => {
  expect(weekStart(local(2026, 10, 17, 10), 1)).toBe(local(2026, 10, 12))
  expect(weekStart(local(2026, 10, 17, 10))).toBe(local(2026, 10, 12))
})

test('E19 O4 weekStart with Sunday and with Wednesday', () => {
  expect(weekStart(local(2026, 10, 17, 10), 0)).toBe(local(2026, 10, 11))
  expect(weekStart(local(2026, 10, 14, 0), 3)).toBe(local(2026, 10, 14))
  expect(weekStart(local(2026, 10, 13, 23), 3)).toBe(local(2026, 10, 7))
})

test('E19 O4 weekStart is local midnight across the clock change of Sun 25 Oct 2026', () => {
  expect(weekStart(local(2026, 10, 30, 12), 6)).toBe(local(2026, 10, 24))
  expect(weekStart(local(2026, 10, 25, 12), 6)).toBe(local(2026, 10, 24))
  expect(weekStart(local(2026, 10, 25, 12), 0)).toBe(local(2026, 10, 25))
  expect(weekStart(local(2026, 10, 31, 12), 6)).toBe(local(2026, 10, 31))
  expect(new Date(weekStart(local(2026, 10, 30, 12), 6)).getHours()).toBe(0)
})

test('E19 O4 weeksOf with Saturday runs Saturday to Friday and puts Sat 17 Oct in the week in progress on Mon 19 Oct', () => {
  const now = local(2026, 10, 19, 9)
  const weeks = weeksOf([session('fri', local(2026, 10, 16, 18)), session('sat', local(2026, 10, 17, 10))], now, 6)
  expect(weeks.map((w) => day(w.start))).toEqual(['2026-10-10', '2026-10-17'])
  expect(weeks.map((w) => w.inProgress)).toEqual([false, true])
  expect(weeks.map((w) => w.sessions.map((s) => s.id))).toEqual([['fri'], ['sat']])
})

test('E19 O4 weeksOf with Saturday keeps every fixture Session and starts on Saturdays', () => {
  const weeks = weeksOf(fixture, NOW, 6)
  expect(weeks.every((w) => new Date(w.start).getDay() === 6)).toBe(true)
  expect(day(weeks[0].start)).toBe('2026-06-20')
  expect(day(weeks[weeks.length - 1].start)).toBe('2026-10-10')
  expect(weeks.reduce((n, w) => n + w.sessions.length, 0)).toBe(fixture.length)
})

test('E19 O4 weeksOf with Wednesday groups the fixture by Wednesday weeks, 1 Session in the week of 14 Oct', () => {
  const weeks = weeksOf(fixture, NOW, 3)
  expect(day(weeks[0].start)).toBe('2026-06-17')
  expect(day(weeks[weeks.length - 1].start)).toBe('2026-10-14')
  expect(weeks).toHaveLength(18)
  expect(weeks[weeks.length - 1].sessions).toHaveLength(1)
  expect(weeks[0].sessions).toHaveLength(1)
})

test('E19 O4 thisWeek with Saturday counts the Sat and Sun Sessions on Mon 19 Oct, not with Monday', () => {
  const sessions = [session('sat', local(2026, 10, 17, 10)), session('sun', local(2026, 10, 18, 10))]
  const now = local(2026, 10, 19, 9)
  expect(thisWeek(sessions, now, 3, 6)).toEqual({ done: 2, planned: 3 })
  expect(thisWeek(sessions, now, 3)).toEqual({ done: 0, planned: 3 })
})

test('E19 O4 adherence with Saturday takes the last complete week as Sat 10 to Fri 16 Oct', () => {
  const sessions = [
    session('fri', local(2026, 10, 16, 18)),
    session('sat', local(2026, 10, 17, 10)),
    session('sun', local(2026, 10, 18, 10)),
  ]
  const now = local(2026, 10, 19, 9)
  expect(adherence(sessions, now, 3, 1, 6)).toEqual({ done: 1, planned: 3 })
  expect(adherence(sessions, now, 3, 1)).toEqual({ done: 3, planned: 3 })
})

test('E19 O4 thisWeek on the fixture with Wednesday is 1 of 3 on Thu 15 Oct, with the default 2 of 3', () => {
  expect(thisWeek(fixture, NOW, 3, 3)).toEqual({ done: 1, planned: 3 })
  expect(thisWeek(fixture, NOW, 3)).toEqual({ done: 2, planned: 3 })
})
