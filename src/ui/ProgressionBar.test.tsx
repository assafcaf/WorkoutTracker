import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { ProgressionBar } from './ProgressionBar'
import type { Progression } from '../domain/progression'

// ProgressionBar draws a Progression it is handed; it derives nothing. Every Progression below
// is written by hand, in the shape `progression()` (E4-T1) returns, so the expected text is a
// literal. The path from a logged session to these bars on the exercise list is proven in
// src/App.test.tsx.

function renderBar(progression: Progression): HTMLElement {
  const { container } = render(<ProgressionBar progression={progression} />)
  return container
}

/** A loaded lift one rep short of the top: 4 sets of 10, the last at 9. */
const SHORT: Progression = {
  workingWeightKg: 65,
  achievedReps: 39,
  targetReps: 40,
  isFull: false,
  suggestion: null,
}

const NEXT_OR_ADD = /Next:|Add a set/

test('O12 the progression bar is a progressbar from 0 to the target reps, now at the achieved reps', () => {
  renderBar(SHORT)

  const bar = screen.getByRole('progressbar')
  expect(bar).toHaveAttribute('aria-valuemin', '0')
  expect(bar).toHaveAttribute('aria-valuemax', '40')
  expect(bar).toHaveAttribute('aria-valuenow', '39')
})

test('O12 the progression bar reads out as 39 of 40 reps', () => {
  renderBar(SHORT)

  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuetext', '39 of 40 reps')
})

test('O12 an exercise with no history draws an empty bar at 0 of its target', () => {
  renderBar({ workingWeightKg: null, achievedReps: 0, targetReps: 36, isFull: false, suggestion: null })

  const bar = screen.getByRole('progressbar')
  expect(bar).toHaveAttribute('aria-valuenow', '0')
  expect(bar).toHaveAttribute('aria-valuemax', '36')
  expect(bar).toHaveAttribute('aria-valuetext', '0 of 36 reps')
})

test('O12 a full bar suggesting more weight shows Next: 67.5 kg beside it', () => {
  renderBar({
    workingWeightKg: 65,
    achievedReps: 40,
    targetReps: 40,
    isFull: true,
    suggestion: { kind: 'add-weight', nextWeightKg: 67.5 },
  })

  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuetext', '40 of 40 reps')
  expect(screen.getByText('Next: 67.5 kg')).toBeVisible()
})

test('O12 a full bar suggesting less assistance shows Next: 26 kg assist beside it', () => {
  renderBar({
    workingWeightKg: 27,
    achievedReps: 32,
    targetReps: 32,
    isFull: true,
    suggestion: { kind: 'reduce-assistance', nextWeightKg: 26 },
  })

  expect(screen.getByText('Next: 26 kg assist')).toBeVisible()
})

test('O12 a full assistance bar down to 0 kg shows Next: 0 kg assist, not an empty weight', () => {
  renderBar({
    workingWeightKg: 1,
    achievedReps: 32,
    targetReps: 32,
    isFull: true,
    suggestion: { kind: 'reduce-assistance', nextWeightKg: 0 },
  })

  expect(screen.getByText('Next: 0 kg assist')).toBeVisible()
})

test('O12 a full bodyweight bar suggesting another set shows Add a set beside it', () => {
  renderBar({
    workingWeightKg: null,
    achievedReps: 45,
    targetReps: 45,
    isFull: true,
    suggestion: { kind: 'add-set' },
  })

  expect(screen.getByText('Add a set')).toBeVisible()
  expect(screen.queryByText(/Next:/)).toBeNull()
})

test('O12 a bar that is not full, with no suggestion, shows nothing beside it', () => {
  const container = renderBar(SHORT)

  expect(screen.getByRole('progressbar')).toBeInTheDocument()
  expect(container.textContent ?? '').not.toMatch(NEXT_OR_ADD)
})

test('O12 a full bar with a null suggestion shows nothing beside it', () => {
  const container = renderBar({
    workingWeightKg: null,
    achievedReps: 40,
    targetReps: 40,
    isFull: true,
    suggestion: null,
  })

  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuetext', '40 of 40 reps')
  expect(container.textContent ?? '').not.toMatch(NEXT_OR_ADD)
})

// --- the stylesheet: token colours only, and no new token -----------------------------------

const here = dirname(fileURLToPath(import.meta.url))

test('O12 the progression bar stylesheet fills with --color-accent on a --color-raised or --color-border track', () => {
  const css = readFileSync(join(here, 'ProgressionBar.css'), 'utf-8')

  expect(css).toMatch(/var\(\s*--color-accent\s*\)/)
  expect(css).toMatch(/var\(\s*--color-(raised|border)\s*\)/)
})
