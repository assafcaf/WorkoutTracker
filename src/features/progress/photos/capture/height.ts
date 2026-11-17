/**
 * Phone height and hand for mirror mode (docs/design/photos-2026-11/mirror-mode.md, 2.3). Pure.
 *
 * With the phone's pitch known, the image row of the horizon is the camera's own height on the
 * reflection, so where the shoulders sit against that row, in torso lengths, is the phone's
 * height relative to the body, with no need to see the hand.
 */
import type { PhotoHand } from '../../../../storage/photoStore'
import { MIN_VISIBILITY, POSE } from './distance'
import type { Landmark } from './distance'
import { Hysteresis, MedianWindow } from './level'

/** The plain iPhone wide lens in a 3:4 portrait frame: vertical half-angle about 33.6°. */
export const VERTICAL_HALF_FOV_DEG = 33.6
/** k = 0.5 / tan(vFOV / 2): image rows per unit of tan(angle), as a fraction of the frame height. */
export const HORIZON_K = 0.5 / Math.tan((VERTICAL_HALF_FOV_DEG * Math.PI) / 180)

const WRIST_LEFT = 15
const WRIST_RIGHT = 16

const seen = (l: Landmark | undefined): l is Landmark => !!l && (l.visibility ?? 1) >= MIN_VISIBILITY

/**
 * The horizon's row as a fraction of the frame height (0 top, 1 bottom) for a phone pitched
 * `pitchDeg` (positive: top toward you, so the back camera aims up and the horizon drops).
 * The sign is a device check (mirror-mode.md section 3, check 2).
 */
export function horizonRow(pitchDeg: number): number {
  return 0.5 + HORIZON_K * Math.tan((pitchDeg * Math.PI) / 180)
}

/**
 * h = (y_shoulderMid − y_horizon) / torso, all in frame heights; larger h is a higher phone.
 * Null when a shoulder or hip is not seen.
 */
export function phoneHeightOf(landmarks: readonly Landmark[], pitchDeg: number): number | null {
  const ls = landmarks[POSE.leftShoulder]
  const rs = landmarks[POSE.rightShoulder]
  const lh = landmarks[POSE.leftHip]
  const rh = landmarks[POSE.rightHip]
  if (!seen(ls) || !seen(rs) || !seen(lh) || !seen(rh)) return null
  const shoulderY = (ls.y + rs.y) / 2
  const torso = (lh.y + rh.y) / 2 - shoulderY
  if (!(torso > 0)) return null
  return (shoulderY - horizonRow(pitchDeg)) / torso
}

/**
 * Which hand holds the phone, by image side: the wrist that is higher in the image (and above
 * the shoulders' row), right of the shoulders' middle is your right (the back camera at a mirror
 * shows what you see in it). Labels are not used: on a reflection they may be swapped.
 */
export function handOf(landmarks: readonly Landmark[]): PhotoHand | null {
  const ls = landmarks[POSE.leftShoulder]
  const rs = landmarks[POSE.rightShoulder]
  if (!seen(ls) || !seen(rs)) return null
  const wrists = [landmarks[WRIST_LEFT], landmarks[WRIST_RIGHT]].filter(seen)
  if (wrists.length === 0) return null
  const raised = wrists.reduce((a, b) => (b.y < a.y ? b : a))
  const shoulderX = (ls.x + rs.x) / 2
  const shoulderY = (ls.y + rs.y) / 2
  if (!(raised.y < shoulderY) || raised.x === shoulderX) return null
  return raised.x > shoulderX ? 'right' : 'left'
}

/** Smoothing time constant of h, seconds. */
export const HEIGHT_TAU_S = 0.4

/** h smoothed: median of the last five, then an EMA (linear, not log) with τ 0.4 s. */
export class HeightSmoother {
  private readonly window = new MedianWindow(5)
  private h: number | null = null
  private t = 0

  push(h: number, tMs: number): number {
    const m = this.window.push(h)
    if (this.h === null) this.h = m
    else {
      const dt = Math.max((tMs - this.t) / 1000, 1e-3)
      this.h += (dt / (HEIGHT_TAU_S + dt)) * (m - this.h)
    }
    this.t = tMs
    return this.h
  }

  get value(): number | null {
    return this.h
  }
}

/** Height zone: in at |h − h_ref| ≤ 0.10 torso (about 5 cm), out past 0.18, 500 ms dwell. */
export const HEIGHT_BAND = { enter: 0.1, leave: 0.18 }
export const HEIGHT_DWELL_MS = 500

export function heightTrigger(): Hysteresis {
  return new Hysteresis([HEIGHT_BAND], HEIGHT_DWELL_MS)
}

/** The words, only past the outer band: a phone higher than last time is lowered. */
export function heightWord(delta: number, matched: boolean): 'Raise the phone' | 'Lower the phone' | null {
  if (matched || Math.abs(delta) <= HEIGHT_BAND.leave) return null
  return delta > 0 ? 'Lower the phone' : 'Raise the phone'
}

/** Where the live dot sits on the height scale, −1 (much lower) to +1 (much higher), ±0.5 torso. */
export function heightPosition(delta: number): number {
  return Math.max(-1, Math.min(1, delta / 0.5))
}
