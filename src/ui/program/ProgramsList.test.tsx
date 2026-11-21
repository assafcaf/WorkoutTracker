// DX-04: the Programs page -- every Program a plain row, tap to make it active, one trailing Copy,
// a quiet Delete (or Reset to original) on the trainee's own that asks once more in place, and
// "New program" at the foot. No per-Program Edit.
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import type { Program } from '../../types'
import { ProgramsList, type ProgramsListProps } from './ProgramsList'

const program = (id: string, name: string): Program => ({ id, name, units: 'kg', sessionsPerWeek: 3, workouts: [] })
const PROGRAMS = [program('ab', 'A/B Split'), program('mine', 'My program'), program('edited', 'Edited bundled')]

function renderList(overrides: Partial<ProgramsListProps> = {}) {
  const props: ProgramsListProps = {
    programs: PROGRAMS,
    activeProgramId: 'ab',
    onChoose: vi.fn(),
    onCopy: vi.fn(),
    onNew: vi.fn(),
    onDelete: vi.fn(),
    onReset: vi.fn(),
    userProgramIds: new Set(['mine', 'edited']),
    bundledProgramIds: new Set(['ab', 'edited']),
    ...overrides,
  }
  render(<ProgramsList {...props} />)
  return props
}

const rowOf = (id: string): HTMLElement => document.querySelector(`[data-program-id="${id}"]`) as HTMLElement

test('the active Program is ticked; tapping another makes it active, tapping the active one does nothing', async () => {
  const user = userEvent.setup()
  const props = renderList()

  expect(within(rowOf('ab')).getByRole('button', { name: /^A\/B Split/ })).toHaveAttribute('aria-pressed', 'true')
  await user.click(within(rowOf('ab')).getByRole('button', { name: /^A\/B Split/ }))
  await user.click(within(rowOf('mine')).getByRole('button', { name: /^My program/ }))
  expect(props.onChoose).toHaveBeenCalledTimes(1)
  expect(props.onChoose).toHaveBeenCalledWith('mine')
})

test('each row carries Copy and no Edit', async () => {
  const user = userEvent.setup()
  const props = renderList()

  expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull()
  await user.click(within(rowOf('ab')).getByRole('button', { name: 'Copy A/B Split' }))
  expect(props.onCopy).toHaveBeenCalledWith('ab')
})

test('a Program of the trainee’s own offers Delete, an edited bundled one Reset; neither acts before Confirm', async () => {
  const user = userEvent.setup()
  const props = renderList()

  expect(within(rowOf('ab')).queryByRole('button', { name: /Delete|Reset/ })).toBeNull()
  await user.click(within(rowOf('mine')).getByRole('button', { name: 'Delete My program' }))
  expect(props.onDelete).not.toHaveBeenCalled()
  await user.click(within(rowOf('mine')).getByRole('button', { name: 'Confirm' }))
  expect(props.onDelete).toHaveBeenCalledWith('mine')

  await user.click(within(rowOf('edited')).getByRole('button', { name: 'Reset Edited bundled to original' }))
  await user.click(within(rowOf('edited')).getByRole('button', { name: 'Confirm' }))
  expect(props.onReset).toHaveBeenCalledWith('edited')
})

test('a refused change is announced under the list, and New program closes it', async () => {
  const user = userEvent.setup()
  const props = renderList({ message: 'Finish the workout in progress first' })

  const status = screen.getByRole('status')
  expect(status).toHaveTextContent('Finish the workout in progress first')
  const list = screen.getByRole('list', { name: 'Programs' })
  expect(list.compareDocumentPosition(status) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  await user.click(screen.getByRole('button', { name: 'New program' }))
  expect(props.onNew).toHaveBeenCalledTimes(1)
})
