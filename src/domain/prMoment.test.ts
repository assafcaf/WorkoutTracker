import { expect, test } from 'vitest'
import { loadCatalog } from '../data/catalog'
import { isSessionPrSet, prMoment, repBestMoment } from './prMoment'
import type { Exercise, ExercisePlan, Session, SetEntry } from '../types'

const T = 1_700_000_000_000
const DAY = 86_400_000
const squat = loadCatalog().get('back-squat') as Exercise
const plan: ExercisePlan = { exerciseId: 'back-squat', sets: 4, repRange: [8, 10], restSeconds: 180 }

function finished(id: string, daysAgo: number, sets: [number, number][]): Session {
  const startedAt = T - daysAgo * DAY
  return {
    id,
    programId: 'p',
    workoutId: 'w',
    startedAt,
    finishedAt: startedAt + 3_600_000,
    entries: sets.map(([weightKg, reps], index) => ({
      exerciseId: 'back-squat',
      setIndex: index + 1,
      weightKg,
      reps,
      loggedAt: startedAt + index * 60_000,
    })),
  }
}

function today(entry: SetEntry): Session {
  return { id: 'today', programId: 'p', workoutId: 'w', startedAt: T, finishedAt: null, entries: [entry] }
}

test('S5a a heavier Set reads New PR · Heaviest set, the Set and the gain, with the history', () => {
  const earlier = [
    finished('a', 14, [[55, 8]]),
    finished('b', 7, [[60, 8], [60, 8]]),
  ]
  const entry: SetEntry = { exerciseId: 'back-squat', setIndex: 1, weightKg: 62.5, reps: 8, loggedAt: T }

  const moment = prMoment(squat, plan, earlier, today(entry), entry)

  expect(moment?.title).toBe('New PR · Heaviest weight')
  expect(moment?.detail).toBe('62.5 kg × 8 · +2.5 kg')
  expect(moment?.values).toEqual([55, 60, 62.5])
  expect(moment?.label).toBe('Heaviest weight history')
})

test('S5a a Set that sets no record has no moment', () => {
  const earlier = [finished('a', 7, [[80, 8]])]
  const entry: SetEntry = { exerciseId: 'back-squat', setIndex: 1, weightKg: 60, reps: 8, loggedAt: T }

  expect(prMoment(squat, plan, earlier, today(entry), entry)).toBeNull()
})

test('S5a the first Session of an Exercise sets no record, so no moment', () => {
  const entry: SetEntry = { exerciseId: 'back-squat', setIndex: 1, weightKg: 100, reps: 8, loggedAt: T }

  expect(prMoment(squat, plan, [], today(entry), entry)).toBeNull()
})

// E18-T16 [O27]: the toast follows R-R, one record per lift per Session, named by its kind.
const history = (): Session[] => [finished('a', 14, [[55, 8]]), finished('b', 7, [[60, 8], [60, 8]])]
const setOf = (setIndex: number, weightKg: number, reps: number, extra: Partial<SetEntry> = {}): SetEntry => ({
  exerciseId: 'back-squat',
  setIndex,
  weightKg,
  reps,
  loggedAt: T + setIndex * 60_000,
  ...extra,
})
const todayWith = (entries: SetEntry[], extra: Partial<Session> = {}): Session => ({
  id: 'today',
  programId: 'p',
  workoutId: 'w',
  startedAt: T,
  finishedAt: null,
  entries,
  ...extra,
})

test('O27 a heavier Set is named by its one R-R kind, Heaviest weight, with its gain', () => {
  const entry = setOf(1, 62.5, 8)

  const moment = prMoment(squat, plan, history(), todayWith([entry]), entry)

  expect(moment?.title).toBe('New PR · Heaviest weight')
  expect(moment?.detail).toBe('62.5 kg × 8 · +2.5 kg')
})

test('O27 a further bump in the same Session toasts again, its gain against the earlier Sessions', () => {
  const first = setOf(1, 62.5, 8)
  const second = setOf(2, 65, 8)

  const moment = prMoment(squat, plan, history(), todayWith([first, second]), second)

  expect(moment?.title).toBe('New PR · Heaviest weight')
  expect(moment?.detail).toBe('65 kg × 8 · +5 kg')
})

test('O27 a rep drop after a weight bump does not toast', () => {
  const bump = setOf(1, 62.5, 8)
  const drop = setOf(2, 62.5, 6)

  expect(prMoment(squat, plan, history(), todayWith([bump, drop]), drop)).toBeNull()
})

// V6 (V5-06): more reps at a weight already lifted, with no better estimated 1RM, is a rep best:
// no PR toast, a quiet "Rep best" moment instead.
test('O27 more reps at an earlier weight toast as a Rep record', () => {
  const entry = setOf(1, 55, 9)

  expect(prMoment(squat, plan, history(), todayWith([entry]), entry)).toBeNull()
  const best = repBestMoment(squat, plan, history(), todayWith([entry]), entry)
  expect(best?.title).toBe('Rep best')
  expect(best?.detail).toBe('55 kg × 9 · +1 rep')
})

test('V6 more reps at the heaviest weight that lifts the estimated 1RM is a PR named Estimated 1RM', () => {
  const entry = setOf(1, 60, 9)

  const moment = prMoment(squat, plan, history(), todayWith([entry]), entry)

  // 60 × (1 + 9/30) = 78 against 60 × (1 + 8/30) = 76: +2 kg.
  expect(moment?.title).toBe('New PR · Estimated 1RM')
  expect(moment?.detail).toBe('60 kg × 9 · +2 kg')
  expect(repBestMoment(squat, plan, history(), todayWith([entry]), entry)).toBeNull()
})

test('V6 a heavier Set is a PR and never a rep best', () => {
  const entry = setOf(1, 62.5, 8)

  expect(prMoment(squat, plan, history(), todayWith([entry]), entry)).not.toBeNull()
  expect(repBestMoment(squat, plan, history(), todayWith([entry]), entry)).toBeNull()
})

test('O27 a deload Session sets no record, so no toast', () => {
  const entry = setOf(1, 65, 8)

  expect(prMoment(squat, plan, history(), todayWith([entry], { deload: true }), entry)).toBeNull()
})

test('O27 a drop Set never sets a record, so no toast', () => {
  const entry = setOf(1, 70, 8, { kind: 'drop' })

  expect(prMoment(squat, plan, history(), todayWith([entry]), entry)).toBeNull()
})

test('V4-03 a rep record by one says +1 rep and by two says +2 reps', () => {
  // V6: at 55 kg neither lifts the estimated 1RM (76), so both are rep bests.
  const one = setOf(1, 55, 9)
  const two = setOf(1, 55, 10)

  expect(repBestMoment(squat, plan, history(), todayWith([one]), one)?.detail).toMatch(/\+1 rep$/)
  expect(repBestMoment(squat, plan, history(), todayWith([two]), two)?.detail).toMatch(/\+2 reps$/)
})

// V7R-13: a lift earns one PR per Session, its best Set, however many Sets toasted on the way.
test('V7R-13 two PR Sets on one lift in one Session count as one PR, on the later, better Set', () => {
  const first = setOf(1, 62.5, 8)
  const second = setOf(2, 65, 8)
  const session = todayWith([first, second])

  expect(isSessionPrSet(squat, plan, history(), session, first)).toBe(false)
  expect(isSessionPrSet(squat, plan, history(), session, second)).toBe(true)
  expect(session.entries.filter((entry) => isSessionPrSet(squat, plan, history(), session, entry))).toHaveLength(1)
})

test('V7R-13 a PR Set stays the PR when a later Set sets none', () => {
  const first = setOf(1, 62.5, 8)
  const second = setOf(2, 60, 8)
  const session = todayWith([first, second])

  expect(isSessionPrSet(squat, plan, history(), session, first)).toBe(true)
  expect(isSessionPrSet(squat, plan, history(), session, second)).toBe(false)
})
