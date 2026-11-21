import { describe, expect, it } from 'vitest'
import type { Session } from '../../types'
import { trainDayOf, usualDays } from './trainDay'

const day = (month: number, date: number, hour = 18): number => new Date(2026, month, date, hour).getTime()

function done(id: string, startedAt: number): Session {
  return {
    id,
    programId: 'assaf-ab-2026',
    workoutId: 'workout-a',
    startedAt,
    finishedAt: startedAt + 3_600_000,
    entries: [],
    updatedAt: startedAt + 3_600_000,
  }
}

// Mon, Wed and Fri in each of the four weeks before Mon 12 Oct 2026.
const REGULAR = [14, 16, 18, 21, 23, 25].map((d, i) => done(`s${i}`, day(8, d))).concat(
  [28, 30].map((d, i) => done(`t${i}`, day(8, d))),
  [2, 5, 7, 9].map((d, i) => done(`u${i}`, day(9, d))),
)

const base = { sessionsPerWeek: 3, weekStartsOn: 1 as const, reminders: null, dueName: 'Workout B' }

describe('usualDays', () => {
  it('reads Mon, Wed and Fri for a regular lifter', () => {
    expect(usualDays(REGULAR, day(9, 13), 1)).toEqual([1, 3, 5])
  })

  it('is empty for a trainee with no Sessions', () => {
    expect(usualDays([], day(9, 13), 1)).toEqual([])
  })
})

describe('trainDayOf (DX-01)', () => {
  it('a day with sessions left this week is a training day: the weekday and the count', () => {
    const sessions = [...REGULAR, done('mon', day(9, 12))]
    expect(trainDayOf({ ...base, sessions, now: day(9, 15, 8) })).toEqual({
      rest: false,
      meta: 'Thursday · 1 of 3 this week',
    })
  })

  it('off the usual days with the sessions left fitting on the usual days still to come, it is a rest day', () => {
    // Mon/Wed/Fri lifter on Thursday with 2 of 3 done: Friday takes the last one.
    const sessions = [...REGULAR, done('mon', day(9, 12)), done('wed', day(9, 14))]
    expect(trainDayOf({ ...base, sessions, now: day(9, 15, 8) })).toEqual({
      rest: true,
      meta: 'Rest day · next: Workout B, Friday',
    })
  })

  it('on a usual day with sessions left it trains, whatever the count', () => {
    const sessions = [...REGULAR, done('mon', day(9, 12)), done('wed', day(9, 14))]
    expect(trainDayOf({ ...base, sessions, now: day(9, 16, 8) }).rest).toBe(false)
  })

  it('once the week is done it is a rest day naming the next Workout and its usual day', () => {
    const sessions = [...REGULAR, done('mon', day(9, 12)), done('tue', day(9, 13)), done('wed', day(9, 14))]
    expect(trainDayOf({ ...base, sessions, now: day(9, 15, 8) })).toEqual({
      rest: true,
      meta: 'Rest day · next: Workout B, Friday',
    })
  })

  it('after a Session finished today it says so', () => {
    const sessions = [...REGULAR, done('thu', day(9, 15, 7))]
    expect(trainDayOf({ ...base, sessions, now: day(9, 15, 20) }).meta).toBe('Done today · next: Workout B, Friday')
  })

  it('with Reminders set, a day off them is a rest day and the next reminder day is named', () => {
    expect(trainDayOf({ ...base, sessions: [], reminders: [2, 6], now: day(9, 15, 8) })).toEqual({
      rest: true,
      meta: 'Rest day · next: Workout B, Saturday',
    })
  })

  it('a new trainee with no usual days trains today, and a rest day names no day it cannot know', () => {
    expect(trainDayOf({ ...base, sessions: [], now: day(9, 15, 8) }).rest).toBe(false)
    const week = [done('a', day(9, 12)), done('b', day(9, 13)), done('c', day(9, 14))]
    expect(trainDayOf({ ...base, sessions: week, now: day(9, 15, 8) }).meta).toBe('Rest day · next: Workout B')
  })
})
