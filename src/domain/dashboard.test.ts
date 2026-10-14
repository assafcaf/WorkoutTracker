import { describe, expect, test } from 'vitest'
import type { Exercise, LibraryExercise, Program, Session, SetEntry } from '../types'
import {
  dueWorkout,
  liftTrends,
  muscleWeek,
  progressionHint,
  startOfWeek,
  timeAgo,
  weekVsLast,
  workoutEstimate,
} from './dashboard'

const DAY = 24 * 60 * 60 * 1000
// Tue 13 Oct 2026, 17:58 local.
const NOW = new Date(2026, 9, 13, 17, 58).getTime()
const at = (month: number, day: number, hour = 18): number => new Date(2026, month, day, hour).getTime()

const exercise = (id: string, extra: Partial<Exercise> = {}): Exercise => ({
  id,
  name: id.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase()),
  weightStep: 2.5,
  startWeight: 20,
  bodyweight: false,
  libraryId: `lib-${id}`,
  ...extra,
})

const EXERCISES = new Map<string, Exercise>([
  ['squat', exercise('squat')],
  ['bench', exercise('bench')],
  ['deadlift', exercise('deadlift')],
  ['row', exercise('row')],
  ['push-ups', exercise('push-ups', { bodyweight: true, startWeight: null })],
])
const resolve = (id: string): Exercise | undefined => EXERCISES.get(id)

const lib = (id: string, primary: LibraryExercise['primaryMuscles'], secondary: LibraryExercise['secondaryMuscles'] = []): LibraryExercise => ({
  id: `lib-${id}`,
  name: id,
  force: null,
  level: 'beginner',
  mechanic: null,
  equipment: null,
  primaryMuscles: primary,
  secondaryMuscles: secondary,
  instructions: [],
  category: 'strength',
  images: [],
})
const LIBRARY = new Map<string, LibraryExercise>(
  [
    lib('squat', ['quadriceps'], ['glutes']),
    lib('bench', ['chest'], ['triceps']),
    lib('deadlift', ['lower back'], ['hamstrings']),
    lib('row', ['middle back']),
    lib('push-ups', ['chest']),
  ].map((entry) => [entry.id, entry]),
)

const PROGRAM: Program = {
  id: 'ab',
  name: 'A/B Split',
  units: 'kg',
  sessionsPerWeek: 3,
  workouts: [
    {
      id: 'a',
      name: 'Workout A',
      exercises: [
        { exerciseId: 'squat', sets: 2, repRange: [8, 10], restSeconds: 180 },
        { exerciseId: 'bench', sets: 2, repRange: [8, 10], restSeconds: 90 },
        { exerciseId: 'push-ups', sets: 1, repRange: [10, 15], restSeconds: 90 },
      ],
    },
    {
      id: 'b',
      name: 'Workout B',
      exercises: [
        { exerciseId: 'deadlift', sets: 2, repRange: [8, 10], restSeconds: 180 },
        { exerciseId: 'row', sets: 2, repRange: [8, 10], restSeconds: 90 },
      ],
    },
  ],
}

const set = (exerciseId: string, weightKg: number | null, reps: number, loggedAt: number, setIndex = 0): SetEntry => ({
  exerciseId,
  setIndex,
  weightKg,
  reps,
  loggedAt,
})

const session = (id: string, workoutId: string, startedAt: number, entries: SetEntry[]): Session => ({
  id,
  programId: 'ab',
  workoutId,
  startedAt,
  finishedAt: startedAt + 3_000_000,
  entries,
})

describe('startOfWeek', () => {
  test('is Monday 00:00 of the week holding now', () => {
    expect(startOfWeek(NOW)).toBe(new Date(2026, 9, 12).getTime())
  })

  test('a Sunday belongs to the week that started the Monday before', () => {
    expect(startOfWeek(new Date(2026, 9, 18, 23).getTime())).toBe(new Date(2026, 9, 12).getTime())
  })
})

describe('weekVsLast', () => {
  test('counts this calendar week and last, by Sessions, working Sets and loaded kg', () => {
    const sessions = [
      session('mon', 'b', at(9, 12), [set('deadlift', 100, 10, at(9, 12)), set('deadlift', 100, 8, at(9, 12), 1)]),
      session('fri', 'a', at(9, 9), [set('squat', 60, 10, at(9, 9)), { ...set('squat', 30, 5, at(9, 9)), kind: 'warmup' }]),
      session('wed', 'b', at(9, 7), [set('push-ups', null, 12, at(9, 7))]),
      session('old', 'a', at(9, 2), [set('squat', 60, 10, at(9, 2))]),
    ]
    const { thisWeek, lastWeek } = weekVsLast(sessions, NOW, resolve)
    expect(thisWeek).toEqual({ sessions: 1, sets: 2, volumeKg: 1800 })
    expect(lastWeek).toEqual({ sessions: 2, sets: 2, volumeKg: 600 })
  })
})

describe('muscleWeek', () => {
  test('lists sets done this week against the sets the program plans a week, and the muscles no plan works directly', () => {
    const sessions = [
      session('mon', 'a', at(9, 12), [set('squat', 60, 10, at(9, 12)), set('squat', 60, 10, at(9, 12), 1)]),
      session('fri', 'a', at(9, 9), [set('bench', 40, 10, at(9, 9))]),
    ]
    const { rows, gaps } = muscleWeek(sessions, NOW, PROGRAM, resolve, LIBRARY)
    const row = (muscle: string) => rows.find((r) => r.muscle === muscle)
    // Planned: each of the 2 workouts weighs 3/2 a week.
    expect(row('quadriceps')).toEqual({ muscle: 'quadriceps', done: 2, planned: 3 })
    expect(row('glutes')).toEqual({ muscle: 'glutes', done: 1, planned: 1.5 })
    expect(row('chest')).toEqual({ muscle: 'chest', done: 0, planned: 4.5 })
    expect(rows.map((r) => r.muscle)).toHaveLength(12)
    expect(gaps).toContain('calves')
    expect(gaps).toContain('abdominals')
    expect(gaps).not.toContain('chest')
    // Glutes and triceps are only ever secondary here: planned, but not trained directly.
    expect(row('triceps')?.planned).toBeGreaterThan(0)
    expect(gaps).toContain('triceps')
    expect(gaps).toContain('glutes')
  })
})

describe('liftTrends', () => {
  test('gives each workout main lift first, its e1RM per Session over 3 weeks and the change', () => {
    const sessions = [
      session('s1', 'a', at(8, 21), [set('squat', 60, 10, at(8, 21))]),
      session('s2', 'a', at(8, 30), [set('squat', 60, 10, at(8, 30)), set('bench', 40, 9, at(8, 30))]),
      session('s3', 'a', at(9, 9), [set('squat', 62.5, 10, at(9, 9)), set('push-ups', null, 15, at(9, 9))]),
      session('s4', 'b', at(9, 12), [set('deadlift', 90, 10, at(9, 12)), set('row', 50, 10, at(9, 12))]),
    ]
    const trends = liftTrends(sessions, PROGRAM, resolve, NOW)
    expect(trends.map((t) => t.exerciseId)).toEqual(['squat', 'deadlift', 'bench'])
    const squat = trends[0]
    // 21 Sep is more than 21 days before 13 Oct, so it is outside the window.
    expect(squat.values).toEqual([80, 62.5 * (1 + 10 / 30)])
    expect(squat.latest).toBeCloseTo(83.33, 2)
    expect(squat.delta).toBeCloseTo(3.33, 2)
    expect(trends[1].delta).toBeNull()
  })

  test('is empty with no Sessions', () => {
    expect(liftTrends([], PROGRAM, resolve, NOW)).toEqual([])
  })
})

describe('progressionHint', () => {
  test('names the first lift whose last Session hit the top of the range, with its next weight', () => {
    const sessions = [
      session('s1', 'a', at(9, 9), [
        set('squat', 60, 10, at(9, 9)),
        set('squat', 60, 10, at(9, 9), 1),
        set('bench', 40, 8, at(9, 9)),
      ]),
    ]
    expect(progressionHint(sessions, PROGRAM, resolve)).toEqual({
      exerciseId: 'squat',
      name: 'Squat',
      nextWeightKg: 62.5,
    })
  })

  test('is null when no lift filled its range', () => {
    const sessions = [session('s1', 'a', at(9, 9), [set('squat', 60, 9, at(9, 9))])]
    expect(progressionHint(sessions, PROGRAM, resolve)).toBeNull()
  })
})

describe('dueWorkout', () => {
  test('is the workout after the newest Session, with when it was last done', () => {
    const sessions = [
      session('s2', 'b', at(9, 12), []),
      session('s1', 'a', at(9, 9), []),
    ]
    expect(dueWorkout(PROGRAM, sessions)).toEqual({ workout: PROGRAM.workouts[0], lastDoneAt: at(9, 9) })
  })

  test('is the first workout, never done, for a new trainee', () => {
    expect(dueWorkout(PROGRAM, [])).toEqual({ workout: PROGRAM.workouts[0], lastDoneAt: null })
  })

  test('skips a hidden workout', () => {
    const hiddenB = { ...PROGRAM, workouts: [PROGRAM.workouts[0], { ...PROGRAM.workouts[1], hidden: true }] }
    expect(dueWorkout(hiddenB, [session('s1', 'a', at(9, 9), [])])?.workout.id).toBe('a')
  })
})

describe('workoutEstimate', () => {
  test('counts exercises and sets, and estimates minutes from lifting time and rests', () => {
    // 5 sets x 40 s + rests (2x180 + 2x90 + 1x90) less the last rest (90) = 200 + 540 = 740 s.
    expect(workoutEstimate(PROGRAM.workouts[0])).toEqual({ exercises: 3, sets: 5, minutes: 12 })
  })

  test('a 23-set workout with one 3-minute lift reads about 54 minutes', () => {
    const a = {
      id: 'a',
      name: 'A',
      exercises: [4, 3, 4, 3, 3, 3, 3].map((sets, i) => ({
        exerciseId: `e${i}`,
        sets,
        repRange: [8, 10] as [number, number],
        restSeconds: i === 0 ? 180 : 90,
      })),
    }
    expect(workoutEstimate(a)).toEqual({ exercises: 7, sets: 23, minutes: 54 })
  })
})

describe('timeAgo', () => {
  test('reads minutes, hours and days', () => {
    expect(timeAgo(NOW - 20_000, NOW)).toBe('just now')
    expect(timeAgo(NOW - 2 * 60_000, NOW)).toBe('2 min ago')
    expect(timeAgo(NOW - 3 * 3_600_000, NOW)).toBe('3 h ago')
    expect(timeAgo(NOW - 2 * DAY, NOW)).toBe('2 d ago')
  })
})
