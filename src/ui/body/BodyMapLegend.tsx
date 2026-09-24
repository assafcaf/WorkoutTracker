export type BodyMapLegendProps = {
  /** Which of `BAND_LABELS` (src/domain/band.ts) this legend names (E6-T9, O23). */
  scale: 'session' | 'week'
}

/**
 * Stub for E6-T9 (O23): names the four shade bands `BodyMap` paints a region in, for `scale`.
 * One legend per section that renders body maps -- not one per map -- carrying
 * `.body-map-legend` (queried by section-placement tests) and `data-scale` so a test can tell
 * which scale a legend names without depending on its text.
 */
export function BodyMapLegend({ scale }: BodyMapLegendProps): JSX.Element {
  return <div className="body-map-legend" data-scale={scale} />
}
