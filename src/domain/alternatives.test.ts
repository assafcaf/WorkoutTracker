import { expect, test } from 'vitest'
import { alternativesFor } from './alternatives'
import type { LibraryExercise } from '../types'

// Hand-rolled free-exercise-db-shaped fixtures, per the ticket's guidance -- alternativesFor
// has no dependency on the bundled catalog or library, so small doubles are clearer than the
// real 876-entry dataset.
function exercise(overrides: Partial<LibraryExercise> & { id: string; name: string }): LibraryExercise {
  return {
    force: null,
    level: 'beginner',
    mechanic: 'compound',
    equipment: 'barbell',
    primaryMuscles: ['chest'],
    secondaryMuscles: [],
    instructions: [],
    category: 'strength',
    images: [],
    ...overrides,
  }
}

function libraryOf(...exercises: LibraryExercise[]): Map<string, LibraryExercise> {
  return new Map(exercises.map((e) => [e.id, e] as const))
}

const target = exercise({
  id: 'Barbell_Bench_Press_-_Medium_Grip',
  name: 'Barbell Bench Press - Medium Grip',
  mechanic: 'compound',
  equipment: 'barbell',
  primaryMuscles: ['chest'],
  secondaryMuscles: ['shoulders', 'triceps'],
  category: 'strength',
})

test('O_S1 an entry sharing the primary muscle with strength category is included', () => {
  const sharesMuscle = exercise({
    id: 'Dumbbell_Bench_Press',
    name: 'Dumbbell Bench Press',
    primaryMuscles: ['chest'],
    category: 'strength',
  })
  const library = libraryOf(target, sharesMuscle)

  const result = alternativesFor(target, library, null)

  expect(result.map((e) => e.id)).toEqual(['Dumbbell_Bench_Press'])
})

test('O_S1 an entry with no shared primary muscle is excluded', () => {
  const noSharedMuscle = exercise({
    id: 'Barbell_Squat',
    name: 'Barbell Squat',
    primaryMuscles: ['quadriceps'],
    category: 'strength',
  })
  const library = libraryOf(target, noSharedMuscle)

  const result = alternativesFor(target, library, null)

  expect(result).toEqual([])
})

test('O_S1 an entry with a powerlifting category and a shared primary muscle is included', () => {
  const powerlifting = exercise({
    id: 'Barbell_Floor_Press',
    name: 'Barbell Floor Press',
    primaryMuscles: ['chest'],
    category: 'powerlifting',
  })
  const library = libraryOf(target, powerlifting)

  const result = alternativesFor(target, library, null)

  expect(result.map((e) => e.id)).toEqual(['Barbell_Floor_Press'])
})

test('O_S1 an entry that shares the primary muscle but has a cardio category is excluded', () => {
  const cardio = exercise({
    id: 'Jump_Rope',
    name: 'Jump Rope',
    primaryMuscles: ['chest'],
    category: 'cardio',
  })
  const library = libraryOf(target, cardio)

  const result = alternativesFor(target, library, null)

  expect(result).toEqual([])
})

test('O_S1 an entry that shares the primary muscle but has a stretching category is excluded', () => {
  const stretching = exercise({
    id: 'Chest_Stretch',
    name: 'Chest Stretch',
    primaryMuscles: ['chest'],
    category: 'stretching',
  })
  const library = libraryOf(target, stretching)

  const result = alternativesFor(target, library, null)

  expect(result).toEqual([])
})

test('O_S1 the target itself is excluded from its own alternatives', () => {
  const library = libraryOf(target)

  const result = alternativesFor(target, library, null)

  expect(result).toEqual([])
})

test('O_S1 an entry qualifies when it shares only one of several primary muscles', () => {
  const multiMuscleTarget = exercise({
    id: 'Barbell_Deadlift',
    name: 'Barbell Deadlift',
    primaryMuscles: ['hamstrings', 'lower back'],
    category: 'strength',
  })
  const partialMatch = exercise({
    id: 'Good_Morning',
    name: 'Good Morning',
    primaryMuscles: ['lower back', 'glutes'],
    category: 'strength',
  })
  const library = libraryOf(multiMuscleTarget, partialMatch)

  const result = alternativesFor(multiMuscleTarget, library, null)

  expect(result.map((e) => e.id)).toEqual(['Good_Morning'])
})

test('O_S2 an alternative matching the target mechanic ranks before one that does not', () => {
  const isolationAlt = exercise({
    id: 'Cable_Crossover',
    name: 'Cable Crossover',
    mechanic: 'isolation',
    primaryMuscles: ['chest'],
    category: 'strength',
  })
  const compoundAlt = exercise({
    id: 'Zzz_Incline_Bench_Press',
    name: 'Zzz Incline Bench Press',
    mechanic: 'compound',
    primaryMuscles: ['chest'],
    category: 'strength',
  })
  const library = libraryOf(target, isolationAlt, compoundAlt)

  const result = alternativesFor(target, library, null)

  expect(result.map((e) => e.id)).toEqual(['Zzz_Incline_Bench_Press', 'Cable_Crossover'])
})

test('O_S2 within the same mechanic group, more shared secondary muscles ranks first', () => {
  const oneShared = exercise({
    id: 'Push_Up',
    name: 'Push Up',
    mechanic: 'compound',
    primaryMuscles: ['chest'],
    secondaryMuscles: ['shoulders'],
    category: 'strength',
  })
  const twoShared = exercise({
    id: 'Incline_Bench_Press',
    name: 'Incline Bench Press',
    mechanic: 'compound',
    primaryMuscles: ['chest'],
    secondaryMuscles: ['shoulders', 'triceps'],
    category: 'strength',
  })
  const library = libraryOf(target, oneShared, twoShared)

  const result = alternativesFor(target, library, null)

  expect(result.map((e) => e.id)).toEqual(['Incline_Bench_Press', 'Push_Up'])
})

test('O_S2 within the same mechanic and shared-secondary-muscle count, name A to Z breaks the tie', () => {
  const zAlt = exercise({
    id: 'Z_Alt',
    name: 'Zercher Press',
    mechanic: 'compound',
    primaryMuscles: ['chest'],
    secondaryMuscles: ['shoulders'],
    category: 'strength',
  })
  const aAlt = exercise({
    id: 'A_Alt',
    name: 'Arnold Press',
    mechanic: 'compound',
    primaryMuscles: ['chest'],
    secondaryMuscles: ['shoulders'],
    category: 'strength',
  })
  const library = libraryOf(target, zAlt, aAlt)

  const result = alternativesFor(target, library, null)

  expect(result.map((e) => e.id)).toEqual(['A_Alt', 'Z_Alt'])
})

test('O_S2 mechanic ranks above secondary-muscle overlap: a matching-mechanic entry with fewer shared secondary muscles still ranks first', () => {
  const isolationHighOverlap = exercise({
    id: 'Cable_Fly',
    name: 'Cable Fly',
    mechanic: 'isolation',
    primaryMuscles: ['chest'],
    secondaryMuscles: ['shoulders', 'triceps'],
    category: 'strength',
  })
  const compoundLowOverlap = exercise({
    id: 'Push_Press',
    name: 'Push Press',
    mechanic: 'compound',
    primaryMuscles: ['chest'],
    secondaryMuscles: [],
    category: 'strength',
  })
  const library = libraryOf(target, isolationHighOverlap, compoundLowOverlap)

  const result = alternativesFor(target, library, null)

  expect(result.map((e) => e.id)).toEqual(['Push_Press', 'Cable_Fly'])
})

test('O_S3 with gymEquipment limited to dumbbell, a barbell entry is excluded', () => {
  const barbellAlt = exercise({
    id: 'Barbell_Incline_Press',
    name: 'Barbell Incline Press',
    equipment: 'barbell',
    primaryMuscles: ['chest'],
    category: 'strength',
  })
  const library = libraryOf(target, barbellAlt)

  const result = alternativesFor(target, library, ['dumbbell'])

  expect(result).toEqual([])
})

test('O_S3 with gymEquipment limited to dumbbell, a machine entry is excluded', () => {
  const machineAlt = exercise({
    id: 'Machine_Chest_Press',
    name: 'Machine Chest Press',
    equipment: 'machine',
    primaryMuscles: ['chest'],
    category: 'strength',
  })
  const library = libraryOf(target, machineAlt)

  const result = alternativesFor(target, library, ['dumbbell'])

  expect(result).toEqual([])
})

test('O_S3 with gymEquipment limited to dumbbell, a dumbbell entry is kept', () => {
  const dumbbellAlt = exercise({
    id: 'Dumbbell_Flyes',
    name: 'Dumbbell Flyes',
    equipment: 'dumbbell',
    primaryMuscles: ['chest'],
    category: 'strength',
  })
  const library = libraryOf(target, dumbbellAlt)

  const result = alternativesFor(target, library, ['dumbbell'])

  expect(result.map((e) => e.id)).toEqual(['Dumbbell_Flyes'])
})

test('O_S3 with gymEquipment limited to dumbbell, a body-only entry is kept', () => {
  const bodyOnlyAlt = exercise({
    id: 'Chest_Dip',
    name: 'Chest Dip',
    equipment: 'body only',
    primaryMuscles: ['chest'],
    category: 'strength',
  })
  const library = libraryOf(target, bodyOnlyAlt)

  const result = alternativesFor(target, library, ['dumbbell'])

  expect(result.map((e) => e.id)).toEqual(['Chest_Dip'])
})

test('O_S3 with gymEquipment limited to dumbbell, a null-equipment entry is kept', () => {
  const noEquipmentAlt = exercise({
    id: 'Chest_Squeeze',
    name: 'Chest Squeeze',
    equipment: null,
    primaryMuscles: ['chest'],
    category: 'strength',
  })
  const library = libraryOf(target, noEquipmentAlt)

  const result = alternativesFor(target, library, ['dumbbell'])

  expect(result.map((e) => e.id)).toEqual(['Chest_Squeeze'])
})

test('O_S3 gymEquipment null applies no equipment filter, so a barbell entry is kept', () => {
  const barbellAlt = exercise({
    id: 'Barbell_Incline_Press',
    name: 'Barbell Incline Press',
    equipment: 'barbell',
    primaryMuscles: ['chest'],
    category: 'strength',
  })
  const library = libraryOf(target, barbellAlt)

  const result = alternativesFor(target, library, null)

  expect(result.map((e) => e.id)).toEqual(['Barbell_Incline_Press'])
})
