import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { loadLibrary } from '../data/library'
import { AlternativesList } from './AlternativesList'
import type { LibraryExercise } from '../types'

// Seated_Dumbbell_Curl is the library entry behind the catalog's seated-biceps-curls
// (src/data/exercises.json), and the real library fixture is loaded the same way `App` loads
// it, so a wrong field in either would fail here rather than mask a real regression. Every
// count and name below is hand-checked against src/data/library/exercises.json through the
// real, already-implemented `alternativesFor` (E5-T5): 49 alternatives share the "biceps"
// primary muscle and a strength/powerlifting category with Seated_Dumbbell_Curl.
async function alternativesFixture() {
  const library = await loadLibrary()
  const target = library.get('Seated_Dumbbell_Curl') as LibraryExercise
  return { library, target }
}

/** The name a row shows, read from `.picker-row-name` (DX-08: the one Exercise list's rows). */
function rowName(row: HTMLElement): string {
  return (row.querySelector('.picker-row-name')?.textContent ?? '').trim()
}

/** The row named `name` exactly, or throws -- `library` has near-duplicate names, so an exact
 * match on the row's own name text is the only unambiguous way to find one. */
function rowNamed(name: string): HTMLElement {
  const rows = screen.getAllByRole('listitem')
  const found = rows.find((row) => rowName(row) === name)
  if (!found) throw new Error(`no row named "${name}" was rendered`)
  return found
}

test('S6 AlternativesList opens with a search box', async () => {
  const { library, target } = await alternativesFixture()

  render(
    <AlternativesList
      target={target}
      library={library}
      gymEquipment={null}
      onChoose={vi.fn()}
      onOpenDetail={vi.fn()}
    />,
  )

  expect(screen.getByRole('searchbox', { name: /search/i })).toBeVisible()
})

test('S6 DX-08 AlternativesList lists every ranked alternative, the whole row its target (no "Do this instead")', async () => {
  const { library, target } = await alternativesFixture()

  render(
    <AlternativesList
      target={target}
      library={library}
      gymEquipment={null}
      onChoose={vi.fn()}
      onOpenDetail={vi.fn()}
    />,
  )

  expect(screen.getAllByRole('listitem')).toHaveLength(134)

  const hammerCurls = rowNamed('Hammer Curls')
  expect(within(hammerCurls).getAllByRole('button')).toHaveLength(1)
  expect(screen.queryByRole('button', { name: /instead/ })).toBeNull()
})

test('S6 typing in the search box narrows the alternatives list by name', async () => {
  const { library, target } = await alternativesFixture()
  const user = userEvent.setup()

  render(
    <AlternativesList
      target={target}
      library={library}
      gymEquipment={null}
      onChoose={vi.fn()}
      onOpenDetail={vi.fn()}
    />,
  )
  expect(screen.getAllByRole('listitem')).toHaveLength(134)

  // "cross body" matches exactly one of the 134 (49 before the exercises-dataset extras) alternatives' names: "Cross Body Hammer Curl".
  await user.type(screen.getByRole('searchbox', { name: /search/i }), 'cross body')

  const rows = screen.getAllByRole('listitem')
  expect(rows).toHaveLength(1)
  expect(rowName(rows[0])).toBe('Cross Body Hammer Curl')
})

test('S7 DX-08 tapping a row calls onChoose with that alternative\'s id', async () => {
  const { library, target } = await alternativesFixture()
  const onChoose = vi.fn()
  const user = userEvent.setup()

  render(
    <AlternativesList
      target={target}
      library={library}
      gymEquipment={null}
      onChoose={onChoose}
      onOpenDetail={vi.fn()}
    />,
  )

  await user.click(within(rowNamed('Hammer Curls')).getByRole('button', { name: 'Hammer Curls' }))

  expect(onChoose).toHaveBeenCalledTimes(1)
  expect(onChoose).toHaveBeenCalledWith('Hammer_Curls')
})

// --- V2-14, DX-08: each row is named by its own Exercise; a browse list opens it ------------------

test('V2-14 DX-08 no two rows share an accessible name, and a browse-only list opens the tapped row', async () => {
  const { library, target } = await alternativesFixture()
  const onOpenDetail = vi.fn()

  render(<AlternativesList target={target} library={library} gymEquipment={null} onOpenDetail={onOpenDetail} limit={11} />)

  const rows = screen.getAllByRole('listitem')
  expect(rows).toHaveLength(11)
  const names = rows.map((row) => within(row).getByRole('button').getAttribute('aria-label'))
  expect(new Set(names).size).toBe(names.length)
  await userEvent.click(within(rows[0]).getByRole('button'))
  expect(onOpenDetail).toHaveBeenCalledWith(expect.any(String))
  expect(onOpenDetail.mock.calls[0][0]).not.toBe('Seated_Dumbbell_Curl')
})

// --- S12: an equipment filter that leaves nothing explains itself -----------------------------
//
// A small hand-built target/library pair, not the real library: EQUIPMENT_ONLY_CANDIDATE is
// the only exercise sharing EQUIPMENT_ONLY_TARGET's primary muscle, and its `equipment` is
// `'machine'` -- not `null`/`'body only'` -- so `gymEquipment={[]}` (a gym with no listed
// equipment) empties `alternativesFor`'s ranked list per its filter (src/domain/alternatives.ts):
// candidate.equipment is neither null/'body only' nor included in `[]`.

const EQUIPMENT_ONLY_TARGET: LibraryExercise = {
  id: 'Equipment_Only_Target',
  name: 'Equipment Only Target',
  force: 'pull',
  level: 'beginner',
  mechanic: 'isolation',
  equipment: null,
  primaryMuscles: ['biceps'],
  secondaryMuscles: [],
  instructions: [],
  category: 'strength',
  images: [],
}

const EQUIPMENT_ONLY_CANDIDATE: LibraryExercise = {
  id: 'Equipment_Only_Candidate',
  name: 'Machine Only Candidate',
  force: 'pull',
  level: 'beginner',
  mechanic: 'isolation',
  equipment: 'machine',
  primaryMuscles: ['biceps'],
  secondaryMuscles: [],
  instructions: [],
  category: 'strength',
  images: [],
}

const EQUIPMENT_ONLY_LIBRARY = new Map<string, LibraryExercise>([
  [EQUIPMENT_ONLY_TARGET.id, EQUIPMENT_ONLY_TARGET],
  [EQUIPMENT_ONLY_CANDIDATE.id, EQUIPMENT_ONLY_CANDIDATE],
])

test('S12 DX-08 when the gym leaves no alternatives, the list says so and "My gym only" is on to turn off', () => {
  render(
    <AlternativesList
      target={EQUIPMENT_ONLY_TARGET}
      library={EQUIPMENT_ONLY_LIBRARY}
      gymEquipment={[]}
      onOpenDetail={vi.fn()}
    />,
  )

  expect(screen.getByText('No exercises match')).toBeVisible()
  expect(screen.getByRole('button', { name: 'My gym only' })).toHaveAttribute('aria-pressed', 'true')
})

test('S12 DX-08 turning "My gym only" off lifts the equipment filter for this list only, showing what it was hiding', async () => {
  const user = userEvent.setup()

  render(
    <AlternativesList
      target={EQUIPMENT_ONLY_TARGET}
      library={EQUIPMENT_ONLY_LIBRARY}
      gymEquipment={[]}
      onOpenDetail={vi.fn()}
    />,
  )
  expect(screen.queryByText('Machine Only Candidate')).not.toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'My gym only' }))

  expect(screen.getByText('Machine Only Candidate')).toBeVisible()
  expect(screen.queryByText('No exercises match')).not.toBeInTheDocument()
})

test('O34 the search box forgives a typo and word order', async () => {
  const { library, target } = await alternativesFixture()
  const user = userEvent.setup()

  render(
    <AlternativesList
      target={target}
      library={library}
      gymEquipment={null}
      onChoose={vi.fn()}
      onOpenDetail={vi.fn()}
    />,
  )

  await user.type(screen.getByRole('searchbox', { name: /search/i }), 'hammer crosz body')

  const rows = screen.getAllByRole('listitem')
  expect(rows.map(rowName)).toContain('Cross Body Hammer Curl')
})
