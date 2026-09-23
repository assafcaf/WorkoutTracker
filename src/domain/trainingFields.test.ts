import { expect, test } from 'vitest'
import { trainingFieldsFor } from './trainingFields'
import type { LibraryExercise } from '../types'

// Mirrors library.test.ts's fixtureLibraryEntry: every field a real free-exercise-db entry
// has, with `equipment` the only field these tests vary.
function fixtureLibraryEntry(equipment: string | null): LibraryExercise {
  return {
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
}

test('S4 trainingFieldsFor gives a barbell exercise a weightStep of 2.5', () => {
  expect(trainingFieldsFor(fixtureLibraryEntry('barbell')).weightStep).toBe(2.5)
})

test('S4 trainingFieldsFor gives a dumbbell exercise a weightStep of 1', () => {
  expect(trainingFieldsFor(fixtureLibraryEntry('dumbbell')).weightStep).toBe(1)
})

test('S4 trainingFieldsFor gives a cable exercise a weightStep of 2.5', () => {
  expect(trainingFieldsFor(fixtureLibraryEntry('cable')).weightStep).toBe(2.5)
})

test('S4 trainingFieldsFor gives a machine exercise a weightStep of 5', () => {
  expect(trainingFieldsFor(fixtureLibraryEntry('machine')).weightStep).toBe(5)
})

test('S4 trainingFieldsFor gives a kettlebells exercise a weightStep of 4', () => {
  expect(trainingFieldsFor(fixtureLibraryEntry('kettlebells')).weightStep).toBe(4)
})

test('S4 trainingFieldsFor gives a body-only exercise a weightStep of 1', () => {
  expect(trainingFieldsFor(fixtureLibraryEntry('body only')).weightStep).toBe(1)
})

test('S4 trainingFieldsFor gives an unlisted equipment name a weightStep of 1', () => {
  expect(trainingFieldsFor(fixtureLibraryEntry('bands')).weightStep).toBe(1)
})

test('S4 trainingFieldsFor gives a null-equipment exercise a weightStep of 1', () => {
  expect(trainingFieldsFor(fixtureLibraryEntry(null)).weightStep).toBe(1)
})

test('S4 trainingFieldsFor marks a body-only exercise bodyweight with no start weight', () => {
  const fields = trainingFieldsFor(fixtureLibraryEntry('body only'))

  expect(fields.bodyweight).toBe(true)
  expect(fields.startWeight).toBeNull()
})

test('S4 trainingFieldsFor marks a barbell exercise not bodyweight with a zero start weight', () => {
  const fields = trainingFieldsFor(fixtureLibraryEntry('barbell'))

  expect(fields.bodyweight).toBe(false)
  expect(fields.startWeight).toBe(0)
})

test('S4 trainingFieldsFor marks a null-equipment exercise not bodyweight with a zero start weight', () => {
  const fields = trainingFieldsFor(fixtureLibraryEntry(null))

  expect(fields.bodyweight).toBe(false)
  expect(fields.startWeight).toBe(0)
})

test('S4 trainingFieldsFor never inverts progress', () => {
  expect(trainingFieldsFor(fixtureLibraryEntry('barbell')).invertProgress).toBe(false)
  expect(trainingFieldsFor(fixtureLibraryEntry('body only')).invertProgress).toBe(false)
})
