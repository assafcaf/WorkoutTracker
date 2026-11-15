/**
 * Three short beeps that mark a rest period running out (E8-T5, spec O10).
 *
 * One `AudioContext` is made lazily, on the first `unlockRestSound()` call -- which the set
 * screen makes on every `Log set` press, so the context exists (and is running) by the time a
 * rest period can end, satisfying iOS's rule that audio only starts from a user gesture. Where
 * `AudioContext` does not exist on this host, both functions are silent no-ops.
 */

/** Each beep's duration in seconds and pitch in Hz. */
const TONE_SECONDS = 0.12
const TONE_GAP_SECONDS = 0.08
const TONE_HZ = 880

let audioContext: AudioContext | null = null

function getAudioContextCtor(): typeof AudioContext | undefined {
  return (globalThis as { AudioContext?: typeof AudioContext }).AudioContext
}

export function unlockRestSound(): void {
  const AudioContextCtor = getAudioContextCtor()
  if (AudioContextCtor === undefined) return

  if (audioContext === null) {
    audioContext = new AudioContextCtor()
    return
  }
  if (audioContext.state !== 'running') {
    void audioContext.resume()
  }
}

/** Plays `pitches` one after another, each a TONE_SECONDS sine, TONE_GAP_SECONDS apart. */
function playTones(pitches: number[]): void {
  if (audioContext === null) return

  pitches.forEach((hz, i) => {
    const context = audioContext as AudioContext
    const startAt = context.currentTime + i * (TONE_SECONDS + TONE_GAP_SECONDS)
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.type = 'sine'
    oscillator.frequency.value = hz
    oscillator.connect(gain)
    gain.connect(context.destination)
    oscillator.start(startAt)
    oscillator.stop(startAt + TONE_SECONDS)
  })
}

export function playRestOver(): void {
  playTones([TONE_HZ, TONE_HZ, TONE_HZ])
}

/** The PR's felt beat (V4-04): two short rising tones, on the same unlocked context as the beep. */
const PR_TONES_HZ = [660, 990]

export function playPrSound(): void {
  playTones(PR_TONES_HZ)
}
