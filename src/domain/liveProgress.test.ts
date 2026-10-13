import { expect, test } from 'vitest'
import { currentExerciseId, formatKg, lastSessionOf, liveProgress, projectSet } from './liveProgress'
import type { Exercise, ExercisePlan, Session, SetEntry, Workout } from '../types'

const squat: Exercise = { id: 'squat', name: 'Back squat', weightStep: 2.5, startWeight: 20, bodyweight: false, libraryId: 'x' }
const lunge: Exercise = { id: 'lunge', name: 'Lunges', weightStep: 2, startWeight: 8, bodyweight: false, libraryId: 'y' }
const pushup: Exercise = { id: 'pushup', name: 'Push-ups', weightStep: 1, startWeight: null, bodyweight: true, libraryId: 'z' }
const byId = new Map([squat, lunge, pushup].map((e) => [e.id, e] as const))
const resolve = (id: string): Exercise | undefined => byId.get(id)

const plan = (exerciseId: string, sets: number): ExercisePlan => ({ exerciseId, sets, repRange: [8, 10], restSeconds: 120 })
const workout: Workout = { id: 'A', name: 'Workout A', exercises: [plan('squat', 4), plan('lunge', 3), plan('pushup', 3)] }

const set = (exerciseId: string, setIndex: number, weightKg: number | null, reps: number, loggedAt: number, extra: Partial<SetEntry> = {}): SetEntry => ({
  exerciseId, setIndex, weightKg, reps, loggedAt, ...extra,
})

const session = (id: string, startedAt: number, entries: SetEntry[], finished = true): Session => ({
  id, programId: 'p', workoutId: 'A', startedAt, finishedAt: finished ? startedAt + 1 : null, entries,
})

const lastA = session('last', 1000, [
  set('squat', 1, 60, 10, 1001),
  set('squat', 2, 60, 9, 1002),
  set('squat', 3, 60, 8, 1003),
  set('lunge', 1, 8, 12, 1004),
])

test('liveProgress counts today against last time only as far as today has gone', () => {
  const today = session('today', 5000, [
    set('squat', 1, 20, 5, 5001, { kind: 'warmup' }),
    set('squat', 2, 60, 10, 5002),
    set('squat', 3, 62.5, 8, 5003),
  ], false)

  const progress = liveProgress({ workout, session: today, earlier: [lastA], resolve })

  expect(progress.volumeKg).toBe(600 + 500)
  // Two working squat Sets today: last time's first two, 600 + 540.
  expect(progress.lastVolumeKg).toBe(1140)
  expect(progress.setsDone).toBe(2)
  expect(progress.setsPlanned).toBe(10)
})

test('liveProgress has no last volume without a finished Session of the same Workout', () => {
  const today = session('today', 5000, [set('squat', 1, 60, 10, 5001)], false)
  const other = { ...lastA, workoutId: 'B' }

  expect(liveProgress({ workout, session: today, earlier: [other], resolve }).lastVolumeKg).toBeNull()
})

test('liveProgress counts the Sets that set a record against earlier Sessions', () => {
  const today = session('today', 5000, [
    set('squat', 1, 62.5, 8, 5001), // heavier than 60: a record
    set('squat', 2, 50, 5, 5002), // no record
  ], false)

  expect(liveProgress({ workout, session: today, earlier: [lastA], resolve }).prs).toBe(1)
})

test('lastSessionOf picks the latest finished Session of the Workout started before today', () => {
  const older = session('older', 500, [])
  const unfinished = session('open', 2000, [], false)
  const today = session('today', 5000, [], false)

  expect(lastSessionOf(today, [older, lastA, unfinished])?.id).toBe('last')
})

test('currentExerciseId stays on the latest Set’s Exercise while it has planned Sets left', () => {
  const today = session('today', 5000, [set('squat', 1, 60, 10, 5001), set('lunge', 1, 8, 12, 5002)], false)

  expect(currentExerciseId(workout, today)).toBe('lunge')
})

test('currentExerciseId moves to the first Exercise with Sets left once the latest one is done', () => {
  const today = session('today', 5000, [
    set('lunge', 1, 8, 12, 5001),
    set('lunge', 2, 8, 12, 5002),
    set('lunge', 3, 8, 12, 5003),
  ], false)

  expect(currentExerciseId(workout, today)).toBe('squat')
})

test('currentExerciseId follows a swap to the Exercise done instead', () => {
  const today = { ...session('today', 5000, [], false), swaps: { squat: 'front-squat' } }

  expect(currentExerciseId(workout, today)).toBe('front-squat')
})

test('currentExerciseId is null once every planned Set is logged', () => {
  const entries: SetEntry[] = []
  let at = 5000
  for (const p of workout.exercises) for (let i = 1; i <= p.sets; i += 1) entries.push(set(p.exerciseId, i, 10, 10, (at += 1)))

  expect(currentExerciseId(workout, session('today', 5000, entries, false))).toBeNull()
})

test('projectSet reads e1RM, the record so far and PR if logged for a heavier Set', () => {
  const today = session('today', 5000, [], false)
  const projection = projectSet({ exercise: squat, plan: plan('squat', 4), earlier: [lastA], session: today, set: { weightKg: 62.5, reps: 8 } })

  expect(projection.e1rm).toBeCloseTo(62.5 * (1 + 8 / 30))
  expect(projection.record).toBeCloseTo(60 * (1 + 10 / 30))
  expect(projection.isPr).toBe(true)
})

test('projectSet is no PR at a load below the records', () => {
  const today = session('today', 5000, [], false)

  expect(projectSet({ exercise: squat, plan: plan('squat', 4), earlier: [lastA], session: today, set: { weightKg: 40, reps: 5 } }).isPr).toBe(false)
})

test('projectSet never calls a Warm-up a PR, and gives a Bodyweight Exercise no e1RM', () => {
  const today = session('today', 5000, [], false)

  expect(projectSet({ exercise: squat, plan: plan('squat', 4), earlier: [lastA], session: today, set: { weightKg: 100, reps: 5, kind: 'warmup' } }).isPr).toBe(false)
  expect(projectSet({ exercise: pushup, plan: plan('pushup', 3), earlier: [lastA], session: today, set: { weightKg: null, reps: 15 } }).e1rm).toBeNull()
})

test('formatKg rounds to whole kg with thousands separators', () => {
  expect(formatKg(1530.4)).toBe('1,530')
  expect(formatKg(0)).toBe('0')
})
