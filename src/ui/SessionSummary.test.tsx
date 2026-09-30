import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { SessionSummary } from './SessionSummary'
import type { Region } from '../domain/muscles'
import type { Exercise, ExercisePlan, LibraryExercise, Muscle, Session, SetEntry } from '../types'

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
  ['Lib_Bench', libraryEntry('Lib_Bench', ['chest'], ['triceps'])],
  ['Lib_PushUp', libraryEntry('Lib_PushUp', ['chest'], ['triceps'])],
])

const CATALOG = new Map<string, Exercise>([
  ['pulldown', catalogEntry('pulldown', 'Pulldown', 'Lib_Pulldown')],
  ['row', catalogEntry('row', 'Row', 'Lib_Row')],
  ['squat', catalogEntry('squat', 'Squat', 'Lib_Squat')],
  ['bench', catalogEntry('bench', 'Bench press', 'Lib_Bench')],
  ['pushup', { ...catalogEntry('pushup', 'Push-up', 'Lib_PushUp'), bodyweight: true }],
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

// --- O23: SessionSummary's body map is session scale, so its legend names the session bands ---

test('O23 SessionSummary shows exactly one session-scale body-map legend', () => {
  renderSummary()

  const dialog = summaryDialog()
  expect(dialog.querySelectorAll('.body-map-legend[data-scale="session"]')).toHaveLength(1)
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

// --- E10-T5 (O13): the court stripe at the top of the summary -------------------------------

test('O13 SessionSummary renders a decorative court-stripe at the top', () => {
  renderSummary()

  const dialog = summaryDialog()
  const stripe = dialog.querySelector('.court-stripe')
  expect(stripe).not.toBeNull()
  expect(stripe).toHaveAttribute('aria-hidden', 'true')
  expect(dialog.firstElementChild).toBe(stripe)
})

// --- E13-T7 (O16): duration, volume and the PRs set, above the body map ---------------------------

const MINUTE = 60_000
const PLANS: Record<string, ExercisePlan> = {
  bench: { exerciseId: 'bench', sets: 3, repRange: [5, 8], restSeconds: 120 },
  pushup: { exerciseId: 'pushup', sets: 3, repRange: [10, 15], restSeconds: 60 },
}
const planFor = (id: string): ExercisePlan | undefined => PLANS[id]

function benchSession(
  id: string,
  startedAt: number,
  minutes: number,
  count: number,
  weightKg: number,
  reps: number,
): Session {
  return {
    id,
    programId: 'assaf-ab-2026',
    workoutId: 'workout-a',
    startedAt,
    finishedAt: startedAt + minutes * MINUTE,
    entries: Array.from({ length: count }, (_, index) => ({
      exerciseId: 'bench',
      setIndex: index + 1,
      weightKg,
      reps,
      loggedAt: startedAt + (index + 1) * 1000,
    })),
  }
}

function renderWithStats(session: Session, earlierSessions: Session[] = []): HTMLElement {
  render(
    <SessionSummary
      session={session}
      earlierSessions={earlierSessions}
      planFor={planFor}
      resolve={resolve}
      library={LIBRARY}
      onClose={vi.fn()}
    />,
  )
  return summaryDialog()
}

test('O16 SessionSummary shows a 52-minute Session’s duration as 52 min', () => {
  const dialog = renderWithStats(benchSession('d52', BASE, 52, 1, 40, 5))

  expect(within(dialog).getByText('52 min')).toBeVisible()
})

test('O16 SessionSummary shows a 65-minute Session’s duration as 1 h 05 min', () => {
  const dialog = renderWithStats(benchSession('d65', BASE, 65, 1, 40, 5))

  expect(within(dialog).getByText('1 h 05 min')).toBeVisible()
})

test('O16 SessionSummary shows the volume as 4,250 kg, and no bodyweight reps when there are none', () => {
  const dialog = renderWithStats(benchSession('vol', BASE, 52, 10, 85, 5))

  expect(within(dialog).getByText('4,250 kg')).toBeVisible()
  expect(dialog.textContent).not.toContain('bodyweight reps')
})

test('O16 SessionSummary adds · 36 bodyweight reps to the volume when the Session has bodyweight sets', () => {
  const session = benchSession('bw', BASE, 52, 10, 85, 5)
  session.entries.push(
    ...[1, 2, 3].map((index) => ({
      exerciseId: 'pushup',
      setIndex: index,
      weightKg: null,
      reps: 12,
      loggedAt: BASE + 100_000 + index,
    })),
  )
  const dialog = renderWithStats(session)

  expect(within(dialog).getByText('4,250 kg · 36 bodyweight reps')).toBeVisible()
})

test('O16 SessionSummary lists a PR set in the Session as Bench press · Heaviest set · 85 kg × 5', () => {
  const earlier = benchSession('before', BASE - 7 * 24 * 60 * MINUTE, 50, 3, 80, 5)
  const dialog = renderWithStats(benchSession('pr', BASE, 52, 3, 85, 5), [earlier])

  const line = within(dialog).getByText('Bench press · Heaviest set · 85 kg × 5')
  expect(line).toBeVisible()
  expect(line.closest('li')).not.toBeNull()
})

test('O16 SessionSummary shows duration, volume and PRs above the body map', () => {
  const earlier = benchSession('before', BASE - 7 * 24 * 60 * MINUTE, 50, 3, 80, 5)
  const dialog = renderWithStats(benchSession('pr', BASE, 52, 3, 85, 5), [earlier])

  const map = dialog.querySelector('[data-region]')!
  for (const text of ['52 min', '1,275 kg', 'Bench press · Heaviest set · 85 kg × 5']) {
    const element = within(dialog).getByText(text)
    expect(
      element.compareDocumentPosition(map) & Node.DOCUMENT_POSITION_FOLLOWING,
      `${text} must come before the body map`,
    ).toBeTruthy()
  }
})

test('O16 SessionSummary with no PRs shows no PR list', () => {
  const earlier = benchSession('before', BASE - 7 * 24 * 60 * MINUTE, 50, 3, 90, 5)
  const dialog = renderWithStats(benchSession('nopr', BASE, 52, 3, 85, 5), [earlier])

  expect(within(dialog).getByText('52 min')).toBeVisible()
  expect(within(dialog).queryAllByRole('listitem')).toHaveLength(0)
  expect(dialog.textContent).not.toContain('Heaviest set')
})
