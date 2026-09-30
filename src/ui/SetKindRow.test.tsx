import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { SetKindRow } from './SetKindRow'
import type { SetKind } from '../types'

const LABELS = ['W-up', 'Working', 'Drop', 'Fail', 'AMRAP']

function renderRow(value: SetKind | null) {
  const onChange = vi.fn()
  render(<SetKindRow value={value} onChange={onChange} />)
  return { user: userEvent.setup(), onChange }
}

function pressed(): string[] {
  return screen
    .getAllByRole('button')
    .filter((button) => button.getAttribute('aria-pressed') === 'true')
    .map((button) => button.textContent ?? '')
}

test('O6 the row offers W-up, Working, Drop, Fail and AMRAP in that order', () => {
  renderRow(null)

  expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual(LABELS)
})

test('O6 a null value selects Working', () => {
  renderRow(null)

  expect(pressed()).toEqual(['Working'])
})

test.each([
  ['warmup', 'W-up'],
  ['drop', 'Drop'],
  ['failure', 'Fail'],
  ['amrap', 'AMRAP'],
] as const)('O6 the value %s selects %s', (value, label) => {
  renderRow(value)

  expect(pressed()).toEqual([label])
})

test.each([
  ['W-up', 'warmup'],
  ['Drop', 'drop'],
  ['Fail', 'failure'],
  ['AMRAP', 'amrap'],
] as const)('O6 choosing %s tells onChange %s', async (label, kind) => {
  const { user, onChange } = renderRow(null)

  await user.click(screen.getByRole('button', { name: label }))

  expect(onChange).toHaveBeenCalledWith(kind)
})

test('O6 choosing Working tells onChange null', async () => {
  const { user, onChange } = renderRow('drop')

  await user.click(screen.getByRole('button', { name: 'Working' }))

  expect(onChange).toHaveBeenCalledWith(null)
})
