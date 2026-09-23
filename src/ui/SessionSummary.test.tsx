import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { SessionSummary } from './SessionSummary'
import type { Region } from '../domain/muscles'
import type { Exercise, LibraryExercise, Muscle, Session, SetEntry } from '../types'

// E5-T20 [M16] and [M9], on the summary itself. Synthetic catalog and library entries, so every
// count below is hand-derived from the fixtures:
//
//   Pulldown x4: lats primary (1), biceps secondary (0.5)
//   Row x2:      middle back primary (1), biceps and lats secondary (0.5 each)
//   Squat x1:    quadriceps primary (1), glutes secondary (0.5)
//   ghost x1:    resolves to nothing, so it counts nowhere
//
//   lats 4 + 1 = 5, middle back 2      -> upper-back 7   (session band 3; week band would be 1)
//   biceps 2 + 1 = 3                   -> biceps 3       (session band 2)
//   quadriceps 1                       -> quadriceps 1   (session band 1)
//   glutes 0.5                         -> gluteal 0.5    (session band 1)
//   chest 0                            -> chest 0        (band 0)
//
//   upper-back's contributors: Pulldown 4 (lats), Row 2 x (1 middle back + 0.5 lats) = 3.
//
// The summary is a `role="dialog"` named "Session summary", with a "Done" button that calls
// `onClose`. A tapped region opens `RegionPanel` (a dialog named by the region id) inside it.

const BASE = 1_700_000_000_000

function libraryEntry(
  id: string,
  primaryMuscles: Muscle[],
  secondaryMuscles: Muscle[],
): LibraryExercise {
  return {
    id,
    name: id,
    force: null,
    level: 'beginner',
    mechanic: null,
    equipment: null,
    primaryMuscles,
    secondaryMuscles,
    instructions: [],
    category: 'strength',
    images: [],
  }
}

function catalogEntry(id: string, name: string, libraryId: string): Exercise {
  return {
    id,
    name,
    weightStep: 2.5,
    startWeight: 20,
    bodyweight: false,
    invertProgress: false,
    libraryId,
  }
}

const LIBRARY = new Map<string, LibraryExercise>([
  ['Lib_Pulldown', libraryEntry('Lib_Pulldown', ['lats'], ['biceps'])],
  ['Lib_Row', libraryEntry('Lib_Row', ['middle back'], ['biceps', 'lats'])],
  ['Lib_Squat', libraryEntry('Lib_Squat', ['quadriceps'], ['glutes'])],
])

const CATALOG = new Map<string, Exercise>([
  ['pulldown', catalogEntry('pulldown', 'Pulldown', 'Lib_Pulldown')],
  ['row', catalogEntry('row', 'Row', 'Lib_Row')],
  ['squat', catalogEntry('squat', 'Squat', 'Lib_Squat')],
])

const resolve = (id: string): Exercise | undefined => CATALOG.get(id)

function sets(exerciseId: string, count: number, offset: number): SetEntry[] {
  return Array.from({ length: count }, (_, index) => ({
    exerciseId,
    setIndex: index + 1,
    weightKg: 40,
    reps: 10,
    loggedAt: BASE + offset + index,
  }))
}

const SESSION: Session = {
  id: 'summary-session',
  programId: 'assaf-ab-2026',
  workoutId: 'workout-b',
  startedAt: BASE,
  finishedAt: BASE + 3_600_000,
  entries: [
    ...sets('pulldown', 4, 100),
    ...sets('row', 2, 200),
    ...sets('squat', 1, 300),
    ...sets('ghost', 1, 400),
  ],
}

function renderSummary(session: Session = SESSION) {
  const onClose = vi.fn()
  const onBrowse = vi.fn()
  render(
    <SessionSummary
      session={session}
      resolve={resolve}
      library={LIBRARY}
      onClose={onClose}
      onBrowse={onBrowse}
    />,
  )
  return { onClose, onBrowse }
}

function summaryDialog(): HTMLElement {
  return screen.getByRole('dialog', { name: 'Session summary' })
}

/** Every shape the summary draws for `region`. */
function regionShapes(region: Region): Element[] {
  return [...summaryDialog().querySelectorAll(`[data-region="${region}"]`)]
}

function expectBand(region: Region, band: string): void {
  const shapes = regionShapes(region)
  expect(shapes.length, `${region} must be drawn on the summary`).toBeGreaterThan(0)
  for (const shape of shapes) {
    expect(shape, region).toHaveAttribute('data-band', band)
  }
}

async function tapRegion(region: Region): Promise<void> {
  const user = userEvent.setup()
  const shapes = regionShapes(region)
  expect(shapes.length, `${region} must be drawn on the summary`).toBeGreaterThan(0)
  await user.click(shapes[0])
}

// --- M16: the session's body map, on the session scale ------------------------------------

test('M16 SessionSummary draws the session’s body map with each region banded on the session scale', () => {
  renderSummary()

  expectBand('upper-back', '3')
  expectBand('biceps', '2')
  expectBand('quadriceps', '1')
  expectBand('gluteal', '1')
  expectBand('chest', '0')
})

test('M16 SessionSummary for a session with no sets draws every region in band 0', () => {
  renderSummary({ ...SESSION, entries: [] })

  const shapes = [...summaryDialog().querySelectorAll('[data-region]')]
  expect(shapes.length).toBeGreaterThan(0)
  for (const shape of shapes) {
    expect(shape).toHaveAttribute('data-band', '0')
  }
})

// --- F2/F3: the summary renders as a modal popup (fix-popups) ------------------------------
//
// The summary already carried `role="dialog"`; the device-check defect was that it (and the
// alternatives list and region panel) landed in normal document flow instead of as a real
// popup over the current view -- these prove the two things role="dialog" alone did not: it is
// marked `aria-modal`, and its root carries the shared `.overlay-panel` class `src/styles/
// overlay.test.ts` audits as data.

test('F2 SessionSummary\'s dialog is aria-modal', () => {
  renderSummary()

  expect(summaryDialog()).toHaveAttribute('aria-modal', 'true')
})

test('F3 SessionSummary\'s dialog carries the shared overlay-panel class', () => {
  renderSummary()

  expect(summaryDialog()).toHaveClass('overlay-panel')
})

test('M16 Done on the session summary calls onClose', async () => {
  const user = userEvent.setup()
  const { onClose } = renderSummary()

  await user.click(within(summaryDialog()).getByRole('button', { name: 'Done' }))

  expect(onClose).toHaveBeenCalledTimes(1)
})

// --- M9: a region tapped on the summary's map opens its panel -----------------------------

test('M9 tapping upper-back on the summary map opens a panel showing its 7 sets', async () => {
  renderSummary()

  await tapRegion('upper-back')

  const panel = await screen.findByRole('dialog', { name: 'upper-back' })
  const countOutsideList = within(panel)
    .getAllByText('7 sets')
    .filter((element) => element.closest('li') === null)
  expect(countOutsideList).toHaveLength(1)
})

test('M9 tapping upper-back on the summary map lists Pulldown (4 sets) and Row (3 sets) as its contributors', async () => {
  renderSummary()

  await tapRegion('upper-back')

  const panel = await screen.findByRole('dialog', { name: 'upper-back' })
  const items = within(panel).getAllByRole('listitem')
  expect(items).toHaveLength(2)
  const pulldown = items.find((item) => within(item).queryByText('Pulldown') !== null)
  const row = items.find((item) => within(item).queryByText('Row') !== null)
  expect(pulldown, 'Pulldown must be listed').toBeDefined()
  expect(row, 'Row must be listed').toBeDefined()
  expect(within(pulldown!).getByText('4 sets')).toBeVisible()
  expect(within(row!).getByText('3 sets')).toBeVisible()
})

test('M9 tapping a region the session did not train opens a panel with 0 sets and no contributors', async () => {
  renderSummary()

  await tapRegion('chest')

  const panel = await screen.findByRole('dialog', { name: 'chest' })
  expect(within(panel).getByText('0 sets')).toBeVisible()
  expect(within(panel).queryAllByRole('listitem')).toHaveLength(0)
})

test('M9 Browse exercises on the summary’s upper-back panel hands up lats and middle back', async () => {
  const user = userEvent.setup()
  const { onBrowse } = renderSummary()

  await tapRegion('upper-back')
  const panel = await screen.findByRole('dialog', { name: 'upper-back' })
  await user.click(within(panel).getByRole('button', { name: 'Browse exercises' }))

  expect(onBrowse).toHaveBeenCalledTimes(1)
  expect([...onBrowse.mock.calls[0][0]].sort()).toEqual(['lats', 'middle back'])
})

test('M9 Close on the region panel closes the panel and leaves the summary up', async () => {
  const user = userEvent.setup()
  const { onClose } = renderSummary()

  await tapRegion('upper-back')
  const panel = await screen.findByRole('dialog', { name: 'upper-back' })
  await user.click(within(panel).getByRole('button', { name: 'Close' }))

  await waitFor(() => {
    expect(screen.queryByRole('dialog', { name: 'upper-back' })).toBeNull()
  })
  expect(summaryDialog()).toBeVisible()
  expect(onClose).not.toHaveBeenCalled()
})
