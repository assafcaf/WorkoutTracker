/**
 * The capture's sounds (photos v2): with the back camera the screen faces away, so the cues are
 * heard. One AudioContext, made or resumed on a tap (iOS starts audio only from a gesture). Where
 * there is no AudioContext, every function is a silent no-op.
 */

let context: AudioContext | null = null

/** Makes or resumes the audio context; call from a tap handler. */
export function unlockCaptureSound(): void {
  const Ctor = (globalThis as { AudioContext?: typeof AudioContext }).AudioContext
  if (!Ctor) return
  try {
    if (context === null) context = new Ctor()
    else if (context.state !== 'running') void context.resume()
  } catch {
    context = null
  }
}

function tone(hz: number, seconds: number, gainValue: number, delay = 0): void {
  if (context === null) return
  const start = context.currentTime + delay
  const oscillator = context.createOscillator()
  const gain = context.createGain()
  oscillator.type = 'sine'
  oscillator.frequency.value = hz
  gain.gain.value = gainValue
  oscillator.connect(gain)
  gain.connect(context.destination)
  oscillator.start(start)
  oscillator.stop(start + seconds)
}

/** A short soft tick: out of the distance zone (its rate says how far), or the level snapping in. */
export function playTick(): void {
  tone(1200, 0.03, 0.25)
}

/** One high tone: everything is matched. */
export function playMatched(): void {
  tone(1320, 0.18, 0.5)
}

/** A countdown second. */
export function playCount(last: boolean): void {
  tone(last ? 1320 : 880, last ? 0.25 : 0.1, 0.5)
}
