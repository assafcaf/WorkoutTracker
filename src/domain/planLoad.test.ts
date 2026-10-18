import { expect, test } from 'vitest'
import { nextLoad, nextLoadText } from './planLoad'
import type { Exercise, ExercisePlan, Session, SetEntry } from '../types'

const squat: Exercise = {
  id: 'squat',
  name: 'Back squat',
  weightStep: 2.5,
  startWeight: 50,
  bodyweight: false,
  libraryId: 'squat',
}
const pullUp: Exercise = {
  id: 'pull-up',
  name: 'Assisted pull-ups',
  weightStep: 1,
  startWeight: null,
  bodyweight: true,
  startLoadKg: -27,
  libraryId: 'pull-up',
}
const pushUp: Exercise = {
  id: 'push-up',
  name: 'Push-ups',
  weightStep: 1,
  startWeight: null,
  bodyweight: true,
  libraryId: 'push-up',
}
const squatPlan: ExercisePlan = { exerciseId: 'squat', sets: 2, repRange: [8, 10], restSeconds: 180 }

function session(
  id: string,
  startedAt: number,
  entries: Omit<SetEntry, 'loggedAt' | 'setIndex'>[],
): Session {
  return {
    id,
    programId: 'p',
    workoutId: 'w',
    startedAt,
    finishedAt: startedAt + 1,
    entries: entries.map((entry, index) => ({ ...entry, setIndex: index + 1, loggedAt: startedAt + index })),
  }
}

test("nextLoad with no history is the Plan's start weight, else the Exercise's", () => {
  expect(nextLoad(squat, squatPlan, [])).toBe(50)
  expect(nextLoad(squat, { ...squatPlan, startWeightKg: 40 }, [])).toBe(40)
})

test('nextLoad after a Session that filled the rep range is one weight step up', () => {
  const full = session('s', 10, [
    { exerciseId: 'squat', weightKg: 60, reps: 10 },
    { exerciseId: 'squat', weightKg: 60, reps: 10 },
  ])
  expect(nextLoad(squat, squatPlan, [full])).toBe(62.5)
})

test("nextLoad after a Session short of the range is the newest Session's first working weight", () => {
  const older = session('old', 1, [{ exerciseId: 'squat', weightKg: 40, reps: 10 }])
  const newer = session('new', 20, [
    { exerciseId: 'squat', weightKg: 60, reps: 9 },
    { exerciseId: 'squat', weightKg: 60, reps: 8 },
  ])
  expect(nextLoad(squat, squatPlan, [newer, older])).toBe(60)
})

test('nextLoad on a Bodyweight Exercise is its signed Load, a filled range adding a step', () => {
  expect(nextLoad(pullUp, { ...squatPlan, exerciseId: 'pull-up' }, [])).toBe(-27)
  const full = session('s', 10, [
    { exerciseId: 'pull-up', weightKg: null, loadKg: -27, reps: 10 },
    { exerciseId: 'pull-up', weightKg: null, loadKg: -27, reps: 10 },
  ])
  expect(nextLoad(pullUp, { ...squatPlan, exerciseId: 'pull-up' }, [full])).toBe(-26)
})

test('nextLoadText reads BW, BW with a signed Load, or the weight', () => {
  expect(nextLoadText(pushUp, { ...squatPlan, exerciseId: 'push-up' }, [])).toBe('BW')
  expect(nextLoadText(pullUp, { ...squatPlan, exerciseId: 'pull-up' }, [])).toBe('BW−27')
  expect(nextLoadText(squat, squatPlan, [])).toBe('50')
  expect(nextLoadText({ ...squat, startWeight: null }, squatPlan, [])).toBe('–')
})

// --- E21-T1 O4: effort and deloads ---

const bar = (id: string, startedAt: number, kg: number, rirs: Array<0 | 1 | 2 | 3 | undefined>, deload = false): Session => ({
  ...session(
    id,
    startedAt,
    rirs.map((rir) => ({ exerciseId: 'squat', weightKg: kg, reps: 10, ...(rir === undefined ? {} : { rir }) })),
  ),
  ...(deload ? { deload: true as const } : {}),
})

test('O4 after an easy full bar nextLoad is two steps up', () => {
  expect(nextLoad(squat, squatPlan, [bar('a', 10, 60, [2, 3, 2])])).toBe(65)
  expect(nextLoadText(squat, squatPlan, [bar('a', 10, 60, [2, 3, 2])])).toBe('65')
})

test('O4 after a full bar at RIR 0 nextLoad is the working weight', () => {
  expect(nextLoad(squat, squatPlan, [bar('a', 10, 60, [0, 0, 0])])).toBe(60)
  expect(nextLoadText(squat, squatPlan, [bar('a', 10, 60, [0, 0, 0])])).toBe('60')
})

test('O4 after a full bar with no RIR nextLoad is one step up', () => {
  expect(nextLoad(squat, squatPlan, [bar('a', 10, 60, [undefined, undefined, undefined])])).toBe(62.5)
})

test('O4 a newest deload Session is skipped for the newest non-deload one', () => {
  const normal = bar('n', 10, 60, [3, 3, 3])
  const deload = bar('d', 20, 54, [3, 3, 3], true)
  expect(nextLoad(squat, squatPlan, [normal, deload])).toBe(65)
  expect(nextLoadText(squat, squatPlan, [deload, normal])).toBe('65')
})

test('O4 with only deload Sessions it reads the newest deload one', () => {
  const older = bar('d1', 10, 50, [0, 0, 0], true)
  const newer = bar('d2', 20, 54, [3, 3, 3], true)
  expect(nextLoad(squat, squatPlan, [older, newer])).toBe(59)
})

test('O4 a deload Session of another Exercise does not hide the last non-deload Session of this one', () => {
  const normal = bar('n', 10, 60, [3, 3, 3])
  const other: Session = {
    ...session('o', 20, [{ exerciseId: 'pull-up', weightKg: null, loadKg: -27, reps: 10 }]),
    deload: true,
  }
  expect(nextLoad(squat, squatPlan, [normal, other])).toBe(65)
})
