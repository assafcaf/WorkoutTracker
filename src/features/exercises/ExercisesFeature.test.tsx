import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { createServices } from '../../services'
import type { LibraryExercise } from '../../types'
import libraryFixture from '../../data/library/exercises.json'
import { ServicesProvider } from '../ServicesProvider'
import { ExercisesFeature } from './ExercisesFeature'

// O11: ExercisesFeature, run over real services/real bundled data (per the ticket's test
// pattern), reproduces what App.tsx's 'exercises' view branch does today (src/App.tsx, search
// box + muscle/equipment filters + LibraryList + DetailOverlay), now as its own container. The
// filtering and pager mechanics themselves are proven on LibraryList directly
// (src/ui/LibraryList.test.tsx) and were proven wired into App in src/App.test.tsx's L9/L10 --
// this only proves the same wiring holds through ExercisesFeature + real services.

const LIBRARY = libraryFixture as unknown as LibraryExercise[]
const NOW = 1_700_000_000_000
const SETTLE = { timeout: 2000 }

function renderFeature(initialMuscles: LibraryExercise['primaryMuscles'] | null = null) {
  const services = createServices({ now: () => NOW, storageAvailable: true })
  const navigate = vi.fn()
  render(
    <ServicesProvider services={services}>
      <ExercisesFeature initialMuscles={initialMuscles} navigate={navigate} />
    </ServicesProvider>,
  )
  return { navigate }
}

test('O11 ExercisesFeature shows the library with a search box, as today', async () => {
  renderFeature()

  expect(await screen.findByRole('searchbox', { name: 'Search exercises' }, SETTLE)).toBeVisible()
  // Hand-checked against the real library fixture's alphabetically (locale-aware) first name,
  // per L9 in src/App.test.tsx.
  expect(await screen.findByText('3/4 Sit-Up', {}, SETTLE)).toBeVisible()
  expect(screen.getAllByRole('listitem')).toHaveLength(10)
})

test('O11 the search box narrows the library by name, as today', async () => {
  renderFeature()
  const search = await screen.findByRole('searchbox', { name: 'Search exercises' }, SETTLE)

  // Hand-checked against the real library fixture: 36 names contain "lat", case-insensitively --
  // above the 10-per-page cap, so only the first 10 show (per L10 in src/App.test.tsx).
  const latMatches = LIBRARY.filter((exercise) => exercise.name.toLowerCase().includes('lat'))
  expect(latMatches.length).toBeGreaterThan(10)

  const user = userEvent.setup()
  await user.type(search, 'lat')

  await waitFor(() => {
    const rows = screen.getAllByRole('listitem')
    expect(rows).toHaveLength(10)
    rows.forEach((row) => {
      expect(row.textContent?.toLowerCase()).toContain('lat')
    })
  }, SETTLE)
})

test('O11 the muscle and equipment filters narrow the library further, as today', async () => {
  renderFeature()
  await screen.findByRole('searchbox', { name: 'Search exercises' }, SETTLE)

  // Hand-checked against the real library fixture: 24 exercises are biceps primary with
  // dumbbell equipment -- above the 10-per-page cap (per L10 in src/App.test.tsx).
  const bicepsDumbbellMatches = LIBRARY.filter(
    (exercise) => exercise.primaryMuscles.includes('biceps') && exercise.equipment === 'dumbbell',
  )
  expect(bicepsDumbbellMatches.length).toBeGreaterThan(10)

  const user = userEvent.setup()
  await user.selectOptions(screen.getByRole('combobox', { name: /muscle/i }), 'biceps')
  await user.selectOptions(screen.getByRole('combobox', { name: /equipment/i }), 'dumbbell')

  await waitFor(() => {
    expect(screen.getAllByRole('listitem')).toHaveLength(10)
  }, SETTLE)
})

test('O11 a filter combination matching nothing shows "No exercises match", as today', async () => {
  renderFeature()
  const search = await screen.findByRole('searchbox', { name: 'Search exercises' }, SETTLE)

  const user = userEvent.setup()
  await user.selectOptions(screen.getByRole('combobox', { name: /muscle/i }), 'biceps')
  await user.selectOptions(screen.getByRole('combobox', { name: /equipment/i }), 'dumbbell')
  await user.type(search, 'lat')

  // Hand-checked against the real library fixture: no biceps/dumbbell exercise's name contains
  // "lat" (per L10 in src/App.test.tsx).
  expect(await screen.findByText('No exercises match', {}, SETTLE)).toBeVisible()
  expect(screen.queryAllByRole('listitem')).toHaveLength(0)
})

test('O11 tapping a row on the Exercises tab opens DetailOverlay for it, as today', async () => {
  renderFeature()
  const search = await screen.findByRole('searchbox', { name: 'Search exercises' }, SETTLE)

  const user = userEvent.setup()
  await user.type(search, 'Barbell Squat')
  // "Barbell Squat To A Bench" is also in the real library, so an exact match on the row's own
  // name is needed (per L14 in src/App.test.tsx).
  const squatRowName = await screen.findByText(
    'Barbell Squat',
    { selector: '.library-row-name' },
    SETTLE,
  )
  const squatRowButton = squatRowName.closest('button')
  if (!squatRowButton) throw new Error('the Barbell Squat row is not inside a button')

  await user.click(squatRowButton)

  const dialog = await screen.findByRole('dialog', { name: 'Barbell Squat' }, SETTLE)
  expect(dialog).toBeVisible()
  // The overlay sits over the tab rather than replacing it (per F1 in src/App.test.tsx).
  expect(screen.getByRole('searchbox', { name: 'Search exercises' })).toBeInTheDocument()
})

test('O11 DetailOverlay Back closes it, returning to the Exercises tab', async () => {
  renderFeature()
  const search = await screen.findByRole('searchbox', { name: 'Search exercises' }, SETTLE)
  const user = userEvent.setup()
  await user.type(search, 'Barbell Squat')
  const squatRowButton = (
    await screen.findByText('Barbell Squat', { selector: '.library-row-name' }, SETTLE)
  ).closest('button')
  if (!squatRowButton) throw new Error('the Barbell Squat row is not inside a button')
  await user.click(squatRowButton)
  const dialog = await screen.findByRole('dialog', { name: 'Barbell Squat' }, SETTLE)

  await user.click(within(dialog).getByRole('button', { name: 'Back' }))

  expect(screen.queryByRole('dialog', { name: 'Barbell Squat' })).toBeNull()
})

test('O11 given initialMuscles, ExercisesFeature opens filtered to them', async () => {
  renderFeature(['forearms'])

  // Hand-checked against the real library fixture: 25 exercises are forearms primary -- above
  // the 10-per-page cap (per M9 in src/App.test.tsx).
  const forearmsMatches = LIBRARY.filter((exercise) => exercise.primaryMuscles.includes('forearms'))
  expect(forearmsMatches.length).toBeGreaterThan(10)

  await waitFor(() => {
    expect(screen.getAllByRole('listitem')).toHaveLength(10)
  }, SETTLE)
  const forearmsNames = new Set(forearmsMatches.map((exercise) => exercise.name))
  const rowNames = Array.from(document.querySelectorAll('.library-row-name'))
  expect(rowNames.length).toBe(10)
  rowNames.forEach((nameNode) => {
    expect(forearmsNames.has(nameNode.textContent ?? '')).toBe(true)
  })
  // Not shown: an exercise whose only primary muscle is not forearms.
  expect(screen.queryByText('Barbell Squat', { selector: '.library-row-name' })).toBeNull()
})
