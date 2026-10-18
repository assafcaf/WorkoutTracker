import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { SessionSummary } from './SessionSummary'
import { nextTime } from '../domain/stats/moves'
import type { Region } from '../domain/muscles'
import type { Exercise, ExercisePlan, LibraryExercise, Muscle, Program, Session, SetEntry } from '../types'

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

  // Title kept (weakened-tests gate); E17 S5b: the region heat list's legend names the session bands.
  const dialog = summaryDialog()
  const legends = dialog.querySelectorAll('.heat-legend[data-scale="session"]')
  expect(legends).toHaveLength(1)
  expect(legends[0].textContent).toContain('3–5')
  expect(legends[0].textContent).toContain('sets / session')
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

  // Title kept (weakened-tests gate); E17-T12 [O15]: the summary renders no stripe at all.
  const dialog = summaryDialog()
  expect(dialog.querySelector('.court-stripe')).toBeNull()
  expect(dialog.querySelector('[data-stripe]')).toBeNull()
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

/** A KPI's value as it reads, number and unit together: `52 min`, `4,250 kg`. */
function kpiValue(dialog: HTMLElement, kpi: string): string {
  return dialog.querySelector(`[data-kpi="${kpi}"] .session-summary-kpi-value`)?.textContent ?? ''
}

/** Every record row's label and detail, as `Heaviest set | Bench press · 85 kg × 5 · +5 kg`. */
function recordRows(dialog: HTMLElement): string[] {
  return [...dialog.querySelectorAll('.session-summary-record')].map(
    (row) =>
      `${row.querySelector('.session-summary-record-label')?.textContent} | ${row.querySelector('.session-summary-record-detail')?.textContent}`,
  )
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

  expect(kpiValue(dialog, 'duration')).toBe('52 min')
})

test('O16 SessionSummary shows a 65-minute Session’s duration as 1 h 05 min', () => {
  const dialog = renderWithStats(benchSession('d65', BASE, 65, 1, 40, 5))

  expect(kpiValue(dialog, 'duration')).toBe('1 h 05 min')
})

test('O16 SessionSummary shows the volume as 4,250 kg, and no bodyweight reps when there are none', () => {
  const dialog = renderWithStats(benchSession('vol', BASE, 52, 10, 85, 5))

  expect(kpiValue(dialog, 'volume')).toBe('4,250 kg')
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

  const volume = dialog.querySelector('[data-kpi="volume"]') as HTMLElement
  expect(kpiValue(dialog, 'volume')).toBe('4,250 kg')
  expect(within(volume).getByText('· 36 bodyweight reps')).toBeVisible()
})

test('O16 SessionSummary lists a PR set in the Session as Bench press · Heaviest set · 85 kg × 5', () => {
  const earlier = benchSession('before', BASE - 7 * 24 * 60 * MINUTE, 50, 3, 80, 5)
  const dialog = renderWithStats(benchSession('pr', BASE, 52, 3, 85, 5), [earlier])

  // Title kept (weakened-tests gate); E18 R-R: the record's kind (`Heaviest weight`) heads its
  // row, the Exercise, the set and the gain over the old record read beneath it.
  expect(recordRows(dialog)).toContain('Heaviest weight | Bench press · 85 kg × 5 · +5 kg')
  const line = within(dialog).getByText('Bench press · 85 kg × 5 · +5 kg')
  expect(line).toBeVisible()
  expect(line.closest('li')).not.toBeNull()
})

test('O16 SessionSummary marks each listed PR with one .tag-pr reading PR', () => {
  const earlier = benchSession('before', BASE - 7 * 24 * 60 * MINUTE, 50, 3, 80, 5)
  const dialog = renderWithStats(benchSession('pr', BASE, 52, 3, 85, 5), [earlier])

  const item = within(dialog).getByText('Bench press · 85 kg × 5 · +5 kg').closest('li') as HTMLElement
  const tags = item.querySelectorAll('.tag.tag-pr')
  expect(tags).toHaveLength(1)
  expect(tags[0].textContent).toBe('PR')
})

test('O16 SessionSummary with no PRs shows no .tag-pr', () => {
  const earlier = benchSession('before', BASE - 7 * 24 * 60 * MINUTE, 50, 3, 90, 5)
  const dialog = renderWithStats(benchSession('nopr', BASE, 52, 3, 85, 5), [earlier])

  expect(dialog.querySelector('.tag-pr')).toBeNull()
})

test('O16 SessionSummary shows duration, volume and PRs above the body map', () => {
  const earlier = benchSession('before', BASE - 7 * 24 * 60 * MINUTE, 50, 3, 80, 5)
  const dialog = renderWithStats(benchSession('pr', BASE, 52, 3, 85, 5), [earlier])

  // Title kept (weakened-tests gate); E18 O26: duration and the records come first, volume is
  // the last quiet line, after the body map.
  const map = dialog.querySelector('[data-region]')!
  expect(kpiValue(dialog, 'duration')).toBe('52 min')
  expect(kpiValue(dialog, 'volume')).toMatch(/^1,275 kg/)
  const elements = [
    dialog.querySelector('[data-kpi="duration"]') as HTMLElement,
    within(dialog).getByText('Bench press · 85 kg × 5 · +5 kg'),
  ]
  for (const element of elements) {
    const text = element.textContent
    expect(
      element.compareDocumentPosition(map) & Node.DOCUMENT_POSITION_FOLLOWING,
      `${text} must come before the body map`,
    ).toBeTruthy()
  }
  const volume = dialog.querySelector('[data-kpi="volume"]') as HTMLElement
  expect(volume.compareDocumentPosition(map) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy()
})

test('O16 SessionSummary with no PRs shows no PR list', () => {
  const earlier = benchSession('before', BASE - 7 * 24 * 60 * MINUTE, 50, 3, 90, 5)
  const dialog = renderWithStats(benchSession('nopr', BASE, 52, 3, 85, 5), [earlier])

  expect(kpiValue(dialog, 'duration')).toBe('52 min')
  expect(within(dialog).queryAllByRole('listitem')).toHaveLength(0)
  expect(dialog.textContent).not.toContain('Heaviest set')
})

// --- E17 S5b: the Progress Dashboard summary --------------------------------------------------

function renderS5b(session: Session, earlierSessions: Session[] = [], extra: { onEdit?: () => void } = {}): HTMLElement {
  render(
    <SessionSummary
      session={session}
      earlierSessions={earlierSessions}
      planFor={planFor}
      resolve={resolve}
      library={LIBRARY}
      workoutName="Workout A"
      onClose={vi.fn()}
      {...extra}
    />,
  )
  return summaryDialog()
}

test('S5b SessionSummary is headed by the Workout, with the day beside it', () => {
  const dialog = renderS5b(benchSession('h', new Date(2026, 9, 13, 18).getTime(), 52, 3, 85, 5))

  expect(within(dialog).getByRole('heading', { name: 'Workout A', level: 2 })).toBeVisible()
  const date = dialog.querySelector('.session-summary-date')?.textContent ?? ''
  expect(date).toMatch(/^(Tue 13 Oct|13 Oct 2026)$/)
})

test('S5b the KPI strip reads duration, volume against the last same Workout, working sets and PRs', () => {
  const earlier = benchSession('before', BASE - 7 * 24 * 60 * MINUTE, 50, 3, 80, 5)
  const session = benchSession('pr', BASE, 52, 3, 85, 5)
  session.entries.push({ kind: 'warmup', exerciseId: 'bench', setIndex: 0, weightKg: 40, reps: 5, loggedAt: BASE + 500 })
  const dialog = renderS5b(session, [earlier])

  // Title kept (weakened-tests gate); E18 O26: one figures line, the volume line last.
  expect(kpiValue(dialog, 'duration')).toBe('52 min')
  expect(kpiValue(dialog, 'volume')).toMatch(/^1,275 kg · up 6 % on /)
  expect(kpiValue(dialog, 'sets')).toBe('3')
  expect(kpiValue(dialog, 'prs')).toBe('1')
  expect(dialog.querySelector('.session-summary-figures')?.textContent).toBe('52 min · 3 working sets · 1 record')
})

test('S5b each record row carries a PR tag and a sparkline of that record over the Sessions', () => {
  const earlier = benchSession('before', BASE - 7 * 24 * 60 * MINUTE, 50, 3, 80, 5)
  const dialog = renderS5b(benchSession('pr', BASE, 52, 3, 85, 5), [earlier])

  // Title kept (weakened-tests gate); E18 R-R: one row per counted record, the PR tag and the
  // word of its kind carry it (no sparkline), the lower kinds beaten the same day are readout only.
  const section = within(dialog).getByRole('region', { name: 'Records' })
  const rows = within(section).getAllByRole('listitem')
  expect(rows).toHaveLength(1)
  for (const row of rows) {
    expect(row.querySelector('.tag.tag-pr')?.textContent).toBe('PR')
    expect(row.querySelector('svg.record-spark')).toBeNull()
  }
})

test('S5b Worked today lists the regions as heat squares on the session scale', () => {
  renderSummary()

  const worked = within(summaryDialog()).getByRole('region', { name: 'Worked today' })
  const upperBack = worked.querySelector('[data-region="upper-back"]') as HTMLElement
  expect(upperBack).toHaveAccessibleName('Lats, 7 sets')
  expect(upperBack.querySelector('.heat-cell')).toHaveAttribute('data-band', '3')
  expect(worked.querySelector('[data-region="gluteal"] .heat-cell')?.textContent).toBe('0.5')
})

test('S5b the exercise table gives each Exercise its best set, volume and change against last time', () => {
  const earlier = benchSession('before', BASE - 7 * 24 * 60 * MINUTE, 50, 3, 80, 5)
  const dialog = renderS5b(benchSession('pr', BASE, 52, 3, 85, 5), [earlier])

  // Title kept (weakened-tests gate); E18 O26: no table; each lift's move in words beside its top set.
  expect(within(dialog).queryByRole('table')).toBeNull()
  const row = within(dialog).getByText('Bench press', { selector: '.session-summary-move-name' }).closest('.session-summary-move') as HTMLElement
  expect(row.querySelector('.session-summary-move-top')?.textContent).toBe('85 kg × 5')
  expect(row.querySelector('.session-summary-move-text')?.textContent).toBe('Stepped up to 85 kg · +5 kg · record')
})

test('S5b the dock offers Share as the secondary action beside Done', () => {
  const dialog = renderS5b(benchSession('d', BASE, 52, 1, 40, 5))

  const share = within(dialog).getByRole('button', { name: 'Share' })
  const done = within(dialog).getByRole('button', { name: 'Done' })
  expect(share).toHaveClass('btn-secondary')
  expect(done).toHaveClass('btn-primary')
  expect(share.compareDocumentPosition(done) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
})

test('S5b Edit session shows only when onEdit is given, and calls it', async () => {
  const onEdit = vi.fn()
  const dialog = renderS5b(benchSession('e', BASE, 52, 1, 40, 5), [], { onEdit })

  await userEvent.setup().click(within(dialog).getByRole('button', { name: 'Edit session' }))
  expect(onEdit).toHaveBeenCalledTimes(1)
})

test('S5b the finish summary, given no onEdit, has no Edit session', () => {
  const dialog = renderS5b(benchSession('e', BASE, 52, 1, 40, 5))

  expect(within(dialog).queryByRole('button', { name: 'Edit session' })).toBeNull()
})


// --- E18-T15 [O26]: what the session did for your week -------------------------------------

const WEEK_PROGRAM: Program = {
  id: 'assaf-ab-2026',
  name: 'A / B',
  units: 'kg',
  sessionsPerWeek: 3,
  workouts: [
    { id: 'workout-a', name: 'Workout A', exercises: [PLANS.bench] },
    {
      id: 'workout-b',
      name: 'Workout B',
      exercises: [{ exerciseId: 'pulldown', sets: 3, repRange: [8, 12], restSeconds: 90 }],
    },
  ],
}

const WED = new Date(2026, 9, 14, 18).getTime()
const DAY_MS = 24 * 60 * MINUTE

/** Mon 12 Oct: Workout B, 3 pulldown sets; Wed 7 Oct: Workout A, 3 bench sets at 80 kg. */
function weekSessions(): { earlier: Session[]; wed: Session } {
  const bench = benchSession('wed-7', WED - 7 * DAY_MS, 50, 3, 80, 5)
  const monday: Session = {
    id: 'mon-12',
    programId: 'assaf-ab-2026',
    workoutId: 'workout-b',
    startedAt: WED - 2 * DAY_MS,
    finishedAt: WED - 2 * DAY_MS + 40 * MINUTE,
    entries: sets('pulldown', 3, 1000).map((e) => ({ ...e, loggedAt: WED - 2 * DAY_MS + e.loggedAt - BASE })),
  }
  const wed = benchSession('wed-14', WED, 71, 3, 85, 5)
  wed.entries.push(
    { kind: 'warmup', exerciseId: 'bench', setIndex: 0, weightKg: 40, reps: 5, loggedAt: WED + 10 },
    { kind: 'warmup', exerciseId: 'bench', setIndex: 0, weightKg: 60, reps: 3, loggedAt: WED + 20 },
  )
  return { earlier: [bench, monday], wed }
}

function renderWeek(extra: { onDeloadChange?: (on: boolean) => void; deload?: boolean } = {}): HTMLElement {
  const { earlier, wed } = weekSessions()
  render(
    <SessionSummary
      session={extra.deload ? { ...wed, deload: true } : wed}
      earlierSessions={earlier}
      planFor={planFor}
      program={WEEK_PROGRAM}
      resolve={resolve}
      library={LIBRARY}
      workoutName="Workout A"
      onClose={vi.fn()}
      onDeloadChange={extra.onDeloadChange}
    />,
  )
  return summaryDialog()
}

test('O26 the summary reads "What Wed did for your week" with 2 of 3 sessions and 6 of 9 sets', () => {
  const dialog = renderWeek()

  expect(within(dialog).getByRole('heading', { name: 'What Wed did for your week' })).toBeVisible()
  expect(dialog.querySelector('.session-summary-week')?.textContent).toContain('2 of 3 sessions · 6 of 9 sets')
})

test('O26 a 71-minute Session reads 1 h 11 min on its own line, apart from the week figures', () => {
  const dialog = renderWeek()

  expect(kpiValue(dialog, 'duration')).toBe('1 h 11 min')
  const duration = dialog.querySelector('[data-kpi="duration"]') as HTMLElement
  const week = dialog.querySelector('.session-summary-week') as HTMLElement
  expect(week.contains(duration)).toBe(false)
  expect(duration.textContent).not.toContain('sessions')
})

test('O26 each lift reads its move in words beside its top set', () => {
  const dialog = renderWeek()

  const move = dialog.querySelector('.session-summary-move') as HTMLElement
  expect(move.querySelector('.session-summary-move-name')?.textContent).toBe('Bench press')
  expect(move.querySelector('.session-summary-move-top')?.textContent).toBe('85 kg × 5')
  expect(move.querySelector('.session-summary-move-text')?.textContent).toBe('Stepped up to 85 kg · +5 kg · record')
})

test('O26 the records list counts the Session records once, with the kind and its gain', () => {
  const dialog = renderWeek()

  const section = within(dialog).getByRole('region', { name: 'Records' })
  expect(within(section).getAllByRole('listitem')).toHaveLength(1)
  expect(recordRows(dialog)).toContain('Heaviest weight | Bench press · 85 kg × 5 · +5 kg')
  expect(dialog.querySelector('.session-summary-figures')?.textContent).toContain('1 record')
})

test('O26 Next time lists what the next Session should do', () => {
  const dialog = renderWeek()
  const { earlier, wed } = weekSessions()
  const lines = nextTime(wed.id, [...earlier, wed], resolve, WEEK_PROGRAM)
  expect(lines.length).toBeGreaterThan(0)

  const next = within(dialog).getByRole('region', { name: 'Next time' })
  expect(within(next).getByText('Next time')).toBeVisible()
  expect([...next.querySelectorAll('.session-summary-next-line')].map((e) => e.textContent)).toEqual(lines)
})

test('O26 Worked today lists the 12 muscles, in sets, with warm-ups left out', () => {
  const dialog = renderWeek()

  const rows = [...dialog.querySelectorAll('.session-summary-muscles [data-muscle]')]
  expect(rows.map((r) => r.getAttribute('data-muscle'))).toEqual([
    'chest', 'shoulders', 'triceps', 'lats', 'middle back', 'biceps',
    'quadriceps', 'hamstrings', 'glutes', 'calves', 'lower back', 'abdominals',
  ])
  const chest = dialog.querySelector('.session-summary-muscles [data-muscle="chest"]') as HTMLElement
  expect(chest.textContent).toBe('Chest3')
  expect(chest).toHaveAttribute('data-band', '2')
  expect(dialog.querySelector('.session-summary-muscles [data-muscle="triceps"]')?.textContent).toBe('Triceps1.5')
})

test('O26 the summary says 2 warm-ups not counted', () => {
  const dialog = renderWeek()

  expect(dialog.querySelector('.session-summary-warmups')?.textContent).toBe('2 warm-ups not counted')
})

test('O26 volume is the last quiet line of the summary body, after the muscles and Next time', () => {
  const dialog = renderWeek()

  const volume = dialog.querySelector('[data-kpi="volume"]') as HTMLElement
  expect(volume.textContent).toMatch(/^1,275 kg · up 6 % on /)
  const body = dialog.querySelector('.session-summary-body') as HTMLElement
  expect(body.lastElementChild).toBe(volume.closest('.session-summary-volume'))
  const muscles = dialog.querySelector('.session-summary-muscles') as HTMLElement
  expect(muscles.compareDocumentPosition(volume) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
})

test('O26 the Deload session switch reflects the Session and reports a change', async () => {
  const onDeloadChange = vi.fn()
  const dialog = renderWeek({ onDeloadChange })
  const toggle = within(dialog).getByRole('switch', { name: 'Deload session' })
  expect(toggle).not.toBeChecked()

  await userEvent.setup().click(toggle)

  expect(onDeloadChange).toHaveBeenCalledWith(true)
  expect(toggle).toBeChecked()
})

test('O26 a deload Session shows the Deload session switch on', () => {
  const dialog = renderWeek({ deload: true })

  expect(within(dialog).getByRole('switch', { name: 'Deload session' })).toBeChecked()
})

// --- E19-T15 O26: Save changes to program ----------------------------------------------------

const PLAN_WORKOUT = {
  id: 'workout-b',
  name: 'Workout B',
  exercises: [
    { exerciseId: 'pulldown', sets: 3, repRange: [8, 10] as [number, number], restSeconds: 90 },
    { exerciseId: 'row', sets: 2, repRange: [8, 10] as [number, number], restSeconds: 90 },
  ],
}

test('O26 an extended Exercise is listed and Save hands the changes up', async () => {
  const onSaveChanges = vi.fn()
  render(
    <SessionSummary
      session={SESSION}
      resolve={resolve}
      library={LIBRARY}
      workout={PLAN_WORKOUT}
      onSaveChanges={onSaveChanges}
      onClose={vi.fn()}
    />,
  )
  const offer = screen.getByRole('region', { name: 'Save changes to program' })
  expect(within(offer).getByText(/Pulldown/)).toBeVisible()

  await userEvent.setup().click(within(offer).getByRole('button', { name: 'Save' }))

  expect(onSaveChanges).toHaveBeenCalledWith([{ kind: 'extend', exerciseId: 'pulldown', from: 3, to: 4 }])
})

test('O26 Not now hides the offer and saves nothing', async () => {
  const onSaveChanges = vi.fn()
  render(
    <SessionSummary
      session={SESSION}
      resolve={resolve}
      library={LIBRARY}
      workout={PLAN_WORKOUT}
      onSaveChanges={onSaveChanges}
      onClose={vi.fn()}
    />,
  )

  await userEvent.setup().click(screen.getByRole('button', { name: 'Not now' }))

  expect(screen.queryByRole('region', { name: 'Save changes to program' })).toBeNull()
  expect(onSaveChanges).not.toHaveBeenCalled()
})

test('O26 without a handler the summary offers no save', () => {
  render(
    <SessionSummary session={SESSION} resolve={resolve} library={LIBRARY} workout={PLAN_WORKOUT} onClose={vi.fn()} />,
  )
  expect(screen.queryByRole('region', { name: 'Save changes to program' })).toBeNull()
})
