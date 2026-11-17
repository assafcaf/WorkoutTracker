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

/** Mirror mode's phone height against the reference's. */
export type HeightCue = { kind: 'off' } | { kind: 'measured'; matched: boolean; word: string | null }

export type Cue = { kind: 'level' | 'height' | 'distance' | 'frame' | 'matched' | 'none'; text: string }

/** Mirror mode's extra cues: the phone height, and whether the feet show (null when unknown). */
export type MirrorCues = { height?: HeightCue; feet?: boolean | null }

/**
 * The single cue to show and say, in the order tilt, phone height (mirror), frame, distance,
 * matched. A hidden level is skipped (it is not pointing at you). `matchedText` is "Matched"
 * against a reference photo and "Level" with none.
 */
export function pickCue(level: LevelCue, distance: DistanceCue, matchedText = 'Matched', mirror: MirrorCues = {}): Cue {
  const height = mirror.height ?? { kind: 'off' }
  if (level.visible && !level.matched) return { kind: 'level', text: level.words ?? 'Hold still' }
  if (height.kind === 'measured' && !height.matched) return { kind: 'height', text: height.word ?? 'Hold still' }
  if (distance.kind === 'no-body') return { kind: 'frame', text: 'Step into frame' }
  if (mirror.feet === false) return { kind: 'frame', text: 'Step back until your feet show' }
  if (distance.kind === 'measured' && !distance.matched) return { kind: 'distance', text: distance.word ?? 'Hold still' }
  const levelOk = level.visible && level.matched
  const distanceOk = distance.kind === 'measured' && distance.matched
  const heightOk = height.kind === 'measured' && height.matched
  if (levelOk || distanceOk || heightOk) return { kind: 'matched', text: distanceOk || heightOk ? 'Matched' : matchedText }
  return { kind: 'none', text: '' }
}
