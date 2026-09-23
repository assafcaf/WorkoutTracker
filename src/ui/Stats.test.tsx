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

// O13: one bar per session, in date order, labelled by workout ---------------------------------

const workoutB = { id: 'workout-b', name: 'Workout B', exercises: [] }

const twoWorkoutProgram: Program = {
  id: 'assaf-ab-2026',
  name: 'Assaf A/B 2026',
  units: 'kg',
  workouts: [workoutA, workoutB],
  sessionsPerWeek: 3,
}

const squat: Exercise = {
  id: 'back-squat',
  name: 'Back Squat',
  weightStep: 2.5,
  startWeight: 20,
  bodyweight: false,
  invertProgress: false,
  libraryId: 'back-squat',
}

const pushup: Exercise = {
  id: 'push-up',
  name: 'Push Up',
  weightStep: 0,
  startWeight: null,
  bodyweight: true,
  invertProgress: false,
  libraryId: 'push-up',
}

function resolveTwoWorkouts(id: string): Exercise | undefined {
  return { [squat.id]: squat, [pushup.id]: pushup }[id]
}

const earlierSession = {
  id: 'session-earlier',
  programId: 'assaf-ab-2026',
  workoutId: 'workout-a',
  startedAt: 100,
  finishedAt: 200,
  entries: [{ exerciseId: 'back-squat', setIndex: 0, weightKg: 60, reps: 5, loggedAt: 150 }],
}

const laterSession = {
  id: 'session-later',
  programId: 'assaf-ab-2026',
  workoutId: 'workout-b',
  startedAt: 300,
  finishedAt: 400,
  entries: [{ exerciseId: 'push-up', setIndex: 0, weightKg: null, reps: 20, loggedAt: 350 }],
}

function renderTwoSessionStats(): void {
  render(
    <Stats
      sessions={[laterSession, earlierSession]}
      resolve={resolveTwoWorkouts}
      programs={[twoWorkoutProgram]}
    />,
  )
}

test('O13 the Volume view draws one bar per session, in date order, labelled with its workout', () => {
  renderTwoSessionStats()

  const rects = volumeSection().querySelectorAll('rect')
  expect(rects.length).toBe(2)
  expect([...rects].map((rect) => rect.getAttribute('data-at'))).toEqual(['100', '300'])
  expect([...rects].map((rect) => rect.getAttribute('data-label'))).toEqual(['Workout A', 'Workout B'])
})

test('O13 a session with zero kg still gets a bar, and its bodyweightReps is shown next to the chart', () => {
  renderTwoSessionStats()

  const rects = volumeSection().querySelectorAll('rect')
  const pushDayRect = [...rects].find((rect) => rect.getAttribute('data-label') === 'Workout B')
  expect(pushDayRect).not.toBeUndefined()
  expect(pushDayRect).toHaveAttribute('data-value', '0')

  const text = textOf(volumeSection())
  expect(text).toMatch(/20/)
})
