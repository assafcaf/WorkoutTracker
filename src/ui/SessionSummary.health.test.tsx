import { fireEvent, render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { expect, test, vi } from 'vitest'
import { SessionSummary } from './SessionSummary'
import { healthShortcutUrl } from './healthShortcut'
import type { Exercise, LibraryExercise, Session } from '../types'

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

test('O31 Send to Apple Health opens the Shortcut URL through openUrl', () => {
  const openUrl = vi.fn()
  show(openUrl)
  fireEvent.click(screen.getByRole('button', { name: 'Send to Apple Health' }))
  expect(openUrl).toHaveBeenCalledWith(healthShortcutUrl(SESSION, 'Workout A'))
})

test('O31 a How to set it up link points at the setup doc', () => {
  show(vi.fn())
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
