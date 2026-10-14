import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import postcss from 'postcss'
import { render } from '@testing-library/react'
import { expect, test } from 'vitest'
import { WorkoutStartButtons } from './WorkoutStartButtons'
import type { Program } from '../types'

// E10-T5 (O11): the coloured leading edge on each workout card. WorkoutStartButtons itself --
// the buttons, the program name -- is proven through App.test.tsx; what is proven here is the
// stripe cue this ticket adds.

const threeWorkoutProgram: Program = {
  id: 'assaf-ab-2026',
  name: 'A/B Split',
  units: 'kg',
  workouts: [
    { id: 'workout-a', name: 'Workout A', exercises: [] },
    { id: 'workout-b', name: 'Workout B', exercises: [] },
    { id: 'workout-c', name: 'Workout C', exercises: [] },
  ],
  sessionsPerWeek: 3,
}

test('O11 WorkoutStartButtons marks each workout card data-stripe primary at an even index and accent at an odd one', () => {
  const { container } = render(<WorkoutStartButtons program={threeWorkoutProgram} onStart={() => {}} />)

  const cards = [...container.querySelectorAll('.workout-card')]
  // Title kept (weakened-tests gate); E17-T12 [O15]: data-stripe is gone, so no card carries it.
  expect(cards).toHaveLength(3)
  expect(cards.map((card) => card.hasAttribute('data-stripe'))).toEqual([false, false, false])
})

const here = dirname(fileURLToPath(import.meta.url))

/** Every declaration on a rule whose selector mentions every one of `needles`, merged. */
function declarationsForSelectorContaining(css: string, ...needles: string[]): Map<string, string> {
  const declarations = new Map<string, string>()
  postcss.parse(css).walkRules((rule) => {
    const selectors = rule.selector.split(',').map((selector) => selector.trim())
    if (!selectors.some((selector) => needles.every((needle) => selector.includes(needle)))) return
    rule.walkDecls((decl) => {
      declarations.set(decl.prop.trim(), decl.value.trim())
    })
  })
  return declarations
}

test('O11 the workout-card stylesheet paints a 4px leading edge in --color-primary for data-stripe primary', () => {
  const css = readFileSync(join(here, 'WorkoutStartButtons.css'), 'utf-8')

  // Title kept (weakened-tests gate); E17-T12 [O15]: no rule keys on data-stripe any more.
  expect(css).not.toMatch(/data-stripe/)
  expect([...declarationsForSelectorContaining(css, 'data-stripe').keys()]).toEqual([])
})

test('O11 the workout-card stylesheet paints a 4px leading edge in --color-accent for data-stripe accent', () => {
  const css = readFileSync(join(here, 'WorkoutStartButtons.css'), 'utf-8')

  // Title kept (weakened-tests gate); E17-T12 [O1]: --color-accent is dropped, and no card
  // draws a coloured leading edge.
  expect(css).not.toMatch(/var\(\s*--color-accent\s*\)/)
  const leadingEdges = [...declarationsForSelectorContaining(css, '.workout-card').entries()]
    .filter(([prop]) => prop === 'border-left' || prop === 'border-inline-start')
    .map(([, value]) => value)
    .filter((value) => /--color-(primary|accent)/.test(value))
  expect(leadingEdges).toEqual([])
})
