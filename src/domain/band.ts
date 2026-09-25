/**
 * Buckets a set count into one of `BodyMap`'s four shade bands (E5-T17, M5).
 *
 * `scale: 'session'` buckets as 0 / 1-2 / 3-5 / 6+. `scale: 'week'` buckets as 0 / under 10
 * (1-9) / 10-20 / over 20 (21+). The returned band (0-3) indexes the map's four shade tokens
 * (`--map-shade-0..3` in src/styles/tokens.css); band 0 is also the "nothing counted" empty
 * token `BodyMap` (M8) paints a region with no count in.
 */
export function band(count: number, scale: 'session' | 'week'): 0 | 1 | 2 | 3 {
  if (count <= 0) return 0
  if (scale === 'session') {
    if (count < 3) return 1
    if (count < 6) return 2
    return 3
  }
  if (count < 10) return 1
  if (count <= 20) return 2
  return 3
}

/**
 * The four shade bands' human-readable labels, one scale's worth per row, in band order
 * (0, 1, 2, 3) matching `band()`'s thresholds above -- so `BodyMapLegend` (E6-T9, O23) can't
 * drift from the banding it names. Only the last entry of each row carries "sets", so a legend
 * joining a row with " / " reads "0 / 1-2 / 3-5 / 6+ sets" (session) or "0 / 1-9 / 10-20 / 21+
 * sets" (week) -- the exact wording the spec (O23) names.
 */
export const BAND_LABELS: Record<'session' | 'week', [string, string, string, string]> = {
  session: ['0', '1–2', '3–5', '6+ sets'],
  week: ['0', '1–9', '10–20', '21+ sets'],
}
