import { expect, test } from 'vitest'
import { loadCatalog } from '../data/catalog'
import {
  exerciseComparison,
  exerciseDoneLine,
  exerciseVerdict,
  honestMoveText,
  liveRecordCount,
  setComparison,
  setDelta,
  setsInNumbers,
} from './exerciseVerdict'
import type { Exercise, ExercisePlan, Session } from '../types'

const T = 1_700_000_000_000
const DAY = 86_400_000
const squat = loadCatalog().get('back-squat') as Exercise
const plan: ExercisePlan = { exerciseId: 'back-squat', sets: 2, repRange: [8, 10], restSeconds: 180 }

function session(id: string, daysAgo: number, sets: [number, number][], finished = true): Session {
  const startedAt = T - daysAgo * DAY
  return {
    id,
    programId: 'p',
    workoutId: 'w',
    startedAt,
    finishedAt: finished ? startedAt + 3_600_000 : null,
    entries: sets.map(([weightKg, reps], index) => ({
      exerciseId: 'back-squat',
      setIndex: index + 1,
      weightKg,
      reps,
      loggedAt: startedAt + index * 60_000,
    })),
  }
}

const earlier = [session('a', 7, [[60, 8], [60, 8]])]
const resolve = (id: string) => (id === 'back-squat' ? squat : undefined)
const planOf = (id: string) => (id === 'back-squat' ? plan : undefined)

test('V2-11 a heavier top Set reads <Exercise> done · stepped up to … · 1 PR', () => {
  const today = session('today', 0, [[70, 8], [70, 8]], false)
  expect(exerciseVerdict(squat, plan, earlier, today)).toBe('Back squat done · stepped up to 70 kg · +10 kg · 1 PR')
})

test('V2-11 the same Sets as last time read <Exercise> done · same, with no PR', () => {
  const today = session('today', 0, [[60, 8], [60, 8]], false)
  // V3-02: "same" names its numbers; never a bare "same".
  expect(exerciseVerdict(squat, plan, earlier, today)).toBe('Back squat done · same as last time · 2 × 60 × 8')
})

test('V3-02 no verdict is a bare same, and a partial Exercise shows n of N sets with no vs', () => {
  const four: ExercisePlan = { ...plan, sets: 4 }
  const before = [session('a', 7, [[60, 8], [60, 8], [60, 8], [60, 8]])]
  const today = session('today', 0, [[60, 6]], false)
  const verdict = exerciseVerdict(squat, four, before, today)
  expect(verdict).toBe('Back squat done · 1 of 4 sets')
  expect(verdict).not.toMatch(/vs/)
})

test('V3-02 honestMoveText names the numbers of a Same and leaves other moves alone', () => {
  const entries = session('today', 0, [[70, 7], [70, 7], [70, 7]], false).entries
  expect(honestMoveText('Same', entries, 3)).toBe('Same as last time · 3 × 70 × 7')
  expect(honestMoveText('Fewer reps · 6 vs 23', entries.slice(0, 1), 4)).toBe('1 of 4 sets')
  expect(honestMoveText('Stepped up to 70 kg · +10 kg · record', entries.slice(0, 1), 3)).toBe(
    'Stepped up to 70 kg · +10 kg · 1 of 3 sets · record',
  )
  expect(honestMoveText('More reps · 21 vs 20', entries, 3)).toBe('More reps · 21 vs 20')
  expect(setsInNumbers([...entries.slice(0, 2), { ...entries[2], reps: 6 }])).toBe('70 × 7, 70 × 7, 70 × 6')
})

test('V2-11 the first Session of an Exercise reads done · first session', () => {
  const today = session('today', 0, [[60, 8]], false)
  expect(exerciseVerdict(squat, plan, [], today)).toBe('Back squat done · first session')
})

test('V2-11 an Exercise with no Set in the Session has no verdict', () => {
  expect(exerciseVerdict(squat, plan, earlier, session('today', 0, [], false))).toBeNull()
})

test('V2-11 liveRecordCount counts the Session records so far', () => {
  expect(liveRecordCount(earlier, session('today', 0, [[70, 8]], false), resolve, planOf)).toBe(1)
  expect(liveRecordCount(earlier, session('today', 0, [[60, 8]], false), resolve, planOf)).toBe(0)
})

// --- V4-01 / V4-02: one comparison sentence per logged Set -------------------------------------

const MON = 'Mon 12 Oct'
const at = (weightKg: number | null, reps: number, loadKg?: number) => ({
  weightKg,
  reps,
  ...(loadKg === undefined ? {} : { loadKg }),
})

test('V4-01 a Set equal to last time reads Same as <day>', () => {
  expect(setComparison(at(60, 10), at(60, 10), MON)).toEqual({ kind: 'same', text: 'Same as Mon 12 Oct', record: null })
  expect(setDelta(at(70, 7), at(70, 7))).toEqual({ kind: 'same', text: 'same' })
})

test('V4-01 a heavier or longer Set reads +2.5 kg / +1 rep on <day>', () => {
  // Title kept (weakened-tests gate). V6 (V5-13): "+2.5 kg on Mon 12 Oct" read as if the record
  // were set on that day; the sentence now compares: "2.5 kg more than Mon 12 Oct".
  expect(setComparison(at(72.5, 7), at(70, 7), MON).text).toBe('2.5 kg more than Mon 12 Oct')
  expect(setComparison(at(70, 9), at(70, 7), MON).text).toBe('2 reps more than Mon 12 Oct')
  expect(setDelta(at(70, 8), at(70, 7))).toEqual({ kind: 'up', text: '+1 rep' })
  // Less assistance is up: BW−19 against BW−27.
  expect(setDelta(at(null, 6, -19), at(null, 6, -27))).toEqual({ kind: 'up', text: '+8 kg' })
})

test('V4-01 a lighter or shorter Set reads 1 rep under <day>', () => {
  // V6 wave 3: fewer reps read as the summary says them, "1 fewer rep than Mon 12 Oct".
  expect(setComparison(at(70, 6), at(70, 7), MON)).toEqual({ kind: 'down', text: '1 fewer rep than Mon 12 Oct', record: null })
  expect(setComparison(at(67.5, 7), at(70, 7), MON).text).toBe('2.5 kg under Mon 12 Oct')
  expect(setDelta(at(70, 5), at(70, 7)).text).toBe('2 fewer reps')
  const entry = (reps: number) => ({ exerciseId: 'x', setIndex: 1, weightKg: 70, reps, loggedAt: 0 })
  expect(exerciseComparison({ today: [entry(6)], last: [entry(7)], lastDay: MON })).toBe('1 fewer rep than Mon 12 Oct')
})

test('V4-01 a Record leads the sentence with its name: Rep record · +1 rep on <day>', () => {
  // Title kept (weakened-tests gate). V6 (V5-13): "Rep record · 1 more than Mon 12 Oct" -- the
  // record's name already says reps, and the day is the one beaten, not the record's.
  expect(setComparison(at(70, 8), at(70, 7), MON, 'Rep record')).toEqual({
    kind: 'up',
    text: 'Rep record · 1 more than Mon 12 Oct',
    record: 'Rep record',
  })
})

test('V6 V5-13 a heavier Record names the kilos it beat last time by: Heaviest weight · 5 kg more than <day>', () => {
  expect(setComparison(at(75, 7), at(70, 7), MON, 'Heaviest weight').text).toBe(
    'Heaviest weight · 5 kg more than Mon 12 Oct',
  )
})

test('V4-01 with no last time the Set reads First time logged', () => {
  expect(setComparison(at(60, 10), null, MON)).toEqual({ kind: 'first', text: 'First time logged', record: null })
})

test('V4-01 the done line lists the Sets, marks a Record and compares once, never n vs m', () => {
  const today = session('today', 0, [[60, 10], [70, 8], [70, 7]], false).entries
  const last = session('a', 3, [[60, 10], [70, 7], [70, 7]]).entries
  const line = exerciseDoneLine({ today, last, lastDay: MON, plannedSets: 3, isRecord: (set) => set.setIndex === 2 })
  expect(line).toBe('60×10 · 70×8 PR · 70×7 · 1 rep more than Mon 12 Oct')
  expect(line).not.toMatch(/\d+ vs \d+/)
  expect(exerciseDoneLine({ today, last: today, lastDay: MON, plannedSets: 3, isRecord: () => false })).toBe(
    '60×10 · 70×8 · 70×7 · Same as Mon 12 Oct',
  )
  expect(exerciseDoneLine({ today: today.slice(0, 2), last, lastDay: MON, plannedSets: 3, isRecord: () => false })).toBe(
    '60×10 · 70×8 · 2 of 3 sets',
  )
  expect(exerciseDoneLine({ today, last: [], lastDay: MON, plannedSets: 3, isRecord: () => false })).toBe(
    '60×10 · 70×8 · 70×7 · First time logged',
  )
})

test('V5 one comparison sentence: less or more assistance says so, and a deload reads Deload', () => {
  const bw = (setIndex: number, loadKg: number, reps: number) => ({
    exerciseId: 'pullups',
    setIndex,
    weightKg: null,
    loadKg,
    reps,
    loggedAt: setIndex,
  })
  const last = [bw(1, -20, 6), bw(2, -20, 6)]
  expect(exerciseComparison({ today: [bw(1, -15, 6), bw(2, -15, 6)], last, lastDay: MON })).toBe(
    '5 kg less assistance than Mon 12 Oct',
  )
  expect(exerciseComparison({ today: [bw(1, -25, 6), bw(2, -25, 6)], last, lastDay: MON })).toBe(
    '5 kg more assistance than Mon 12 Oct',
  )
  expect(exerciseComparison({ today: last, last, lastDay: MON, deload: true })).toBe('Deload')
  expect(exerciseComparison({ today: last.slice(0, 1), last, lastDay: MON, plannedSets: 2 })).toBe('1 of 2 sets')
})
