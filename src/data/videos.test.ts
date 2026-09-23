import { expect, test } from 'vitest'
import exercisesJson from './exercises.json'
import { loadLibrary, loadVideos } from './library'
import type { Exercise } from '../types'

// The catalog fixture, independent of loadCatalog(), per E5-T7's Interfaces section.
const catalogSeed = exercisesJson as Exercise[]

function catalogLibraryId(catalogId: string): string {
  const exercise = catalogSeed.find((entry) => entry.id === catalogId)
  if (!exercise) throw new Error(`fixture bug: no catalog exercise ${catalogId}`)
  return exercise.libraryId
}

// Hand-checked against the corrected harvest (scripts/data/ms-pages.json) plus the confirmed
// override pins from the E5-T7 interface-correction ruling: the 10 catalog exercises with a
// certain Muscle & Strength match, keyed by their catalog id.
const CATALOG_IDS_WITH_A_CERTAIN_MATCH = [
  'back-squat',
  'lunges',
  'db-bench-press',
  'push-ups',
  'lateral-raises',
  'deadlift',
  'narrow-grip-pull-down',
  'machine-row',
  'hyper-extension',
  'seated-biceps-curls',
]

// The 4 catalog exercises the ruling names as having no certain M&S match.
const CATALOG_IDS_WITH_NO_MATCH = [
  'machine-shoulder-press',
  'cable-push-down',
  'assisted-pull-ups',
  'face-pull',
]

// --- L4: shape of every videos.json entry ---------------------------------------------------

test('L4 loadVideos keys every entry by a library id', async () => {
  const library = await loadLibrary()
  const videos = await loadVideos()

  const unknownKeys = [...videos.keys()].filter((id) => !library.has(id))
  expect(unknownKeys).toEqual([])
})

test('L4 loadVideos gives every entry a provider of youtube or vimeo', async () => {
  const videos = await loadVideos()

  const offList = [...videos.values()].filter(
    (video) => video.provider !== 'youtube' && video.provider !== 'vimeo',
  )
  expect(offList).toEqual([])
})

test('L4 loadVideos gives every youtube entry an id matching ^[\\w-]{11}$', async () => {
  const videos = await loadVideos()

  const bad = [...videos.entries()]
    .filter(([, video]) => video.provider === 'youtube')
    .filter(([, video]) => !/^[\w-]{11}$/.test(video.id))
    .map(([id]) => id)
  expect(bad).toEqual([])
})

test('L4 loadVideos gives every vimeo entry an id matching ^\\d+$', async () => {
  const videos = await loadVideos()

  const bad = [...videos.entries()]
    .filter(([, video]) => video.provider === 'vimeo')
    .filter(([, video]) => !/^\d+$/.test(video.id))
    .map(([id]) => id)
  expect(bad).toEqual([])
})

test('L4 loadVideos gives every entry a muscleandstrength.com exercises page as its source', async () => {
  const videos = await loadVideos()

  const bad = [...videos.entries()]
    .filter(
      ([, video]) => !/^https:\/\/www\.muscleandstrength\.com\/exercises\/[^/]+\.html$/.test(video.source),
    )
    .map(([id]) => id)
  expect(bad).toEqual([])
})

test('L4 loadVideos loads at least one entry', async () => {
  const videos = await loadVideos()

  expect(videos.size).toBeGreaterThan(0)
})

// --- L5: catalog coverage and the Barbell_Squat pin -----------------------------------------

test('L5 loadVideos gives every catalog exercise with a certain match a video', async () => {
  const videos = await loadVideos()

  const missing = CATALOG_IDS_WITH_A_CERTAIN_MATCH.filter(
    (catalogId) => !videos.has(catalogLibraryId(catalogId)),
  )
  expect(missing).toEqual([])
})

test('L5 loadVideos gives none of the 4 catalog exercises with no certain match a video', async () => {
  const videos = await loadVideos()

  const wronglyHasVideo = CATALOG_IDS_WITH_NO_MATCH.filter((catalogId) =>
    videos.has(catalogLibraryId(catalogId)),
  )
  expect(wronglyHasVideo).toEqual([])
})

test('L5 loadVideos gives Barbell_Squat a youtube video with id R2dMsNhN3DE', async () => {
  const videos = await loadVideos()

  const squat = videos.get('Barbell_Squat')
  expect(squat).toEqual({
    provider: 'youtube',
    id: 'R2dMsNhN3DE',
    source: 'https://www.muscleandstrength.com/exercises/squat.html',
  })
})
