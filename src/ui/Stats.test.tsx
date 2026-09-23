import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { Stats } from './Stats'
import type { Exercise, Program } from '../types'

// Stats loads nothing itself: it is handed the finished sessions, newest first, the way
// `listSessions()` returns them. With none handed over, each of its two views must say what it
// needs instead of drawing an empty chart. The path to this screen through the History tab is
// proven in src/App.test.tsx.

const workoutA = { id: 'workout-a', name: 'Workout A', exercises: [] }

const assaf: Program = {
  id: 'assaf-ab-2026',
  name: 'Assaf A/B 2026',
  units: 'kg',
  workouts: [workoutA],
  sessionsPerWeek: 3,
}

/** Nothing is logged, so nothing is ever looked up; answering undefined mirrors an unknown id. */
function resolveNothing(_id: string): Exercise | undefined {
  return undefined
}

function renderEmptyStats(): void {
  render(<Stats sessions={[]} resolve={resolveNothing} programs={[assaf]} />)
}

function exerciseProgressSection(): HTMLElement {
  return screen.getByRole('region', { name: 'Exercise progress' })
}

function volumeSection(): HTMLElement {
  return screen.getByRole('region', { name: 'Volume' })
}

function textOf(element: Element): string {
  return (element.textContent ?? '').replace(/\s+/g, ' ').trim()
}

test('O10 Stats renders exactly the Exercise progress and Volume sections, in that order', () => {
  renderEmptyStats()

  const labels = Array.from(document.body.querySelectorAll('section')).map((section) =>
    section.getAttribute('aria-label'),
  )
  expect(labels).toEqual(['Exercise progress', 'Volume'])
})

test('O10 with no sessions the Exercise progress section says a set has to be logged before an exercise can be chosen', () => {
  renderEmptyStats()

  const text = textOf(exerciseProgressSection())
  expect(text).toMatch(/\blog/i)
  expect(text).toMatch(/\bset\b/i)
  expect(text).toMatch(/\bexercise\b/i)
})

test('O10 with no sessions the Volume section says a session has to be finished before a bar can be drawn', () => {
  renderEmptyStats()

  const text = textOf(volumeSection())
  expect(text).toMatch(/\bsession\b/i)
  expect(text).toMatch(/\bfinish/i)
})

test('O10 with no sessions the Exercise progress section draws no chart', () => {
  renderEmptyStats()

  expect(exerciseProgressSection().querySelector('svg')).toBeNull()
})

test('O10 with no sessions the Volume section draws no chart', () => {
  renderEmptyStats()

  expect(volumeSection().querySelector('svg')).toBeNull()
})
