import { render } from '@testing-library/react'
import { expect, test } from 'vitest'
import { BodyMapLegend } from './BodyMapLegend'

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
