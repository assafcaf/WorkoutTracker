import { beforeAll, expect, test } from 'vitest'
import { loadLibrary } from '../data/library'
import { editDistance, matchesQuery, normalizeWords, SHORTHAND, typoAllowance } from './search'

let names: string[] = []
beforeAll(async () => {
  names = [...(await loadLibrary()).values()].map((e) => e.name)
})

const matching = (q: string) => names.filter((n) => matchesQuery(n, q))

test('O1 "bech press" matches the bench presses despite one typo', () => {
  const hits = matching('bech press')
  expect(hits).toContain('Dumbbell Bench Press')
  expect(hits).toContain('Barbell Bench Press - Medium Grip')
})

test('O2 typo allowance is 0 for 1-3 letters, 1 for 4-7, 2 for 8+', () => {
  expect(typoAllowance('a')).toBe(0)
  expect(typoAllowance('row')).toBe(0)
  expect(typoAllowance('bech')).toBe(1)
  expect(typoAllowance('dumbell')).toBe(1)
  expect(typoAllowance('dumbbell')).toBe(2)
  expect(typoAllowance('kettlebell')).toBe(2)
})

test('O2 edit distance counts insert, delete, substitute and adjacent transpose as one', () => {
  expect(editDistance('bench', 'bench')).toBe(0)
  expect(editDistance('bech', 'bench')).toBe(1)
  expect(editDistance('bnech', 'bench')).toBe(1)
  expect(editDistance('benck', 'bench')).toBe(1)
  expect(editDistance('dumbell', 'dumbbell')).toBe(1)
  expect(editDistance('dmbll', 'dumbbell')).toBe(3)
})

test('O2 applying the allowance: dumbell matches dumbbell, dmbll does not, raw does not match row', () => {
  expect(matchesQuery('Dumbbell Curl', 'dumbell')).toBe(true)
  expect(matchesQuery('Dumbbell Curl', 'dmbll')).toBe(false)
  expect(matchesQuery('Upright Row', 'raw')).toBe(false)
  expect(matchesQuery('Upright Row', 'row')).toBe(true)
  expect(matchesQuery('Barbell Bench Press', 'bnech')).toBe(true)
})

test('O3 word order does not matter', () => {
  const forward = matching('bench press')
  expect(forward.length).toBeGreaterThan(3)
  expect(matching('press bench').sort()).toEqual(forward.sort())
  expect(matching('press bench')).toContain('Dumbbell Bench Press')
})

test('O4 a query word matches as a prefix of a name word, with typos', () => {
  const hits = matching('dumb curl')
  expect(hits.length).toBeGreaterThan(0)
  for (const n of hits) expect(n.toLowerCase()).toContain('dumbbell')
  expect(matching('dumbel curl')).toContain(hits[0])
  expect(matchesQuery('Dumbbell Bench Press', 'dumbel')).toBe(true)
})

test('O5 hyphens, spaces and trailing s are forgiven', () => {
  for (const q of ['pullup', 'pull up', 'pull-ups']) {
    const hits = matching(q)
    expect(hits).toContain('Pullups')
    expect(hits).toContain('V-Bar Pullup')
    expect(hits).toContain('Band Assisted Pull-Up')
  }
  expect(matching('lateral raises')).toContain('Side Lateral Raise')
  expect(matchesQuery('Lat Pull-Down', 'pulldown')).toBe(true)
})

test('O5 normalizeWords splits on non-alphanumerics and strips one trailing s from words over 3 letters', () => {
  expect(normalizeWords('Pull-Up (Wide)/Grip')).toEqual(['pull', 'up', 'wide', 'grip'])
  expect(normalizeWords('Lateral Raises')).toEqual(['lateral', 'raise'])
  expect(normalizeWords('pullups')).toEqual(['pullup'])
  expect(normalizeWords('abs')).toEqual(['abs'])
  expect(normalizeWords('Press')).toEqual(['pres'])
  expect(normalizeWords('  - ')).toEqual([])
})

test('O6 shorthand expands on the query side', () => {
  expect(matching('db bench')).toContain('Dumbbell Bench Press')
  expect(matching('rdl')).toContain('Romanian Deadlift')
  expect(matching('sldl')).toContain('Stiff-Legged Barbell Deadlift')
  expect(matching('ez curl')).toContain('EZ-Bar Curl')
})

test('O6 the typed shorthand still matches literally, and keys are never typo-matched', () => {
  expect(matchesQuery('DB Row', 'db')).toBe(true)
  expect(matchesQuery('Dumbbell Curl', 'db')).toBe(true)
  expect(matchesQuery('Dumbbell Curl', 'dbb')).toBe(false)
})

test('O6 the shorthand table holds the spec entries', () => {
  expect(SHORTHAND.db).toBe('dumbbell')
  expect(SHORTHAND.bb).toBe('barbell')
  expect(SHORTHAND.kb).toBe('kettlebell')
  expect(SHORTHAND.ez).toBe('ez bar')
  expect(SHORTHAND.ohp).toBe('overhead press')
  expect(SHORTHAND.rdl).toBe('romanian deadlift')
  expect(SHORTHAND.sldl).toBe('stiff legged deadlift')
  expect(SHORTHAND.bw).toBe('bodyweight')
  expect(SHORTHAND.tri).toBe('triceps')
  expect(SHORTHAND.tris).toBe('triceps')
  expect(SHORTHAND.bi).toBe('biceps')
  expect(SHORTHAND.bis).toBe('biceps')
  expect(SHORTHAND.delt).toBe('deltoid')
  expect(SHORTHAND.delts).toBe('deltoid')
  expect(SHORTHAND.ext).toBe('extension')
})

test('O7 every query word must match', () => {
  expect(matching('bench zzzz')).toEqual([])
  expect(matchesQuery('Dumbbell Bench Press', 'bench zzzz')).toBe(false)
})

test('O7 an empty or whitespace-only query matches every name', () => {
  expect(matching('').length).toBe(names.length)
  expect(matching('   ').length).toBe(names.length)
  expect(matchesQuery('Anything', '')).toBe(true)
})
