// fix-refusal-shift: the refusal message (e.g. "Finish the workout in progress first", O11)
// must not move any Edit/Copy/Delete/Reset button. It renders after every Program's own row in
// DOM order, and carries role="status" or role="alert" so it is announced.
import { render, screen, within } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { ProgramPage } from './ProgramPage'
import type { Program } from '../types'

const userOnlyProgram: Program = {
  id: 'user-only',
  name: 'User only program',
  units: 'kg',
  sessionsPerWeek: 1,
  workouts: [],
}

const otherProgram: Program = {
  id: 'other',
  name: 'Other program',
  units: 'kg',
  sessionsPerWeek: 1,
  workouts: [],
}

function renderPage(programMessage: string | null) {
  return render(
    <ProgramPage
      programs={[userOnlyProgram, otherProgram]}
      activeProgramId="user-only"
      catalog={new Map()}
      library={new Map()}
      onChooseProgram={vi.fn()}
      userProgramIds={new Set(['user-only'])}
      bundledProgramIds={new Set()}
      onNewProgram={vi.fn()}
      onEditProgram={vi.fn()}
      onCopyProgram={vi.fn()}
      onDeleteProgram={vi.fn()}
      onResetProgram={vi.fn()}
      programMessage={programMessage}
    />,
  )
}

test('the refusal message renders after every Program row, not before the first row', () => {
  const { container } = renderPage('Finish the workout in progress first')

  const rows = Array.from(container.querySelectorAll('.program-page-switcher-row'))
  expect(rows.length).toBeGreaterThan(0)
  const message = screen.getByText('Finish the workout in progress first')

  for (const row of rows) {
    expect(Boolean(row.compareDocumentPosition(message) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(
      true,
    )
  }
})

test('the refusal message carries role status or alert so it is announced', () => {
  renderPage('Finish the workout in progress first')

  const byStatus = screen.queryByRole('status')
  const byAlert = screen.queryByRole('alert')
  expect(byStatus ?? byAlert).not.toBeNull()
  expect((byStatus ?? byAlert)?.textContent).toBe('Finish the workout in progress first')
})

test('every Edit/Copy/Delete button keeps its row position whether or not a message is set', () => {
  const { container: withoutMessage } = renderPage(null)
  const editButtonsWithout = within(withoutMessage as unknown as HTMLElement)
    .getAllByRole('button', { name: 'Edit' })
    .map((button) => button.closest('.program-page-switcher-row'))

  const { container: withMessage } = renderPage('Finish the workout in progress first')
  const editButtonsWith = within(withMessage as unknown as HTMLElement)
    .getAllByRole('button', { name: 'Edit' })
    .map((button) => button.closest('.program-page-switcher-row')?.getAttribute('data-program-id'))

  expect(editButtonsWithout.map((row) => row?.getAttribute('data-program-id'))).toEqual([
    'user-only',
    'other',
  ])
  expect(editButtonsWith).toEqual(['user-only', 'other'])
})
