/**
 * The mirror-mode shutter (docs/design/photos-2026-11/mirror-mode.md, 2.2 and 2.3). Pure: the live
 * view calls `update` a few times a second with whether every cue is matched and how fast the
 * phone is turning, and takes the frame when it says `fire`.
 *
 *   idle ──matched──► confirming (0.6 s) ──► counting 3·2·1 (1.5 s) ──► steadying ──► fired
 *     ▲                    │ not matched           │ not matched           (rotation < 15°/s,
 *     └────────────────────┴───────────────────────┘                        at most 0.4 s)
 *
 * A tap starts a 2 s countdown that does not need the cues (the tap shakes the phone); a tap
 * during any countdown cancels it, and auto-capture then waits until the cues have let go once.
 */

export type AutoPhase = 'idle' | 'confirming' | 'counting' | 'steadying' | 'fired'

export type AutoSettings = {
  /** Everything matched this long before the countdown starts. */
  confirmMs: number
  /** The automatic countdown and its steps. */
  countMs: number
  stepMs: number
  /** A tap's countdown and its steps. */
  tapMs: number
  tapStepMs: number
  /** Still enough to shoot: rotation rate below this, degrees per second. */
  stillDegPerS: number
  /** The longest wait for stillness after the countdown. */
  stillWaitMs: number
}

export const AUTO_SETTINGS: AutoSettings = {
  confirmMs: 600,
  countMs: 1500,
  stepMs: 500,
  tapMs: 2000,
  tapStepMs: 1000,
  stillDegPerS: 15,
  stillWaitMs: 400,
}
/** With no reference yet: level and head to ankles in frame for 1 s. */
export const FIRST_PHOTO_CONFIRM_MS = 1000

export type AutoInput = {
  t: number
  /** Every measured cue is in its zone. */
  matched: boolean
  /** Auto-capture is on. */
  auto: boolean
  /** |rotationRate| in degrees per second, or null when the phone does not report it. */
  rotation: number | null
  /** Overrides the confirm dwell (the first photo's 1 s). */
  confirmMs?: number
}

export type AutoState = {
  phase: AutoPhase
  /** The number to show during a countdown (3, 2, 1), else null. */
  count: number | null
  /** 0 to 1 through the confirm dwell, for the ring around the shutter. */
  progress: number
  /** True on the one update that should take the frame. */
  fire: boolean
  /** Whether the running countdown came from a tap. */
  manual: boolean
}

/** |rotationRate| from a devicemotion event's alpha, beta, gamma (deg/s), null when missing. */
export function rotationOf(rate: { alpha: number | null; beta: number | null; gamma: number | null } | null | undefined): number | null {
  if (!rate) return null
  const { alpha, beta, gamma } = rate
  if (typeof alpha !== 'number' || typeof beta !== 'number' || typeof gamma !== 'number') return null
  return Math.hypot(alpha, beta, gamma)
}

export class AutoCapture {
  private phase: AutoPhase = 'idle'
  private since = 0
  private manual = false
  private holdOff = false
  private lastT = 0

  constructor(private readonly settings: AutoSettings = AUTO_SETTINGS) {}

  get current(): AutoPhase {
    return this.phase
  }

  /** A tap on the shutter: starts the 2 s countdown, or cancels any countdown running. */
  tap(t: number): void {
    if (this.phase === 'fired') return
    if (this.phase === 'idle') {
      this.phase = 'counting'
      this.manual = true
      this.since = t
      return
    }
    this.holdOff = true
    this.toIdle()
  }

  /** Stops everything (a cue switch, the view changing). */
  reset(): void {
    this.toIdle()
    this.holdOff = false
  }

  private toIdle(): void {
    this.phase = 'idle'
    this.manual = false
  }

  update(input: AutoInput): AutoState {
    const { t, matched, auto, rotation } = input
    this.lastT = t
    const s = this.settings
    const confirmMs = input.confirmMs ?? s.confirmMs
    if (!matched) this.holdOff = false
    let fire = false

    if (this.phase === 'idle' && auto && matched && !this.holdOff) {
      this.phase = 'confirming'
      this.since = t
    }
    if (this.phase === 'confirming') {
      if (!auto || !matched) this.toIdle()
      else if (t - this.since >= confirmMs) {
        this.phase = 'counting'
        this.manual = false
        this.since = t
      }
    }
    if (this.phase === 'counting') {
      if (!this.manual && (!auto || !matched)) this.toIdle()
      else if (t - this.since >= (this.manual ? s.tapMs : s.countMs)) {
        this.phase = 'steadying'
        this.since = t
      }
    }
    if (this.phase === 'steadying') {
      if (rotation === null || rotation < s.stillDegPerS || t - this.since >= s.stillWaitMs) {
        this.phase = 'fired'
        fire = true
      }
    }
    return this.snapshot(fire, confirmMs)
  }

  private snapshot(fire: boolean, confirmMs: number): AutoState {
    const s = this.settings
    let count: number | null = null
    let progress = 0
    if (this.phase === 'confirming') progress = Math.min(1, (this.lastT - this.since) / confirmMs)
    if (this.phase === 'counting') {
      const total = this.manual ? s.tapMs : s.countMs
      const step = this.manual ? s.tapStepMs : s.stepMs
      count = Math.max(1, Math.ceil((total - (this.lastT - this.since)) / step))
      progress = 1
    }
    if (this.phase === 'steadying') {
      count = 1
      progress = 1
    }
    return { phase: this.phase, count, progress, fire, manual: this.manual }
  }
}
