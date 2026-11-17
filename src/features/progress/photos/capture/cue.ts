/**
 * One cue at a time (photos v2): tilt first, then distance, and "Matched" only when everything
 * that can be measured is in its zone. Pure.
 */

export type LevelCue = { visible: boolean; matched: boolean; words: string | null }
export type DistanceCue =
  | { kind: 'off' }
  | { kind: 'loading' }
  | { kind: 'no-body' }
  | { kind: 'measured'; matched: boolean; word: string | null }

export type Cue = { kind: 'level' | 'distance' | 'frame' | 'matched' | 'none'; text: string }

/**
 * The single cue to show and say. A hidden level is skipped (it is not pointing at you).
 * `matchedText` is "Matched" against a reference photo and "Level" with none.
 */
export function pickCue(level: LevelCue, distance: DistanceCue, matchedText = 'Matched'): Cue {
  if (level.visible && !level.matched) return { kind: 'level', text: level.words ?? 'Hold still' }
  if (distance.kind === 'no-body') return { kind: 'frame', text: 'Step into frame' }
  if (distance.kind === 'measured' && !distance.matched) return { kind: 'distance', text: distance.word ?? 'Hold still' }
  const levelOk = level.visible && level.matched
  const distanceOk = distance.kind === 'measured' && distance.matched
  if (levelOk || distanceOk) return { kind: 'matched', text: distanceOk ? 'Matched' : matchedText }
  return { kind: 'none', text: '' }
}
