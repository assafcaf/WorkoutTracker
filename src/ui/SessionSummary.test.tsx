import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { SessionSummary } from './SessionSummary'
import { nextTime } from '../domain/stats/moves'
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

/**
 * v7 (study §1.6, §4): the muscles left the summary for Progress › Muscles, so it lists no muscle,
 * draws no map and opens no region panel.
 */
function expectNoMuscles(dialog: HTMLElement): void {
  expect(dialog.querySelectorAll('[data-muscle], [data-region], .session-summary-muscles')).toHaveLength(0)
  expect(within(dialog).queryByRole('region', { name: 'Worked today' })).toBeNull()
  expect(within(dialog).queryByRole('region', { name: 'Muscles worked' })).toBeNull()
  expect(dialog.textContent).not.toMatch(/Worked today|Muscles worked|Lats \d/)
}

// --- M16: the session's body map, on the session scale ------------------------------------

test('M16 SessionSummary draws the session’s body map with each region banded on the session scale', () => {
  renderSummary()

  // Title kept (weakened-tests gate); v7 (study §1.6): "Worked today" moved to Progress › Muscles,
  // weekly, where the range means something; the summary draws no muscle at all.
  expectNoMuscles(summaryDialog())
})

test('M16 SessionSummary for a session with no sets draws every region in band 0', () => {
  renderSummary({ ...SESSION, entries: [] })

  // Title kept (weakened-tests gate); V4-03 (V3-13): no zero cells, so a Session with no Sets
  // lists no muscle and has no Worked today line at all.
  const dialog = summaryDialog()
  expect(dialog.querySelectorAll('[data-muscle]')).toHaveLength(0)
  expect(within(dialog).queryByRole('region', { name: 'Worked today' })).toBeNull()
  expect(dialog.textContent).not.toContain('Worked today')
})

test('V2-06 the summary has one muscle grid, named in the Progress vocabulary', () => {
  renderSummary()

  // Title kept (weakened-tests gate); v7 (study §1.6, §4): no muscle grid at all, in any
  // vocabulary; the muscles live in Progress › Muscles.
  const dialog = summaryDialog()
  expectNoMuscles(dialog)
  expect(dialog.querySelector('.region-heat')).toBeNull()
  expect(dialog.textContent).not.toMatch(/Middle back|Mid back|Quadriceps|Quads|Abdominals/)
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

  // Title kept (weakened-tests gate); v7: no muscles, so no legend of any kind and no
  // "sets / session".
  const dialog = summaryDialog()
  expect(dialog.querySelectorAll('.heat-legend, .body-map-legend')).toHaveLength(0)
  expect(dialog.textContent).not.toContain('sets / session')
  expectNoMuscles(dialog)
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

  // Title kept (weakened-tests gate); v7: the summary has no muscle to tap, so no region panel;
  // Progress › Muscles opens the panels now.
  expectNoMuscles(summaryDialog())
  expect(screen.queryByRole('dialog', { name: 'upper-back' })).toBeNull()
})

test('M9 tapping upper-back on the summary map lists Pulldown (4 sets) and Row (3 sets) as its contributors', async () => {
  renderSummary()

  // Title kept (weakened-tests gate); v7: no region panel, so no contributors list; the lifts
  // themselves are listed once, in Lift by lift.
  const dialog = summaryDialog()
  expect(screen.queryByRole('dialog', { name: 'upper-back' })).toBeNull()
  expect(within(dialog).queryAllByRole('button', { name: /^(Lats|Mid back)/ })).toHaveLength(0)
})

test('M9 tapping a region the session did not train opens a panel with 0 sets and no contributors', async () => {
  renderSummary()

  // Title kept (weakened-tests gate); V4-03 (V3-13), v7: no muscle is listed, so there is nothing
  // to tap and no panel of 0 sets.
  const dialog = summaryDialog()
  expect(dialog.querySelector('[data-muscle="chest"]')).toBeNull()
  expect(within(dialog).queryByRole('button', { name: /^Chest/ })).toBeNull()
  expect(screen.queryByRole('dialog', { name: 'chest' })).toBeNull()
})

test('M9 Browse exercises on the summary’s upper-back panel hands up lats and middle back', async () => {
  const { onBrowse } = renderSummary()

  // Title kept (weakened-tests gate); v7: no region panel, so no Browse exercises and nothing is
  // handed up.
  expect(within(summaryDialog()).queryByRole('button', { name: 'Browse exercises' })).toBeNull()
  expect(onBrowse).not.toHaveBeenCalled()
})

test('M9 Close on the region panel closes the panel and leaves the summary up', async () => {
  const user = userEvent.setup()
  const { onClose } = renderSummary()

  // Title kept (weakened-tests gate); v7: no region panel to close; the Share sheet is the only
  // panel the summary opens, and closing it leaves the summary up.
  await user.click(within(summaryDialog()).getByRole('button', { name: 'Share' }))
  const sheet = await screen.findByRole('dialog', { name: 'Share session' })
  expect(sheet).toBeVisible()
  expect(screen.queryByRole('dialog', { name: 'upper-back' })).toBeNull()
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

/** `count` Push-up Sets at bodyweight, logged after `startedAt` + 100 s. */
function pushUps(startedAt: number, count: number, reps: number): SetEntry[] {
  return Array.from({ length: count }, (_, index) => ({
    exerciseId: 'pushup',
    setIndex: index + 1,
    weightKg: null,
    reps,
    loggedAt: startedAt + 100_000 + index,
  }))
}

/**
 * Two PRs today: Bench press 80 → 85 kg × 5, and Push-ups BW × 10 → BW+5 × 12 (a first added
 * load; V6: more reps alone would be a rep best, not a PR).
 */
function twoRecordSessions(): { earlier: Session[]; today: Session } {
  const before = benchSession('before', BASE - 7 * 24 * 60 * MINUTE, 50, 3, 80, 5)
  before.entries.push(...pushUps(before.startedAt, 3, 10))
  const today = benchSession('pr2', BASE, 52, 3, 85, 5)
  today.entries.push(...pushUps(BASE, 3, 12).map((entry) => ({ ...entry, loadKg: 5 })))
  return { earlier: [before], today }
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

  // Title kept (weakened-tests gate); v7 (study §1.6): the PR is a gold row under the verdict
  // sentence: the lift, the record's kind in words, and the Set that set it on the right.
  expect(recordRows(dialog)).toEqual([' · heaviest | Bench press'])
  const row = dialog.querySelector('.session-summary-record') as HTMLElement
  expect(row).toBeVisible()
  expect(row.querySelector('.session-summary-record-figure')?.textContent).toBe('85 kg×5')
  expect(dialog.querySelector('.session-summary-win')).toBeNull()
})

test('O16 SessionSummary marks each listed PR with one .tag-pr reading PR', () => {
  const earlier = benchSession('before', BASE - 7 * 24 * 60 * MINUTE, 50, 3, 80, 5)
  const dialog = renderWithStats(benchSession('pr', BASE, 52, 3, 85, 5), [earlier])

  // Title kept (weakened-tests gate); v7: one PR treatment, the tag on its PR row; Lift by lift
  // carries none (the records come first, study §3 PR).
  const rows = [...dialog.querySelectorAll('.session-summary-record')]
  expect(rows).toHaveLength(1)
  const tags = rows[0].querySelectorAll('.tag.tag-pr')
  expect(tags).toHaveLength(1)
  expect(tags[0].textContent).toBe('PR')
  expect(dialog.querySelector('.session-summary-move .tag-pr')).toBeNull()
  expect(dialog.querySelectorAll('.tag-pr')).toHaveLength(1)
})

test('O16 SessionSummary with no PRs shows no .tag-pr', () => {
  const earlier = benchSession('before', BASE - 7 * 24 * 60 * MINUTE, 50, 3, 90, 5)
  const dialog = renderWithStats(benchSession('nopr', BASE, 52, 3, 85, 5), [earlier])

  expect(dialog.querySelector('.tag-pr')).toBeNull()
})

test('O16 SessionSummary shows duration, volume and PRs above the body map', () => {
  const earlier = benchSession('before', BASE - 7 * 24 * 60 * MINUTE, 50, 3, 80, 5)
  const dialog = renderWithStats(benchSession('pr', BASE, 52, 3, 85, 5), [earlier])

  // Title kept (weakened-tests gate); v7: no body map. The order is the day and duration, the
  // verdict sentence, the PR rows, Lift by lift, then the one totals line with the volume.
  expect(kpiValue(dialog, 'duration')).toBe('52 min')
  expect(kpiValue(dialog, 'volume')).toMatch(/^1,275 kg/)
  const order = [
    dialog.querySelector('[data-kpi="duration"]'),
    dialog.querySelector('.session-summary-sentence'),
    dialog.querySelector('.session-summary-record'),
    within(dialog).getByRole('region', { name: 'Lift by lift' }),
    dialog.querySelector('[data-kpi="volume"]'),
  ] as HTMLElement[]
  for (let at = 1; at < order.length; at += 1) {
    expect(
      order[at - 1].compareDocumentPosition(order[at]) & Node.DOCUMENT_POSITION_FOLLOWING,
      `${order[at - 1].textContent} must come before ${order[at].textContent}`,
    ).toBeTruthy()
  }
  expectNoMuscles(dialog)
})

test('O16 SessionSummary with no PRs shows no PR list', () => {
  const earlier = benchSession('before', BASE - 7 * 24 * 60 * MINUTE, 50, 3, 90, 5)
  const dialog = renderWithStats(benchSession('nopr', BASE, 52, 3, 85, 5), [earlier])

  expect(kpiValue(dialog, 'duration')).toBe('52 min')
  expect(within(dialog).queryAllByRole('listitem')).toHaveLength(0)
  expect(within(dialog).queryByRole('region', { name: 'Records' })).toBeNull()
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

  // Title kept (weakened-tests gate); v7 (study §1.6): the duration sits with the day over the
  // heading; one totals line reads the Sets, the volume (one small number, no % headline) and the
  // warm-ups; the records are said by the verdict sentence and the PR rows, never a PR count.
  expect(dialog.querySelector('.session-summary-label')?.textContent).toMatch(/^\w{3} \d{1,2} \w{3} · 52 min$|^\d{1,2} \w{3} \d{4} · 52 min$/)
  expect(kpiValue(dialog, 'duration')).toBe('52 min')
  expect(kpiValue(dialog, 'volume')).toBe('1,275 kg')
  expect(kpiValue(dialog, 'sets')).toBe('3')
  expect(dialog.querySelector('[data-kpi="prs"]')).toBeNull()
  expect(dialog.querySelector('[data-kpi="comparison"]')).toBeNull()
  expect(dialog.querySelector('.session-summary-totals')?.textContent).toBe('3 sets · 1,275 kg · 1 warm-up not counted')
  expect(dialog.textContent).not.toMatch(/%/)
})

test('S5b each record row carries a PR tag and a sparkline of that record over the Sessions', () => {
  const earlier = benchSession('before', BASE - 7 * 24 * 60 * MINUTE, 50, 3, 80, 5)
  const dialog = renderS5b(benchSession('pr', BASE, 52, 3, 85, 5), [earlier])

  // Title kept (weakened-tests gate); v7: every PR is a row, one or many: the PR tag and the
  // record's kind in words carry it (no sparkline).
  expect(within(within(dialog).getByRole('region', { name: 'Records' })).getAllByRole('listitem')).toHaveLength(1)
  cleanup()
  const two = twoRecordSessions()
  const both = renderS5b(two.today, two.earlier)
  const section = within(both).getByRole('region', { name: 'Records' })
  const rows = within(section).getAllByRole('listitem')
  expect(rows).toHaveLength(2)
  for (const row of rows) {
    expect(row.querySelector('.tag.tag-pr')?.textContent).toBe('PR')
    expect(row.querySelector('svg.record-spark')).toBeNull()
  }
})

test('S5b Worked today lists the regions as heat squares on the session scale', () => {
  renderSummary()

  // Title kept (weakened-tests gate); v7 (study §1.6): no Worked today at all; Progress › Muscles
  // shows the week against its range.
  const dialog = summaryDialog()
  expectNoMuscles(dialog)
  expect(dialog.querySelector('.heat-cell')).toBeNull()
})

test('S5b the exercise table gives each Exercise its best set, volume and change against last time', () => {
  const earlier = benchSession('before', BASE - 7 * 24 * 60 * MINUTE, 50, 3, 80, 5)
  const dialog = renderS5b(benchSession('pr', BASE, 52, 3, 85, 5), [earlier])

  // Title kept (weakened-tests gate); v7: no table; each lift is its name over its Sets in the
  // repeated-reps form, and one verdict on the right, glyph first, with no "record" word.
  expect(within(dialog).queryByRole('table')).toBeNull()
  const row = within(dialog).getByText('Bench press', { selector: '.session-summary-move-name' }).closest('.session-summary-move') as HTMLElement
  expect(row.querySelector('.session-summary-move-top')).toBeNull()
  expect(row.querySelector('.session-summary-move-text')?.textContent).toBe('85×5 · 5 · 5')
  const verdict = row.querySelector('.session-summary-verdict') as HTMLElement
  expect(verdict.textContent).toBe('↑ +5 kg')
  expect(verdict).toHaveAttribute('data-tone', 'up')
  expect(row.textContent).not.toContain('record')
})

test('S5b the dock offers Share as the secondary action beside Done', () => {
  const dialog = renderS5b(benchSession('d', BASE, 52, 1, 40, 5))

  // Title kept (weakened-tests gate); v7 (study §1.6, §4): Done is the dock's one button and the
  // one primary; Share is a text link at the foot of the body, holding Apple Health.
  const dock = dialog.querySelector('.session-summary-dock') as HTMLElement
  const buttons = within(dock).getAllByRole('button')
  expect(buttons).toHaveLength(1)
  const done = within(dock).getByRole('button', { name: 'Done' })
  expect(done).toHaveClass('btn-primary')
  expect(dialog.querySelectorAll('.btn-primary')).toHaveLength(1)
  const share = within(dialog).getByRole('button', { name: 'Share' })
  expect(share).toHaveClass('btn-quiet')
  expect(share).not.toHaveClass('btn-secondary')
  expect(share.closest('.session-summary-foot')).not.toBeNull()
  expect(share.compareDocumentPosition(done) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(within(dialog).queryByRole('button', { name: 'Send to Apple Health' })).toBeNull()
})

test('S5b DX-14 Edit shows only when onEdit is given, as text, and calls it', async () => {
  const onEdit = vi.fn()
  const dialog = renderS5b(benchSession('e', BASE, 52, 1, 40, 5), [], { onEdit })

  await userEvent.setup().click(within(dialog).getByRole('button', { name: 'Edit' }))
  expect(onEdit).toHaveBeenCalledTimes(1)
})

test('S5b the finish summary, given no onEdit, has no Edit session', () => {
  const dialog = renderS5b(benchSession('e', BASE, 52, 1, 40, 5))

  expect(within(dialog).queryByRole('button', { name: 'Edit' })).toBeNull()
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

  // Title kept (weakened-tests gate); v7 (study §1.6): the week left the summary (Train and
  // Sessions own it); what comes next is one line, "Next: Workout B". Weekly, no streak.
  expect(within(dialog).queryByRole('heading', { name: 'What Wed did for your week' })).toBeNull()
  expect(dialog.querySelector('.session-summary-week')).toBeNull()
  expect(dialog.textContent).not.toContain('This week')
  expect(dialog.querySelector('.session-summary-next')?.textContent).toBe('Next: Workout B')
  expect(dialog.textContent).not.toMatch(/streak/i)
})

test('O26 a 71-minute Session reads 1 h 11 min on its own line, apart from the week figures', () => {
  const dialog = renderWeek()

  // v7: with the day, over the heading, apart from the totals line.
  expect(kpiValue(dialog, 'duration')).toBe('1 h 11 min')
  const duration = dialog.querySelector('[data-kpi="duration"]') as HTMLElement
  expect(duration.closest('.session-summary-label')).not.toBeNull()
  const totals = dialog.querySelector('.session-summary-totals') as HTMLElement
  expect(totals.contains(duration)).toBe(false)
  expect(duration.textContent).not.toContain('sessions')
})

test('DX-14 a Session shorter than a minute reads "1 min", never "0 min"', () => {
  const quick = { ...benchSession('quick', BASE, 0, 1, 40, 5), finishedAt: BASE + 20_000 }
  const dialog = renderBench(quick, [])

  expect(kpiValue(dialog, 'duration')).toBe('1 min')
})

test('O26 each lift reads its move in words beside its top set', () => {
  const dialog = renderWeek()

  // Title kept (weakened-tests gate); v7: the name, its Sets in the repeated-reps form, and the
  // move as one verdict on the right.
  const move = dialog.querySelector('.session-summary-move') as HTMLElement
  expect(move.querySelector('.session-summary-move-name')?.textContent).toBe('Bench press')
  expect(move.querySelector('.session-summary-move-text')?.textContent).toBe('85×5 · 5 · 5')
  expect(move.querySelector('.session-summary-verdict')?.textContent).toBe('↑ +5 kg')
  expect(dialog.querySelector('.session-summary-versus')?.textContent).toBe('vs Wed 7 Oct')
})

test('O26 the records list counts the Session records once, with the kind and its gain', () => {
  const dialog = renderWeek()

  // Title kept (weakened-tests gate); v7: the one record is one PR row and one word in the verdict
  // sentence ("One record."), never "+n more".
  const rows = within(within(dialog).getByRole('region', { name: 'Records' })).getAllByRole('listitem')
  expect(rows).toHaveLength(1)
  expect(rows[0].textContent).toBe('PRBench press · heaviest85 kg×5')
  expect(dialog.querySelector('.session-summary-sentence')?.textContent).toBe('Bench press beat Wed 7 Oct. One record.')
  expect(dialog.querySelector('.session-summary-win-more')).toBeNull()
  expect(dialog.textContent).not.toMatch(/more PR/)
})

test('O26 Next time lists what the next Session should do', () => {
  const dialog = renderWeek()
  const { earlier, wed } = weekSessions()
  const lines = nextTime(wed.id, [...earlier, wed], resolve, WEEK_PROGRAM)
  expect(lines.length).toBeGreaterThan(0)

  // Title kept (weakened-tests gate); V4-03, v7: "Next time · n of m reps at …" is the lift page's;
  // what comes next on the summary is the next Workout, "Next: Workout B".
  expect(within(dialog).queryByRole('region', { name: 'Next time' })).toBeNull()
  for (const line of lines) expect(dialog.textContent).not.toContain(line)
  expect(dialog.textContent).not.toMatch(/\d+ of \d+ reps at/)
  expect(dialog.querySelector('.session-summary-next')?.textContent).toBe('Next: Workout B')
})

test('O26 Worked today lists the 12 muscles, in sets, with warm-ups left out', () => {
  const dialog = renderWeek()

  // Title kept (weakened-tests gate); v7: no muscles on the summary; the warm-ups are still left
  // out of the counts, and said once in the totals line.
  expectNoMuscles(dialog)
  expect(kpiValue(dialog, 'sets')).toBe('3')
  expect(dialog.querySelector('.session-summary-totals')?.textContent).toContain('2 warm-ups not counted')
})

test('O26 the summary says 2 warm-ups not counted', () => {
  const dialog = renderWeek()

  expect(dialog.querySelector('.session-summary-warmups')?.textContent).toBe('2 warm-ups not counted')
})

test('O26 volume is the last quiet line of the summary body, after the muscles and Next time', () => {
  const dialog = renderWeek()

  // Title kept (weakened-tests gate); v7: the volume is one small number in the totals line,
  // after Lift by lift; only "Next" and Share follow it.
  const volume = dialog.querySelector('[data-kpi="volume"]') as HTMLElement
  expect(volume.textContent).toBe('1,275 kg')
  const totals = volume.closest('.session-summary-totals') as HTMLElement
  expect(totals.textContent).toBe('3 sets · 1,275 kg · 2 warm-ups not counted')
  const lifts = within(dialog).getByRole('region', { name: 'Lift by lift' })
  expect(lifts.compareDocumentPosition(totals) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  const body = dialog.querySelector('.session-summary-body') as HTMLElement
  expect(body.lastElementChild).toBe(dialog.querySelector('.session-summary-foot'))
  expect(totals.nextElementSibling).toBe(dialog.querySelector('.session-summary-foot'))
})

test('O26 the Deload session switch reflects the Session and reports a change', async () => {
  const onDeloadChange = vi.fn()
  const dialog = renderWeek({ onDeloadChange })

  // Title kept (weakened-tests gate); V2-10: the switch moved to the Session editor
  // (SessionEditor.test.tsx), so the summary holds no switch at all.
  expect(within(dialog).queryByRole('switch')).toBeNull()
  expect(onDeloadChange).not.toHaveBeenCalled()
})

test('O26 a deload Session shows the Deload session switch on', () => {
  const dialog = renderWeek({ deload: true })

  // Title kept (weakened-tests gate); V2-10: no switch on the summary, deload or not.
  expect(within(dialog).queryByRole('switch', { name: 'Deload session' })).toBeNull()
})

// --- V2-10: Best today, and no comparison on a partial Session --------------------------------

test('V2-10 the summary leads with Best today, the top Record, under the figures', () => {
  const dialog = renderWeek()

  // Title kept (weakened-tests gate); v7: no "Best today" line and no headline PR; the verdict
  // sentence leads, right under the heading, then the PR rows, then Lift by lift.
  expect(dialog.querySelector('.session-summary-best')).toBeNull()
  expect(dialog.textContent).not.toContain('Best today')
  expect(dialog.querySelector('.session-summary-win')).toBeNull()
  const head = dialog.querySelector('.session-summary-head') as HTMLElement
  const sentence = dialog.querySelector('.session-summary-sentence') as HTMLElement
  expect(head.nextElementSibling).toBe(sentence)
  expect(sentence.querySelector('.session-summary-sentence-lead')?.textContent).toBe('Bench press beat Wed 7 Oct.')
  const records = within(dialog).getByRole('region', { name: 'Records' })
  const lifts = within(dialog).getByRole('region', { name: 'Lift by lift' })
  expect(sentence.compareDocumentPosition(records) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(records.compareDocumentPosition(lifts) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
})

test('V2-10 a Session with no Record shows no Best today line', () => {
  renderSummary()

  expect(summaryDialog().querySelector('.session-summary-best')).toBeNull()
})

test('V2-10 a Session that logged fewer Sets than planned shows its volume without a down % comparison', () => {
  const { earlier, wed } = weekSessions()
  const partial: Session = { ...wed, entries: wed.entries.filter((e) => e.kind === 'warmup' || e.setIndex === 1) }
  render(
    <SessionSummary
      session={partial}
      earlierSessions={earlier}
      planFor={planFor}
      program={WEEK_PROGRAM}
      resolve={resolve}
      library={LIBRARY}
      workoutName="Workout A"
      onClose={vi.fn()}
    />,
  )

  const dialog = summaryDialog()
  expect(kpiValue(dialog, 'volume')).toBe('425 kg')
  expect(dialog.textContent).not.toMatch(/down \d+ %/)
})

test('V2-10 the finish summary reads the planned Sets from its Workout: 3 of 6 logged shows no comparison', () => {
  const earlier = benchSession('before', BASE - 7 * 24 * 60 * MINUTE, 50, 3, 100, 5)
  render(
    <SessionSummary
      session={benchSession('half', BASE, 30, 3, 80, 5)}
      earlierSessions={[earlier]}
      planFor={planFor}
      workout={{ id: 'workout-a', name: 'Workout A', exercises: [PLANS.bench, PLANS.pushup] }}
      resolve={resolve}
      library={LIBRARY}
      onClose={vi.fn()}
    />,
  )

  expect(kpiValue(summaryDialog(), 'volume')).toBe('1,200 kg')
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

// --- V3-02: verdict wording names the numbers, and a partial lift is not compared -----------

function renderBench(today: Session, earlier: Session[]): HTMLElement {
  render(
    <SessionSummary
      session={today}
      earlierSessions={earlier}
      planFor={planFor}
      program={WEEK_PROGRAM}
      resolve={resolve}
      library={LIBRARY}
      workoutName="Workout A"
      onClose={vi.fn()}
    />,
  )
  return summaryDialog()
}

test('V3-02 Lift by lift never reads a bare Same: it names the Sets, Same as last time · 3 × 80 × 5', () => {
  const before = benchSession('wed-7', WED - 7 * DAY_MS, 50, 3, 80, 5)
  const dialog = renderBench(benchSession('wed-14', WED, 50, 3, 80, 5), [before])

  // Title kept (weakened-tests gate); v7: the Sets are named in the repeated-reps form beside
  // the "= same" verdict, and the sentence says it matched.
  expect(dialog.querySelector('.session-summary-move-text')?.textContent).toBe('80×5 · 5 · 5')
  expect(dialog.querySelector('.session-summary-verdict')?.textContent).toBe('= same')
  expect(dialog.querySelector('.session-summary-sentence')?.textContent).toBe('Bench press matched Wed 7 Oct.')
})

test('V3-02 a lift with 1 of 3 Sets logged reads 1 of 3 sets, with no vs comparison', () => {
  const before = benchSession('wed-7', WED - 7 * DAY_MS, 50, 3, 80, 5)
  const dialog = renderBench(benchSession('wed-14', WED, 20, 1, 80, 5), [before])

  const verdict = dialog.querySelector('.session-summary-verdict') as HTMLElement
  expect(verdict.textContent).toBe('1 of 3 sets')
  expect(verdict).toHaveAttribute('data-tone', 'flat')
  expect(dialog.querySelector('.session-summary-versus')).toBeNull()
  expect(dialog.querySelector('.session-summary-move')?.textContent).not.toContain('vs')
})

// --- V4-03: one win, one comparison, and what comes next -------------------------------------

test('V4-03 several PRs: the headline is the first, "+1 more PR", and the Records list shows both', () => {
  const { earlier, today } = twoRecordSessions()
  const dialog = renderS5b(today, earlier)

  // Title kept (weakened-tests gate); v7: no headline PR; the sentence counts them ("Two
  // records.") and the Records list shows both.
  expect(dialog.querySelector('.session-summary-win-more')).toBeNull()
  expect(dialog.querySelector('.session-summary-sentence-rest')?.textContent).toBe('Two records.')
  expect(dialog.querySelector('.session-summary-sentence-lead')?.textContent).toMatch(/^Both lifts beat /)
  expect(within(within(dialog).getByRole('region', { name: 'Records' })).getAllByRole('listitem')).toHaveLength(2)
})

test('V4-03 a rep record by one reads +1 rep, never +1 reps', () => {
  const before = benchSession('before', BASE - 7 * 24 * 60 * MINUTE, 50, 3, 85, 5)
  const today = benchSession('reps', BASE, 52, 3, 85, 5)
  today.entries[0] = { ...today.entries[0], reps: 6 }
  const dialog = renderS5b(today, [before])

  // V6 (V5-06): one more rep at the heaviest weight is a PR because it lifts the estimated 1RM
  // (85 × (1 + 6/30) = 102 kg); v7: its row says "est. strength", the lift's verdict "+1 rep".
  expect(recordRows(dialog)).toEqual([' · est. strength | Bench press'])
  expect(dialog.querySelector('.session-summary-record-figure')?.textContent).toBe('102 kg')
  expect(dialog.textContent).not.toContain('+1 reps')
  expect(dialog.querySelector('.session-summary-move-text')?.textContent).toBe('85×6 · 5 · 5')
  expect(dialog.querySelector('.session-summary-verdict')?.textContent).toBe('↑ +1 rep')
})

test('V4-03 a partial Session reads "1 of 3 sets" in the figures, with no % comparison', () => {
  const before = benchSession('wed-7', WED - 7 * DAY_MS, 50, 3, 80, 5)
  const dialog = renderBench(benchSession('wed-14', WED, 20, 1, 80, 5), [before])

  // DX-14: the lead line says it was short; the totals line keeps the figures.
  expect(dialog.querySelector('.session-summary-totals')?.textContent).toBe('1 of 3 sets · 400 kg')
  expect(dialog.textContent).not.toMatch(/%/)
})

test('V6-11 DX-14 under half the planned Sets the Summary leads with "Short Session: n of N sets"; half or more does not', () => {
  const before = benchSession('wed-7', WED - 7 * DAY_MS, 50, 3, 80, 5)
  const short = renderBench(benchSession('wed-14', WED, 20, 1, 80, 5), [before])
  expect(short.querySelector('[data-kpi="short"]')?.textContent).toBe('Short Session: 1 of 3 sets')
  const sentence = short.querySelector('.session-summary-sentence') as HTMLElement
  const heading = short.querySelector('.session-summary-heading') as HTMLElement
  expect(heading.compareDocumentPosition(sentence) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(sentence.compareDocumentPosition(short.querySelector('.session-summary-section') as HTMLElement) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  cleanup()
  const most = renderBench(benchSession('wed-14', WED, 40, 2, 80, 5), [before])
  expect(most.querySelector('.session-summary-totals')?.textContent).toBe('2 of 3 sets · 800 kg')
  expect(most.querySelector('[data-kpi="short"]')).toBeNull()
})

test('V4-03 a full Session compares with the last same Workout: "vs <day>: volume +6.3 %"', () => {
  const before = benchSession('wed-7', WED - 7 * DAY_MS, 50, 3, 80, 5)
  const dialog = renderBench(benchSession('wed-14', WED, 50, 3, 85, 5), [before])

  // Title kept (weakened-tests gate); v7 (study §1.6): the comparison is per lift, under
  // "vs Wed 7 Oct", with no volume % headline.
  expect(dialog.querySelector('.session-summary-versus')?.textContent).toBe('vs Wed 7 Oct')
  expect(dialog.querySelector('.session-summary-verdict')?.textContent).toBe('↑ +5 kg')
  expect(dialog.querySelector('[data-kpi="comparison"]')).toBeNull()
  expect(dialog.textContent).not.toMatch(/%/)
})

test('V4-03 the summary never shows a zero muscle, a legend or Best today, and Share… and Done stay the dock', () => {
  const dialog = renderWeek()

  // Title kept (weakened-tests gate); v7: no muscle at all, no legend, no Best today; the dock is
  // Done alone and Share is the text link above it.
  expectNoMuscles(dialog)
  expect(dialog.textContent).not.toContain('sets / session')
  expect(dialog.textContent).not.toContain('Best today')
  const dock = dialog.querySelector('.session-summary-dock') as HTMLElement
  expect(within(dock).getAllByRole('button').map((b) => b.textContent)).toEqual(['Done'])
  expect(within(dialog).getByRole('button', { name: 'Share' }).closest('.session-summary-foot')).not.toBeNull()
})
