// E22-T4 [O10 O11]: lastWeekCard against hand-built Sessions. Contract (test-designer's):
//   lastWeekCard(...) -> { start, end (exclusive: next week's local midnight), last, before } | null
//   last / before = { sessions, sets, volumeKg, prs }; `before` is all zeros with no Session.
import { describe, expect, it } from 'vitest'
import type { BodyLog, Exercise, Session, SetEntry } from '../../types'
import { lastWeekCard } from './weekCard'

const exercise = (id: string, extra: Partial<Exercise> = {}): Exercise => ({
  id,
  name: id,
  weightStep: 2.5,
  startWeight: 20,
  bodyweight: false,
  libraryId: `lib-${id}`,
  ...extra,
})
const EXERCISES = new Map<string, Exercise>([
  ['bench', exercise('bench')],
  ['squat', exercise('squat')],
  ['push-ups', exercise('push-ups', { bodyweight: true, startWeight: null })],
])
const resolve = (id: string) => EXERCISES.get(id)
const planOf = () => undefined

// Mon 19 Oct 2026, 09:00 local.
const NOW = new Date(2026, 9, 19, 9).getTime()
const at = (day: number, month = 9) => new Date(2026, month, day, 18).getTime()
const midnight = (day: number, month = 9) => new Date(2026, month, day).getTime()

const set = (exerciseId: string, weightKg: number | null, reps: number, t: number, extra: Partial<SetEntry> = {}): SetEntry => ({
  exerciseId,
  setIndex: 0,
  weightKg,
  reps,
  loggedAt: t,
  ...extra,
})
const sess = (id: string, startedAt: number, entries: SetEntry[], extra: Partial<Session> = {}): Session => ({
  id,
  programId: 'p',
  workoutId: 'w',
  startedAt,
  finishedAt: startedAt + 3_000_000,
  entries,
  ...extra,
})
const bench = (id: string, startedAt: number, kg: number) => sess(id, startedAt, [set('bench', kg, 8, startedAt)])

describe('lastWeekCard', () => {
  it('O11: with weekStartsOn 1 last week runs Mon 5 to Sun 11 Oct', () => {
    const card = lastWeekCard([bench('a', at(7), 60)], NOW, resolve, planOf, 1, [])
    expect(card?.start).toBe(midnight(5))
    expect(card?.end).toBe(midnight(12))
  })

  it('O11: with weekStartsOn 6 last week runs Sat 10 to Fri 16 Oct', () => {
    const card = lastWeekCard([bench('a', at(12), 60)], NOW, resolve, planOf, 6, [])
    expect(card?.start).toBe(midnight(10))
    expect(card?.end).toBe(midnight(17))
  })

  it('O11: the weekStartsOn decides which week holds a Session (Sat 10 and Fri 16)', () => {
    const sessions = [bench('sat10', at(10), 60), bench('fri16', at(16), 60)]
    expect(lastWeekCard(sessions, NOW, resolve, planOf, 1, [])?.last.sessions).toBe(1)
    expect(lastWeekCard(sessions, NOW, resolve, planOf, 6, [])?.last.sessions).toBe(2)
  })

  it('O11: with no Session last week and none the week before it answers null', () => {
    const sessions = [bench('old', at(20, 8), 60), bench('now', at(19), 60), bench('thisweek', at(18), 60)]
    expect(lastWeekCard(sessions, NOW, resolve, planOf, 1, [])).toBeNull()
    expect(lastWeekCard([], NOW, resolve, planOf, 1, [])).toBeNull()
  })

  it('O11: a Session only the week before last still answers, last week all zeros', () => {
    const card = lastWeekCard([bench('a', at(1), 60)], NOW, resolve, planOf, 1, [])
    expect(card?.last).toEqual({ sessions: 0, sets: 0, volumeKg: 0, prs: 0 })
    expect(card?.before.sessions).toBe(1)
  })

  it('O10: counts Sessions, working Sets and loaded volume of last week and of the week before', () => {
    const sessions = [
      sess('l1', at(6), [set('bench', 100, 10, at(6)), set('bench', 100, 8, at(6), { setIndex: 1 })]),
      sess('l2', at(9), [set('squat', 60, 5, at(9))]),
      sess('b1', at(1), [set('squat', 50, 10, at(1))]),
    ]
    const card = lastWeekCard(sessions, NOW, resolve, planOf, 1, [])
    expect(card?.last).toMatchObject({ sessions: 2, sets: 3, volumeKg: 1800 + 300 })
    expect(card?.before).toMatchObject({ sessions: 1, sets: 1, volumeKg: 500 })
  })

  it('O10: warm-ups, deleted and unfinished Sessions, and this week do not count', () => {
    const sessions = [
      sess('ok', at(7), [set('bench', 60, 10, at(7)), set('bench', 20, 10, at(7), { kind: 'warmup', setIndex: 1 })]),
      sess('deleted', at(8), [set('bench', 60, 10, at(8))], { deletedAt: at(9) }),
      sess('unfinished', at(9), [set('bench', 60, 10, at(9))], { finishedAt: null }),
      bench('thisweek', at(19), 90),
    ]
    const card = lastWeekCard(sessions, NOW, resolve, planOf, 1, [])
    expect(card?.last).toMatchObject({ sessions: 1, sets: 1, volumeKg: 600 })
    expect(card?.before).toMatchObject({ sessions: 0, sets: 0, volumeKg: 0 })
  })

  it('O10: a Bodyweight Set counts bodyweight plus Load in volume when the log has a weigh-in', () => {
    const log: BodyLog = [{ day: '2026-10-01', weightKg: 80 }]
    const sessions = [
      sess('l', at(7), [set('push-ups', null, 5, at(7), { loadKg: 10 }), set('bench', 60, 10, at(7), { setIndex: 1 })]),
    ]
    const card = lastWeekCard(sessions, NOW, resolve, planOf, 1, log)
    expect(card?.last.volumeKg).toBe(450 + 600)
  })

  it('O10: a Bodyweight Set adds no kg when the log is empty', () => {
    const sessions = [
      sess('l', at(7), [set('push-ups', null, 5, at(7), { loadKg: 10 }), set('bench', 60, 10, at(7), { setIndex: 1 })]),
    ]
    expect(lastWeekCard(sessions, NOW, resolve, planOf, 1, [])?.last.volumeKg).toBe(600)
  })

  it('O10: PRs are the records set in each week, counted once per Session, ignoring later weeks', () => {
    const sessions = [
      bench('b1', at(1), 60), // week before: the first Session sets no record
      bench('l1', at(7), 70), // last week: heaviest weight
      bench('l2', at(9), 70), // last week: no gain
      bench('t1', at(18), 80), // this week: must not count
    ]
    const card = lastWeekCard(sessions, NOW, resolve, planOf, 1, [])
    expect(card?.before.prs).toBe(0)
    expect(card?.last.prs).toBe(1)
  })
})
