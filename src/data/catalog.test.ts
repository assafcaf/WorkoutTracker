import { expect, test } from 'vitest'
import exercisesJson from './exercises.json'
import { loadCatalog, loadPrograms } from './catalog'
import type { Exercise, Program, Workout } from '../types'

// The JSON files are hand-authored fixtures. Building the fixture catalog here — rather than
// with loadCatalog — keeps the expectations independent of the code under test.
const seeded = exercisesJson as Exercise[]

function fixtureCatalog(without: string[] = []): Map<string, Exercise> {
  return new Map(
    seeded.filter((e) => !without.includes(e.id)).map((e) => [e.id, e] as const),
  )
}

function workoutOf(programs: Program[], programId: string, workoutId: string): Workout {
  const program = programs.find((p) => p.id === programId)
  if (!program) throw new Error(`fixture error: no program ${programId} in the loaded programs`)
  const workout = program.workouts.find((w) => w.id === workoutId)
  if (!workout) throw new Error(`fixture error: no workout ${workoutId} in ${programId}`)
  return workout
}

test('O1 loadCatalog returns all fourteen seeded exercises keyed by id', () => {
  const catalog = loadCatalog()

  expect(catalog.size).toBe(14)
  expect([...catalog.keys()].sort()).toEqual(
    [
      'assisted-pull-ups',
      'back-squat',
      'cable-push-down',
      'db-bench-press',
      'deadlift',
      'face-pull',
      'hyper-extension',
      'lateral-raises',
      'lunges',
      'machine-row',
      'machine-shoulder-press',
      'narrow-grip-pull-down',
      'push-ups',
      'seated-biceps-curls',
    ],
  )
  expect(catalog.get('unknown-id')).toBeUndefined()
})

test('O1 loadCatalog keeps each exercise its own weight step and start weight', () => {
  const catalog = loadCatalog()

  expect(catalog.get('back-squat')).toEqual({
    id: 'back-squat',
    name: 'Back squat',
    weightStep: 2.5,
    startWeight: 50,
    bodyweight: false,
    invertProgress: false,
    // libraryId is E5-T1's addition to Exercise; back-squat maps to Barbell_Squat per the
    // mapping table in .work/plans/exercise-library.md.
    libraryId: 'Barbell_Squat',
  })
  expect(catalog.get('machine-shoulder-press')?.weightStep).toBe(1.25)
  expect(catalog.get('machine-shoulder-press')?.startWeight).toBe(5)
  expect(catalog.get('machine-row')?.weightStep).toBe(5)
})

test('O1 loadCatalog gives the bodyweight exercises no start weight', () => {
  const catalog = loadCatalog()

  const bodyweight = [...catalog.values()].filter((e) => e.bodyweight)
  expect(bodyweight.map((e) => e.id).sort()).toEqual(['hyper-extension', 'push-ups'])
  expect(bodyweight.map((e) => e.startWeight)).toEqual([null, null])
})

test('O1 loadCatalog inverts progress only for the assisted pull-up', () => {
  const catalog = loadCatalog()

  const inverted = [...catalog.values()].filter((e) => e.invertProgress)
  expect(inverted.map((e) => e.id)).toEqual(['assisted-pull-ups'])
  expect(catalog.get('assisted-pull-ups')?.startWeight).toBe(27)
})

// Every catalog exercise's libraryId already resolves in the real library (L3, proven in
// src/data/library.test.ts); what is new here is that infoUrl is gone.
test('L2 loadCatalog carries no infoUrl on any catalog exercise any more', () => {
  const catalog = loadCatalog()

  const stillCarryingInfoUrl = [...catalog.values()].filter((e) =>
    Object.prototype.hasOwnProperty.call(e, 'infoUrl'),
  )
  expect(stillCarryingInfoUrl.map((e) => e.id)).toEqual([])
})

test('O1 loadPrograms returns both bundled programs', () => {
  const programs = loadPrograms(fixtureCatalog())

  expect(programs.map((p) => p.id).sort()).toEqual(['assaf-ab-2026', 'full-body-starter'])
  expect(programs.every((p) => p.units === 'kg')).toBe(true)
  expect(workoutOf(programs, 'full-body-starter', 'full-body').exercises.map((p) => p.exerciseId))
    .toContain('back-squat')
})

test('O1 loadPrograms validates against the bundled catalog when none is passed', () => {
  const programs = loadPrograms()

  expect(programs.map((p) => p.id).sort()).toEqual(['assaf-ab-2026', 'full-body-starter'])
})

test('O1 loadPrograms gives Workout A its seven plans in the prescribed order', () => {
  const workout = workoutOf(loadPrograms(fixtureCatalog()), 'assaf-ab-2026', 'workout-a')

  expect(workout.name).toBe('Workout A')
  expect(workout.exercises).toEqual([
    { exerciseId: 'back-squat', sets: 4, repRange: [8, 10], restSeconds: 180 },
    { exerciseId: 'lunges', sets: 3, repRange: [10, 12], restSeconds: 90 },
    { exerciseId: 'db-bench-press', sets: 4, repRange: [8, 10], restSeconds: 90 },
    { exerciseId: 'push-ups', sets: 3, repRange: [10, 15], restSeconds: 90 },
    { exerciseId: 'machine-shoulder-press', sets: 3, repRange: [8, 10], restSeconds: 90 },
    { exerciseId: 'lateral-raises', sets: 3, repRange: [10, 15], restSeconds: 90 },
    { exerciseId: 'cable-push-down', sets: 3, repRange: [10, 12], restSeconds: 90 },
  ])
})

test('O1 loadPrograms gives Workout B its seven plans in the prescribed order', () => {
  const workout = workoutOf(loadPrograms(fixtureCatalog()), 'assaf-ab-2026', 'workout-b')

  expect(workout.name).toBe('Workout B')
  expect(workout.exercises).toEqual([
    { exerciseId: 'deadlift', sets: 3, repRange: [8, 10], restSeconds: 180 },
    { exerciseId: 'assisted-pull-ups', sets: 4, repRange: [5, 8], restSeconds: 90 },
    { exerciseId: 'narrow-grip-pull-down', sets: 3, repRange: [10, 12], restSeconds: 90 },
    { exerciseId: 'machine-row', sets: 4, repRange: [8, 10], restSeconds: 90 },
    { exerciseId: 'face-pull', sets: 3, repRange: [10, 15], restSeconds: 90 },
    { exerciseId: 'hyper-extension', sets: 3, repRange: [10, 15], restSeconds: 90 },
    { exerciseId: 'seated-biceps-curls', sets: 3, repRange: [10, 12], restSeconds: 90 },
  ])
})

test('O2 loadPrograms throws naming the program and the exercise id the catalog lacks', () => {
  let thrown: unknown
  try {
    loadPrograms(fixtureCatalog(['deadlift']))
  } catch (error) {
    thrown = error
  }

  expect(thrown).toBeInstanceOf(Error)
  expect((thrown as Error).message).toContain('assaf-ab-2026')
  expect((thrown as Error).message).toContain('deadlift')
})

test('O2 loadPrograms throws on an empty catalog instead of returning programs', () => {
  let thrown: unknown
  try {
    loadPrograms(new Map<string, Exercise>())
  } catch (error) {
    thrown = error
  }

  expect(thrown).toBeInstanceOf(Error)
  expect((thrown as Error).message).toContain('assaf-ab-2026')
  expect((thrown as Error).message).toContain('back-squat')
})
