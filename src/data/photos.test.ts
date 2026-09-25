import { expect, test } from 'vitest'
import { photoUrls } from './photos'
import type { LibraryExercise } from '../types'

// Hand-checked against src/data/catalog.ts's LIBRARY_COMMIT (E5-T1) rather than imported from
// it, so a wrong pin in photos.ts would fail this test instead of passing it silently.
const LIBRARY_COMMIT = 'a859101d633a01c4a1a920d6a8ce41dabba0705f'

function fixtureEntry(id: string, images: string[]): LibraryExercise {
  return {
    id,
    name: id,
    force: null,
    level: 'beginner',
    mechanic: null,
    equipment: null,
    primaryMuscles: ['chest'],
    secondaryMuscles: [],
    instructions: ['Do the exercise.'],
    category: 'strength',
    images,
  }
}

test('L13 photoUrls resolves a catalog exercise to the bundled local library-photos files under base', () => {
  const entry = fixtureEntry('Barbell_Squat', ['Barbell_Squat/0.jpg', 'Barbell_Squat/1.jpg'])
  const catalogLibraryIds = new Set(['Barbell_Squat'])

  const urls = photoUrls(entry, catalogLibraryIds, '/')

  expect(urls).toEqual([
    '/library-photos/Barbell_Squat/0.jpg',
    '/library-photos/Barbell_Squat/1.jpg',
  ])
})

test('L13 photoUrls resolves a non-catalog exercise to the pinned free-exercise-db commit on raw.githubusercontent.com', () => {
  const entry = fixtureEntry('Zottman_Curl', ['Zottman_Curl/0.jpg'])
  const catalogLibraryIds = new Set(['Barbell_Squat'])

  const urls = photoUrls(entry, catalogLibraryIds, '/')

  expect(urls).toEqual([
    `https://raw.githubusercontent.com/yuhonas/free-exercise-db/${LIBRARY_COMMIT}/exercises/Zottman_Curl/0.jpg`,
  ])
})

test('L13 photoUrls returns an empty array for an entry with no images', () => {
  const entry = fixtureEntry('No_Photos', [])

  const urls = photoUrls(entry, new Set(['No_Photos']), '/')

  expect(urls).toEqual([])
})
