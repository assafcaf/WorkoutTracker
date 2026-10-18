import { describe, expect, it } from 'vitest'
import type { Exercise, LibraryExercise } from '../../types'
import { mapName } from './mapping'

const ex = (id: string, name: string, libraryId: string): Exercise => ({
  id,
  name,
  weightStep: 2.5,
  startWeight: null,
  bodyweight: false,
  libraryId,
})
const lib = (id: string, name: string): LibraryExercise => ({
  id,
  name,
  force: null,
  level: 'beginner',
  mechanic: null,
  equipment: null,
  primaryMuscles: [],
  secondaryMuscles: [],
  instructions: [],
  category: 'strength',
  images: [],
})
const cat = (...xs: Exercise[]) => new Map(xs.map((x) => [x.id, x]))
const libs = (...xs: LibraryExercise[]) => new Map(xs.map((x) => [x.id, x]))

const CATALOG = cat(
  ex('back-squat', 'Back squat', 'Barbell_Squat'),
  ex('deadlift', 'Deadlift', 'Barbell_Deadlift'),
  ex('db-bench-press', 'DB bench press', 'Dumbbell_Bench_Press'),
  ex('bench-press', 'Bench press', 'Barbell_Bench_Press'),
  ex('custom-belt', 'Belt squat', 'custom-belt'),
)
const LIBRARY = libs(
  lib('Barbell_Squat', 'Barbell Squat'),
  lib('Barbell_Deadlift', 'Barbell Deadlift'),
  lib('Dumbbell_Bench_Press', 'Dumbbell Bench Press'),
  lib('Barbell_Bench_Press', 'Barbell Bench Press'),
  lib('custom-belt', 'Belt squat'),
  lib('Cable_Crossover', 'Cable Crossover'),
)

describe('mapName (O9)', () => {
  it('O9: Squat (Barbell) answers the catalog id, not the library id', () => {
    expect(mapName('Squat (Barbell)', CATALOG, LIBRARY)?.id).toBe('back-squat')
  })
  it('O9: Deadlift (Barbell) answers deadlift', () => {
    expect(mapName('Deadlift (Barbell)', CATALOG, LIBRARY)?.id).toBe('deadlift')
  })
  it('O9: Bench Press (Dumbbell) answers db-bench-press, the equipment word first', () => {
    expect(mapName('Bench Press (Dumbbell)', CATALOG, LIBRARY)?.id).toBe('db-bench-press')
  })
  it('O9: a Custom Exercise Belt squat matches Belt Squat (Machine) by searching again without the equipment word', () => {
    expect(mapName('Belt Squat (Machine)', CATALOG, LIBRARY)?.id).toBe('custom-belt')
  })
  it('O9: a library-only entry answers its library id', () => {
    expect(mapName('Cable Crossover', CATALOG, LIBRARY)?.id).toBe('Cable_Crossover')
  })
  it('O9: a name with no candidate answers null', () => {
    expect(mapName('Zercher Carry Thing', CATALOG, LIBRARY)).toBeNull()
  })
  it('O9: empty maps answer null', () => {
    expect(mapName('Squat (Barbell)', new Map(), new Map())).toBeNull()
  })
  it('O9: a library entry that backs a catalog Exercise never answers its library id', () => {
    const only = libs(lib('Barbell_Squat', 'Barbell Squat'))
    expect(mapName('Squat (Barbell)', cat(ex('back-squat', 'Back squat', 'Barbell_Squat')), only)?.id).toBe('back-squat')
  })
})

describe('mapName ranking (O10)', () => {
  it('O10: a name equal ignoring case, spaces and punctuation is exact', () => {
    expect(mapName('belt  SQUAT', CATALOG, LIBRARY)).toEqual({ id: 'custom-belt', match: 'exact' })
    expect(mapName('Belt-Squat', CATALOG, LIBRARY)).toEqual({ id: 'custom-belt', match: 'exact' })
  })
  it('O10: Belt Squat (Machine) falls back and still reads exact', () => {
    expect(mapName('Belt Squat (Machine)', CATALOG, LIBRARY)).toEqual({ id: 'custom-belt', match: 'exact' })
  })
  it('O10: any other match is a guess', () => {
    expect(mapName('Bench Press (Dumbbell)', CATALOG, LIBRARY)?.match).toBe('guess')
  })
  it('O10: an exact name beats a catalog Exercise, even a library-only one', () => {
    const c = cat(ex('barbell-curl', 'Barbell curl', 'Barbell_Curl'))
    const l = libs(lib('Barbell_Curl', 'Barbell Curl'), lib('Curl', 'Curl'))
    expect(mapName('curl', c, l)).toEqual({ id: 'Curl', match: 'exact' })
  })
  it('O10: a catalog Exercise comes before a library-only entry with fewer uncovered words', () => {
    const c = cat(ex('zh-curl', 'Zottman hammer curl', 'Zottman_Hammer_Curl'))
    const l = libs(lib('Zottman_Hammer_Curl', 'Zottman Hammer Curl'), lib('Curl_Up', 'Curl Up'))
    expect(mapName('curl', c, l)).toEqual({ id: 'zh-curl', match: 'guess' })
  })
  it('O10: fewer uncovered name words come first, ahead of alphabetical order', () => {
    const c = cat(
      ex('hammer-curl-var', 'Hammer curl variation', 'x1'),
      ex('zottman-curl', 'Zottman curl', 'x2'),
    )
    expect(mapName('curl', c, new Map())?.id).toBe('zottman-curl')
  })
  it('O10: equal on everything else, the name decides, whatever the map order', () => {
    const a = ex('alpha', 'Alpha curl', 'x1')
    const b = ex('beta', 'Beta curl', 'x2')
    expect(mapName('curl', cat(b, a), new Map())?.id).toBe('alpha')
    expect(mapName('curl', cat(a, b), new Map())?.id).toBe('alpha')
  })
  it('O10: the same input always answers the same proposal', () => {
    const first = mapName('Bench Press (Dumbbell)', CATALOG, LIBRARY)
    expect(first).not.toBeNull()
    for (let i = 0; i < 3; i++) expect(mapName('Bench Press (Dumbbell)', CATALOG, LIBRARY)).toEqual(first)
  })
})
