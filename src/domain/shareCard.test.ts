import { expect, test } from 'vitest'
import { buildShareCard } from './shareCard'
import type { Exercise, Session, SetEntry } from '../types'

// E26-T4 [O11]: the share card's data. Hand-derived: Bench 60 x5 earlier, 62.5 now is a new
// heaviest weight (the shared PR rule); Row 40 x10 twice is no PR.

const START = new Date(2026, 9, 12, 10).getTime() // Mon 12 Oct 2026, local
const MIN = 60_000

const CATALOG = new Map<string, Exercise>([
  ['bench', { id: 'bench', name: 'Bench press', weightStep: 2.5, startWeight: 20, bodyweight: false, libraryId: 'Lib_x' }],
  ['row', { id: 'row', name: 'Row', weightStep: 2.5, startWeight: 20, bodyweight: false, libraryId: 'Lib_x' }],
])
const resolve = (id: string): Exercise | undefined => CATALOG.get(id)
const planFor = (): undefined => undefined

function set(exerciseId: string, setIndex: number, weightKg: number, reps: number, kind?: 'warmup'): SetEntry {
  return { exerciseId, setIndex, weightKg, reps, loggedAt: START, ...(kind ? { kind } : {}) }
}

function session(id: string, startedAt: number, minutes: number, entries: SetEntry[]): Session {
  return { id, programId: 'p', workoutId: 'w', startedAt, finishedAt: startedAt + minutes * MIN, entries }
}

const EARLIER = session('s0', START - 7 * 24 * 60 * MIN, 50, [
  set('bench', 0, 60, 5),
  set('bench', 1, 60, 5),
  set('row', 0, 40, 10),
])
const NOW = session('s1', START, 45, [
  set('bench', 0, 20, 10, 'warmup'),
  set('bench', 1, 62.5, 5),
  set('bench', 2, 62.5, 4),
  set('row', 0, 40, 10),
])

test('O11 the card carries the workout name, date, duration, top sets and the PR tag', () => {
  const card = buildShareCard(NOW, [EARLIER], resolve, planFor, 'Push day')
  expect(card.name).toBe('Push day')
  expect(card.dateText).toBe('Mon 12 Oct')
  expect(card.durationText).toBe('45 min')
  expect(card.lifts).toEqual([
    { name: 'Bench press', topSet: '62.5 kg × 5' },
    { name: 'Row', topSet: '40 kg × 10' },
  ])
  expect(card.prs).toEqual([{ name: 'Bench press', kind: 'Heaviest weight' }])
})

test('O11 a first-ever session has top sets and no PR tags', () => {
  const card = buildShareCard(EARLIER, [], resolve, planFor, 'Push day')
  expect(card.lifts.map((l) => l.name)).toEqual(['Bench press', 'Row'])
  expect(card.prs).toEqual([])
})

test('O11 the card excludes warm-up sets from the top set', () => {
  const warmupHeavy = session('s2', START, 30, [set('bench', 0, 100, 1, 'warmup'), set('bench', 1, 50, 8)])
  const card = buildShareCard(warmupHeavy, [], resolve, planFor, 'Push day')
  expect(card.lifts).toEqual([{ name: 'Bench press', topSet: '50 kg × 8' }])
})

test('O11 a missing workout name reads Workout and an hour-plus duration reads h and min', () => {
  const long = session('s3', START, 65, [set('row', 0, 40, 10)])
  const card = buildShareCard(long, [], resolve, planFor, undefined)
  expect(card.name).toBe('Workout')
  expect(card.durationText).toBe('1 h 05 min')
})

test('O11 the card has no photos', () => {
  const card = buildShareCard(NOW, [EARLIER], resolve, planFor, 'Push day')
  expect(JSON.stringify(card).toLowerCase()).not.toContain('photo')
  expect(card.lifts.length).toBeGreaterThan(0)
})
