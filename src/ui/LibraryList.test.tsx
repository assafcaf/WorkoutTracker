import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
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

// --- L9: the first 10 of the 876 library exercises, sorted by name ---------------------------
//
// RULING (fix-popups, F4): this test used to assert exactly 876 rows -- LibraryList rendered
// every filtered exercise at once, which was the operator's second device-check defect ("show
// 10, Show more"). Rewritten to the first 10, sorted -- see src/App.test.tsx's L10 and M9
// sections for the equivalent, authorised rewrites of the App-level tests that asserted exact
// counts above 10.
//
// RULING (fix-the-ui-audit, O16-O18): the "Show more" progression this test used to also check
// (tapping through all 876, a synthetic 10-more-per-tap case, and the prop-reset case) is
// replaced by a Previous/Next pager -- see the O16-O18 section below.

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

// --- O16-O18: the Previous/Next pager replacing "Show more" ---------------------------------
//
// A synthetic 25-row fixture -- three pages of 10, 10 and 5 -- names padded so alphabetical
// order matches fixture order.

function pagerFixtures(count: number, prefix: string): LibraryExercise[] {
  return Array.from({ length: count }, (_, index) =>
    fixture({
      id: `${prefix}-${index}`,
      name: `${prefix} Exercise ${String(index).padStart(2, '0')}`,
      primaryMuscles: ['chest'],
    }),
  )
}

/** The pager `<nav>` O16's Interfaces section commits to, scoped so button/text queries inside
 * it cannot match some other part of the page. */
function pagerNav(): HTMLElement {
  return screen.getByRole('navigation', { name: 'Pages' })
}

test('O16 given 25 matching exercises, the Exercises tab shows rows 1-10, "Page 1 of 3", Previous disabled, Next enabled, and no Show more button', () => {
  const library = pagerFixtures(25, 'Page')

  render(<LibraryList library={library} onOpen={() => {}} gymEquipment={null} />)

  const rows = screen.getAllByRole('listitem')
  expect(rows.map(rowName)).toEqual([
    'Page Exercise 00',
    'Page Exercise 01',
    'Page Exercise 02',
    'Page Exercise 03',
    'Page Exercise 04',
    'Page Exercise 05',
    'Page Exercise 06',
    'Page Exercise 07',
    'Page Exercise 08',
    'Page Exercise 09',
  ])

  const nav = pagerNav()
  expect(within(nav).getByText('Page 1 of 3')).toBeVisible()
  expect(within(nav).getByRole('button', { name: 'Previous' })).toBeDisabled()
  expect(within(nav).getByRole('button', { name: 'Next' })).toBeEnabled()

  expect(screen.queryByRole('button', { name: 'Show more' })).toBeNull()
})

test('O17 given the page-1 list, pressing Next twice shows rows 21-25 and "Page 3 of 3" with Next disabled', async () => {
  const user = userEvent.setup()
  const library = pagerFixtures(25, 'Page')

  render(<LibraryList library={library} onOpen={() => {}} gymEquipment={null} />)

  const nav = pagerNav()
  await user.click(within(nav).getByRole('button', { name: 'Next' }))
  await user.click(within(nav).getByRole('button', { name: 'Next' }))

  expect(screen.getAllByRole('listitem').map(rowName)).toEqual([
    'Page Exercise 20',
    'Page Exercise 21',
    'Page Exercise 22',
    'Page Exercise 23',
    'Page Exercise 24',
  ])
  expect(within(nav).getByText('Page 3 of 3')).toBeVisible()
  expect(within(nav).getByRole('button', { name: 'Next' })).toBeDisabled()
})

test('O17 given page 3, pressing Previous shows rows 11-20', async () => {
  const user = userEvent.setup()
  const library = pagerFixtures(25, 'Page')

  render(<LibraryList library={library} onOpen={() => {}} gymEquipment={null} />)

  const nav = pagerNav()
  await user.click(within(nav).getByRole('button', { name: 'Next' }))
  await user.click(within(nav).getByRole('button', { name: 'Next' }))

  await user.click(within(nav).getByRole('button', { name: 'Previous' }))

  expect(screen.getAllByRole('listitem').map(rowName)).toEqual([
    'Page Exercise 10',
    'Page Exercise 11',
    'Page Exercise 12',
    'Page Exercise 13',
    'Page Exercise 14',
    'Page Exercise 15',
    'Page Exercise 16',
    'Page Exercise 17',
    'Page Exercise 18',
    'Page Exercise 19',
  ])
})

// O18: on page 3, a result change (here, a new filtered `library` prop -- App's search/muscle/
// equipment filters, per the ticket's Files note) returns the list to page 1.

test('O18 given the list on page 3, a new filtered library prop returns the list to page 1', async () => {
  const user = userEvent.setup()
  const original = pagerFixtures(25, 'Page')
  const narrowed = pagerFixtures(12, 'Narrowed')

  const { rerender } = render(
    <LibraryList library={original} onOpen={() => {}} gymEquipment={null} />,
  )
  const nav = pagerNav()
  await user.click(within(nav).getByRole('button', { name: 'Next' }))
  await user.click(within(nav).getByRole('button', { name: 'Next' }))
  expect(within(nav).getByText('Page 3 of 3')).toBeVisible()

  rerender(<LibraryList library={narrowed} onOpen={() => {}} gymEquipment={null} />)

  expect(screen.getAllByRole('listitem').map(rowName)).toEqual([
    'Narrowed Exercise 00',
    'Narrowed Exercise 01',
    'Narrowed Exercise 02',
    'Narrowed Exercise 03',
    'Narrowed Exercise 04',
    'Narrowed Exercise 05',
    'Narrowed Exercise 06',
    'Narrowed Exercise 07',
    'Narrowed Exercise 08',
    'Narrowed Exercise 09',
  ])
  expect(within(pagerNav()).getByText('Page 1 of 2')).toBeVisible()
})

// O18: the same reset, triggered by toggling "My gym only" -- a component-owned state change
// rather than a new `library` prop, so the reset must be driven off the filtered/sorted result
// itself, not off prop identity.

test('O18 given the list on page 3, turning My gym only off (changing the result) returns the list to page 1', async () => {
  const user = userEvent.setup()
  // 25 always-visible rows (equipment null passes the gym filter regardless), sorting before
  // 15 machine rows that only appear once "My gym only" is off and `gymEquipment` (['barbell'])
  // no longer excludes them -- so toggling changes the result from 25 rows (3 pages) to 40 (4
  // pages) without touching the first 10 names.
  const always = pagerFixtures(25, 'Always')
  const machineOnly = Array.from({ length: 15 }, (_, index) =>
    fixture({
      id: `machine-${index}`,
      name: `Zz Machine Exercise ${String(index).padStart(2, '0')}`,
      equipment: 'machine',
      primaryMuscles: ['chest'],
    }),
  )

  const nav = pagerNav
  render(
    <LibraryList
      library={[...always, ...machineOnly]}
      onOpen={() => {}}
      gymEquipment={['barbell']}
    />,
  )
  await user.click(within(nav()).getByRole('button', { name: 'Next' }))
  await user.click(within(nav()).getByRole('button', { name: 'Next' }))
  expect(within(nav()).getByText('Page 3 of 3')).toBeVisible()

  await user.click(screen.getByRole('button', { name: 'My gym only' }))

  expect(screen.getAllByRole('listitem').map(rowName)).toEqual([
    'Always Exercise 00',
    'Always Exercise 01',
    'Always Exercise 02',
    'Always Exercise 03',
    'Always Exercise 04',
    'Always Exercise 05',
    'Always Exercise 06',
    'Always Exercise 07',
    'Always Exercise 08',
    'Always Exercise 09',
  ])
  expect(within(nav()).getByText('Page 1 of 4')).toBeVisible()
})

// --- O19: no pager for 10 or fewer matches; "No exercises match" carries the empty class ------

test('O19 given 10 or fewer matching exercises, no pager is rendered', () => {
  const library = pagerFixtures(10, 'Page')

  render(<LibraryList library={library} onOpen={() => {}} gymEquipment={null} />)

  expect(screen.getAllByRole('listitem')).toHaveLength(10)
  expect(screen.queryByRole('navigation', { name: 'Pages' })).toBeNull()
})

test('O19 given no matching exercises, "No exercises match" is shown with the library-empty class', () => {
  render(<LibraryList library={[]} onOpen={() => {}} gymEquipment={null} />)

  const message = screen.getByText('No exercises match')
  expect(message).toBeVisible()
  expect(message).toHaveClass('library-empty')
  expect(screen.queryByRole('navigation', { name: 'Pages' })).toBeNull()
})

// --- O20: Previous/Next scrolls the list's top into view ---------------------------------------

test('O20 pressing Next scrolls the list into view', async () => {
  const user = userEvent.setup()
  const library = pagerFixtures(25, 'Page')
  const scrollIntoView = vi.fn()
  Element.prototype.scrollIntoView = scrollIntoView

  render(<LibraryList library={library} onOpen={() => {}} gymEquipment={null} />)

  const nav = pagerNav()
  await user.click(within(nav).getByRole('button', { name: 'Next' }))

  expect(scrollIntoView).toHaveBeenCalled()
})

test('O20 pressing Previous scrolls the list into view', async () => {
  const user = userEvent.setup()
  const library = pagerFixtures(25, 'Page')
  const scrollIntoView = vi.fn()
  Element.prototype.scrollIntoView = scrollIntoView

  render(<LibraryList library={library} onOpen={() => {}} gymEquipment={null} />)

  const nav = pagerNav()
  await user.click(within(nav).getByRole('button', { name: 'Next' }))
  scrollIntoView.mockClear()
  await user.click(within(nav).getByRole('button', { name: 'Previous' }))

  expect(scrollIntoView).toHaveBeenCalled()
})
