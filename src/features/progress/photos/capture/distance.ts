/**
 * The distance cue for progress photos (photos v2, docs/design/photos-2026-11/stability-and-distance.md
 * section 3.4). Pure: the live view feeds it pose landmarks and reads one ratio, r = S / S_ref,
 * where S is the body's size in the frame. r > 1 means bigger in the frame than last time, so
 * closer to the phone.
 */
import type { PhotoBodyLines, PhotoBodyScale } from '../../../../storage/photoStore'
import { Hysteresis, MedianWindow } from './level'

/** One pose landmark in normalised image coordinates (MediaPipe's NormalizedLandmark). */
export type Landmark = { x: number; y: number; visibility?: number }

/** MediaPipe Pose landmark indices. */
export const POSE = {
  nose: 0,
  leftShoulder: 11,
  rightShoulder: 12,
  leftHip: 23,
  rightHip: 24,
  leftAnkle: 27,
  rightAnkle: 28,
  leftHeel: 29,
  rightHeel: 30,
  leftFoot: 31,
  rightFoot: 32,
} as const

export const MIN_VISIBILITY = 0.5

const seen = (l: Landmark | undefined): l is Landmark => !!l && (l.visibility ?? 1) >= MIN_VISIBILITY
const mid = (a: Landmark, b: Landmark): Landmark => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })

/**
 * The body's size in one frame of `width` × `height` pixels, as fractions of the frame height:
 * shoulder-mid to ankle-mid (null when an ankle is not seen) and shoulder-mid to hip-mid. Null
 * when a shoulder or a hip is not seen ("Step into frame"). The nose and the feet are left out:
 * they move with head tilt and stance, not distance.
 */
export function bodyScaleOf(landmarks: readonly Landmark[], width: number, height: number): PhotoBodyScale | null {
  const ls = landmarks[POSE.leftShoulder]
  const rs = landmarks[POSE.rightShoulder]
  const lh = landmarks[POSE.leftHip]
  const rh = landmarks[POSE.rightHip]
  if (!seen(ls) || !seen(rs) || !seen(lh) || !seen(rh) || height <= 0) return null
  const dist = (a: Landmark, b: Landmark): number => Math.hypot((a.x - b.x) * width, (a.y - b.y) * height) / height
  const shoulders = mid(ls, rs)
  const torso = dist(shoulders, mid(lh, rh))
  if (!(torso > 0)) return null
  const la = landmarks[POSE.leftAnkle]
  const ra = landmarks[POSE.rightAnkle]
  const full = seen(la) && seen(ra) ? dist(shoulders, mid(la, ra)) : null
  return { full: full !== null && full > 0 ? full : null, torso }
}

/**
 * The top of the head and the soles, as fractions of the frame height, for the no-model fallback
 * lines. The head top is estimated above the nose by 0.6 of the nose-to-shoulder drop.
 */
export function bodyLinesOf(landmarks: readonly Landmark[]): PhotoBodyLines | null {
  const nose = landmarks[POSE.nose]
  const ls = landmarks[POSE.leftShoulder]
  const rs = landmarks[POSE.rightShoulder]
  if (!seen(nose) || !seen(ls) || !seen(rs)) return null
  const feet = [POSE.leftHeel, POSE.rightHeel, POSE.leftFoot, POSE.rightFoot, POSE.leftAnkle, POSE.rightAnkle]
    .map((i) => landmarks[i])
    .filter(seen)
    .map((l) => l.y)
  if (feet.length === 0) return null
  const head = nose.y - 0.6 * (mid(ls, rs).y - nose.y)
  return { head: Math.max(0, head), feet: Math.min(1, Math.max(...feet)) }
}

/**
 * The one number to compare: shoulder-to-ankle over the reference's when both have it; otherwise
 * torso over torso, which equals torso × k_ref / S_ref with k_ref = full/torso on the reference,
 * so slouching does not read as distance.
 */
export function scaleRatio(now: PhotoBodyScale, reference: PhotoBodyScale): number {
  if (now.full !== null && reference.full !== null) return now.full / reference.full
  return now.torso / reference.torso
}

/** Smoothing time constant of log r, seconds. */
export const DISTANCE_TAU_S = 0.4
/** Inferences the median runs over. */
export const DISTANCE_MEDIAN = 5

/**
 * r = S / S_ref, smoothed: the median of the last five inferences' ratios, then an EMA of log r
 * with τ = 0.4 s (log, so a step closer and a step back weigh the same). α comes from the real
 * time step, since inference times vary.
 */
export class DistanceSmoother {
  private readonly window = new MedianWindow(DISTANCE_MEDIAN)
  private logR: number | null = null
  private t = 0

  push(ratio: number, tMs: number): number {
    const m = this.window.push(ratio)
    const log = Math.log(m)
    if (this.logR === null) {
      this.logR = log
    } else {
      const dt = Math.max((tMs - this.t) / 1000, 1e-3)
      this.logR += (dt / (DISTANCE_TAU_S + dt)) * (log - this.logR)
    }
    this.t = tMs
    return Math.exp(this.logR)
  }

  get value(): number | null {
    return this.logR === null ? null : Math.exp(this.logR)
  }

  reset(): void {
    this.logR = null
  }
}

/** Green zone: in at |r − 1| ≤ 3 %, out past 5 %, after 500 ms inside. */
export const DISTANCE_BAND = { enter: 0.03, leave: 0.05 }
export const DISTANCE_DWELL_MS = 500
/** The bar spans ±20 %; beyond it the dot sits at the end with an arrow. */
export const BAR_RANGE = 0.2

/** The distance zone's hysteresis. */
export function distanceTrigger(): Hysteresis {
  return new Hysteresis([DISTANCE_BAND], DISTANCE_DWELL_MS)
}

/**
 * Where the dot sits on the "closer ◄ green ► farther" bar, −1 (far left, much closer than last
 * time) to +1 (far right, much farther); `clamped` when past the ±20 % range.
 */
export function barPosition(r: number): { position: number; clamped: boolean } {
  const raw = (1 - r) / BAR_RANGE
  return { position: Math.max(-1, Math.min(1, raw)), clamped: Math.abs(raw) > 1 }
}

/** How far off, as a whole percent of the reference size. */
export function percentOff(r: number): number {
  return Math.round(Math.abs(r - 1) * 100)
}

/** The word to say: bigger in the frame means closer, so step back. Null inside the zone. */
export function distanceWord(r: number, matched: boolean): 'Step back' | 'Come closer' | null {
  if (matched) return null
  if (Math.abs(r - 1) <= DISTANCE_BAND.enter) return null
  return r > 1 ? 'Step back' : 'Come closer'
}

/**
 * Milliseconds between ticks while out of the zone (back camera, screen unseen): slow far away,
 * faster nearer the zone; 1000 ms at the bar's end, 250 ms at the zone's edge.
 */
export function tickInterval(r: number): number {
  const off = Math.min(BAR_RANGE, Math.max(DISTANCE_BAND.enter, Math.abs(r - 1)))
  const t = (off - DISTANCE_BAND.enter) / (BAR_RANGE - DISTANCE_BAND.enter)
  return Math.round(250 + t * 750)
}
