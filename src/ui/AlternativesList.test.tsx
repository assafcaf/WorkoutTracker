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

/** The name a row shows, read from `.alternatives-row-name`, the way `LibraryList` rows are. */
function rowName(row: HTMLElement): string {
  return (row.querySelector('.alternatives-row-name')?.textContent ?? '').trim()
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

test('S6 AlternativesList lists every ranked alternative, each offering "Do this instead"', async () => {
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

  expect(screen.getAllByRole('listitem')).toHaveLength(49)

  const hammerCurls = rowNamed('Hammer Curls')
  expect(within(hammerCurls).getByRole('button', { name: 'Do this instead' })).toBeVisible()
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
  expect(screen.getAllByRole('listitem')).toHaveLength(49)

  // "cross body" matches exactly one of the 49 alternatives' names: "Cross Body Hammer Curl".
  await user.type(screen.getByRole('searchbox', { name: /search/i }), 'cross body')

  const rows = screen.getAllByRole('listitem')
  expect(rows).toHaveLength(1)
  expect(rowName(rows[0])).toBe('Cross Body Hammer Curl')
})

test('S7 tapping "Do this instead" on a row calls onChoose with that alternative\'s id', async () => {
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

  await user.click(within(rowNamed('Hammer Curls')).getByRole('button', { name: 'Do this instead' }))

  expect(onChoose).toHaveBeenCalledTimes(1)
  expect(onChoose).toHaveBeenCalledWith('Hammer_Curls')
})
