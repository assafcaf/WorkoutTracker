// V6 (V5-05, V5-06): a past workout's summary, opened from Sessions (it has Edit and Delete), on
// the stats fixture's Mon 12 Oct Workout B. It says what that Session did, once: the header is
// the date, duration, Sets and the PR count; Lift by lift carries the PR tags; no Records list,
// no "This week" line, the volume line labelled "Volume"; "Muscles worked" in whole Sets. The finish
// summary (no Edit, no Delete) is covered by SessionSummary.test.tsx.
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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
  const figures = dialog.querySelector('.session-summary-figures') as HTMLElement
  expect(figures.textContent).toMatch(/^1 h 06 min · 23 sets · /)
  expect(figures.querySelector('[data-kpi="prs"]')?.textContent).toBe('2 PRs')
  expect(dialog.querySelector('.session-summary-win')).toBeNull()
})

test('V6 past summary shows each PR once, inline in Lift by lift; rep bests carry no PR tag', () => {
  const dialog = renderPast()
  expect(within(dialog).queryByRole('region', { name: 'Records' })).toBeNull()
  const lifts = within(dialog).getByRole('region', { name: 'Lift by lift' })
  expect(lifts.querySelectorAll('.tag-pr')).toHaveLength(2)
  expect(dialog.querySelectorAll('.tag-pr')).toHaveLength(2)
  const tagged = [...lifts.querySelectorAll('.session-summary-move')]
    .filter((move) => move.querySelector('.tag-pr') !== null)
    .map((move) => move.querySelector('.session-summary-move-name')?.textContent)
  expect(tagged).toEqual(['Deadlift', 'Machine row'])
})

test('V6 past summary drops the week line and labels the volume line', () => {
  const dialog = renderPast()
  expect(dialog.querySelector('.session-summary-week')).toBeNull()
  expect(dialog.textContent).not.toContain('This week')
  expect(dialog.textContent).not.toContain('next up')
  expect(dialog.querySelector('.session-summary-volume')?.textContent).toMatch(/^Volume [\d,]+ kg/)
})

test('V6 past summary names the muscles "Muscles worked", in whole Sets', () => {
  const dialog = renderPast()
  expect(dialog.textContent).not.toContain('Worked today')
  const muscles = within(dialog).getByRole('region', { name: 'Muscles worked' })
  expect(muscles.textContent).toMatch(/^Muscles worked \(sets\): Lats \d+ · /)
  expect(muscles.textContent).not.toMatch(/\d\.\d/)
})

test('V6 past summary keeps Delete workout, which calls onDelete', async () => {
  const onDelete = vi.fn()
  const dialog = renderPast(onDelete)
  await userEvent.click(within(dialog).getByRole('button', { name: 'Delete workout' }))
  expect(onDelete).toHaveBeenCalledTimes(1)
})
