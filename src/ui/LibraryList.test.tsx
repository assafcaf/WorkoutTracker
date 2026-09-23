import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { LibraryList } from './LibraryList'
import { loadLibrary } from '../data/library'
import type { LibraryExercise } from '../types'

/** A minimal, valid `LibraryExercise` for the synthetic sort-order test below. */
function fixture(
  overrides: Partial<LibraryExercise> & { id: string; name: string },
): LibraryExercise {
  return {
    force: null,
    level: 'beginner',
    mechanic: null,
    equipment: null,
    primaryMuscles: ['chest'],
    secondaryMuscles: [],
    instructions: [],
    category: 'strength',
    images: [],
    ...overrides,
  }
}

/**
 * The name a row shows, read through the row markup `LibraryList` commits to: a child element
 * carrying `.library-row-name`. Not a role-based query -- the name is plain row text, the same
 * way `HistoryList`'s fields are read in `App.test.tsx`.
 */
function rowName(row: HTMLElement): string {
  return (row.querySelector('.library-row-name')?.textContent ?? '').trim()
}

/** The primary muscle a row shows, read from `.library-row-muscle`. */
function rowMuscle(row: HTMLElement): string {
  return (row.querySelector('.library-row-muscle')?.textContent ?? '').trim()
}

// --- L9: all 876 library exercises, sorted by name, name + primary muscle per row ----------
//
// One render of the real 876-entry library (`loadLibrary()`, the same data `App` wires
// through the Exercises tab) -- per the ticket's performance note, the full-876 render happens
// exactly once in this file, and every assertion about it (count, sort order, row content) is
// packed into this one test rather than re-rendered per assertion.

test('L9 LibraryList renders all 876 library exercises, sorted by name, each row showing its name and primary muscle', async () => {
  const library = [...(await loadLibrary()).values()]

  render(<LibraryList library={library} onOpen={() => {}} />)

  const rows = screen.getAllByRole('listitem')
  expect(rows).toHaveLength(876)

  const names = rows.map(rowName)
  expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)))

  // Hand-checked against src/data/library.test.ts's own fixture fact: Barbell_Squat is named
  // "Barbell Squat" with quadriceps as its only primary muscle.
  const squatRow = rows.find((row) => rowName(row) === 'Barbell Squat')
  expect(squatRow, 'no row named "Barbell Squat" was rendered').toBeDefined()
  expect(rowMuscle(squatRow as HTMLElement)).toBe('quadriceps')

  // Hand-checked against the real library fixture (src/data/library/exercises.json): the
  // alphabetically (locale-aware) first and last names.
  expect(names[0]).toBe('3/4 Sit-Up')
  expect(names[names.length - 1]).toBe('Zottman Preacher Curl')
})

// A small synthetic case pinning the sort as locale/case-insensitive rather than a naive
// code-point sort -- a fixture the mostly-capitalized real library data would not itself catch:
// a raw `<` sort would put "Banana Curl" before "ab wheel rollout" (`'B'` < `'a'` in code
// points), which is not alphabetical order.
test('L9 LibraryList sorts case-insensitively rather than by raw code point', () => {
  const library: LibraryExercise[] = [
    fixture({ id: 'b', name: 'Banana Curl', primaryMuscles: ['biceps'] }),
    fixture({ id: 'a', name: 'ab wheel rollout', primaryMuscles: ['abdominals'] }),
  ]

  render(<LibraryList library={library} onOpen={() => {}} />)

  const rows = screen.getAllByRole('listitem')
  expect(rows.map(rowName)).toEqual(['ab wheel rollout', 'Banana Curl'])
})
