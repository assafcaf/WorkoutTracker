/**
 * The phone level for progress photos (photos v2, docs/design/photos-2026-11/stability-and-distance.md
 * section 2). Pure: no DOM, no React. The live view feeds it `devicemotion` samples and reads the
 * filtered angles every animation frame and the matched state ten times a second.
 */

export type Vec3 = { x: number; y: number; z: number }
export type Angles = { roll: number; pitch: number }

const DEG = 180 / Math.PI

/** The 1€ filter's settings (Casiez et al.): cutoffs in Hz, beta per unit per second. */
export type OneEuroSettings = { minCutoff: number; beta: number; dCutoff: number }

/** Fused gravity (iOS CoreMotion through WebKit): steady at rest, quick when moved. */
export const FUSED_FILTER: OneEuroSettings = { minCutoff: 0.5, beta: 0.05, dCutoff: 1 }
/** Raw accelerometer: hand shake is still in it, so a stronger filter. */
export const RAW_FILTER: OneEuroSettings = { minCutoff: 0.3, beta: 0.03, dCutoff: 1 }

const smoothing = (cutoff: number, dt: number): number => {
  const tau = 1 / (2 * Math.PI * cutoff)
  return 1 / (1 + tau / dt)
}

/** An EMA whose cutoff rises with speed: no jitter at rest, little lag in a deliberate move. */
export class OneEuroFilter {
  private x: number | null = null
  private dx = 0
  private t = 0

  constructor(private readonly settings: OneEuroSettings) {}

  /** Filters `value`, sampled at `tMs` milliseconds. */
  filter(value: number, tMs: number): number {
    if (this.x === null) {
      this.x = value
      this.t = tMs
      return value
    }
    const dt = Math.max((tMs - this.t) / 1000, 1e-3)
    this.t = tMs
    const rawDx = (value - this.x) / dt
    this.dx += smoothing(this.settings.dCutoff, dt) * (rawDx - this.dx)
    const cutoff = this.settings.minCutoff + this.settings.beta * Math.abs(this.dx)
    this.x += smoothing(cutoff, dt) * (value - this.x)
    return this.x
  }

  get value(): number | null {
    return this.x
  }

  reset(): void {
    this.x = null
    this.dx = 0
  }
}

/** The median of a list of numbers (NaN for none). */
export function median(values: readonly number[]): number {
  if (values.length === 0) return Number.NaN
  const sorted = [...values].sort((a, b) => a - b)
  const mid = sorted.length >> 1
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

/** The median of the last `size` values pushed: removes single spikes such as a tap. */
export class MedianWindow {
  private readonly values: number[] = []

  constructor(private readonly size: number) {}

  push(value: number): number {
    this.values.push(value)
    if (this.values.length > this.size) this.values.shift()
    return median(this.values)
  }

  get length(): number {
    return this.values.length
  }
}

type MotionVector = { x: number | null; y: number | null; z: number | null } | null | undefined
export type MotionSample = { accelerationIncludingGravity?: MotionVector; acceleration?: MotionVector }

const full = (v: MotionVector): v is { x: number; y: number; z: number } =>
  !!v && typeof v.x === 'number' && typeof v.y === 'number' && typeof v.z === 'number'

/**
 * Gravity from one `devicemotion` event. On iOS `accelerationIncludingGravity − acceleration` is
 * exactly CoreMotion's gyro-fused gravity (WebKit sends both from CMDeviceMotion), which has no
 * hand shake in it. Without `acceleration` (no gyro, other browsers) the raw value is all there is.
 */
export function gravityOf(event: MotionSample): { g: Vec3; fused: boolean } | null {
  const aig = event.accelerationIncludingGravity
  if (!full(aig)) return null
  const acc = event.acceleration
  if (full(acc)) return { g: { x: aig.x - acc.x, y: aig.y - acc.y, z: aig.z - acc.z }, fused: true }
  return { g: { x: aig.x, y: aig.y, z: aig.z }, fused: false }
}

/**
 * Whether this device reports gravity with the spec's sign (Android, the W3C spec) instead of
 * iOS's. Decided from a sample with the phone held upright: iOS gives y ≈ −9.8 there, the spec +9.8.
 * Null while the phone is not upright enough to tell.
 */
export function upsideSign(g: Vec3): 1 | -1 | null {
  const norm = Math.hypot(g.x, g.y, g.z)
  if (norm < 1 || Math.abs(g.y) < 0.7 * norm) return null
  return g.y > 0 ? -1 : 1
}

/**
 * Roll (sideways tilt, positive when the top leans right) and pitch (positive when the top leans
 * toward the subject, i.e. the screen tips down) in degrees, from gravity in iOS's sign
 * convention; `sign` −1 flips a spec-convention device into it.
 */
export function anglesOf(g: Vec3, sign: 1 | -1 = 1): Angles {
  const x = g.x * sign
  const y = g.y * sign
  const z = g.z * sign
  return { roll: Math.atan2(x, -y) * DEG, pitch: Math.atan2(z, Math.hypot(x, y)) * DEG }
}

/** One band of a hysteresis check: in when |error| ≤ enter, out when |error| > leave. */
export type Band = { enter: number; leave: number }

/**
 * A Schmitt trigger with a dwell: it becomes matched only after every error has stayed inside its
 * inner band for `dwellMs`, and stops being matched when any error leaves its outer band. Between
 * the two bands nothing changes, so it cannot flicker at an edge.
 */
export class Hysteresis {
  private matched = false
  private insideSince: number | null = null

  constructor(private readonly bands: readonly Band[], private readonly dwellMs: number) {}

  update(errors: readonly number[], tMs: number): boolean {
    if (this.matched) {
      if (errors.some((e, i) => Math.abs(e) > this.bands[i].leave)) {
        this.matched = false
        this.insideSince = null
      }
      return this.matched
    }
    const inside = errors.every((e, i) => Math.abs(e) <= this.bands[i].enter)
    if (!inside) {
      this.insideSince = null
      return false
    }
    if (this.insideSince === null) this.insideSince = tMs
    if (tMs - this.insideSince >= this.dwellMs) this.matched = true
    return this.matched
  }

  get state(): boolean {
    return this.matched
  }

  reset(): void {
    this.matched = false
    this.insideSince = null
  }
}

/** The thresholds of one gravity source. */
export type LevelTuning = { filter: OneEuroSettings; roll: Band; pitch: Band; dwellMs: number; prefilter: number }

export const FUSED_TUNING: LevelTuning = {
  filter: FUSED_FILTER,
  roll: { enter: 1.0, leave: 2.0 },
  pitch: { enter: 1.5, leave: 3.0 },
  dwellMs: 300,
  prefilter: 1,
}
export const RAW_TUNING: LevelTuning = {
  filter: RAW_FILTER,
  roll: { enter: 1.5, leave: 2.5 },
  pitch: { enter: 1.5, leave: 3.0 },
  dwellMs: 500,
  prefilter: 5,
}

/** Beyond this roll the phone is not pointing at the subject, and the level hides (as iOS's does). */
export const HIDE_ROLL_DEGREES = 25
/** With no motion event for this long the level hides. */
export const STALE_MS = 1000
/** The stored reference angles are the median of this much of the last filtered samples. */
export const REFERENCE_WINDOW_MS = 500

/**
 * The whole level: gravity in, filtered angles and the matched state out. One instance per live
 * view; `push` is the `devicemotion` handler's only work, so it never touches React.
 */
export class LevelTracker {
  private sign: 1 | -1 | null = null
  private fused: boolean | null = null
  private rollFilter = new OneEuroFilter(FUSED_FILTER)
  private pitchFilter = new OneEuroFilter(FUSED_FILTER)
  private rollMedian = new MedianWindow(1)
  private pitchMedian = new MedianWindow(1)
  private trigger = new Hysteresis([FUSED_TUNING.roll, FUSED_TUNING.pitch], FUSED_TUNING.dwellMs)
  private history: { t: number; roll: number; pitch: number }[] = []
  private lastAt: number | null = null
  /** The latest filtered angles, or null before the first sample. */
  angles: Angles | null = null

  constructor(public target: Angles = { roll: 0, pitch: 0 }) {}

  private tune(fused: boolean): void {
    if (this.fused === fused) return
    this.fused = fused
    const tuning = fused ? FUSED_TUNING : RAW_TUNING
    this.rollFilter = new OneEuroFilter(tuning.filter)
    this.pitchFilter = new OneEuroFilter(tuning.filter)
    this.rollMedian = new MedianWindow(tuning.prefilter)
    this.pitchMedian = new MedianWindow(tuning.prefilter)
    this.trigger = new Hysteresis([tuning.roll, tuning.pitch], tuning.dwellMs)
  }

  get tuning(): LevelTuning {
    return this.fused === false ? RAW_TUNING : FUSED_TUNING
  }

  /** Takes one `devicemotion` event at `tMs`. */
  push(event: MotionSample, tMs: number): void {
    const gravity = gravityOf(event)
    if (!gravity) return
    this.tune(gravity.fused)
    if (this.sign === null) this.sign = upsideSign(gravity.g)
    const raw = anglesOf(gravity.g, this.sign ?? 1)
    const roll = this.rollFilter.filter(this.rollMedian.push(raw.roll), tMs)
    const pitch = this.pitchFilter.filter(this.pitchMedian.push(raw.pitch), tMs)
    this.angles = { roll, pitch }
    this.lastAt = tMs
    this.history.push({ t: tMs, roll, pitch })
    while (this.history.length > 0 && this.history[0].t < tMs - REFERENCE_WINDOW_MS) this.history.shift()
  }

  /** The filtered angles minus the target: what is left to correct. */
  error(): Angles | null {
    if (!this.angles) return null
    return { roll: this.angles.roll - this.target.roll, pitch: this.angles.pitch - this.target.pitch }
  }

  /** Whether the level should show at `tMs`: a recent sample, and not tilted past 25°. */
  visible(tMs: number): boolean {
    const err = this.error()
    if (!err || this.lastAt === null || tMs - this.lastAt > STALE_MS) return false
    return Math.abs(this.angles?.roll ?? 0) <= HIDE_ROLL_DEGREES
  }

  /** Updates and returns the matched state (call at the text rate, 10 Hz). */
  matched(tMs: number): boolean {
    const err = this.error()
    if (!err || !this.visible(tMs)) {
      this.trigger.reset()
      return false
    }
    return this.trigger.update([err.roll, err.pitch], tMs)
  }

  /** The angles to store with a photo: the median of the last 0.5 s, or null with no recent data. */
  reference(tMs: number): Angles | null {
    const recent = this.history.filter((h) => h.t >= tMs - REFERENCE_WINDOW_MS)
    if (recent.length === 0 || this.lastAt === null || tMs - this.lastAt > STALE_MS) return null
    return { roll: median(recent.map((h) => h.roll)), pitch: median(recent.map((h) => h.pitch)) }
  }
}

/**
 * A displayed number in 0.5° steps that only changes when the value has moved at least 0.5° from
 * what is shown, so it cannot flick between two neighbours.
 */
export function steppedDegrees(previous: number | null, value: number): number {
  const v = Math.abs(value)
  if (previous !== null && Math.abs(v - previous) < 0.5) return previous
  return Math.round(v * 2) / 2
}

const degrees = (n: number): string => `${Number.isInteger(n) ? n : n.toFixed(1)}°`

/**
 * The level's words while it is not matched: the roll first (it matters most), then the pitch,
 * each only past its inner band. Null inside both, where the dwell is running ("Hold still"). Once
 * matched, nothing is said until the Hysteresis lets go past the outer band.
 */
export function levelWords(err: Angles, shown: Angles, tuning: LevelTuning): string | null {
  if (Math.abs(err.roll) > tuning.roll.enter) return `Tilt ${err.roll > 0 ? 'right' : 'left'} ${degrees(shown.roll)}`
  if (Math.abs(err.pitch) > tuning.pitch.enter) return `Top ${err.pitch > 0 ? 'toward' : 'away'} ${degrees(shown.pitch)}`
  return null
}
