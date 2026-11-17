import { expect, test } from 'vitest'
import { loadLibrary } from './library'
import { matchesExercise } from '../domain/search'

// The names a trainee types at the gym must find the library entry they mean (A/B Hypertrophy,
// 2026-11-17): each query below found nothing, or only a different exercise, before
// `library/gym-names.json`.

const FINDS: [query: string, libraryId: string][] = [
  ['Reverse lunge', 'Dumbbell_Rear_Lunge'],
  ['Goblet squat', 'Goblet_Squat'],
  ['Explosive push ups', 'Plyo_Push-up'],
  ['Clap push up', 'Plyo_Push-up'],
  ['Machine dips', 'Dip_Machine'],
  ['Single DB shoulder press', 'Dumbbell_One-Arm_Shoulder_Press'],
  ['Y raises', 'Front_Incline_Dumbbell_Raise'],
  ['Rope push down', 'Triceps_Pushdown_-_Rope_Attachment'],
  ['KB swing', 'One-Arm_Kettlebell_Swings'],
  ['Single arm DB row', 'One-Arm_Dumbbell_Row'],
  ['Rear delt fly', 'Reverse_Machine_Flyes'],
  ['DB pull over', 'Straight-Arm_Dumbbell_Pullover'],
  ['Alternate DB curls', 'Dumbbell_Alternate_Bicep_Curl'],
  ['Pull up machine', 'Band_Assisted_Pull-Up'],
]

test.each(FINDS)('G1 searching "%s" finds %s', async (query, libraryId) => {
  const library = [...(await loadLibrary()).values()]

  const found = library.filter((entry) => matchesExercise(entry, query)).map((entry) => entry.id)

  expect(found).toContain(libraryId)
})

test('G2 a gym name replaces the library name and keeps the old one searchable', async () => {
  const library = await loadLibrary()

  const rope = library.get('Triceps_Pushdown_-_Rope_Attachment')
  expect(rope?.name).toBe('Rope push-down')
  expect(rope?.aliases).toContain('Triceps Pushdown - Rope Attachment')
  expect(matchesExercise(rope!, 'triceps pushdown rope')).toBe(true)
})

test('G2 an entry with no gym name keeps its library name and no aliases', async () => {
  const library = await loadLibrary()

  const squat = library.get('Barbell_Squat')
  expect(squat?.name).toBe('Barbell Squat')
  expect(squat?.aliases).toBeUndefined()
})

test('G3 every gym-names entry names a library id', async () => {
  const library = await loadLibrary()
  const { default: gymNames } = await import('./library/gym-names.json')

  expect(Object.keys(gymNames).filter((id) => !library.has(id))).toEqual([])
})
