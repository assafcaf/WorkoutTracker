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

export function playRestOver(): void {
  if (audioContext === null) return

  for (let i = 0; i < 3; i += 1) {
    const startAt = audioContext.currentTime + i * (TONE_SECONDS + TONE_GAP_SECONDS)
    const oscillator = audioContext.createOscillator()
    const gain = audioContext.createGain()
    oscillator.type = 'sine'
    oscillator.frequency.value = TONE_HZ
    oscillator.connect(gain)
    gain.connect(audioContext.destination)
    oscillator.start(startAt)
    oscillator.stop(startAt + TONE_SECONDS)
  }
}
