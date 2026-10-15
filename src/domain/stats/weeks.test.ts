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
