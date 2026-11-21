// V6 (V5-05, V5-06), v7 (study §1.6): a past workout's summary, opened from Sessions (it has Edit
// and Delete), on the stats fixture's Mon 12 Oct Workout B. It reads as the finish summary does:
// the day and duration, the verdict sentence, the PR rows in gold, Lift by lift with one verdict
// per lift, one totals line; no muscles, no week line and no "Next". The finish summary (no Edit,
// no Delete) is covered by SessionSummary.test.tsx.
import { render, screen, within } from '@testing-library/react'
import { beforeAll, expect, test, vi } from 'vitest'
import sessionsJson from '../test/fixtures/stats/sessions.json'
import { loadCatalog, loadPrograms } from '../data/catalog'
import { loadLibrary } from '../data/library'
import { SessionSummary } from './SessionSummary'
import type { LibraryExercise, Session } from '../types'

const sessions = sessionsJson as unknown as Session[]
const catalog = loadCatalog()
const program = loadPrograms().find((p) => p.id === 'assaf-ab-2026')!
const day = (ms: number) => new Date(ms).toLocaleDateString('sv-SE', { timeZone: 'Asia/Jerusalem' })
const mon12 = sessions.find((s) => day(s.startedAt) === '2026-10-12')!
const workout = program.workouts.find((w) => w.id === mon12.workoutId)!
let library: Map<string, LibraryExercise>

beforeAll(async () => {
  library = await loadLibrary()
})

function renderPast(onDelete = vi.fn()): HTMLElement {
  render(
    <SessionSummary
      session={mon12}
      resolve={(id) => catalog.get(id)}
      library={library}
      workoutName={workout.name}
      earlierSessions={sessions.filter((s) => s.startedAt < mon12.startedAt)}
      planFor={(id) => workout.exercises.find((plan) => plan.exerciseId === id)}
      workout={workout}
      program={program}
      onClose={vi.fn()}
      onEdit={vi.fn()}
      onDelete={onDelete}
    />,
  )
  return screen.getByRole('dialog', { name: 'Session summary' })
}

test('V6 past summary header: duration, Sets and the PR count; no PR headline repeating a lift', () => {
  const dialog = renderPast()
  // Title kept (weakened-tests gate); v7: the duration sits with the day, the Sets in the totals
  // line, and the PR count is a word in the verdict sentence ("Two records.").
  expect(dialog.querySelector('.session-summary-label')?.textContent).toMatch(/ · 1 h 06 min$/)
  expect(dialog.querySelector('.session-summary-totals')?.textContent).toMatch(/^23 sets · [\d,]+ kg/)
  expect(dialog.querySelector('.session-summary-sentence')?.textContent).toMatch(
    /^5 of 7 lifts beat \w+( \d{1,2} \w{3})?\. Two records\. Narrow-grip pull-down dipped\.$/,
  )
  expect(dialog.querySelector('[data-kpi="prs"]')).toBeNull()
  expect(dialog.querySelector('.session-summary-win')).toBeNull()
})

test('V6 past summary shows each PR once, inline in Lift by lift; rep bests carry no PR tag', () => {
  const dialog = renderPast()
  // Title kept (weakened-tests gate); v7: each PR is said once, as a gold row above Lift by lift;
  // the lift rows carry no tag, and a rep best is never a row.
  const records = within(dialog).getByRole('region', { name: 'Records' })
  const rows = within(records).getAllByRole('listitem')
  expect(rows.map((row) => row.querySelector('.session-summary-record-detail')?.textContent)).toEqual([
    'Deadlift',
    'Machine row',
  ])
  const lifts = within(dialog).getByRole('region', { name: 'Lift by lift' })
  expect(lifts.querySelectorAll('.tag-pr')).toHaveLength(0)
  expect(dialog.querySelectorAll('.tag-pr')).toHaveLength(2)
  // The repeated-reps form and one verdict per lift: Narrow-grip pull-down dipped by 3 reps.
  const pulldown = [...lifts.querySelectorAll('.session-summary-move')].find(
    (move) => move.querySelector('.session-summary-move-name')?.textContent === 'Narrow-grip pull-down',
  ) as HTMLElement
  expect(pulldown.querySelector('.session-summary-move-text')?.textContent).toBe('46.25×9 · 8 · 8')
  expect(pulldown.querySelector('.session-summary-verdict')?.textContent).toBe('↓ −3 reps')
})

test('V6 past summary drops the week line and labels the volume line', () => {
  const dialog = renderPast()
  // Title kept (weakened-tests gate); v7: no week line and no "Next" on a past workout; the volume
  // is the kilos in the totals line, after the Sets.
  expect(dialog.querySelector('.session-summary-week')).toBeNull()
  expect(dialog.querySelector('.session-summary-next')).toBeNull()
  expect(dialog.textContent).not.toContain('This week')
  expect(dialog.textContent).not.toContain('next up')
  expect(dialog.textContent).not.toContain('Next:')
  expect(dialog.querySelector('[data-kpi="volume"] .session-summary-kpi-value')?.textContent).toMatch(/^[\d,]+ kg$/)
})

test('V6 past summary names the muscles "Muscles worked", in whole Sets', () => {
  const dialog = renderPast()
  // Title kept (weakened-tests gate); v7 (study §1.6, §4): the muscles left the summary for
  // Progress › Muscles.
  expect(dialog.textContent).not.toContain('Worked today')
  expect(within(dialog).queryByRole('region', { name: 'Muscles worked' })).toBeNull()
  expect(dialog.textContent).not.toContain('Muscles worked')
  expect(dialog.querySelectorAll('[data-muscle]')).toHaveLength(0)
})

test('DX-14 Session detail has Edit as text in its header and a Back, and no Done bar or Delete link', async () => {
  const onDelete = vi.fn()
  const dialog = renderPast(onDelete)
  expect(within(dialog).queryByRole('button', { name: /Delete/ })).toBeNull()
  expect(within(dialog).queryByRole('button', { name: 'Done' })).toBeNull()
  expect(dialog.querySelector('.session-summary-dock')).toBeNull()
  const edit = within(dialog).getByRole('button', { name: 'Edit session' })
  expect(edit.closest('.session-summary-bar')).not.toBeNull()
  expect(within(dialog).getByRole('button', { name: 'Back' }).closest('.session-summary-bar')).not.toBeNull()
})

test('DX-06 Session detail embedded in a page has no panel and no bar of its own: the page carries ‹ and Edit', async () => {
  const onEdit = vi.fn()
  render(
    <SessionSummary
      session={mon12}
      resolve={(id) => catalog.get(id)}
      library={library}
      workoutName={workout.name}
      earlierSessions={sessions.filter((s) => s.startedAt < mon12.startedAt)}
      planFor={(id) => workout.exercises.find((plan) => plan.exerciseId === id)}
      workout={workout}
      program={program}
      onClose={vi.fn()}
      onEdit={onEdit}
      embedded
    />,
  )
  expect(screen.queryByRole('dialog')).toBeNull()
  const region = screen.getByRole('region', { name: 'Session summary' })
  expect(within(region).queryByRole('button', { name: 'Back' })).toBeNull()
  expect(within(region).queryByRole('button', { name: 'Edit session' })).toBeNull()
  expect(region.querySelector('.session-summary-bar')).toBeNull()
})
