import { describe, expect, test } from 'vitest'
import type { ExercisePlan, Session, Workout } from '../types'
import { sessionPlans } from './sessionPlans'

const bench: ExercisePlan = { exerciseId: 'bench', sets: 3, repRange: [6, 8], restSeconds: 120 }
const row: ExercisePlan = { exerciseId: 'row', sets: 3, repRange: [8, 10], restSeconds: 90 }
const curl: ExercisePlan = { exerciseId: 'curl', sets: 3, repRange: [8, 12], restSeconds: 90 }
const dip: ExercisePlan = { exerciseId: 'dip', sets: 3, repRange: [8, 12], restSeconds: 90 }

const workout: Workout = { id: 'w1', name: 'Workout one', exercises: [bench, row] }

function session(over: Partial<Session> = {}): Session {
  return {
    id: 's1',
    programId: 'p1',
    workoutId: 'w1',
    startedAt: 1,
    finishedAt: null,
    entries: [],
    ...over,
  }
}

describe('sessionPlans (E19-T12 O22)', () => {
  test('O22 a Session without added Exercises answers the Workout Plans', () => {
    expect(sessionPlans(workout, session())).toEqual([bench, row])
  })

  test('O22 added Plans follow the Workout Plans, in the order added', () => {
    expect(sessionPlans(workout, session({ added: [curl, dip] }))).toEqual([bench, row, curl, dip])
  })

  test('O22 an empty added list answers the Workout Plans', () => {
    expect(sessionPlans(workout, session({ added: [] }))).toEqual([bench, row])
  })

  test('O22 the answer is a new list: the Workout is not extended', () => {
    sessionPlans(workout, session({ added: [curl] }))

    expect(workout.exercises).toEqual([bench, row])
  })
})
