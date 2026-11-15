import { expect, test } from 'vitest'
import {
  comparisonText,
  liftLine,
  liftLineText,
  prHeadline,
  recordGainText,
  weekLine,
  workedToday,
} from './summaryLines'
import { exerciseDoneLine } from './exerciseVerdict'
import type { SessionRecord } from './stats/records'
import type { Exercise, ExercisePlan, Muscle, Program, Session, SetEntry } from '../types'

// V4-03: the summary's lines. Hand-built fixtures: a Deadlift (loaded) and Assisted pull-ups
// (Bodyweight, assistance as a negative Load).

const DAY = 86_400_000
const MON_12_OCT = new Date(2026, 9, 12, 18).getTime()
const THU_15_OCT = new Date(2026, 9, 15, 18).getTime()

const DEADLIFT: Exercise = { id: 'deadlift', name: 'Deadlift', weightStep: 2.5, startWeight: 40, bodyweight: false, libraryId: 'deadlift' }
const PULLUPS: Exercise = { id: 'pullups', name: 'Assisted pull-ups', weightStep: 2.5, startWeight: 0, bodyweight: true, libraryId: 'pullups' }
const resolve = (id: string): Exercise | undefined => ({ deadlift: DEADLIFT, pullups: PULLUPS })[id]

const PLANS: Record<string, ExercisePlan> = {
  deadlift: { exerciseId: 'deadlift', sets: 3, repRange: [6, 8], restSeconds: 180 },
  pullups: { exerciseId: 'pullups', sets: 4, repRange: [6, 10], restSeconds: 120 },
}
const planOf = (id: string): ExercisePlan | undefined => PLANS[id]

const PROGRAM: Program = {
  id: 'ab',
  name: 'A / B',
  units: 'kg',
  sessionsPerWeek: 3,
  workouts: [
    { id: 'a', name: 'Workout A', exercises: [] },
    { id: 'b', name: 'Workout B', exercises: [PLANS.deadlift, PLANS.pullups] },
  ],
}

function set(exerciseId: string, setIndex: number, weight: number, reps: number, at: number): SetEntry {
  const bodyweight = exerciseId === 'pullups'
  return {
    exerciseId,
    setIndex,
    weightKg: bodyweight ? null : weight,
    ...(bodyweight ? { loadKg: weight } : {}),
    reps,
    loggedAt: at + setIndex,
  }
}

function session(id: string, workoutId: string, startedAt: number, entries: [string, number, number][]): Session {
  return {
    id,
    programId: 'ab',
    workoutId,
    startedAt,
    finishedAt: startedAt + 3_600_000,
    entries: entries.map(([exerciseId, weight, reps], index) => set(exerciseId, index + 1, weight, reps, startedAt)),
  }
}

const MONDAY = session('mon', 'b', MON_12_OCT, [
  ['deadlift', 60, 10],
  ['deadlift', 70, 7],
  ['deadlift', 70, 7],
])
const THURSDAY = session('thu', 'b', THU_15_OCT, [
  ['deadlift', 60, 10],
  ['deadlift', 70, 8],
  ['deadlift', 70, 7],
])

const REP_RECORD: SessionRecord = {
  exerciseId: 'deadlift',
  sessionId: 'thu',
  kind: 'Rep record',
  lever: 70,
  reps: 8,
  gain: 1,
  alsoBeat: [],
}

test('V4-03 the headline is the first PR with its kind and gain, "+1 rep" in the singular', () => {
  expect(prHeadline([REP_RECORD], resolve)).toEqual({ text: 'Deadlift 70 kg × 8 · rep record, +1 rep', more: null })
  expect(prHeadline([], resolve)).toBeNull()
})

test('V4-03 several PRs add "+n more PR" to the headline', () => {
  const second: SessionRecord = { ...REP_RECORD, exerciseId: 'pullups', kind: 'Least assistance', lever: -15, gain: 2.5 }
  expect(prHeadline([REP_RECORD, second], resolve)?.more).toBe('+1 more PR')
  expect(prHeadline([REP_RECORD, second, second], resolve)?.more).toBe('+2 more PRs')
})

test('V4-03 a record gain reads +1 rep, +2 reps, +5 kg or −2.5 kg assistance', () => {
  expect(recordGainText({ kind: 'Rep record', gain: 1 })).toBe('+1 rep')
  expect(recordGainText({ kind: 'Rep record', gain: 2 })).toBe('+2 reps')
  expect(recordGainText({ kind: 'Heaviest weight', gain: 5 })).toBe('+5 kg')
  expect(recordGainText({ kind: 'Least assistance', gain: 2.5 })).toBe('−2.5 kg assistance')
})

test('V4-03 a lift reads its Sets, the PR on the record Set, then "1 rep more", with no totals', () => {
  const line = liftLine('deadlift', THURSDAY, [MONDAY, THURSDAY], resolve, planOf, [REP_RECORD], 3)

  // Title kept (weakened-tests gate); V5: the comparison is the live Session's sentence.
  expect(liftLineText(line)).toBe('60×10 · 70×8 PR · 70×7 · 1 rep more than Mon 12 Oct')
  expect(liftLineText(line)).not.toMatch(/ vs |record/)
})

test('V4-03 a lift with fewer Sets than planned reads "2 of 4 sets" and makes no comparison', () => {
  const before = session('mon', 'b', MON_12_OCT, [
    ['pullups', -20, 6],
    ['pullups', -20, 6],
    ['pullups', -20, 6],
    ['pullups', -20, 6],
  ])
  const today = session('thu', 'b', THU_15_OCT, [
    ['pullups', -20, 6],
    ['pullups', -20, 6],
  ])

  expect(liftLineText(liftLine('pullups', today, [before, today], resolve, planOf, [], 4))).toBe(
    'BW−20×6 · BW−20×6 · 2 of 4 sets',
  )
})

test('V4-03 a lift says fewer reps, a weight step, less assistance, or the same as last time', () => {
  const fewer = session('thu', 'b', THU_15_OCT, [['deadlift', 70, 6], ['deadlift', 70, 6], ['deadlift', 70, 6]])
  const heavier = session('thu', 'b', THU_15_OCT, [['deadlift', 72.5, 7], ['deadlift', 72.5, 7], ['deadlift', 72.5, 7]])
  const before = session('mon', 'b', MON_12_OCT, [['deadlift', 70, 7], ['deadlift', 70, 7], ['deadlift', 70, 7]])
  const same = session('thu', 'b', THU_15_OCT, [['deadlift', 70, 7], ['deadlift', 70, 7], ['deadlift', 70, 7]])
  const tail = (today: Session, earlier: Session): string =>
    liftLine('deadlift', today, [earlier, today], resolve, planOf, [], 3).tail

  // Title kept (weakened-tests gate); V5: worded by `exerciseComparison`, as the live Session.
  // V6-18: the summary says fewer reps plainly, "3 fewer reps than", never "3 reps under".
  expect(tail(fewer, before)).toBe('3 fewer reps than Mon 12 Oct')
  expect(tail(heavier, before)).toBe('+2.5 kg top set on Mon 12 Oct')
  expect(tail(same, before)).toBe('Same as Mon 12 Oct')
  expect(tail(same, { ...before, id: 'other', workoutId: 'b', startedAt: THU_15_OCT + DAY })).toBe('First time logged')

  const assisted = session('mon', 'b', MON_12_OCT, [['pullups', -20, 6]])
  const lighter = session('thu', 'b', THU_15_OCT, [['pullups', -15, 6]])
  expect(liftLine('pullups', lighter, [assisted, lighter], resolve, planOf, []).tail).toBe(
    '5 kg less assistance than Mon 12 Oct',
  )
})

test('V5 the summary and the live Session say a lift the same: liftLine ends with exerciseDoneLine', () => {
  const line = liftLineText(liftLine('deadlift', THURSDAY, [MONDAY, THURSDAY], resolve, planOf, [REP_RECORD], 3))
  const live = exerciseDoneLine({
    today: THURSDAY.entries,
    last: MONDAY.entries,
    lastDay: 'Mon 12 Oct',
    plannedSets: 3,
    isRecord: (entry) => entry.setIndex === 2,
  })
  expect(line).toBe(live)
})

test('V5 a deload Session reads Deload, and more assistance says so', () => {
  const before = session('mon', 'b', MON_12_OCT, [['pullups', -20, 6]])
  const harder = session('thu', 'b', THU_15_OCT, [['pullups', -25, 6]])
  expect(liftLine('pullups', harder, [before, harder], resolve, planOf, []).tail).toBe(
    '5 kg more assistance than Mon 12 Oct',
  )
  const deload: Session = { ...harder, deload: true }
  expect(liftLine('pullups', deload, [before, deload], resolve, planOf, []).tail).toBe('Deload')
})

test('V4-03 the comparison is with the last same Workout: "vs Mon 12 Oct: volume +1.2 %"', () => {
  // Monday 600 + 490 + 490 = 1,580 kg; Thursday 600 + 560 + 490 = 1,650 kg: +4.4 %.
  expect(comparisonText(THURSDAY, [MONDAY, THURSDAY], resolve, 3)).toBe('vs Mon 12 Oct: volume +4.4 %')
  const lighter = session('thu', 'b', THU_15_OCT, [['deadlift', 60, 10], ['deadlift', 70, 7], ['deadlift', 70, 5]])
  expect(comparisonText(lighter, [MONDAY, lighter], resolve, 3)).toBe('vs Mon 12 Oct: volume −8.9 %')
  expect(comparisonText(MONDAY, [MONDAY], resolve, 3)).toBeNull()
})

test('V4-03 a partial Session is not compared: "5 of 23 sets", no %', () => {
  expect(comparisonText(THURSDAY, [MONDAY, THURSDAY], resolve, 23)).toBe('3 of 23 sets')
})

test('V4-03 Worked today lists only the trained muscles, most sets first', () => {
  const muscles = new Map<Muscle, number>([
    ['chest', 0],
    ['lower back', 3],
    ['lats', 3.5],
    ['quadriceps', 1.5],
    ['middle back', 2.5],
  ])
  expect(workedToday(muscles)).toEqual([
    { muscle: 'lats', count: 3.5 },
    { muscle: 'lower back', count: 3 },
    { muscle: 'middle back', count: 2.5 },
    { muscle: 'quadriceps', count: 1.5 },
  ])
})

test('V4-03 the week line counts this week against the Program and names the Workout due next', () => {
  const tuesday = session('tue', 'a', MON_12_OCT + DAY, [])
  // Thursday's Workout B in full (3 Deadlift and 4 pull-up Sets), so the rotation moves on (V6-11).
  const thursday = session('thu', 'b', THU_15_OCT, [
    ...THURSDAY.entries.map((entry): [string, number, number] => [entry.exerciseId, entry.weightKg ?? 0, entry.reps]),
    ['pullups', -20, 6],
    ['pullups', -20, 6],
    ['pullups', -20, 6],
    ['pullups', -20, 6],
  ])
  const sessions = [MONDAY, tuesday, thursday]

  expect(weekLine(thursday, sessions, PROGRAM)).toBe('This week 3 of 3 · next up Workout A')
  expect(weekLine(tuesday, sessions, PROGRAM)).toBe('This week 2 of 3 · next up Workout B')
})

test('V6-18 one rep fewer reads "1 fewer rep than <day>"', () => {
  const before = session('mon', 'b', MON_12_OCT, [['deadlift', 70, 7], ['deadlift', 70, 7], ['deadlift', 70, 7]])
  const today = session('thu', 'b', THU_15_OCT, [['deadlift', 70, 7], ['deadlift', 70, 7], ['deadlift', 70, 6]])
  expect(liftLine('deadlift', today, [before, today], resolve, planOf, [], 3).tail).toBe('1 fewer rep than Mon 12 Oct')
})

test('V6-11 a short Session still counts in the week, and the same Workout is next up', () => {
  // Workout B plans 3 + 4 = 7 Sets; 1 Set logged is under half.
  const tuesday = session('tue', 'a', MON_12_OCT + DAY, [])
  const short = session('thu', 'b', THU_15_OCT, [['deadlift', 60, 10]])
  expect(weekLine(short, [MONDAY, tuesday, short], PROGRAM)).toBe('This week 3 of 3 · next up Workout B')
})
