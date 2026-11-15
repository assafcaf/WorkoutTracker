import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { Keypad } from './Keypad'

test('V1-18 typing 8, 3, Delete digit, 2 shows 82 and commits 82', async () => {
  const user = userEvent.setup()
  const onCommit = vi.fn()
  render(<Keypad label="Weight" value={60} onCommit={onCommit} onCancel={vi.fn()} />)

  for (const key of ['8', '3']) await user.click(screen.getByRole('button', { name: key }))
  await user.click(screen.getByRole('button', { name: 'Delete digit' }))
  await user.click(screen.getByRole('button', { name: '2' }))

  expect(document.querySelector('.keypad-entry')?.textContent).toBe('82')
  await user.click(screen.getByRole('button', { name: 'OK' }))
  expect(onCommit).toHaveBeenCalledWith(82)
})

test('V1-18 Delete digit is a key, as tall as the digits', () => {
  render(<Keypad label="Weight" value={60} onCommit={vi.fn()} onCancel={vi.fn()} />)
  const key = screen.getByRole('button', { name: 'Delete digit' })
  // `.keypad-key` carries min-height: var(--key-min), the 64 px key height.
  expect(key).toHaveClass('keypad-key', 'key')
})

test('V1-18 Delete digit on an empty entry leaves the hint showing', async () => {
  const user = userEvent.setup()
  render(<Keypad label="Weight" value={60} onCommit={vi.fn()} onCancel={vi.fn()} />)
  await user.click(screen.getByRole('button', { name: 'Delete digit' }))
  expect(document.querySelector('.keypad-entry')?.textContent).toBe('60')
})
