import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { ImportConfirm } from './ImportConfirm'
import type { ImportPlan } from '../storage/backup'

// Hand-checked: 26 kept + 8 removed = 34 current; 26 kept + 5 added = 31 incoming -- matches the
// ticket's "34 sessions on the phone and a file holding 31" example.
const plan: ImportPlan = { added: 5, removed: 8, kept: 26 }

test('O8 ImportConfirm names the current count, the incoming count and how many local sessions will be removed', () => {
  render(
    <ImportConfirm
      currentCount={34}
      incomingCount={31}
      plan={plan}
      onConfirm={vi.fn()}
      onCancel={vi.fn()}
    />,
  )

  const dialog = screen.getByRole('alertdialog')
  expect(dialog.textContent).toContain('34')
  expect(dialog.textContent).toContain('31')
  expect(dialog.textContent).toContain('8')
})

test('O8 confirming an import calls onConfirm and not onCancel', async () => {
  const user = userEvent.setup()
  const onConfirm = vi.fn()
  const onCancel = vi.fn()
  render(
    <ImportConfirm
      currentCount={34}
      incomingCount={31}
      plan={plan}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />,
  )

  await user.click(screen.getByRole('button', { name: 'Import' }))

  expect(onConfirm).toHaveBeenCalledTimes(1)
  expect(onCancel).not.toHaveBeenCalled()
})

test('O8 cancelling an import calls onCancel and not onConfirm', async () => {
  const user = userEvent.setup()
  const onConfirm = vi.fn()
  const onCancel = vi.fn()
  render(
    <ImportConfirm
      currentCount={34}
      incomingCount={31}
      plan={plan}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />,
  )

  await user.click(screen.getByRole('button', { name: 'Cancel' }))

  expect(onCancel).toHaveBeenCalledTimes(1)
  expect(onConfirm).not.toHaveBeenCalled()
})
