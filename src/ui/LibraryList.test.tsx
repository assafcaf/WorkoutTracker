import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { LibraryList, MyLiftsList } from './LibraryList'
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
 * The name a row shows, read through the row markup the one Exercise list commits to (DX-08): a
 * child element carrying `.picker-row-name`.
 */
function rowName(row: HTMLElement): string {
  return (row.querySelector('.picker-row-name')?.textContent ?? '').trim()
}

// --- L9, DX-08: every library exercise in one list, sorted by name, no pager -------------------

test('L9 DX-08 LibraryList lists every one of the library exercises, sorted by name, with no pager', async () => {
  const library = [...(await loadLibrary()).values()]

  render(<LibraryList library={library} onOpen={() => {}} gymEquipment={null} />)

  const rows = screen.getAllByRole('listitem')
  expect(rows).toHaveLength(library.length)
  const names = rows.map(rowName)
  expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)))
  expect(names[0]).toBe('3/4 Sit-Up')
  expect(screen.queryByRole('navigation', { name: 'Pages' })).toBeNull()
  expect(screen.queryByText(/Page \d+ of/)).toBeNull()
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

// --- DX-08: the whole row is the target; the muscle is grey text with no dot ------------------

test('DX-08 with onPick, tapping the row picks it; no row carries a Pick button', async () => {
  const user = userEvent.setup()
  const onPick = vi.fn()
  const onOpen = vi.fn()
  const library: LibraryExercise[] = [
    fixture({ id: 'Barbell_Squat', name: 'Barbell Squat' }),
    fixture({ id: 'Pushups', name: 'Pushups' }),
  ]

  render(<LibraryList library={library} onOpen={onOpen} gymEquipment={null} onPick={onPick} />)

  expect(screen.queryByRole('button', { name: 'Pick' })).toBeNull()
  await user.click(screen.getByRole('button', { name: 'Pushups' }))
  expect(onPick).toHaveBeenCalledWith('Pushups')
  expect(onOpen).not.toHaveBeenCalled()
})

test('DX-08 DX-15 a row shows its primary muscle as grey text, with no Muscle-family dot or tint', () => {
  render(
    <LibraryList
      library={[fixture({ id: 'bench', name: 'Bench Press', primaryMuscles: ['chest'] })]}
      onOpen={() => {}}
      gymEquipment={null}
      lastSets={new Map([['bench', '60 × 8 · 14 Oct']])}
    />,
  )

  const row = screen.getByRole('listitem')
  expect(row.querySelector('.picker-row-meta')).toHaveTextContent('chest · 60 × 8 · 14 Oct')
  expect(row.querySelector('.muscle-dot, [data-family]')).toBeNull()
})

test('DX-08 a lead section ("My lifts") comes first; its rows go to onOpenLead', async () => {
  const onOpenLead = vi.fn()
  const onOpen = vi.fn()
  render(
    <LibraryList
      library={[fixture({ id: 'a', name: 'Alpha' }), fixture({ id: 'b', name: 'Bravo' })]}
      onOpen={onOpen}
      gymEquipment={null}
      lead={{ title: 'My lifts', rows: [{ key: 'back-squat', name: 'Back squat', last: '62.5 × 8 · 13 Oct' }] }}
      onOpenLead={onOpenLead}
    />,
  )

  const headings = screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)
  expect(headings).toEqual(['My lifts', 'All exercises (2)'])
  await userEvent.click(screen.getByRole('button', { name: 'Back squat' }))
  expect(onOpenLead).toHaveBeenCalledWith('back-squat')
  await userEvent.click(screen.getByRole('button', { name: 'Bravo' }))
  expect(onOpen).toHaveBeenCalledWith('b')
})

// --- V6-03 step 3: My lifts ------------------------------------------------------------------

test('V6-03 MyLiftsList shows each lift with its latest top Set, and a tap calls onOpenLift with its id', async () => {
  const onOpenLift = vi.fn()
  const now = new Date(2026, 9, 15)
  render(
    <MyLiftsList
      lifts={[
        {
          exerciseId: 'back-squat',
          name: 'Back squat',
          lastAt: new Date(2026, 9, 13).getTime(),
          top: { exerciseId: 'back-squat', setIndex: 2, weightKg: 62.5, reps: 8, loggedAt: 0 },
        },
        { exerciseId: 'pull-up', name: 'Pull-up', lastAt: null, top: null },
      ]}
      now={now}
      onOpenLift={onOpenLift}
    />,
  )

  const list = screen.getByRole('list', { name: 'My lifts' })
  const squat = within(list).getByRole('button', { name: /^Back squat/ })
  expect(squat.querySelector('.picker-row-name')).toHaveTextContent('Back squat')
  expect(squat).toHaveTextContent('62.5 × 8 · 13 Oct')
  expect(within(list).getByRole('button', { name: /^Pull-up/ })).toHaveTextContent('Not logged yet')

  await userEvent.setup().click(squat)
  expect(onOpenLift).toHaveBeenCalledWith('back-squat')
})
