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
