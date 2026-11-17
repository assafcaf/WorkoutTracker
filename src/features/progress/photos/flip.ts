/**
 * Mirror photos next to stand photos (docs/design/photos-2026-11/mirror-mode.md, 2.6). A mirror
 * photo is kept as the mirror showed it; it is drawn flipped only when it sits next to a stand
 * photo, so both show the same side of the body on the same side. Same-mode pairs never flip.
 * Display only: the stored pixels and transform never change. Pure.
 */
import type { Photo, PhotoMode } from '../../../storage/photoStore'

type Moded = Pick<Photo, 'mode'>

/** A photo's mode: photos from before mirror mode were all taken on a stand or by the camera app. */
export const modeOf = (photo: Moded): PhotoMode => photo.mode ?? 'stand'

/** Whether `photo` is drawn flipped when shown with `others`: a mirror photo among stand ones. */
export function flipNextTo(photo: Moded, others: readonly Moded[]): boolean {
  return modeOf(photo) === 'mirror' && others.some((o) => modeOf(o) === 'stand')
}

/** Compare's pair: each photo flips when the other is of the other mode; `extra` flips the after one too. */
export function pairFlips(before: Moded, after: Moded, extra = false): { before: boolean; after: boolean } {
  return { before: flipNextTo(before, [after]), after: flipNextTo(after, [before]) !== extra }
}

/**
 * Landmarks of a photo drawn flipped, for a fit against a photo of the other mode: x negated about
 * the frame's middle (normalised x becomes 1 - x). The fit uses midpoints and centre-line points
 * only (nose, shoulder-mid, hip-mid, ankle-mid), so no left/right label needs swapping.
 */
export function mirroredPoints<T extends { x: number; y: number }>(points: readonly T[]): T[] {
  return points.map((p) => ({ ...p, x: 1 - p.x }))
}
