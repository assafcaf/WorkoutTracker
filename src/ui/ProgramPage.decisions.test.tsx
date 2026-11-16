// v7 (study §1.8, build-plan step 11): the Program tab's "Needs a decision", on top, where the plan
// is changed, and the weekly bar without family colours. The statuses here are hand-built
// LiftStatus values; which lifts need a decision is programDecisions.test.ts's business.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import assafJson from '../data/programs/assaf-ab-2026.json'
import exercisesJson from '../data/exercises.json'
import type { LiftStatus } from '../domain/stats/status'
import { declarationsFor } from '../test/cssAudit'
import type { Exercise, Program } from '../types'
import { ProgramPage } from './ProgramPage'
import type { ProgramPageProps } from './ProgramPage'

const assaf = assafJson as unknown as Program
const catalog = new Map((exercisesJson as unknown as Exercise[]).map((exercise) => [exercise.id, exercise] as const))

function status(exerciseId: string, kind: LiftStatus['kind'], label: string, glyph: string, action: string, swap = false): LiftStatus {
  return { exerciseId, kind, label, glyph, action, swap, evidence: '', why: [], next: null, decision: true }
}

const STALLED = status('db-bench-press', 'stalled', 'Stalled', '=', 'Try a variation for 4 weeks.', true)
const LOWERED = status('narrow-grip-pull-down', 'lowered', 'Lowered', '↓', 'Stay at 46.25 kg until all 3 sets reach 12.')
const READY = status('seated-biceps-curls', 'ready', 'Ready', '↑', 'Next time: 15 kg.')

function renderPage(overrides: Partial<ProgramPageProps> = {}) {
  return render(
    <ProgramPage
      programs={[assaf]}
      activeProgramId="assaf-ab-2026"
      catalog={catalog}
      library={new Map()}
      onChooseProgram={vi.fn()}
      {...overrides}
    />,
  )
}

test('v7 Needs a decision heads the Program tab: one row per lift, its status and its one action', () => {
  const { container } = renderPage({ decisions: [STALLED, LOWERED, READY], onOpenLift: vi.fn() })

  const section = screen.getByRole('region', { name: 'Needs a decision' })
  const rows = within(section).getAllByRole('listitem')
  expect(rows.map((row) => row.querySelector('.program-page-decision-line')?.textContent)).toEqual([
    '= Stalled · Try a variation for 4 weeks.',
    '↓ Lowered · Stay at 46.25 kg until all 3 sets reach 12.',
    '↑ Ready · Next time: 15 kg.',
  ])
  expect(rows[0].querySelector('.status-mark')).toHaveAttribute('data-tone', 'flat')
  expect(rows[1].querySelector('.status-mark')).toHaveAttribute('data-tone', 'down')
  expect(rows[2].querySelector('.status-mark')).toHaveAttribute('data-tone', 'up')
  // On top: before the weekly bar and the first workout.
  const volume = container.querySelector('.program-page-volume') as HTMLElement
  expect(section.compareDocumentPosition(volume) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
})

test('v7 a decision whose action is a change of exercise offers Swap, which hands up the lift', async () => {
  const onSwap = vi.fn()
  renderPage({ decisions: [STALLED, READY], onSwap })

  const section = screen.getByRole('region', { name: 'Needs a decision' })
  const swaps = within(section).getAllByRole('button', { name: /^Swap/ })
  expect(swaps).toHaveLength(1)
  expect(swaps[0]).toHaveAccessibleName(`Swap ${catalog.get('db-bench-press')?.name}`)
  await userEvent.setup().click(swaps[0])
  expect(onSwap).toHaveBeenCalledWith('db-bench-press')
})

test('v7 no Swap when the lift cannot be swapped, or with no handler', () => {
  renderPage({ decisions: [STALLED], onSwap: vi.fn(), canSwap: () => false })
  expect(within(screen.getByRole('region', { name: 'Needs a decision' })).queryByRole('button', { name: /^Swap/ })).toBeNull()
})

test('v7 each decision names its lift as a door to the Lift page', async () => {
  const onOpenLift = vi.fn()
  renderPage({ decisions: [LOWERED], onOpenLift })

  const name = catalog.get('narrow-grip-pull-down')?.name as string
  const section = screen.getByRole('region', { name: 'Needs a decision' })
  await userEvent.setup().click(within(section).getByRole('button', { name }))
  expect(onOpenLift).toHaveBeenCalledWith('narrow-grip-pull-down')
})

test('v7 with no decision there is no Needs a decision section', () => {
  renderPage({ decisions: [] })
  expect(screen.queryByRole('region', { name: 'Needs a decision' })).toBeNull()
  expect(screen.queryByText('Needs a decision')).toBeNull()
})

test('v7 the weekly bar draws every family in the one neutral ink, never a family colour', () => {
  const { container } = renderPage()

  for (const segment of container.querySelectorAll('.program-page-volume-segment')) {
    expect(segment).not.toHaveClass('program-family')
  }
  expect(container.querySelector('.program-page .muscle-dot, .program-page .program-family')).toBeNull()
  const css = readFileSync(join(process.cwd(), 'src/ui/ProgramPage.css'), 'utf-8')
  expect(declarationsFor(css, '.program-page-volume-segment').get('background')).toBe('var(--color-muted)')
  expect(css).not.toMatch(/--data-(push|pull|legs|core)/)
})

test('v7 the decision rows keep 44 px targets: the lift door and Swap', () => {
  const css = readFileSync(join(process.cwd(), 'src/ui/ProgramPage.css'), 'utf-8')
  expect(declarationsFor(css, '.program-page-decision-name.lift-door').get('min-height')).toBe('var(--tap-min)')
  expect(declarationsFor(css, '.program-page-decision-swap').get('min-height')).toBe('var(--tap-min)')
})
