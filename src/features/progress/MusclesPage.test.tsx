// E18-T12 [O22]: the Muscles page, 12 bullet rows against the plan.
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { beforeAll, expect, test, vi } from 'vitest'
import { MusclesView } from './MusclesPage'
import { loadCatalog, loadPrograms } from '../../data/catalog'
import { loadLibrary } from '../../data/library'
import { band } from '../../domain/band'
import { muscleWeeks } from '../../domain/stats/muscles'
import type { LibraryExercise, Program, Session } from '../../types'

process.env.TZ = 'Asia/Jerusalem' // the zone the fixture was written in

const root = resolve(__dirname, '..', '..', '..')
const sessions = JSON.parse(readFileSync(join(root, 'src/test/fixtures/stats/sessions.json'), 'utf8')) as Session[]
const catalog = loadCatalog()
const program = loadPrograms().find((p) => p.id === 'assaf-ab-2026') as Program
let library: Map<string, LibraryExercise>
beforeAll(async () => {
  library = await loadLibrary()
})

const NOW = new Date(2026, 9, 15, 18, 5).getTime() // Thu 15 Oct 2026
const existing = sessions.filter((s) => s.startedAt <= NOW)

function show(): { container: HTMLElement } {
  return render(
    <MusclesView
      data={{ sessions: existing, program, resolve: (id) => catalog.get(id), library }}
      now={NOW}
      onBack={vi.fn()}
    />,
  )
}

const rowNames = (container: HTMLElement): string[] =>
  [...container.querySelectorAll('button[data-muscle]')].map((b) => b.getAttribute('data-muscle') ?? '')

test('O22 twelve muscle rows with Lats and Mid back apart, fewest sets first', () => {
  const { container } = show()
  const names = rowNames(container)
  expect(names).toHaveLength(12)
  expect(names).toContain('lats')
  expect(names).toContain('middle back')
  expect(names[0]).toBe('abdominals')
  expect(names[1]).toBe('calves')
})

test('O22 the 2-week window is the default, dated, under the on-plan sentence', () => {
  show()
  expect(screen.getByText('28 Sep – 11 Oct')).toBeVisible()
  expect(screen.getByText(/^On plan for 2 weeks/)).toBeVisible()
  expect(screen.getByRole('radio', { name: '2 weeks' })).toBeChecked()
  // V2-06: a 4 weeks segment now exists (the Sessions matrix moved here), but 2 weeks stays the default.
  expect(screen.getByRole('radio', { name: '4 weeks' })).not.toBeChecked()
})

// --- V2-06 step 3: the 4 weeks segment, the matrix that used to sit on the Sessions tab ---------

test('V2-06 the window segment reads This week | 2 weeks | 4 weeks', () => {
  show()
  expect(screen.getAllByRole('radio').map((radio) => radio.getAttribute('aria-label') ?? radio.closest('label')?.textContent)).toEqual([
    'This week',
    '2 weeks',
    '4 weeks',
  ])
})

test('V2-06 4 weeks shows each muscle per calendar week, in the Progress vocabulary, banded on the week scale', async () => {
  show()
  await userEvent.setup().click(screen.getByRole('radio', { name: '4 weeks' }))

  const card = screen.getByRole('region', { name: 'Muscle sets by week' })
  expect(screen.getByText('weeks of 21 Sep – 12 Oct')).toBeVisible()
  expect(within(card).getAllByRole('rowheader').map((header) => header.textContent)).toEqual([
    'Chest', 'Shoulders', 'Triceps', 'Lats', 'Mid back', 'Biceps',
    'Quads', 'Hamstrings', 'Glutes', 'Calves', 'Lower back', 'Abs',
  ])
  const weeks = muscleWeeks(existing, NOW, (id) => catalog.get(id), library, 1).slice(-4)
  const lats = card.querySelector('tr[data-muscle="lats"]') as HTMLElement
  const cells = [...lats.querySelectorAll('.heat-cell')]
  expect(cells.map((cell) => cell.textContent)).toEqual(weeks.map((w) => String(Math.round(w.sets.get('lats') ?? 0))))
  expect(cells.map((cell) => cell.getAttribute('data-band'))).toEqual(
    weeks.map((w) => String(band(Math.round(w.sets.get('lats') ?? 0), 'week'))),
  )
  expect(card.querySelector('.heat-legend[data-scale="week"]')).not.toBeNull()
  expect(document.body.textContent).not.toMatch(/Middle back|Quadriceps|Abdominals/)
})

test('V2-06 the 4 weeks matrix follows the stored week start', async () => {
  render(
    <MusclesView
      data={{ sessions: existing, program, resolve: (id) => catalog.get(id), library, weekStart: 0 }}
      now={NOW}
      onBack={vi.fn()}
    />,
  )
  await userEvent.setup().click(screen.getByRole('radio', { name: '4 weeks' }))
  expect(screen.getByText('weeks of 20 Sep – 11 Oct')).toBeVisible()
})

test('O22 a row prints whole numbers against its plan, half up', () => {
  show()
  const lats = screen.getByRole('button', { name: /^Lats/ })
  expect(lats).toHaveTextContent('19')
  expect(lats).toHaveTextContent('plan 19')
  expect(screen.getByRole('button', { name: /^Calves/ })).toHaveTextContent('plan 8')
})

test('O22 each row draws a done bar, a plan tick and the muted 10-20 band', () => {
  show()
  const lats = screen.getByRole('button', { name: /^Lats/ })
  expect(lats.querySelector('[data-part="done"]')).not.toBeNull()
  expect(lats.querySelector('[data-part="plan"]')).not.toBeNull()
  expect(lats.querySelector('[data-part="band"]')).not.toBeNull()
  expect(lats.querySelector('[data-part="still"]')).toBeNull()
})

test('O22 a row opens its contributors with the arithmetic', async () => {
  const user = userEvent.setup()
  show()
  await user.click(screen.getByRole('button', { name: /^Lats/ }))
  expect(
    screen.getByText('Lats 18.75 = Assisted pull-ups 6 · Machine row 6 · Narrow-grip pull-down 4.5 · Deadlift 2.25'),
  ).toBeVisible()
})

test('O22 This week adds the still-planned segment: Lats 12.5 done and 12.5 to come', async () => {
  const user = userEvent.setup()
  show()
  await user.click(screen.getByRole('radio', { name: 'This week' }))
  const lats = screen.getByRole('button', { name: /^Lats/ })
  expect(lats.querySelector('[data-part="still"]')).not.toBeNull()
  expect(lats).toHaveTextContent('13 still planned')
  expect(screen.queryByText('28 Sep – 11 Oct')).toBeNull()
  const chest = screen.getByRole('button', { name: /^Chest/ })
  expect(chest.querySelector('[data-part="still"]')).toBeNull()
})

test('E19-T4 O6 the 2-week window is cut on the stored week start', () => {
  render(
    <MusclesView
      data={{ sessions: existing, program, resolve: (id) => catalog.get(id), library, weekStart: 4 }}
      now={NOW}
      onBack={vi.fn()}
    />,
  )
  expect(screen.getByText('1 Oct – 14 Oct')).toBeVisible()
})

test('O22 the body map is an index: a region opens its muscle row', async () => {
  const user = userEvent.setup()
  const { container } = show()
  await user.click(container.querySelector('polygon[data-region="abs"]') as Element)
  const row = screen.getByRole('button', { name: /^Abs/ })
  expect(row).toHaveAttribute('aria-expanded', 'true')
  expect(within(row.parentElement as HTMLElement).getByText(/^Abs 3 = /)).toBeVisible()
})

// V1-26: a row outside the weekly set range says so in words, not by position alone.
test('V1-26 rows below or above the weekly range say so in words', () => {
  show()
  expect(screen.getByRole('button', { name: /^Abs/ })).toHaveTextContent('3 · below 10')
  expect(screen.getByRole('button', { name: /^Calves/ })).toHaveTextContent('8 · below 10')
  expect(screen.getByRole('button', { name: /^Shoulders/ })).toHaveTextContent('21 · above 20')
  expect(screen.getByRole('button', { name: /^Lats/ })).not.toHaveTextContent(/below|above/)
})

test('V1-26 the headline says "above" for a muscle over the range, not "at the top"', () => {
  show()
  const sentence = screen.getByText(/^On plan for 2 weeks/)
  expect(sentence).toHaveTextContent('Shoulders 21 is above the typical 10–20.')
  expect(sentence).not.toHaveTextContent(/Shoulders 21[^.]*at the top/)
  expect(sentence).toHaveTextContent('Lats 19 sits at the top of the typical 10–20.')
})
