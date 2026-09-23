import { expect, test } from 'vitest'
import { prescribedWeekly, programGaps } from './programVolume'
import type { Exercise, LibraryExercise, Muscle, Program, Workout } from '../types'

// Hand-rolled free-exercise-db-shaped fixtures, matching muscles.test.ts's convention --
// prescribedWeekly/programGaps have no dependency on the bundled catalog or library.
function libraryExercise(
  overrides: Partial<LibraryExercise> & { id: string; name: string },
): LibraryExercise {
  return {
    force: null,
    level: 'beginner',
    mechanic: 'compound',
    equipment: null,
    primaryMuscles: [],
    secondaryMuscles: [],
    instructions: [],
    category: 'strength',
    images: [],
    ...overrides,
  }
}

function exercise(overrides: Partial<Exercise> & { id: string; libraryId: string }): Exercise {
  return {
    name: 'Fixture Exercise',
    weightStep: 2.5,
    startWeight: 20,
    bodyweight: false,
    invertProgress: false,
    ...overrides,
  }
}

function workout(overrides: Partial<Workout> & { id: string; exercises: Workout['exercises'] }): Workout {
  return {
    name: 'Fixture Workout',
    ...overrides,
  }
}

function program(
  overrides: Partial<Program> & { id: string; sessionsPerWeek: number; workouts: Workout[] },
): Program {
  return {
    name: 'Fixture Program',
    units: 'kg',
    ...overrides,
  }
}

// M3: prescribedWeekly -------------------------------------------------------------------

const squatLibrary = libraryExercise({
  id: 'squat-lib',
  name: 'Squat',
  primaryMuscles: ['quadriceps'],
  secondaryMuscles: ['glutes'],
})
const squatExercise = exercise({ id: 'back-squat', libraryId: 'squat-lib' })

const benchLibrary = libraryExercise({
  id: 'bench-lib',
  name: 'Bench Press',
  primaryMuscles: ['chest'],
  secondaryMuscles: ['triceps'],
})
const benchExercise = exercise({ id: 'db-bench-press', libraryId: 'bench-lib' })

const catalog = new Map([
  [squatExercise.id, squatExercise],
  [benchExercise.id, benchExercise],
])
const library = new Map([
  [squatLibrary.id, squatLibrary],
  [benchLibrary.id, benchLibrary],
])

// sessionsPerWeek: 3 over two workouts -> weight 1.5 per workout, per the ticket's M3 example.
const workoutA = workout({
  id: 'workout-a',
  exercises: [{ exerciseId: 'back-squat', sets: 4, repRange: [8, 10], restSeconds: 180 }],
})
const workoutB = workout({
  id: 'workout-b',
  exercises: [{ exerciseId: 'db-bench-press', sets: 2, repRange: [8, 10], restSeconds: 90 }],
})
const twoWorkoutProgram = program({
  id: 'two-workout-program',
  sessionsPerWeek: 3,
  workouts: [workoutA, workoutB],
})

test('M3 a plan sets count is weighted by sessionsPerWeek divided by workout count before the primary muscle split', () => {
  const result = prescribedWeekly(twoWorkoutProgram, catalog, library)

  // back-squat: 4 sets * (3 sessionsPerWeek / 2 workouts) = 6 primary sets on quadriceps.
  expect(result.get('quadriceps')).toBe(6)
})

test('M3 a plan sets count contributes half its weighted value to secondary muscles', () => {
  const result = prescribedWeekly(twoWorkoutProgram, catalog, library)

  // back-squat: 4 sets * 1.5 weight * 0.5 secondary share = 3 sets on glutes.
  expect(result.get('glutes')).toBe(3)
  // db-bench-press: 2 sets * 1.5 weight * 0.5 secondary share = 1.5 sets on triceps.
  expect(result.get('triceps')).toBe(1.5)
})

test('M3 weighted sets toward the same muscle from different workouts accumulate', () => {
  const workoutBWithSquat = workout({
    id: 'workout-b',
    exercises: [
      { exerciseId: 'db-bench-press', sets: 2, repRange: [8, 10], restSeconds: 90 },
      { exerciseId: 'back-squat', sets: 2, repRange: [8, 10], restSeconds: 90 },
    ],
  })
  const overlappingProgram = program({
    id: 'overlapping-program',
    sessionsPerWeek: 3,
    workouts: [workoutA, workoutBWithSquat],
  })

  const result = prescribedWeekly(overlappingProgram, catalog, library)

  // workoutA: 4 sets * 1.5 = 6, workoutB: 2 sets * 1.5 = 3, both primary on quadriceps -> 9.
  expect(result.get('quadriceps')).toBe(9)
})

// M4: programGaps ---------------------------------------------------------------------------

// Hand-checked against the ticket's M4 list, not against programVolume.ts's own TRACKED_MUSCLES
// export, per the ticket's guidance -- a self-referential expectation would pass whatever the
// stub returns.
const TWELVE_TRACKED_MUSCLES: readonly Muscle[] = [
  'quadriceps',
  'hamstrings',
  'glutes',
  'calves',
  'chest',
  'lats',
  'middle back',
  'shoulders',
  'biceps',
  'triceps',
  'abdominals',
  'lower back',
]

test('M4 given no prescribed sets at all, programGaps returns all twelve tracked muscles', () => {
  const prescribed = new Map<Muscle, number>()

  const gaps = programGaps(prescribed)

  expect([...gaps].sort()).toEqual([...TWELVE_TRACKED_MUSCLES].sort())
})

test('M4 a tracked muscle with zero prescribed sets is a gap even when every other tracked muscle has sets', () => {
  const prescribed = new Map<Muscle, number>(
    TWELVE_TRACKED_MUSCLES.map((muscle) => [muscle, muscle === 'calves' ? 0 : 4]),
  )

  const gaps = programGaps(prescribed)

  expect(gaps).toEqual(['calves'])
})
