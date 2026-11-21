// DX-04, DX-16, DX-03: the Program tab's body -- each Workout a plain list (no card, no table, no
// column headers, no Swap), one muscles row into Progress › Muscles, and the list group.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import assafJson from '../data/programs/assaf-ab-2026.json'
import exercisesJson from '../data/exercises.json'
import libraryJson from '../data/library/exercises.json'
import { plannedAgainstRange } from '../domain/setRange'
import { declarationsFor } from '../test/cssAudit'
import type { Exercise, LibraryExercise, Program } from '../types'
import { muscleVerdict, ProgramPage, type ProgramPageProps } from './ProgramPage'

const assaf = assafJson as unknown as Program
const catalog = new Map((exercisesJson as Exercise[]).map((e) => [e.id, e] as const))
const library = new Map((libraryJson as LibraryExercise[]).map((e) => [e.id, e] as const))
const lookup = (id: string): Exercise | undefined => catalog.get(id)

function renderPage(overrides: Partial<ProgramPageProps> = {}) {
  const links = { onOpenPrograms: vi.fn(), onOpenDeload: vi.fn(), onOpenExercises: vi.fn(), onOpenSettings: vi.fn() }
  const props: ProgramPageProps = { program: assaf, catalog, library, links, onOpenLift: vi.fn(), ...overrides }
  render(<ProgramPage {...props} />)
  return { ...props, links }
}

test('DX-16 each Workout is a section header over a plain list, one row per Plan, no card or table', () => {
  renderPage({ loadOf: () => '70', minutesOf: () => 66 })

  expect(screen.getByRole('heading', { level: 2, name: 'Workout A · 23 sets · ~66 min' })).toBeTruthy()
  expect(screen.getByRole('heading', { level: 2, name: 'Workout B · 23 sets · ~66 min' })).toBeTruthy()
  const a = within(screen.getByRole('list', { name: 'Workout A' })).getAllByRole('listitem')
  expect(a).toHaveLength(7)
  expect(a[1]).toHaveTextContent('Lunges3 × 10–12 · 70 kg')
  expect(document.querySelector('.card, table, th')).toBeNull()
})

test('DX-16 the rest is written out only where it is not the usual 1:30', () => {
  renderPage()
  const a = screen.getByRole('list', { name: 'Workout A' })
  expect(within(a).getByRole('button', { name: /^Back squat/ })).toHaveTextContent('4 × 8–10 · 3:00 rest')
  expect(within(a).getByRole('button', { name: /^Lunges/ }).textContent).toBe('Lunges3 × 10–12')
})

test('DX-16 a load with no weight to go on is left out; a bodyweight load has no kg', () => {
  renderPage({ loadOf: (plan) => (plan.exerciseId === 'push-ups' ? 'BW' : '–') })
  const a = screen.getByRole('list', { name: 'Workout A' })
  expect(within(a).getByRole('button', { name: /^Push-ups/ }).textContent).toBe('Push-ups3 × 10–15 · BW')
  expect(within(a).getByRole('button', { name: /^Lunges/ }).textContent).toBe('Lunges3 × 10–12')
})

test('DX-16 a Plan row opens its lift page', async () => {
  const user = userEvent.setup()
  const onOpenLift = vi.fn()
  renderPage({ onOpenLift })
  await user.click(screen.getByRole('button', { name: /^Deadlift/ }))
  expect(onOpenLift).toHaveBeenCalledWith('deadlift')
})

test('DX-03 one muscles row, "69 sets a week · …", opens Progress › Muscles', async () => {
  const user = userEvent.setup()
  const onOpenMuscles = vi.fn()
  renderPage({ onOpenMuscles })
  const row = screen.getByRole('button', { name: `69 sets a week · ${muscleVerdict(assaf, lookup, library)}` })
  await user.click(row)
  expect(onOpenMuscles).toHaveBeenCalledTimes(1)
  expect(screen.queryByText('Needs a decision')).toBeNull()
  expect(document.querySelector('.body-map')).toBeNull()
})

test('DX-03 the muscle verdict names one or two muscles out of range, counts more, or says all are in it', () => {
  const range = plannedAgainstRange(assaf, lookup, library)
  const out = range.filter((row) => row.standing !== 'within')
  const verdict = muscleVerdict(assaf, lookup, library)
  if (out.length === 0) expect(verdict).toBe('every muscle in range')
  else if (out.length > 2) expect(verdict).toBe(`${out.length} muscles out of range`)
  else expect(verdict).toMatch(/(above|below) range/)

  const one: Program = { ...assaf, workouts: [{ id: 'w', name: 'W', exercises: [{ ...assaf.workouts[0].exercises[0], sets: 2 }] }], sessionsPerWeek: 1 }
  expect(muscleVerdict(one, lookup, library)).toMatch(/muscles out of range$/)
})

test('DX-04 the list group: Programs, Deload week, Exercises, Settings, each a row that opens its page', async () => {
  const user = userEvent.setup()
  const { links } = renderPage()
  const rows = within(screen.getByRole('list', { name: 'More' })).getAllByRole('button')
  expect(rows.map((row) => row.textContent)).toEqual(['Programs', 'Deload week', 'Exercises', 'Settings'])
  for (const row of rows) await user.click(row)
  expect(links.onOpenPrograms).toHaveBeenCalledTimes(1)
  expect(links.onOpenDeload).toHaveBeenCalledTimes(1)
  expect(links.onOpenExercises).toHaveBeenCalledTimes(1)
  expect(links.onOpenSettings).toHaveBeenCalledTimes(1)
})

test('DX-04 the Settings row says when a backup is due, and the Deload row when one is on', () => {
  const links = { onOpenPrograms: vi.fn(), onOpenDeload: vi.fn(), onOpenExercises: vi.fn(), onOpenSettings: vi.fn(), backupDue: true, deloadOn: true }
  render(<ProgramPage program={assaf} catalog={catalog} library={library} links={links} />)
  expect(screen.getByRole('button', { name: /^Settings/ })).toHaveTextContent('A backup is due')
  expect(screen.getByRole('button', { name: /^Deload week/ })).toHaveTextContent('On this week')
})

test('DX-16 no text on the Program tab is under 14 px', () => {
  const css = readFileSync(join(process.cwd(), 'src/ui/ProgramPage.css'), 'utf-8')
  expect(css).not.toMatch(/--text-xs/)
  expect(declarationsFor(css, '.program-plan-row').get('font-size')).toBe('var(--text-md)')
  expect(declarationsFor(css, '.program-plan-figure').get('white-space')).toBe('nowrap')
})
