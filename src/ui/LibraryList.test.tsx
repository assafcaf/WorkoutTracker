import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

// --- L9/F4: the first 10 of the 876 library exercises, sorted by name, "Show more" reaches
// the rest ------------------------------------------------------------------------------------
//
// RULING (fix-popups, F4): this test used to assert exactly 876 rows -- LibraryList rendered
// every filtered exercise at once, which was the operator's second device-check defect ("show
// 10, Show more"). Rewritten to the first 10, sorted, plus proof that "Show more" reaches every
// one of the 876 -- see src/App.test.tsx's L10 and M9 sections for the equivalent, authorised
// rewrites of the App-level tests that asserted exact counts above 10. One render of the real
// 876-entry library (`loadLibrary()`, the same data `App` wires through the Exercises tab) per
// the ticket's performance note, driven through the whole "Show more" progression in one test
// rather than re-rendered per assertion.

test('L9 LibraryList shows only the first 10 of the 876 library exercises, sorted by name, each row showing its name and primary muscle', async () => {
  const library = [...(await loadLibrary()).values()]

  render(<LibraryList library={library} onOpen={() => {}} gymEquipment={null} />)

  const rows = screen.getAllByRole('listitem')
  expect(rows).toHaveLength(10)

  const names = rows.map(rowName)
  expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)))

  // Hand-checked against the real library fixture (src/data/library/exercises.json): the
  // alphabetically (locale-aware) first name -- the same fact the old, full-876 test pinned.
  expect(names[0]).toBe('3/4 Sit-Up')

  expect(screen.getByRole('button', { name: 'Show more' })).toBeVisible()
})

test('F4 tapping Show more on the full library eventually reaches Barbell Squat and Zottman Preacher Curl, and the button disappears once all 876 show', async () => {
  const user = userEvent.setup()
  const library = [...(await loadLibrary()).values()]

  render(<LibraryList library={library} onOpen={() => {}} gymEquipment={null} />)

  // 876 rows, 10 shown at a time: 86 taps reach 870, one more reaches all 876.
  for (let i = 0; i < 87; i += 1) {
    await user.click(screen.getByRole('button', { name: 'Show more' }))
  }

  const rows = screen.getAllByRole('listitem')
  expect(rows).toHaveLength(876)
  const names = rows.map(rowName)
  expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)))

  // Hand-checked against src/data/library.test.ts's own fixture fact: Barbell_Squat is named
  // "Barbell Squat" with quadriceps as its only primary muscle.
  const squatRow = rows.find((row) => rowName(row) === 'Barbell Squat')
  expect(squatRow, 'no row named "Barbell Squat" was rendered').toBeDefined()
  expect(rowMuscle(squatRow as HTMLElement)).toBe('quadriceps')
  expect(names[names.length - 1]).toBe('Zottman Preacher Curl')

  expect(screen.queryByRole('button', { name: 'Show more' })).toBeNull()
}, 20000)

// A small synthetic fixture, not the real 876-entry library, so the "reveals 10 more each tap"
// mechanic itself is proven quickly and precisely rather than by counting through the real data.

test('F4 tapping Show more reveals 10 more rows each time, and the button disappears once everything is shown', async () => {
  const user = userEvent.setup()
  const library: LibraryExercise[] = Array.from({ length: 25 }, (_, index) =>
    fixture({
      id: `show-more-${index}`,
      name: `Show More Exercise ${String(index).padStart(2, '0')}`,
      primaryMuscles: ['chest'],
    }),
  )

  render(<LibraryList library={library} onOpen={() => {}} gymEquipment={null} />)

  expect(screen.getAllByRole('listitem')).toHaveLength(10)

  await user.click(screen.getByRole('button', { name: 'Show more' }))
  expect(screen.getAllByRole('listitem')).toHaveLength(20)

  await user.click(screen.getByRole('button', { name: 'Show more' }))
  expect(screen.getAllByRole('listitem')).toHaveLength(25)
  expect(screen.queryByRole('button', { name: 'Show more' })).toBeNull()
})

// App passes LibraryList an already-filtered `library` prop (search, muscle, equipment) that
// changes as the trainee types or picks a filter -- per F4, "Search... still filter across all
// 876, then the first 10 of the result show", so the page has to reset, not stay expanded past
// however many the previous filter's result had.

test('F4 a new filtered library prop resets Show more back to its own first 10', async () => {
  const user = userEvent.setup()
  const original: LibraryExercise[] = Array.from({ length: 15 }, (_, index) =>
    fixture({
      id: `orig-${index}`,
      name: `Original Exercise ${String(index).padStart(2, '0')}`,
      primaryMuscles: ['chest'],
    }),
  )
  const narrowed: LibraryExercise[] = Array.from({ length: 12 }, (_, index) =>
    fixture({
      id: `narrowed-${index}`,
      name: `Narrowed Exercise ${String(index).padStart(2, '0')}`,
      primaryMuscles: ['chest'],
    }),
  )

  const { rerender } = render(
    <LibraryList library={original} onOpen={() => {}} gymEquipment={null} />,
  )
  await user.click(screen.getByRole('button', { name: 'Show more' }))
  expect(screen.getAllByRole('listitem')).toHaveLength(15)
  expect(screen.queryByRole('button', { name: 'Show more' })).toBeNull()

  rerender(<LibraryList library={narrowed} onOpen={() => {}} gymEquipment={null} />)

  expect(screen.getAllByRole('listitem')).toHaveLength(10)
  expect(screen.getByRole('button', { name: 'Show more' })).toBeVisible()
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

  render(<LibraryList library={library} onOpen={() => {}} gymEquipment={null} />)

  const rows = screen.getAllByRole('listitem')
  expect(rows.map(rowName)).toEqual(['ab wheel rollout', 'Banana Curl'])
})

// --- E5-T16: the "My gym only" chip ---------------------------------------------------------
//
// A machine exercise (fixture equipment 'machine') alongside a barbell one (fixture equipment
// 'barbell'), narrowed by `gymEquipment` -- a saved list that does not include 'machine'.

const machineExercise = fixture({
  id: 'machine-row',
  name: 'Leg Press Machine',
  equipment: 'machine',
  primaryMuscles: ['quadriceps'],
})
const barbellExercise = fixture({
  id: 'barbell-row',
  name: 'Barbell Row',
  equipment: 'barbell',
  primaryMuscles: ['lats'],
})
const bodyOnlyExercise = fixture({
  id: 'body-only-row',
  name: 'Push-Up',
  equipment: 'body only',
  primaryMuscles: ['chest'],
})

test('S15 with a saved gym equipment list, the My gym only chip is on by default and excludes exercises whose equipment is not in it', () => {
  render(
    <LibraryList
      library={[machineExercise, barbellExercise, bodyOnlyExercise]}
      onOpen={() => {}}
      gymEquipment={['barbell']}
    />,
  )

  expect(screen.getByRole('button', { name: 'My gym only', pressed: true })).toBeInTheDocument()
  expect(screen.queryByText('Leg Press Machine')).toBeNull()
  expect(screen.getByText('Barbell Row')).toBeVisible()
  // `body only` is always available, regardless of what is saved (mirrors alternativesFor).
  expect(screen.getByText('Push-Up')).toBeVisible()
})

test('S15 turning the My gym only chip off lists the excluded equipment again', async () => {
  const user = userEvent.setup()
  render(
    <LibraryList
      library={[machineExercise, barbellExercise]}
      onOpen={() => {}}
      gymEquipment={['barbell']}
    />,
  )
  expect(screen.queryByText('Leg Press Machine')).toBeNull()

  await user.click(screen.getByRole('button', { name: 'My gym only' }))

  expect(screen.getByRole('button', { name: 'My gym only', pressed: false })).toBeInTheDocument()
  expect(screen.getByText('Leg Press Machine')).toBeVisible()
})

// --- M9: `initialMuscles`, the muscle filter a region panel's "Browse exercises" presets ----
//
// E5-T20's contract: when `initialMuscles` is given and non-empty, only exercises with at least
// one of those muscles among their `primaryMuscles` are listed -- an OR across the muscles, so
// upper-back's lats-or-middle-back browse is one filter. A secondary-only match does not count.

const latsExercise = fixture({ id: 'Lat_Pulldown', name: 'Lat Pulldown', primaryMuscles: ['lats'] })
const middleBackExercise = fixture({
  id: 'Seated_Row',
  name: 'Seated Row',
  primaryMuscles: ['middle back'],
})
const chestExercise = fixture({ id: 'Bench_Press', name: 'Bench Press', primaryMuscles: ['chest'] })
const latsSecondaryOnly = fixture({
  id: 'Pullover',
  name: 'Pullover',
  primaryMuscles: ['chest'],
  secondaryMuscles: ['lats'],
})

test('M9 LibraryList with initialMuscles lats and middle back lists exercises primary in either, and no others', () => {
  render(
    <LibraryList
      library={[latsExercise, middleBackExercise, chestExercise, latsSecondaryOnly]}
      onOpen={() => {}}
      gymEquipment={null}
      initialMuscles={['lats', 'middle back']}
    />,
  )

  expect(screen.getAllByRole('listitem').map(rowName)).toEqual(['Lat Pulldown', 'Seated Row'])
})

test('M9 LibraryList with initialMuscles matching nothing shows "No exercises match"', () => {
  render(
    <LibraryList
      library={[latsExercise, chestExercise]}
      onOpen={() => {}}
      gymEquipment={null}
      initialMuscles={['calves']}
    />,
  )

  expect(screen.getByText('No exercises match')).toBeVisible()
  expect(screen.queryAllByRole('listitem')).toHaveLength(0)
})
