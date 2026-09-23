import { expect, test } from 'vitest'
import { matchVideo, normaliseName, type MsPage } from './videoMatch'
import type { LibraryExercise } from '../types'

// Hand-checked fixtures, independent of matchVideo/normaliseName. Every field the type
// requires is filled in with an unrelated placeholder so only `id`/`name` matter to the test.
function fixtureLibraryEntry(id: string, name: string): LibraryExercise {
  return {
    id,
    name,
    force: null,
    level: 'beginner',
    mechanic: null,
    equipment: null,
    primaryMuscles: ['chest'],
    secondaryMuscles: [],
    instructions: ['Do the exercise.'],
    category: 'strength',
    images: [],
  }
}

function fixturePage(overrides: Partial<MsPage> = {}): MsPage {
  return {
    slug: 'barbell-squat',
    title: 'Barbell Squat',
    equipment: 'Barbell',
    youtubeId: 'R2dMsNhN3DE',
    ...overrides,
  }
}

// L7: matchVideo

test('L7 matchVideo returns the library id whose normalised name equals the page title', () => {
  const library = new Map([
    ['Barbell_Squat', fixtureLibraryEntry('Barbell_Squat', 'Barbell Squat')],
    ['Front_Barbell_Squat', fixtureLibraryEntry('Front_Barbell_Squat', 'Front Barbell Squat')],
  ])
  const page = fixturePage({ slug: 'barbell-squat', title: 'Barbell Squat' })

  expect(matchVideo(page, library, {})).toBe('Barbell_Squat')
})

test('L7 matchVideo returns null when no library exercise matches the page title', () => {
  const library = new Map([
    ['Barbell_Squat', fixtureLibraryEntry('Barbell_Squat', 'Barbell Squat')],
  ])
  const page = fixturePage({ slug: 'underwater-basket-weaving', title: 'Underwater Basket Weaving' })

  expect(matchVideo(page, library, {})).toBeNull()
})

test('L7 matchVideo returns null when two or more library exercises match the page title', () => {
  const library = new Map([
    ['Cable_Row_Machine', fixtureLibraryEntry('Cable_Row_Machine', 'Seated Cable Row')],
    ['Cable_Row_Alt', fixtureLibraryEntry('Cable_Row_Alt', 'Seated Cable Row')],
  ])
  const page = fixturePage({ slug: 'seated-cable-row', title: 'Seated Cable Row' })

  expect(matchVideo(page, library, {})).toBeNull()
})

test('L7 matchVideo prefers the override over a different computed match', () => {
  const library = new Map([
    ['Barbell_Squat', fixtureLibraryEntry('Barbell_Squat', 'Barbell Squat')],
    ['Front_Barbell_Squat', fixtureLibraryEntry('Front_Barbell_Squat', 'Front Barbell Squat')],
  ])
  const page = fixturePage({ slug: 'barbell-squat', title: 'Barbell Squat' })
  const overrides = { 'barbell-squat': 'Front_Barbell_Squat' }

  expect(matchVideo(page, library, overrides)).toBe('Front_Barbell_Squat')
})

test('L7 matchVideo uses the override when there is no computed match', () => {
  const library = new Map([
    ['Barbell_Squat', fixtureLibraryEntry('Barbell_Squat', 'Barbell Squat')],
  ])
  const page = fixturePage({ slug: 'underwater-basket-weaving', title: 'Underwater Basket Weaving' })
  const overrides = { 'underwater-basket-weaving': 'Barbell_Squat' }

  expect(matchVideo(page, library, overrides)).toBe('Barbell_Squat')
})

test('L7 matchVideo returns null when the override maps the slug to null despite a computed match', () => {
  const library = new Map([
    ['Barbell_Squat', fixtureLibraryEntry('Barbell_Squat', 'Barbell Squat')],
  ])
  const page = fixturePage({ slug: 'barbell-squat', title: 'Barbell Squat' })
  const overrides = { 'barbell-squat': null }

  expect(matchVideo(page, library, overrides)).toBeNull()
})

// L8: normaliseName

test('L8 normaliseName ignores case differences', () => {
  expect(normaliseName('Barbell Squat')).toBe(normaliseName('BARBELL SQUAT'))
})

test('L8 normaliseName ignores punctuation differences', () => {
  expect(normaliseName('Sumo Deadlift')).toBe(normaliseName('Sumo, Deadlift.'))
})

test('L8 normaliseName ignores plural differences', () => {
  expect(normaliseName('Lateral Raise')).toBe(normaliseName('Lateral Raises'))
})

test('L8 normaliseName ignores word order differences', () => {
  expect(normaliseName('Barbell Squat')).toBe(normaliseName('Squat Barbell'))
})

test('L8 normaliseName treats db and dumbbell as the same word', () => {
  expect(normaliseName('DB Bench Press')).toBe(normaliseName('Dumbbell Bench Press'))
})

test('L8 normaliseName treats bb and barbell as the same word', () => {
  expect(normaliseName('BB Row')).toBe(normaliseName('Barbell Row'))
})

test('L8 normaliseName treats pushup and push-up as the same word', () => {
  expect(normaliseName('Pushup')).toBe(normaliseName('Push-Up'))
})

test('L8 normaliseName keeps Barbell Squat and Front Barbell Squat different', () => {
  expect(normaliseName('Barbell Squat')).not.toBe(normaliseName('Front Barbell Squat'))
})
