// DX-15: a muscle reads as grey 14 px text. No Muscle-family dot, tint or pill: a plum dot next to
// "Assisted pull-ups" read as Workout B, a green one next to "Back squat" as "moving".
//
// What an element paints is read from the stylesheets under src/ through src/test/cssMatch.ts.
import { render } from '@testing-library/react'
import { expect, test } from 'vitest'
import { MuscleChip } from './MuscleChip'
import type { Muscle } from '../types'
import { declarationsMatching, paintOf } from '../test/cssMatch'

const MUSCLES = ['chest', 'lats', 'quadriceps', 'abdominals'] as const

for (const muscle of MUSCLES) {
  test(`DX-15 a ${muscle} MuscleChip is grey 14 px text with no dot and no tint`, () => {
    const { container } = render(<MuscleChip muscle={muscle as Muscle} />)
    const chip = container.querySelector('.muscle-chip') as Element

    expect(chip.textContent).toBe(muscle)
    expect(chip.querySelector('.muscle-dot')).toBeNull()
    expect(chip.hasAttribute('data-family')).toBe(false)
    const declared = declarationsMatching(chip)
    expect(declared.get('color')).toBe('var(--color-muted)')
    expect(declared.get('font-size')).toBe('var(--text-sm)')
    expect(paintOf(declared)).toBeUndefined()
  })
}
