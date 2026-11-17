import type { PhotoAlign } from '../../../../storage/photoStore'

export const IDENTITY_ALIGN: PhotoAlign = { scale: 1, rotate: 0, dx: 0, dy: 0 }

const MIN_SCALE = 0.5
const MAX_SCALE = 3

export type Point = { x: number; y: number }

/** Moves the photo by a drag of (`dx`, `dy`) pixels over a stage of the given size. */
export function dragged(align: PhotoAlign, dx: number, dy: number, stage: { w: number; h: number }): PhotoAlign {
  return { ...align, dx: align.dx + dx / (stage.w || 1), dy: align.dy + dy / (stage.h || 1) }
}

/** Scales and turns the photo by how two fingers moved from `before` to `after`. */
export function pinched(align: PhotoAlign, before: [Point, Point], after: [Point, Point]): PhotoAlign {
  const vec = (pair: [Point, Point]): Point => ({ x: pair[1].x - pair[0].x, y: pair[1].y - pair[0].y })
  const a = vec(before)
  const b = vec(after)
  const lenA = Math.hypot(a.x, a.y)
  const lenB = Math.hypot(b.x, b.y)
  if (lenA === 0 || lenB === 0) return align
  const turn = ((Math.atan2(b.y, b.x) - Math.atan2(a.y, a.x)) * 180) / Math.PI
  return {
    ...align,
    scale: Math.min(MAX_SCALE, Math.max(MIN_SCALE, align.scale * (lenB / lenA))),
    rotate: align.rotate + turn,
  }
}

/** The CSS transform that draws a photo through its alignment. */
export function cssTransform(align: PhotoAlign | null): string {
  const a = align ?? IDENTITY_ALIGN
  return `translate(${a.dx * 100}%, ${a.dy * 100}%) rotate(${a.rotate}deg) scale(${a.scale})`
}

/** The phone's sideways tilt in degrees from its gravity vector (0 when held upright). */
export function tiltDegrees(x: number, y: number): number {
  return (Math.atan2(x, -y) * 180) / Math.PI
}
