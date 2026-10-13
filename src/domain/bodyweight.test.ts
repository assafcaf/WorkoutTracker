import { expect, test } from 'vitest'
import { applyBodyweight, bodyweightOf } from './bodyweight'
import { trainingFieldsFor } from './trainingFields'
import type { Exercise, LibraryExercise } from '../types'

// E16-T1 O1: whether an Exercise is Bodyweight, with the trainee's per-Exercise override applied.

const benchPress: Exercise = {
  id: 'bench-press',
  name: 'Bench Press',
  weightStep: 2.5,
  startWeight: 40,
  bodyweight: false,
  libraryId: 'Barbell_Bench_Press_-_Medium_Grip',
}

const pullUps: Exercise = {
  id: 'pull-ups',
  name: 'Pull-ups',
  weightStep: 2.5,
  startWeight: null,
  bodyweight: true,
  libraryId: 'Pullups',
}

// A library Exercise as resolve.ts builds it: its training fields come from trainingFieldsFor.
function libraryExercise(equipment: string | null): Exercise {
  const entry: LibraryExercise = {
    id: 'Fixture_Exercise',
    name: 'Fixture Exercise',
    force: null,
    level: 'beginner',
    mechanic: null,
    equipment,
    primaryMuscles: ['chest'],
    secondaryMuscles: [],
    instructions: ['Do the exercise.'],
    category: 'strength',
    images: [],
  }
  return {
    id: entry.id,
    name: entry.name,
    libraryId: entry.id,
    ...trainingFieldsFor(entry),
  }
}

test('O1 bodyweightOf answers a catalog Exercise its own flag when no override is stored', () => {
  expect(bodyweightOf(benchPress, {})).toBe(false)
  expect(bodyweightOf(pullUps, {})).toBe(true)
})

test('O1 bodyweightOf answers a body-only library Exercise true when no override is stored', () => {
  expect(bodyweightOf(libraryExercise('body only'), {})).toBe(true)
})

test('O1 bodyweightOf answers an equipped library Exercise false when no override is stored', () => {
  expect(bodyweightOf(libraryExercise('dumbbell'), {})).toBe(false)
  expect(bodyweightOf(libraryExercise(null), {})).toBe(false)
})

test('O1 bodyweightOf lets an override of true win over a loaded Exercise', () => {
  expect(bodyweightOf(benchPress, { 'bench-press': true })).toBe(true)
})

test('O1 bodyweightOf lets an override of false win over a Bodyweight Exercise', () => {
  expect(bodyweightOf(pullUps, { 'pull-ups': false })).toBe(false)
})

test('O1 bodyweightOf ignores overrides stored for other Exercises', () => {
  expect(bodyweightOf(benchPress, { 'pull-ups': true, squat: true })).toBe(false)
  expect(bodyweightOf(pullUps, { 'bench-press': false })).toBe(true)
})

test('O1 bodyweightOf ignores an Exercise id that only names an inherited property of the overrides', () => {
  const toStringExercise: Exercise = { ...benchPress, id: 'toString' }

  expect(bodyweightOf(toStringExercise, {})).toBe(false)
})

test('O1 applyBodyweight answers the Exercise with the overridden bodyweight and every other field unchanged', () => {
  expect(applyBodyweight(benchPress, { 'bench-press': true })).toEqual({
    id: 'bench-press',
    name: 'Bench Press',
    weightStep: 2.5,
    startWeight: 40,
    bodyweight: true,
    libraryId: 'Barbell_Bench_Press_-_Medium_Grip',
  })
})

test('O1 applyBodyweight answers the Exercise as it is when no override is stored for it', () => {
  expect(applyBodyweight(pullUps, { 'bench-press': true })).toEqual({
    id: 'pull-ups',
    name: 'Pull-ups',
    weightStep: 2.5,
    startWeight: null,
    bodyweight: true,
    libraryId: 'Pullups',
  })
})

test('O1 applyBodyweight leaves the Exercise it was given unchanged', () => {
  const original = { ...pullUps }

  applyBodyweight(original, { 'pull-ups': false })

  expect(original.bodyweight).toBe(true)
})
