// v7 (study §1.6, build-plan step 8): the summary's one ↑ / = / ↓ per lift, the repeated-reps
// groups, the verdict sentence and "Next". Hand-built fixtures; dates in local time.
import { expect, test } from 'vitest'
import { liftLine, liftVerdict, nextLine, referenceDay, setGroups, summaryVerdict } from './summaryLines'
import type { LiftVerdict } from './summaryLines'
import type { Exercise, ExercisePlan, Program, Session, SetEntry } from '../types'

const MON_12_OCT = new Date(2026, 9, 12, 18).getTime()
const WED_7_OCT = new Date(2026, 9, 7, 18).getTime()
const MON_5_OCT = new Date(2026, 9, 5, 18).getTime()

const DEADLIFT: Exercise = { id: 'deadlift', name: 'Deadlift', weightStep: 2.5, startWeight: 40, bodyweight: false, libraryId: 'deadlift' }
const resolve = (id: string): Exercise | undefined => (id === 'deadlift' ? DEADLIFT : undefined)
const PLAN: ExercisePlan = { exerciseId: 'deadlift', sets: 3, repRange: [6, 8], restSeconds: 180 }

function sets(rows: [number | null, number, number?][]): SetEntry[] {
  return rows.map(([weightKg, reps, loadKg], index) => ({
    exerciseId: 'deadlift',
    setIndex: index + 1,
    weightKg,
    ...(loadKg === undefined ? {} : { loadKg }),
    reps,
    loggedAt: index,
  }))
}

test('v7 liftVerdict: the same loads compare the reps, ↑ +3 reps, ↓ −2 reps or = same', () => {
  const last = sets([[46.25, 9], [46.25, 9], [46.25, 9]])
  expect(liftVerdict({ today: sets([[46.25, 10], [46.25, 10], [46.25, 10]]), last, lastAt: WED_7_OCT })).toMatchObject({
    kind: 'up',
    glyph: '↑',
    text: '+3 reps',
  })
  expect(liftVerdict({ today: sets([[46.25, 9], [46.25, 8], [46.25, 8]]), last, lastAt: WED_7_OCT })).toMatchObject({
    kind: 'down',
    glyph: '↓',
    text: '−2 reps',
  })
  expect(liftVerdict({ today: last, last, lastAt: WED_7_OCT })).toMatchObject({ kind: 'same', glyph: '=', text: 'same' })
  expect(liftVerdict({ today: sets([[46.25, 10], [46.25, 9], [46.25, 9]]), last, lastAt: WED_7_OCT }).text).toBe('+1 rep')
})

test('v7 liftVerdict: a heavier top set reads ↑ +2.5 kg, a lighter one ↓ −2.5 kg, assistance in its own words', () => {
  const last = sets([[60, 10], [67.5, 7], [67.5, 7]])
  expect(liftVerdict({ today: sets([[60, 10], [70, 7], [70, 7]]), last, lastAt: WED_7_OCT }).text).toBe('+2.5 kg')
  expect(liftVerdict({ today: sets([[60, 10], [65, 7], [65, 7]]), last, lastAt: WED_7_OCT })).toMatchObject({
    kind: 'down',
    text: '−2.5 kg',
  })
  const assisted = sets([[null, 6, -20], [null, 6, -20]])
  expect(liftVerdict({ today: sets([[null, 6, -15], [null, 6, -15]]), last: assisted, lastAt: WED_7_OCT })).toMatchObject({
    kind: 'up',
    text: '−5 kg assistance',
  })
})

test('v7 liftVerdict: first time, a partial lift and a deload carry no glyph and no comparison', () => {
  const today = sets([[70, 7], [70, 7]])
  expect(liftVerdict({ today, last: [], lastAt: null })).toEqual({ kind: 'first', glyph: '', text: 'First time', lastAt: null })
  expect(liftVerdict({ today, last: today, lastAt: WED_7_OCT, plannedSets: 3 })).toMatchObject({ kind: 'partial', glyph: '', text: '2 of 3 sets' })
  expect(liftVerdict({ today, last: today, lastAt: WED_7_OCT, deload: true })).toMatchObject({ kind: 'deload', glyph: '', text: 'Deload' })
})

test('v7 setGroups folds the following Sets at the same load: 46.25 × 9 · 8 · 8', () => {
  expect(setGroups([{ weightKg: 60, reps: 10 }, { weightKg: 70, reps: 7 }, { weightKg: 70, reps: 7 }])).toEqual([
    { set: { weightKg: 60, reps: 10 }, moreReps: [] },
    { set: { weightKg: 70, reps: 7 }, moreReps: [7] },
  ])
  expect(
    setGroups([{ weightKg: null, loadKg: -19, reps: 6 }, { weightKg: null, loadKg: -19, reps: 5 }, { weightKg: null, reps: 4 }]),
  ).toEqual([
    { set: { weightKg: null, loadKg: -19, reps: 6 }, moreReps: [5] },
    { set: { weightKg: null, reps: 4 }, moreReps: [] },
  ])
})

test('v7 liftLine carries the groups and the verdict against the lift’s last Session', () => {
  const session = (id: string, at: number, rows: [number, number][]): Session => ({
    id,
    programId: 'ab',
    workoutId: 'b',
    startedAt: at,
    finishedAt: at + 3_600_000,
    entries: sets(rows).map((entry) => ({ ...entry, loggedAt: at + entry.setIndex })),
  })
  const wed = session('wed', WED_7_OCT, [[60, 10], [67.5, 7], [67.5, 7]])
  const mon = session('mon', MON_12_OCT, [[60, 10], [70, 7], [70, 7]])
  const line = liftLine('deadlift', mon, [wed, mon], resolve, () => PLAN, [], 3)
  expect(line.groups).toEqual([
    { set: { weightKg: 60, reps: 10 }, moreReps: [] },
    { set: { weightKg: 70, reps: 7 }, moreReps: [7] },
  ])
  expect(line.verdict).toEqual({ kind: 'up', glyph: '↑', text: '+2.5 kg', lastAt: WED_7_OCT })
})

const verdict = (kind: LiftVerdict['kind'], lastAt: number | null = WED_7_OCT): LiftVerdict => ({
  kind,
  glyph: kind === 'up' ? '↑' : kind === 'down' ? '↓' : kind === 'same' ? '=' : '',
  text: '',
  lastAt,
})

test('v7 summaryVerdict: "5 of 7 lifts beat Wednesday. Two records. Narrow-grip pull-down dipped."', () => {
  const lifts = [
    { name: 'Deadlift', verdict: verdict('up') },
    { name: 'Assisted pull-ups', verdict: verdict('up') },
    { name: 'Narrow-grip pull-down', verdict: verdict('down') },
    { name: 'Machine row', verdict: verdict('up') },
    { name: 'Face pull', verdict: verdict('up') },
    { name: 'Hyper-extension', verdict: verdict('same') },
    { name: 'Seated biceps curls', verdict: verdict('up') },
  ]
  expect(summaryVerdict(lifts, 2, MON_12_OCT)).toEqual({
    lead: '5 of 7 lifts beat Wednesday.',
    rest: 'Two records. Narrow-grip pull-down dipped.',
  })
})

test('v7 summaryVerdict says all, both, matched, one lift by name, first time and deload plainly', () => {
  const up = { name: 'Deadlift', verdict: verdict('up') }
  const same = { name: 'Face pull', verdict: verdict('same') }
  expect(summaryVerdict([up, up, up], 0, MON_12_OCT).lead).toBe('All 3 lifts beat Wednesday.')
  expect(summaryVerdict([up, up], 1, MON_12_OCT)).toEqual({ lead: 'Both lifts beat Wednesday.', rest: 'One record.' })
  expect(summaryVerdict([same, same, same], 0, MON_12_OCT).lead).toBe('All 3 lifts matched Wednesday.')
  expect(summaryVerdict([up], 0, MON_12_OCT).lead).toBe('Deadlift beat Wednesday.')
  expect(summaryVerdict([{ name: 'Deadlift', verdict: verdict('first', null) }], 0, MON_12_OCT).lead).toBe('First time for every lift.')
  expect(summaryVerdict([{ name: 'Deadlift', verdict: verdict('deload') }], 0, MON_12_OCT).lead).toBe('A deload session.')
  // Lifts last done on different days compare with "last time".
  expect(summaryVerdict([up, { name: 'Row', verdict: verdict('up', MON_5_OCT) }], 0, MON_12_OCT).lead).toBe('Both lifts beat last time.')
  // Three or more dips are counted, not named; numbers past ten are digits.
  const down = { name: 'Row', verdict: verdict('down') }
  expect(summaryVerdict([down, down, down, up], 12, MON_12_OCT).rest).toBe('12 records. 3 lifts dipped.')
})

test('v7 referenceDay: a weekday name within the week, else the date', () => {
  expect(referenceDay(WED_7_OCT, MON_12_OCT)).toBe('Wednesday')
  expect(referenceDay(MON_5_OCT, MON_12_OCT)).toBe('Mon 5 Oct')
})

test('v7 nextLine names the Workout Train puts up next', () => {
  const program: Program = {
    id: 'ab',
    name: 'A / B',
    units: 'kg',
    sessionsPerWeek: 3,
    workouts: [
      { id: 'a', name: 'Workout A', exercises: [{ ...PLAN, sets: 1 }] },
      { id: 'b', name: 'Workout B', exercises: [PLAN] },
    ],
  }
  const mon: Session = {
    id: 'mon',
    programId: 'ab',
    workoutId: 'b',
    startedAt: MON_12_OCT,
    finishedAt: MON_12_OCT + 3_600_000,
    entries: sets([[60, 10], [70, 7], [70, 7]]),
  }
  expect(nextLine(mon, [mon], program)).toBe('Next: Workout A')
})
