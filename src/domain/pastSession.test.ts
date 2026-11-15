import { expect, test } from 'vitest'
import type { Exercise, LibraryExercise, Session, SetEntry, Workout } from '../types'
import { addableExercises, pastSessionDraft } from './pastSession'

// V6-13: a missed Session logged after the fact opens the Session editor on a draft of its
// Workout, each Plan's Sets preset from the last time that Exercise was done.

const EXERCISES: Record<string, Exercise> = {
  'back-squat': { id: 'back-squat', libraryId: 'Barbell_Squat', name: 'Back squat', weightStep: 2.5, startWeight: 50, bodyweight: false },
  'pull-up': { id: 'pull-up', libraryId: 'Pullups', name: 'Pull-up', weightStep: 2.5, startWeight: null, bodyweight: true },
}
const resolve = (id: string): Exercise | undefined => EXERCISES[id]

const WORKOUT: Workout = {
  id: 'workout-a',
  name: 'Workout A',
  exercises: [
    { exerciseId: 'back-squat', sets: 3, repRange: [6, 8], restSeconds: 120 },
    { exerciseId: 'pull-up', sets: 2, repRange: [5, 8], restSeconds: 90 },
  ],
}

const DAY = new Date(2026, 9, 13).getTime()

function set(exerciseId: string, setIndex: number, weightKg: number | null, reps: number, extra: Partial<SetEntry> = {}): SetEntry {
  return { exerciseId, setIndex, weightKg, reps, loggedAt: 0, ...extra }
}

test('V6-13 a missed Session draft is finished on the chosen day at 18:00, an hour long, of the Workout', () => {
  const draft = pastSessionDraft({ id: 'new', programId: 'p', workout: WORKOUT, day: DAY, sessions: [], resolve })

  expect(draft).toMatchObject({ id: 'new', programId: 'p', workoutId: 'workout-a' })
  expect(new Date(draft.startedAt).getHours()).toBe(18)
  expect(new Date(draft.startedAt).getDate()).toBe(13)
  expect(draft.finishedAt).toBe(draft.startedAt + 60 * 60_000)
})

test('V6-13 with no history, each Plan gets its Sets at the start weight and bottom rep count', () => {
  const draft = pastSessionDraft({ id: 'new', programId: 'p', workout: WORKOUT, day: DAY, sessions: [], resolve })

  expect(draft.entries.map((e) => [e.exerciseId, e.setIndex, e.weightKg, e.reps])).toEqual([
    ['back-squat', 1, 50, 6],
    ['back-squat', 2, 50, 6],
    ['back-squat', 3, 50, 6],
    ['pull-up', 1, null, 5],
    ['pull-up', 2, null, 5],
  ])
  draft.entries.forEach((entry) => {
    expect(entry.loggedAt).toBeGreaterThan(draft.startedAt)
    expect(entry.loggedAt).toBeLessThanOrEqual(draft.finishedAt ?? 0)
  })
})

test('V6-13 each Plan Sets are preset from the last earlier Session working Sets, warm-ups left out', () => {
  const earlier: Session = {
    id: 'earlier',
    programId: 'p',
    workoutId: 'workout-a',
    startedAt: DAY - 3 * 86_400_000,
    finishedAt: DAY - 3 * 86_400_000 + 3_600_000,
    entries: [
      set('back-squat', 1, 40, 5, { kind: 'warmup' }),
      set('back-squat', 2, 60, 8),
      set('back-squat', 3, 62.5, 6),
      set('pull-up', 1, null, 7, { loadKg: -20 }),
    ],
  }
  const later: Session = { ...earlier, id: 'later', startedAt: DAY + 86_400_000, finishedAt: DAY + 90_000_000, entries: [set('back-squat', 1, 99, 1)] }

  const draft = pastSessionDraft({ id: 'new', programId: 'p', workout: WORKOUT, day: DAY, sessions: [later, earlier], resolve })

  expect(draft.entries.map((e) => [e.exerciseId, e.setIndex, e.weightKg, e.reps, e.loadKg])).toEqual([
    ['back-squat', 1, 60, 8, undefined],
    ['back-squat', 2, 62.5, 6, undefined],
    ['pull-up', 1, null, 7, -20],
  ])
  expect(draft.entries.some((entry) => entry.kind !== undefined)).toBe(false)
})

function library(id: string, name: string): LibraryExercise {
  return {
    id,
    name,
    force: null,
    level: 'beginner',
    mechanic: null,
    equipment: null,
    primaryMuscles: ['quadriceps'],
    secondaryMuscles: [],
    instructions: [],
    category: 'strength',
    images: [],
  }
}

test('V6-13 the editor Add exercise list offers catalog Exercises by their own id and name, in place of their library entry', () => {
  const catalog = new Map(Object.entries(EXERCISES))
  const list = addableExercises(catalog, [library('Barbell_Squat', 'Barbell Squat'), library('Hammer_Curls', 'Hammer Curls')])

  expect(list.map((entry) => [entry.id, entry.name])).toEqual([
    ['back-squat', 'Back squat'],
    ['Hammer_Curls', 'Hammer Curls'],
  ])
})
