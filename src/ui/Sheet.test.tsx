import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { Sheet } from './Sheet'
import { Snackbar } from './Snackbar'

test('S3b a Sheet is a modal dialog named by its label, rendered over the page', () => {
  render(
    <Sheet label="Back squat tools" onClose={() => undefined}>
      <p>inside</p>
    </Sheet>,
  )

  const sheet = screen.getByRole('dialog', { name: 'Back squat tools' })
  expect(sheet).toHaveAttribute('aria-modal', 'true')
  expect(sheet).toHaveTextContent('inside')
  expect(document.querySelector('.sheet-scrim')).not.toBeNull()
  expect(document.querySelector('.sheet-grabber')).not.toBeNull()
})

test('S3b Escape and a tap on the scrim close a Sheet', async () => {
  const user = userEvent.setup()
  const onClose = vi.fn()
  render(
    <Sheet label="Tools" onClose={onClose}>
      <p>inside</p>
    </Sheet>,
  )

  await user.keyboard('{Escape}')
  await user.click(document.querySelector('.sheet-scrim') as HTMLElement)

  expect(onClose).toHaveBeenCalledTimes(2)
})

test('S2b the Snackbar says what happened and offers its one action', async () => {
  const user = userEvent.setup()
  const onAction = vi.fn()
  render(<Snackbar message="Set deleted" actionLabel="Undo" onAction={onAction} />)

  expect(screen.getByRole('status')).toHaveTextContent('Set deleted')
  await user.click(screen.getByRole('button', { name: 'Undo' }))

  expect(onAction).toHaveBeenCalledTimes(1)
})
