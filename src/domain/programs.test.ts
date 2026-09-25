import { describe, expect, test } from 'vitest'
import { mergePrograms, newPlan, validateProgram, visiblePrograms } from './programs'
import type { ProgramFault } from './programs'
import { loadCatalog, loadPrograms } from '../data/catalog'
import type { Exercise, ExercisePlan, Program, UserProgram, Workout } from '../types'

// Hand-rolled fixtures, matching programVolume.test.ts's convention.
function exercise(overrides: Partial<Exercise> & { id: string }): Exercise {
  return {
    name: 'Fixture Exercise',
    weightStep: 2.5,
    startWeight: 20,
    bodyweight: false,
    invertProgress: false,
    libraryId: 'Fixture_Library',
    ...overrides,
  }
}

const catalog = new Map<string, Exercise>([
  ['squat', exercise({ id: 'squat' })],
  ['bench', exercise({ id: 'bench' })],
  ['push-ups', exercise({ id: 'push-ups', bodyweight: true, startWeight: null })],
])
const resolve = (id: string) => catalog.get(id)

function plan(overrides: Partial<ExercisePlan> = {}): ExercisePlan {
  return { exerciseId: 'squat', sets: 3, repRange: [8, 10], restSeconds: 90, ...overrides }
}

function workout(overrides: Partial<Workout> = {}): Workout {
  return { id: 'w-a', name: 'Workout A', exercises: [plan()], ...overrides }
}

function program(overrides: Partial<Program> = {}): Program {
  return {
    id: 'p-1',
    name: 'My program',
    units: 'kg',
    sessionsPerWeek: 3,
    workouts: [workout()],
    ...overrides,
  }
}

function userProgram(overrides: Partial<UserProgram> & { createdAt: number }): UserProgram {
  return { ...program(), ...overrides }
}

/** A Program whose only Workout holds one Plan built from `overrides`. */
function withPlan(overrides: Partial<ExercisePlan>): Program {
  return program({ workouts: [workout({ exercises: [plan(overrides)] })] })
}

const byPath = (a: ProgramFault, b: ProgramFault) => a.path.localeCompare(b.path)

describe('O1 mergePrograms', () => {
  test('O1 an edited bundled Program replaces the bundled one in place, then user Programs follow', () => {
    const bundled = loadPrograms()
    const edited = userProgram({
      ...bundled[0],
      id: 'assaf-ab-2026',
      name: 'Assaf A/B edited',
      createdAt: 2000,
    })
    const created = userProgram({ id: 'p-new', name: 'New program', createdAt: 1000 })

    const merged = mergePrograms(bundled, [created, edited])

    expect(merged.map((p) => p.id)).toEqual(['assaf-ab-2026', 'full-body-starter', 'p-new'])
    expect(merged[0].name).toBe('Assaf A/B edited')
    expect(merged[1]).toEqual(bundled[1])
    expect(merged[2].name).toBe('New program')
  })

  test('O1 user Programs follow the bundled ones ordered by createdAt, not stored order', () => {
    const bundled = loadPrograms()
    const late = userProgram({ id: 'p-late', createdAt: 3000 })
    const early = userProgram({ id: 'p-early', createdAt: 1000 })
    const middle = userProgram({ id: 'p-middle', createdAt: 2000 })

    const merged = mergePrograms(bundled, [late, early, middle])

    expect(merged.map((p) => p.id)).toEqual([
      'assaf-ab-2026',
      'full-body-starter',
      'p-early',
      'p-middle',
      'p-late',
    ])
  })

  test('O1 with no user Programs the bundled Programs come back unchanged', () => {
    const bundled = loadPrograms()

    const merged = mergePrograms(bundled, [])

    expect(merged.map((p) => p.id)).toEqual(['assaf-ab-2026', 'full-body-starter'])
    expect(merged).toEqual(bundled)
  })

  test('O1 an edited bundled Program is not also listed as a user Program', () => {
    const bundled = loadPrograms()
    const edited = userProgram({ ...bundled[1], name: 'Starter edited', createdAt: 1 })

    const merged = mergePrograms(bundled, [edited])

    expect(merged.map((p) => p.id)).toEqual(['assaf-ab-2026', 'full-body-starter'])
    expect(merged[1].name).toBe('Starter edited')
  })
})

describe('O2 visiblePrograms', () => {
  const hiddenProgram = program({ id: 'p-hidden', name: 'Hidden', hidden: true })
  const withHiddenWorkout = program({
    id: 'p-partly',
    workouts: [
      workout({ id: 'w-shown', name: 'Shown' }),
      workout({ id: 'w-hidden', name: 'Hidden workout', hidden: true }),
    ],
  })
  const plain = program({ id: 'p-plain' })

  test('O2 a hidden Program is absent from the visible Programs', () => {
    const visible = visiblePrograms([plain, hiddenProgram, withHiddenWorkout])

    expect(visible.map((p) => p.id)).toEqual(['p-plain', 'p-partly'])
  })

  test('O2 a hidden Workout is absent from its visible Program', () => {
    const visible = visiblePrograms([withHiddenWorkout])

    expect(visible).toHaveLength(1)
    expect(visible[0].workouts.map((w) => w.id)).toEqual(['w-shown'])
  })

  test('O2 a Program with nothing hidden keeps all its Workouts', () => {
    const twoWorkouts = program({
      id: 'p-two',
      workouts: [workout({ id: 'w-1' }), workout({ id: 'w-2' })],
    })

    const visible = visiblePrograms([twoWorkouts])

    expect(visible[0].workouts.map((w) => w.id)).toEqual(['w-1', 'w-2'])
  })

  test('O2 mergePrograms still returns hidden Programs and hidden Workouts after visiblePrograms', () => {
    const user = [
      userProgram({ ...hiddenProgram, createdAt: 1 }),
      userProgram({ ...withHiddenWorkout, createdAt: 2 }),
    ]

    const merged = mergePrograms(loadPrograms(), user)
    visiblePrograms(merged)

    expect(merged.map((p) => p.id)).toContain('p-hidden')
    const partly = merged.find((p) => p.id === 'p-partly')
    expect(partly?.workouts.map((w) => w.id)).toEqual(['w-shown', 'w-hidden'])
  })
})

describe('O3 validateProgram', () => {
  test('O3 a valid Program has no faults', () => {
    expect(validateProgram(program(), resolve)).toEqual([])
  })

  test('O3 every bundled Program is valid against the catalog', () => {
    const bundledCatalog = loadCatalog()
    for (const p of loadPrograms()) {
      expect(validateProgram(p, (id) => bundledCatalog.get(id))).toEqual([])
    }
  })

  test('O3 an empty name is a name fault', () => {
    expect(validateProgram(program({ name: '' }), resolve)).toEqual([
      { path: 'name', message: 'Name is empty' },
    ])
  })

  test('O3 a whitespace-only name is a name fault', () => {
    expect(validateProgram(program({ name: '   ' }), resolve)).toEqual([
      { path: 'name', message: 'Name is empty' },
    ])
  })

  test('O3 no Workouts at all is a workouts fault', () => {
    expect(validateProgram(program({ workouts: [] }), resolve)).toEqual([
      { path: 'workouts', message: 'Add a workout' },
    ])
  })

  test('O3 only hidden Workouts is a workouts fault', () => {
    const p = program({ workouts: [workout({ hidden: true })] })
    expect(validateProgram(p, resolve)).toEqual([{ path: 'workouts', message: 'Add a workout' }])
  })

  test('O3 a visible Workout with an empty name is a fault at its index', () => {
    const p = program({ workouts: [workout({ id: 'w-1' }), workout({ id: 'w-2', name: ' ' })] })
    expect(validateProgram(p, resolve)).toEqual([
      { path: 'workouts.1.name', message: 'Name is empty' },
    ])
  })

  test('O3 a visible Workout with no Exercise is an exercises fault at its index', () => {
    const p = program({ workouts: [workout({ exercises: [] })] })
    expect(validateProgram(p, resolve)).toEqual([
      { path: 'workouts.0.exercises', message: 'Add an exercise' },
    ])
  })

  test('O3 a hidden Workout is never validated but still counts in the index', () => {
    const p = program({
      workouts: [
        workout({ id: 'w-hidden', name: '', exercises: [plan({ sets: 0 })], hidden: true }),
        workout({ id: 'w-shown', exercises: [] }),
      ],
    })
    expect(validateProgram(p, resolve)).toEqual([
      { path: 'workouts.1.exercises', message: 'Add an exercise' },
    ])
  })

  test.each([0, 11, 2.5, -1])('O3 sets of %s is a sets fault', (sets) => {
    expect(validateProgram(withPlan({ sets }), resolve)).toEqual([
      { path: 'workouts.0.exercises.0.sets', message: 'Sets: 1 to 10' },
    ])
  })

  test.each([1, 10])('O3 sets of %s is valid', (sets) => {
    expect(validateProgram(withPlan({ sets }), resolve)).toEqual([])
  })

  test.each([
    [0, 10],
    [8, 101],
    [-1, 5],
  ] as [number, number][])('O3 rep range %s-%s outside 1 to 100 is a repRange fault', (min, max) => {
    expect(validateProgram(withPlan({ repRange: [min, max] }), resolve)).toEqual([
      { path: 'workouts.0.exercises.0.repRange', message: 'Rep range: 1 to 100' },
    ])
  })

  test('O3 a rep range whose min is more than its max is a repRange fault', () => {
    expect(validateProgram(withPlan({ repRange: [10, 8] }), resolve)).toEqual([
      { path: 'workouts.0.exercises.0.repRange', message: 'Rep range: min is more than max' },
    ])
  })

  test.each([
    [8, 8],
    [1, 100],
  ] as [number, number][])('O3 rep range %s-%s is valid', (min, max) => {
    expect(validateProgram(withPlan({ repRange: [min, max] }), resolve)).toEqual([])
  })

  test.each([-1, 601])('O3 rest of %s seconds is a restSeconds fault', (restSeconds) => {
    expect(validateProgram(withPlan({ restSeconds }), resolve)).toEqual([
      { path: 'workouts.0.exercises.0.restSeconds', message: 'Rest: 0 to 600 s' },
    ])
  })

  test.each([0, 600])('O3 rest of %s seconds is valid', (restSeconds) => {
    expect(validateProgram(withPlan({ restSeconds }), resolve)).toEqual([])
  })

  test.each([-1, 501])('O3 a starting weight of %s kg is a startWeightKg fault', (startWeightKg) => {
    expect(validateProgram(withPlan({ startWeightKg }), resolve)).toEqual([
      { path: 'workouts.0.exercises.0.startWeightKg', message: 'Starting weight: 0 to 500 kg' },
    ])
  })

  test.each([0, 500, 42.5])('O3 a starting weight of %s kg is valid', (startWeightKg) => {
    expect(validateProgram(withPlan({ startWeightKg }), resolve)).toEqual([])
  })

  test('O3 a starting weight on a Bodyweight Exercise is a startWeightKg fault', () => {
    expect(
      validateProgram(withPlan({ exerciseId: 'push-ups', startWeightKg: 0 }), resolve),
    ).toEqual([
      {
        path: 'workouts.0.exercises.0.startWeightKg',
        message: 'Starting weight: not for a bodyweight exercise',
      },
    ])
  })

  test('O3 a Bodyweight Exercise with no starting weight is valid', () => {
    expect(validateProgram(withPlan({ exerciseId: 'push-ups' }), resolve)).toEqual([])
  })

  test.each([0, 15])('O3 %s sessions per week is a sessionsPerWeek fault', (sessionsPerWeek) => {
    expect(validateProgram(program({ sessionsPerWeek }), resolve)).toEqual([
      { path: 'sessionsPerWeek', message: 'Sessions per week: 1 to 14' },
    ])
  })

  test.each([1, 14])('O3 %s sessions per week is valid', (sessionsPerWeek) => {
    expect(validateProgram(program({ sessionsPerWeek }), resolve)).toEqual([])
  })

  test('O3 an exerciseId the resolver does not know is an exerciseId fault', () => {
    expect(validateProgram(withPlan({ exerciseId: 'no-such-lift' }), resolve)).toEqual([
      { path: 'workouts.0.exercises.0.exerciseId', message: 'Unknown exercise' },
    ])
  })

  test('O3 several faults come back one per field with their indexes', () => {
    const p = program({
      name: '',
      sessionsPerWeek: 0,
      workouts: [
        workout({ id: 'w-hidden', hidden: true, exercises: [] }),
        workout({
          id: 'w-1',
          exercises: [
            plan(),
            plan({ exerciseId: 'bench', sets: 11, restSeconds: 601 }),
            plan({ exerciseId: 'push-ups', repRange: [12, 6], startWeightKg: 10 }),
          ],
        }),
        workout({ id: 'w-2', name: '', exercises: [] }),
      ],
    })

    const faults = validateProgram(p, resolve)

    expect([...faults].sort(byPath)).toEqual(
      [
        { path: 'name', message: 'Name is empty' },
        { path: 'sessionsPerWeek', message: 'Sessions per week: 1 to 14' },
        { path: 'workouts.1.exercises.1.sets', message: 'Sets: 1 to 10' },
        { path: 'workouts.1.exercises.1.restSeconds', message: 'Rest: 0 to 600 s' },
        {
          path: 'workouts.1.exercises.2.repRange',
          message: 'Rep range: min is more than max',
        },
        {
          path: 'workouts.1.exercises.2.startWeightKg',
          message: 'Starting weight: not for a bodyweight exercise',
        },
        { path: 'workouts.2.name', message: 'Name is empty' },
        { path: 'workouts.2.exercises', message: 'Add an exercise' },
      ].sort(byPath),
    )
  })
})

// --- E9-T7 O14: a new Plan's defaults ----------------------------------------------------------

describe('newPlan (E9-T7 O14)', () => {
  test('O14 a new Plan starts with 3 sets, 8-12 reps, 90 s rest and no starting weight', () => {
    const made = newPlan('bench')

    expect(made).toEqual({ exerciseId: 'bench', sets: 3, repRange: [8, 12], restSeconds: 90 })
    expect('startWeightKg' in made).toBe(false)
  })

  test('O14 two new Plans do not share one rep range array', () => {
    const first = newPlan('bench')
    const second = newPlan('squat')

    first.repRange[1] = 15

    expect(second.repRange).toEqual([8, 12])
  })
})
