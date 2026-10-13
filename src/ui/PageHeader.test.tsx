import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { PageHeader } from './PageHeader'

test('PageHeader renders the title as the screen heading', () => {
  render(<PageHeader title="Dashboard" />)

  const title = screen.getByRole('heading', { level: 1, name: 'Dashboard' })
  expect(title).toHaveClass('page-header-title')
  expect(title.closest('header.page-header')).not.toBeNull()
})

test('PageHeader renders the subtitle under the title, and none when it is not given', () => {
  const { container, rerender } = render(<PageHeader title="Dashboard" subtitle="Tue 13 Oct · Synced 2 min ago" />)

  expect(screen.getByText('Tue 13 Oct · Synced 2 min ago')).toHaveClass('page-header-subtitle')

  rerender(<PageHeader title="Dashboard" />)
  expect(container.querySelector('.page-header-subtitle')).toBeNull()
})

test('PageHeader puts its actions in a right-hand slot after the title, and none when it is not given', () => {
  const { container, rerender } = render(
    <PageHeader title="Dashboard" actions={<button type="button" className="icon-btn" aria-label="Settings" />} />,
  )

  const slot = container.querySelector('.page-header-actions') as HTMLElement
  expect(slot).not.toBeNull()
  expect(slot.contains(screen.getByRole('button', { name: 'Settings' }))).toBe(true)
  expect(container.querySelector('.page-header-text')?.nextElementSibling).toBe(slot)

  rerender(<PageHeader title="Dashboard" />)
  expect(container.querySelector('.page-header-actions')).toBeNull()
})

test('PageHeader adds a caller class to its header element', () => {
  const { container } = render(<PageHeader title="Lifts" className="app-header" />)

  expect(container.querySelector('header')).toHaveClass('page-header', 'app-header')
})
