import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { createServices } from '../../services'
import { db } from '../../storage/db'
import type { LibraryExercise } from '../../types'
import libraryFixture from '../../data/library/exercises.json'
import extraLibraryFixture from '../../data/library/extra-exercises.json'
import { ServicesProvider } from '../ServicesProvider'
import { ExercisesFeature } from './ExercisesFeature'

// O11: ExercisesFeature, run over real services/real bundled data (per the ticket's test
// pattern): search box + LibraryList + DetailOverlay, as its own container. DX-08: the library is
// the one Exercise list (search, "My gym only", My lifts, then All); the muscle and equipment
// selects are gone. The
// filtering and pager mechanics themselves are proven on LibraryList directly
// (src/ui/LibraryList.test.tsx) and were proven wired into App in src/App.test.tsx's L9/L10 --
// this only proves the same wiring holds through ExercisesFeature + real services.

const LIBRARY = [...libraryFixture, ...extraLibraryFixture] as unknown as LibraryExercise[]

// DX-08: the one Exercise list has no pager; it draws its first 60 rows and grows as its end
// scrolls near. An observer that never fires keeps every test on that first chunk.
const FIRST_CHUNK = 60
beforeEach(() => {
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe(): void {}
      disconnect(): void {}
    },
  )
})
afterEach(() => {
  vi.unstubAllGlobals()
})
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
  expect(screen.getAllByRole('listitem')).toHaveLength(FIRST_CHUNK)
  expect(screen.queryByText(/Page \d+ of/)).toBeNull()
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
    expect(rows.length).toBeGreaterThan(10)
    rows.forEach((row) => {
      expect(row.textContent?.toLowerCase()).toContain('lat')
    })
  }, SETTLE)
})

test('O35 the search box forgives a typo and word order', async () => {
  renderFeature()
  const search = await screen.findByRole('searchbox', { name: 'Search exercises' }, SETTLE)
  const user = userEvent.setup()
  await user.type(search, 'curl hammr')

  await waitFor(() => {
    const rows = screen.getAllByRole('listitem')
    expect(rows.some((row) => /hammer curl/i.test(row.textContent ?? ''))).toBe(true)
  }, SETTLE)
})

test('DX-08 the library is the one Exercise list: no muscle or equipment selects, a My gym only chip', async () => {
  renderFeature()
  await screen.findByRole('searchbox', { name: 'Search exercises' }, SETTLE)

  expect(screen.queryByRole('combobox', { name: /muscle/i })).toBeNull()
  expect(screen.queryByRole('combobox', { name: /equipment/i })).toBeNull()
  expect(screen.getByRole('button', { name: 'My gym only' })).toHaveAttribute('aria-pressed', 'true')
})

test('O11 a search matching nothing shows "No exercises match", as today', async () => {
  renderFeature()
  const search = await screen.findByRole('searchbox', { name: 'Search exercises' }, SETTLE)

  await userEvent.setup().type(search, 'zzqqxx')

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
    { selector: '.picker-row-name' },
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
    await screen.findByText('Barbell Squat', { selector: '.picker-row-name' }, SETTLE)
  ).closest('button')
  if (!squatRowButton) throw new Error('the Barbell Squat row is not inside a button')
  await user.click(squatRowButton)
  const dialog = await screen.findByRole('dialog', { name: 'Barbell Squat' }, SETTLE)

  await user.click(within(dialog).getByRole('button', { name: 'Back' }))

  expect(screen.queryByRole('dialog', { name: 'Barbell Squat' })).toBeNull()
})

test('O11 given initialMuscles, ExercisesFeature opens filtered to them', async () => {
  renderFeature(['forearms'])

  // Hand-checked against the real library fixture: more than 10 exercises are forearms primary;
  // every one is listed, in one list (DX-08).
  const forearmsMatches = LIBRARY.filter((exercise) => exercise.primaryMuscles.includes('forearms'))
  expect(forearmsMatches.length).toBeGreaterThan(10)

  await waitFor(() => {
    expect(screen.getAllByRole('listitem')).toHaveLength(Math.min(forearmsMatches.length, FIRST_CHUNK))
  }, SETTLE)
  const forearmsNames = new Set(forearmsMatches.map((exercise) => exercise.name))
  const rowNames = Array.from(document.querySelectorAll('.picker-row-name'))
  expect(rowNames.length).toBe(Math.min(forearmsMatches.length, FIRST_CHUNK))
  rowNames.forEach((nameNode) => {
    expect(forearmsNames.has(nameNode.textContent ?? '')).toBe(true)
  })
  // Not shown: an exercise whose only primary muscle is not forearms.
  expect(screen.queryByText('Barbell Squat', { selector: '.picker-row-name' })).toBeNull()
})

// --- V6-03 step 3: My lifts first ------------------------------------------------------------

const OCT_13 = new Date(2026, 9, 13, 18).getTime()

/** The bundled A/B Program made active, and one finished Session of Deadlift on 13 Oct. */
async function seedLifter(): Promise<void> {
  await db.open()
  await db.sessions.clear()
  await db.settings.clear()
  await db.settings.put({ key: 'activeProgramId', value: 'assaf-ab-2026', updatedAt: OCT_13 })
  await db.sessions.put({
    id: 'past',
    programId: 'assaf-ab-2026',
    workoutId: 'workout-b',
    startedAt: OCT_13,
    finishedAt: OCT_13 + 3_600_000,
    entries: [
      { exerciseId: 'deadlift', setIndex: 1, weightKg: 40, reps: 5, loggedAt: OCT_13, kind: 'warmup' },
      { exerciseId: 'deadlift', setIndex: 2, weightKg: 70, reps: 7, loggedAt: OCT_13 },
    ],
    updatedAt: OCT_13,
  })
}

function renderLifter(onOpenLift?: (id: string) => void, initialMuscles: LibraryExercise['primaryMuscles'] | null = null) {
  const services = createServices({ now: () => OCT_13 + 86_400_000, storageAvailable: true })
  render(
    <ServicesProvider services={services}>
      <ExercisesFeature
        initialMuscles={initialMuscles}
        navigate={vi.fn()}
        onOpenLift={onOpenLift}
        now={() => OCT_13 + 86_400_000}
      />
    </ServicesProvider>,
  )
}

test('V6-03 Exercises opens on My lifts, the Program Exercises with the latest logged first, above the catalog', async () => {
  await seedLifter()
  renderLifter()

  const mine = await screen.findByRole('region', { name: 'My lifts' }, SETTLE)
  const names = within(mine)
    .getAllByRole('button')
    .map((row) => row.querySelector('.picker-row-name')?.textContent)
  expect(names[0]).toBe('Deadlift')
  expect(names).toContain('Back squat')
  expect(names).toHaveLength(14)
  expect(within(mine).getAllByRole('button')[0]).toHaveTextContent('70 × 7 · 13 Oct')

  const headings = screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)
  expect(headings[0]).toBe('My lifts')
  expect(headings[1]).toMatch(/^All exercises \(\d+\)$/)
})

test('V6-03 searching "squat" lists the Program Back squat in My lifts, first on the page', async () => {
  await seedLifter()
  renderLifter()
  const search = await screen.findByRole('searchbox', { name: 'Search exercises' }, SETTLE)
  await screen.findByRole('region', { name: 'My lifts' }, SETTLE)

  await userEvent.setup().type(search, 'squat')

  await waitFor(() => {
    const mine = screen.getByRole('region', { name: 'My lifts' })
    const rows = within(mine).getAllByRole('button')
    expect(rows[0]).toHaveTextContent(/^Back squat/)
    rows.forEach((row) => expect(row.textContent?.toLowerCase()).toContain('squat'))
  }, SETTLE)
  const firstName = document.querySelector('.picker-row-name')
  expect(firstName?.textContent).toBe('Back squat')
})

test('V6-03 a My lifts row calls onOpenLift with its Exercise id', async () => {
  await seedLifter()
  const onOpenLift = vi.fn()
  renderLifter(onOpenLift)
  const mine = await screen.findByRole('region', { name: 'My lifts' }, SETTLE)

  await userEvent.setup().click(within(mine).getByRole('button', { name: /^Back squat/ }))

  expect(onOpenLift).toHaveBeenCalledWith('back-squat')
})

test('V6-03 with no onOpenLift, a My lifts row opens that lift History overlay', async () => {
  await seedLifter()
  renderLifter()
  const mine = await screen.findByRole('region', { name: 'My lifts' }, SETTLE)
  const user = userEvent.setup()

  await user.click(within(mine).getByRole('button', { name: /^Deadlift/ }))

  // The one Lift page: headed by the lift's name, left with a bare ‹ (DX-06, N7).
  const dialog = await screen.findByRole('dialog', { name: 'Deadlift' }, SETTLE)
  expect(dialog).toBeVisible()
  await user.click(within(dialog).getByRole('button', { name: 'Back' }))
  expect(screen.queryByRole('dialog', { name: 'Deadlift' })).toBeNull()
})

test('V6-03 My lifts steps aside while a Region\'s muscles browse the catalog', async () => {
  await seedLifter()
  renderLifter(undefined, ['biceps'])

  await waitFor(() => expect(screen.getAllByRole('listitem').length).toBeGreaterThan(0), SETTLE)
  expect(screen.queryByRole('region', { name: 'My lifts' })).toBeNull()
})
