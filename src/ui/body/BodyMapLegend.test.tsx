import { render } from '@testing-library/react'
import { expect, test } from 'vitest'
import { BodyMapLegend } from './BodyMapLegend'
import { declarationsMatching, paintOf } from '../../test/cssMatch'

// O23: BodyMapLegend names the four shade bands for its scale, exactly as the spec's outcome
// text does -- "0 / 1-2 / 3-5 / 6+ sets" (session), "0 / 1-9 / 10-20 / 21+ sets" (week). The
// expected strings are hand-checked against the outcome, not computed from src/domain/band.ts's
// BAND_LABELS.

function legendText(container: HTMLElement): string {
  const legend = container.querySelector('.body-map-legend')
  if (!legend) throw new Error('expected a .body-map-legend element')
  return (legend.textContent ?? '').replace(/\s+/g, ' ').trim()
}

test('O23 BodyMapLegend for the session scale names 0 / 1–2 / 3–5 / 6+ sets', () => {
  const { container } = render(<BodyMapLegend scale="session" />)

  expect(legendText(container)).toBe('0 / 1–2 / 3–5 / 6+ sets')
})

test('O23 BodyMapLegend for the week scale names 0 / 1–9 / 10–20 / 21+ sets', () => {
  const { container } = render(<BodyMapLegend scale="week" />)

  expect(legendText(container)).toBe('0 / 1–9 / 10–20 / 21+ sets')
})

// O18 (E17-T10): the legend shows a swatch per band -- four `.body-map-legend-swatch` elements
// (`data-band` 0-3, band order, no text of their own, so the label text above reads unchanged),
// each painting its band's heat step.

for (const scale of ['session', 'week'] as const) {
  test(`O18 BodyMapLegend for the ${scale} scale shows one swatch per band, painted --heat-0 to --heat-3`, () => {
    const { container } = render(<BodyMapLegend scale={scale} />)
    const swatches = [...container.querySelectorAll('.body-map-legend-swatch')]

    expect(swatches.map((swatch) => swatch.getAttribute('data-band'))).toEqual(['0', '1', '2', '3'])
    expect(swatches.map((swatch) => paintOf(declarationsMatching(swatch)))).toEqual([
      'var(--heat-0)',
      'var(--heat-1)',
      'var(--heat-2)',
      'var(--heat-3)',
    ])
  })
}

test('O18 a BodyMapLegend swatch carries no text of its own', () => {
  const { container } = render(<BodyMapLegend scale="session" />)
  const swatches = [...container.querySelectorAll('.body-map-legend-swatch')]

  expect(swatches.length).toBe(4)
  for (const swatch of swatches) expect(swatch.textContent).toBe('')
})
