// E18-T12 [O22]: the Muscles page, 12 bullet rows against the plan.
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { beforeAll, expect, test, vi } from 'vitest'
import { MusclesView } from './MusclesPage'
import { loadCatalog, loadPrograms } from '../../data/catalog'
import { loadLibrary } from '../../data/library'
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
  expect(screen.queryByRole('radio', { name: /4 weeks/ })).toBeNull()
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
