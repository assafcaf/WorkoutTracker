import { fireEvent, render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { beforeEach, expect, test, vi } from 'vitest'
import { SessionSummary } from './SessionSummary'
import { AppleHealthSettings } from './AppleHealthSettings'
import { healthShortcutUrl } from './healthShortcut'
import type { Exercise, LibraryExercise, Session } from '../types'

// V2-10: the summary sends to Apple Health from its Share… sheet; the setup guide and its doc
// link live in Settings (`AppleHealthSettings`).

const START = new Date(2026, 9, 12, 10).getTime()
const SESSION: Session = {
  id: 's1',
  programId: 'p',
  workoutId: 'w',
  startedAt: START,
  finishedAt: START + 3_600_000,
  entries: [],
}
const resolve = (): Exercise | undefined => undefined

beforeEach(() => localStorage.clear())

function show(openUrl: (url: string) => void): void {
  render(
    <SessionSummary
      session={SESSION}
      resolve={resolve}
      library={new Map<string, LibraryExercise>()}
      workoutName="Workout A"
      onClose={vi.fn()}
      openUrl={openUrl}
    />,
  )
}

function openShare(): void {
  fireEvent.click(screen.getByRole('button', { name: /^Share/ }))
}

test('O31 Send to Apple Health opens the Shortcut URL through openUrl', () => {
  const openUrl = vi.fn()
  show(openUrl)
  openShare()
  fireEvent.click(screen.getByRole('button', { name: 'Send to Apple Health' }))
  expect(openUrl).toHaveBeenCalledWith(healthShortcutUrl(SESSION, 'Workout A'))
})

/** DX-23: Settings' Apple Health is one row that pushes its page. */
function openHealthPage(): void {
  render(<AppleHealthSettings />)
  fireEvent.click(screen.getByRole('button', { name: /^Apple Health/ }))
}

test('O31 a How to set it up link points at the setup doc', () => {
  openHealthPage()
  expect(screen.getByRole('link', { name: 'How to set it up' }).getAttribute('href')).toBe(
    'https://github.com/assafcaf/WorkoutTracker/blob/main/docs/apple-health-shortcut.md',
  )
})

test('O31 the setup doc names the Shortcut, its text input and the actions', () => {
  const doc = readFileSync('docs/apple-health-shortcut.md', 'utf8')
  expect(doc).toContain('Workout Tracker to Health')
  expect(doc).toContain('Shortcut Input')
  expect(doc).toContain('Get Dictionary from Input')
  expect(doc).toContain('Log Workout')
})

test('O2 the first Send to Apple Health opens the guide and still opens the Shortcut', () => {
  const openUrl = vi.fn()
  show(openUrl)
  openShare()
  // The guide is in Settings now; the sheet names where it is.
  expect(screen.getByText(/set it up first in Settings/)).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Send to Apple Health' }))
  expect(openUrl).toHaveBeenCalledTimes(1)
  expect(screen.queryByRole('list', { name: 'Apple Health setup steps' })).toBeNull()
})

test('O2 after Done, it is set up the guide stays closed on Send and is remembered', () => {
  openHealthPage()
  fireEvent.click(screen.getByRole('button', { name: 'Set up Apple Health' }))
  expect(screen.getByRole('list', { name: 'Apple Health setup steps' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: "Done, it's set up" }))
  expect(localStorage.getItem('healthShortcutReady')).not.toBeNull()

  const openUrl = vi.fn()
  show(openUrl)
  openShare()
  expect(screen.queryByText(/set it up first in Settings/)).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Send to Apple Health' }))
  expect(openUrl).toHaveBeenCalledTimes(1)
})

test('O3 the summary shows the hint until the setup is confirmed', () => {
  show(vi.fn())
  // V2-10: no setup block on the summary itself; the hint sits in the Share… sheet.
  expect(screen.queryByRole('button', { name: 'Set up Apple Health' })).toBeNull()
  openShare()
  expect(screen.getByText("If iOS says it can't find the shortcut, set it up first in Settings › Apple Health.")).toBeTruthy()
})

test('V2-10 DX-23 Settings carries an Apple Health row whose page holds the setup block and its hint', () => {
  openHealthPage()
  expect(screen.getByRole('region', { name: 'Apple Health' })).toBeTruthy()
  expect(screen.getByRole('dialog', { name: 'Apple Health' })).toBeTruthy()
  expect(screen.getByText("If iOS says it can't find the shortcut, set it up first.")).toBeTruthy()
})
