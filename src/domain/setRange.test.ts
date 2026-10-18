// E21-T6 [O19]: the planned weekly sets of the Program, set against the 10-20 range.
import { beforeAll, expect, test } from 'vitest'
import { plannedAgainstRange, WEEKLY_SET_RANGE } from './setRange'
import { STATS_MUSCLES } from './stats/muscles'
import { loadCatalog, loadPrograms } from '../data/catalog'
import { loadLibrary } from '../data/library'
import type { LibraryExercise, Muscle, Program } from '../types'

const catalog = loadCatalog()
const resolveExercise = (id: string) => catalog.get(id)
const program = loadPrograms().find((p) => p.id === 'assaf-ab-2026') as Program
let library: Map<string, LibraryExercise>
beforeAll(async () => {
  library = await loadLibrary()
})

test('O19 the weekly range is 10 to 20 sets', () => {
  expect(WEEKLY_SET_RANGE).toEqual({ min: 10, max: 20 })
})

test('O19 one row per STATS_MUSCLE, in table order', () => {
  expect(plannedAgainstRange(program, resolveExercise, library).map((r) => r.muscle)).toEqual([...STATS_MUSCLES])
})

test('O19 the A/B Program: Shoulders 21 above, Calves 8 and Abs 3 below, the other nine within', () => {
  const rows = plannedAgainstRange(program, resolveExercise, library)
  const by = Object.fromEntries(rows.map((r) => [r.muscle, r]))
  expect(by.shoulders).toMatchObject({ planned: 21, standing: 'above' })
  expect(by.calves).toMatchObject({ planned: 8, standing: 'below' })
  expect(by.abdominals).toMatchObject({ planned: 3, standing: 'below' })
  const rest = rows.filter((r) => !['shoulders', 'calves', 'abdominals'].includes(r.muscle))
  expect(rest).toHaveLength(9)
  for (const r of rest) expect(r.standing, r.muscle).toBe('within')
})

test('O19 Biceps plans 9.75 sets, shown as 10 and within', () => {
  const biceps = plannedAgainstRange(program, resolveExercise, library).find((r) => r.muscle === 'biceps')
  expect(biceps).toEqual({ muscle: 'biceps', planned: 10, standing: 'within' })
})

// A one-lift Program: `sets` sets of a lift whose chest weight is primary or secondary (x0.5).
function single(sets: number, secondary: boolean) {
  const lib = new Map([
    [
      'lib',
      {
        primaryMuscles: secondary ? [] : ['chest'],
        secondaryMuscles: secondary ? ['chest'] : [],
      } as unknown as LibraryExercise,
    ],
  ])
  const prog = {
    sessionsPerWeek: 1,
    workouts: [{ id: 'w', exercises: [{ exerciseId: 'x', sets }] }],
  } as unknown as Program
  const resolve = () => ({ libraryId: 'lib' }) as never
  return plannedAgainstRange(prog, resolve, lib).find((r) => r.muscle === ('chest' as Muscle))
}

test('O19 exactly 10 and exactly 20 planned sets are within', () => {
  expect(single(10, false)).toEqual({ muscle: 'chest', planned: 10, standing: 'within' })
  expect(single(20, false)).toEqual({ muscle: 'chest', planned: 20, standing: 'within' })
})

test('O19 9 is below and 21 is above', () => {
  expect(single(9, false)?.standing).toBe('below')
  expect(single(21, false)?.standing).toBe('above')
})

test('O19 9.5 rounds half up to 10 and is within', () => {
  expect(single(19, true)).toEqual({ muscle: 'chest', planned: 10, standing: 'within' })
})

test('O19 an empty Program gives 12 rows of 0 planned, all below', () => {
  const empty = { sessionsPerWeek: 3, workouts: [] } as unknown as Program
  const rows = plannedAgainstRange(empty, resolveExercise, library)
  expect(rows).toHaveLength(12)
  for (const r of rows) expect(r).toMatchObject({ planned: 0, standing: 'below' })
})
