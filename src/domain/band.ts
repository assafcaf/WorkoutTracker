/**
 * Buckets a set count into one of `BodyMap`'s four shade bands (E5-T17, M5).
 *
 * `scale: 'session'` buckets as 0 / 1-2 / 3-5 / 6+. `scale: 'week'` buckets as 0 / under 10
 * (1-9) / 10-20 / over 20 (21+). The returned band (0-3) indexes the map's four shade tokens
 * (`--map-shade-0..3` in src/styles/tokens.css); band 0 is also the "nothing counted" empty
 * token `BodyMap` (M8) paints a region with no count in.
 */
export function band(count: number, scale: 'session' | 'week'): 0 | 1 | 2 | 3 {
  void count
  void scale
  throw new Error('not implemented')
}
