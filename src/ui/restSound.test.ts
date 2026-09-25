import { afterEach, beforeEach, expect, test, vi } from 'vitest'

// jsdom exposes no AudioContext at all (like navigator.wakeLock, per useWakeLock.test.ts), so
// the "does not exist" case is this environment's own default and only the present case needs
// a fake stubbed onto the global.

class FakeAudioParam {
  value = 0
  setValueAtTime = vi.fn()
  linearRampToValueAtTime = vi.fn()
  exponentialRampToValueAtTime = vi.fn()
}

class FakeOscillatorNode {
  type = 'sine'
  frequency = new FakeAudioParam()
  connect = vi.fn()
  start = vi.fn()
  stop = vi.fn()
}

class FakeGainNode {
  gain = new FakeAudioParam()
  connect = vi.fn()
}

/** Records every instance made, and every oscillator each one is asked to create. */
class FakeAudioContext {
  static instances: FakeAudioContext[] = []
  state: 'suspended' | 'running' = 'suspended'
  currentTime = 0
  destination = {}
  resume = vi.fn(async () => {
    this.state = 'running'
  })
  createOscillator = vi.fn(() => new FakeOscillatorNode())
  createGain = vi.fn(() => new FakeGainNode())
  constructor() {
    FakeAudioContext.instances.push(this)
  }
}

/** A fresh import, so the module's own lazily-made AudioContext does not leak between tests. */
async function freshRestSound() {
  vi.resetModules()
  return import('./restSound')
}

beforeEach(() => {
  FakeAudioContext.instances = []
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

test('O2 unlockRestSound makes an AudioContext when none exists yet', async () => {
  vi.stubGlobal('AudioContext', FakeAudioContext)
  const { unlockRestSound } = await freshRestSound()

  unlockRestSound()

  expect(FakeAudioContext.instances).toHaveLength(1)
})

test('O2 unlockRestSound resumes the AudioContext it already made rather than making another on a later call', async () => {
  vi.stubGlobal('AudioContext', FakeAudioContext)
  const { unlockRestSound } = await freshRestSound()

  unlockRestSound()
  unlockRestSound()

  expect(FakeAudioContext.instances).toHaveLength(1)
  expect(FakeAudioContext.instances[0].resume).toHaveBeenCalled()
})

test('O2 playRestOver schedules three tones on the AudioContext unlockRestSound made', async () => {
  vi.stubGlobal('AudioContext', FakeAudioContext)
  const { unlockRestSound, playRestOver } = await freshRestSound()
  unlockRestSound()

  playRestOver()

  const [context] = FakeAudioContext.instances
  expect(context.createOscillator).toHaveBeenCalledTimes(3)
  const oscillators = context.createOscillator.mock.results.map(
    (result) => result.value as FakeOscillatorNode,
  )
  for (const oscillator of oscillators) {
    expect(oscillator.start).toHaveBeenCalledTimes(1)
  }
})

test('O2 unlockRestSound is a silent no-op that throws nothing where AudioContext does not exist', async () => {
  vi.stubGlobal('AudioContext', undefined)
  const { unlockRestSound } = await freshRestSound()

  expect(() => unlockRestSound()).not.toThrow()
})

test('O2 playRestOver is a silent no-op that throws nothing where AudioContext does not exist', async () => {
  vi.stubGlobal('AudioContext', undefined)
  const { playRestOver } = await freshRestSound()

  expect(() => playRestOver()).not.toThrow()
})
