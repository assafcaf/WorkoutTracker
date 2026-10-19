import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, expect, test, vi } from 'vitest'
import { HealthSetup } from './HealthSetup'
import { HEALTH_SHORTCUT_STEPS } from './healthShortcut'

function Harness({ ready = false, onReady = () => {} }: { ready?: boolean; onReady?: () => void }) {
  const [open, setOpen] = useState(false)
  return <HealthSetup open={open} ready={ready} onToggle={() => setOpen((o) => !o)} onReady={onReady} />
}

afterEach(() => vi.unstubAllGlobals())

test('O1 Set up Apple Health expands the numbered steps on the page and a second tap collapses', () => {
  render(<Harness />)
  expect(screen.queryByRole('list')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Set up Apple Health' }))
  expect(screen.getByRole('list').tagName).toBe('OL')
  expect(screen.getAllByRole('listitem')).toHaveLength(HEALTH_SHORTCUT_STEPS.length)
  expect(screen.queryByRole('dialog')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Set up Apple Health' }))
  expect(screen.queryByRole('list')).toBeNull()
})

test('O1 Copy name writes the Shortcut name to the clipboard', () => {
  const writeText = vi.fn().mockResolvedValue(undefined)
  vi.stubGlobal('navigator', { clipboard: { writeText } })
  render(<Harness />)
  fireEvent.click(screen.getByRole('button', { name: 'Set up Apple Health' }))
  fireEvent.click(screen.getByRole('button', { name: 'Copy name' }))
  expect(writeText).toHaveBeenCalledWith('Workout Tracker to Health')
})

test('O1 without a clipboard the name is shown as selectable text', () => {
  vi.stubGlobal('navigator', {})
  render(<Harness />)
  fireEvent.click(screen.getByRole('button', { name: 'Set up Apple Health' }))
  fireEvent.click(screen.getByRole('button', { name: 'Copy name' }))
  expect(screen.getByLabelText('Shortcut name')).toHaveProperty('value', 'Workout Tracker to Health')
})

test('O2 Done, it is set up calls onReady', () => {
  const onReady = vi.fn()
  render(<Harness onReady={onReady} />)
  fireEvent.click(screen.getByRole('button', { name: 'Set up Apple Health' }))
  fireEvent.click(screen.getByRole('button', { name: "Done, it's set up" }))
  expect(onReady).toHaveBeenCalledTimes(1)
})

test('O2 once ready the Done button is gone', () => {
  render(<Harness ready />)
  fireEvent.click(screen.getByRole('button', { name: 'Set up Apple Health' }))
  expect(screen.queryByRole('button', { name: "Done, it's set up" })).toBeNull()
})

test('O3 the hint shows only while not confirmed', () => {
  const hint = "If iOS says it can't find the shortcut, set it up first."
  const { unmount } = render(<Harness />)
  expect(screen.getByText(hint)).toBeTruthy()
  unmount()
  render(<Harness ready />)
  expect(screen.queryByText(hint)).toBeNull()
})
