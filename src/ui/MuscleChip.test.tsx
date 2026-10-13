// [O10 -> O17, E17-T10] Muscle colour appears only as data: a `.muscle-chip` is a neutral chip
// (--color-raised behind --color-text) holding an 8 px `.muscle-dot` painted
// `var(--data-<family>)` from the chip's `data-family`. The O10 titles are kept verbatim; their
// bodies now hold the family tokens to the dot, which is where a family's colour lives now.
//
// What an element paints is read from the stylesheets under src/ through
// src/test/cssMatch.ts: every rule whose selector the rendered element matches, wherever the
// implementer put it (docs/decisions/0004-one-palette-one-shell-audited-as-data.md).
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { render } from '@testing-library/react'
import { expect, test } from 'vitest'
import { MuscleChip } from './MuscleChip'
import type { Muscle } from '../types'
import { declarationsFor, referencedVars } from '../test/cssAudit'
import { declarationsMatching, paintOf } from '../test/cssMatch'

// src/ui/MuscleChip.test.tsx -> the repository root.
const repoRoot = resolve(fileURLToPath(import.meta.url), '..', '..', '..')

// One muscle per family, hand-picked from src/domain/muscles.ts's table.
const MUSCLE_OF = { push: 'chest', pull: 'lats', legs: 'quadriceps', core: 'abdominals' } as const

const FAMILIES = ['push', 'pull', 'legs', 'core'] as const

function renderChip(muscle: string): { chip: Element; dot: Element | null } {
  const { container } = render(<MuscleChip muscle={muscle as Muscle} />)
  const chip = container.querySelector('.muscle-chip')
  if (!chip) throw new Error('expected a .muscle-chip element')
  return { chip, dot: chip.querySelector('.muscle-dot') }
}

for (const family of FAMILIES) {
  test(`O10 .muscle-chip[data-family='${family}'] paints background and color from the ${family} family tokens`, () => {
    const { chip, dot } = renderChip(MUSCLE_OF[family])
    expect(chip).toHaveAttribute('data-family', family)
    expect(dot, `a ${family} chip must hold a .muscle-dot`).not.toBeNull()

    expect(
      paintOf(declarationsMatching(dot as Element)),
      `the .muscle-dot in a ${family} chip must paint var(--data-${family})`,
    ).toBe(`var(--data-${family})`)
  })
}

for (const family of FAMILIES) {
  test(`O17 a ${family} .muscle-chip paints --color-raised behind --color-text`, () => {
    const { chip } = renderChip(MUSCLE_OF[family])
    const declared = declarationsMatching(chip)

    expect(paintOf(declared), `a ${family} chip's background`).toBe('var(--color-raised)')
    expect(declared.get('color'), `a ${family} chip's text colour`).toBe('var(--color-text)')
  })
}

test('O17 a MuscleChip holds exactly one .muscle-dot and still reads as the muscle name', () => {
  const { container } = render(<MuscleChip muscle={'middle back' as Muscle} />)
  const chip = container.querySelector('.muscle-chip') as Element

  expect(chip.querySelectorAll('.muscle-dot').length).toBe(1)
  expect((chip.querySelector('.muscle-dot') as Element).textContent).toBe('')
  expect((chip.textContent ?? '').trim()).toBe('middle back')
})

test('O17 a .muscle-dot is 8 px square', () => {
  const { dot } = renderChip('chest')
  expect(dot, 'the chip must hold a .muscle-dot').not.toBeNull()
  const declared = declarationsMatching(dot as Element)

  expect(declared.get('width'), '.muscle-dot width').toBe('8px')
  expect(declared.get('height'), '.muscle-dot height').toBe('8px')
})

test('O17 .muscle-dot is declared in src/styles/components.css', () => {
  const css = readFileSync(join(repoRoot, 'src', 'styles', 'components.css'), 'utf-8')

  expect(declarationsFor(css, '.muscle-dot').get('width')).toBe('8px')
})

test('O17 MuscleChip.css references no --family-* or --color-accent token', () => {
  const path = join(repoRoot, 'src', 'ui', 'MuscleChip.css')
  const css = existsSync(path) ? readFileSync(path, 'utf-8') : ''
  const stale = [...referencedVars(css)].filter(
    (name) => name.startsWith('--family-') || name === '--color-accent',
  )

  expect(stale).toEqual([])
})
