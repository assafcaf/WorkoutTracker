// photos v2: the steady level (docs/design/photos-2026-11/stability-and-distance.md section 2).
import { describe, expect, test } from 'vitest'
import {
  FUSED_TUNING,
  Hysteresis,
  LevelTracker,
  MedianWindow,
  OneEuroFilter,
  RAW_TUNING,
  anglesOf,
  gravityOf,
  levelWords,
  MIRROR_ROLL,
  mirrorTuning,
  median,
  steppedDegrees,
  upsideSign,
} from './level'
import type { MotionSample } from './level'

const G = 9.80665
const rad = (deg: number): number => (deg * Math.PI) / 180

/** iOS gravity for a phone upright, turned `roll` degrees clockwise and leaning `pitch` toward you. */
function iosGravity(roll: number, pitch: number): { x: number; y: number; z: number } {
  const c = Math.cos(rad(pitch))
  return { x: G * c * Math.sin(rad(roll)), y: -G * c * Math.cos(rad(roll)), z: G * Math.sin(rad(pitch)) }
}

/** A deterministic noise source (no Math.random in tests). */
function noise(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648
    return s / 2147483648 - 0.5
  }
}

/** One fused-gravity event: the hand's acceleration is in both fields, gravity in neither's difference. */
function fused(roll: number, pitch: number, shake = { x: 0, y: 0, z: 0 }): MotionSample {
  const g = iosGravity(roll, pitch)
  return {
    accelerationIncludingGravity: { x: g.x + shake.x, y: g.y + shake.y, z: g.z + shake.z },
    acceleration: shake,
  }
}

describe('gravity source', () => {
  test('fused gravity is accelerationIncludingGravity minus acceleration', () => {
    const out = gravityOf({ accelerationIncludingGravity: { x: 1.5, y: -9, z: 2 }, acceleration: { x: 0.5, y: 0.8, z: 2 } })
    expect(out?.fused).toBe(true)
    expect(out?.g.x).toBeCloseTo(1)
    expect(out?.g.y).toBeCloseTo(-9.8)
    expect(out?.g.z).toBeCloseTo(0)
  })

  test('without acceleration (null fields or none) the raw value is used and marked raw', () => {
    expect(gravityOf({ accelerationIncludingGravity: { x: 1, y: -9.8, z: 0 }, acceleration: { x: null, y: null, z: null } })).toEqual({
      g: { x: 1, y: -9.8, z: 0 },
      fused: false,
    })
    expect(gravityOf({ accelerationIncludingGravity: { x: 1, y: -9.8, z: 0 } })?.fused).toBe(false)
  })

  test('no gravity at all gives nothing', () => {
    expect(gravityOf({})).toBeNull()
    expect(gravityOf({ accelerationIncludingGravity: { x: null, y: 1, z: 1 } })).toBeNull()
  })
})

describe('angle maths', () => {
  test('upright is roll 0, pitch 0', () => {
    const a = anglesOf({ x: 0, y: -G, z: 0 })
    expect(a.roll).toBeCloseTo(0)
    expect(a.pitch).toBeCloseTo(0)
  })

  test('roll and pitch come back from a synthetic iOS gravity vector', () => {
    for (const [roll, pitch] of [
      [5, 0],
      [-12, 3],
      [2, -7],
      [20, 10],
    ]) {
      const a = anglesOf(iosGravity(roll, pitch))
      expect(a.roll).toBeCloseTo(roll, 6)
      expect(a.pitch).toBeCloseTo(pitch, 6)
    }
  })

  test('the E26 example: x 0.85, y -9.76 is about 5 degrees right', () => {
    expect(anglesOf({ x: 0.85, y: -9.76, z: 0 }).roll).toBeCloseTo(4.98, 1)
  })

  test('the iOS sign flip: a spec-convention device (y > 0 upright) is detected and flipped', () => {
    const ios = iosGravity(4, -2)
    const spec = { x: -ios.x, y: -ios.y, z: -ios.z }
    expect(upsideSign(ios)).toBe(1)
    expect(upsideSign(spec)).toBe(-1)
    const flipped = anglesOf(spec, -1)
    expect(flipped.roll).toBeCloseTo(4, 6)
    expect(flipped.pitch).toBeCloseTo(-2, 6)
  })

  test('the sign is not decided from a phone lying flat', () => {
    expect(upsideSign({ x: 0, y: -1, z: -9.7 })).toBeNull()
    expect(upsideSign({ x: 0, y: 0, z: 0 })).toBeNull()
  })

  test('a tracker on a spec-convention device reads the same angles as on iOS', () => {
    const ios = new LevelTracker()
    const spec = new LevelTracker()
    for (let t = 0; t < 1000; t += 16) {
      const g = iosGravity(3, 1)
      ios.push({ accelerationIncludingGravity: g, acceleration: { x: 0, y: 0, z: 0 } }, t)
      spec.push({ accelerationIncludingGravity: { x: -g.x, y: -g.y, z: -g.z }, acceleration: { x: 0, y: 0, z: 0 } }, t)
    }
    expect(spec.angles?.roll).toBeCloseTo(ios.angles?.roll ?? Number.NaN, 6)
    expect(spec.angles?.pitch).toBeCloseTo(ios.angles?.pitch ?? Number.NaN, 6)
  })
})

describe('the 1-euro filter', () => {
  test('the first sample passes through; a constant stays constant', () => {
    const f = new OneEuroFilter(FUSED_TUNING.filter)
    expect(f.filter(3, 0)).toBe(3)
    for (let t = 16; t < 1000; t += 16) expect(f.filter(3, t)).toBeCloseTo(3, 9)
  })

  test('resting jitter of +-0.5 degrees comes out well under 0.2 degrees', () => {
    const f = new OneEuroFilter(FUSED_TUNING.filter)
    const rand = noise(7)
    const out: number[] = []
    for (let t = 0; t < 4000; t += 16) {
      const y = f.filter(rand(), t) // uniform in +-0.5
      if (t > 1000) out.push(y)
    }
    expect(Math.max(...out) - Math.min(...out)).toBeLessThan(0.4)
    expect(Math.max(...out.map(Math.abs))).toBeLessThan(0.2)
  })

  test('a deliberate 10 degree tilt is followed within about 300 ms', () => {
    const f = new OneEuroFilter(FUSED_TUNING.filter)
    for (let t = 0; t < 500; t += 16) f.filter(0, t)
    let at = Number.NaN
    for (let t = 500; t < 2500; t += 16) {
      if (f.filter(10, t) > 9 && Number.isNaN(at)) at = t - 500
    }
    expect(at).toBeLessThan(600)
  })

  test('uneven event timing: alpha follows the real time step', () => {
    const a = new OneEuroFilter({ minCutoff: 1, beta: 0, dCutoff: 1 })
    const b = new OneEuroFilter({ minCutoff: 1, beta: 0, dCutoff: 1 })
    a.filter(0, 0)
    b.filter(0, 0)
    // One 100 ms step moves further than one 10 ms step.
    expect(a.filter(10, 100)).toBeGreaterThan(b.filter(10, 10))
  })
})

describe('median pre-filter', () => {
  test('median of odd and even lists, and NaN for none', () => {
    expect(median([3, 1, 2])).toBe(2)
    expect(median([4, 1, 3, 2])).toBe(2.5)
    expect(median([])).toBeNaN()
  })

  test('a single spike in five samples is removed', () => {
    const w = new MedianWindow(5)
    const out = [0, 0, 17, 0, 0, 0].map((v) => w.push(v))
    expect(out).toEqual([0, 0, 0, 0, 0, 0])
  })
})

describe('hysteresis state machine', () => {
  const bands = [{ enter: 1, leave: 2 }]

  test('enters only after the dwell inside the inner band', () => {
    const h = new Hysteresis(bands, 300)
    expect(h.update([0.5], 0)).toBe(false)
    expect(h.update([0.5], 200)).toBe(false)
    expect(h.update([0.5], 300)).toBe(true)
  })

  test('a pass-through shorter than the dwell does not count', () => {
    const h = new Hysteresis(bands, 300)
    h.update([0.5], 0)
    h.update([0.5], 200)
    expect(h.update([1.5], 250)).toBe(false)
    expect(h.update([0.5], 300)).toBe(false)
    expect(h.update([0.5], 599)).toBe(false)
    expect(h.update([0.5], 600)).toBe(true)
  })

  test('between the bands nothing changes, so it cannot flicker at an edge', () => {
    const h = new Hysteresis(bands, 0)
    expect(h.update([0.9], 0)).toBe(true)
    // Noise around 1.0 to 1.9: stays matched.
    for (const e of [1.1, 1.9, 1.0, 1.95, -1.8]) expect(h.update([e], 10)).toBe(true)
    expect(h.update([2.01], 20)).toBe(false)
    // And unmatched noise around 1.1 to 1.9 stays unmatched.
    for (const e of [1.1, 1.9, 1.5]) expect(h.update([e], 30)).toBe(false)
  })

  test('with two bands, every error must be in to enter and any out to leave', () => {
    const h = new Hysteresis([FUSED_TUNING.roll, FUSED_TUNING.pitch], 0)
    expect(h.update([0.5, 2], 0)).toBe(false)
    expect(h.update([0.5, 1.2], 0)).toBe(true)
    expect(h.update([1.5, 2.9], 0)).toBe(true)
    expect(h.update([1.5, 3.1], 0)).toBe(false)
  })
})

describe('the level tracker', () => {
  test('fused: matched after 300 ms at the reference angles, using its own target', () => {
    const tracker = new LevelTracker({ roll: 3, pitch: -2 })
    let firstMatched = Number.NaN
    for (let t = 0; t <= 1000; t += 16) {
      tracker.push(fused(3.2, -2.3), t)
      if (t % 96 === 0 && tracker.matched(t) && Number.isNaN(firstMatched)) firstMatched = t
    }
    expect(firstMatched).toBeGreaterThanOrEqual(288)
    expect(firstMatched).toBeLessThan(500)
    expect(tracker.tuning).toBe(FUSED_TUNING)
  })

  test('fused: hand shake (in acceleration) does not move the angles', () => {
    const tracker = new LevelTracker()
    const rand = noise(3)
    for (let t = 0; t <= 2000; t += 16) {
      tracker.push(fused(0, 0, { x: rand() * 4, y: rand() * 4, z: rand() * 4 }), t)
      if (t % 96 === 0) tracker.matched(t)
    }
    expect(Math.abs(tracker.angles?.roll ?? 99)).toBeLessThan(1e-9)
    expect(tracker.matched(2000)).toBe(true)
  })

  test('raw fallback: noisy samples settle and use the wider band and longer dwell', () => {
    const tracker = new LevelTracker()
    const rand = noise(11)
    const states: boolean[] = []
    for (let t = 0; t <= 3000; t += 16) {
      const g = iosGravity(1.2 + rand(), rand())
      tracker.push({ accelerationIncludingGravity: g }, t)
      if (t % 96 === 0) states.push(tracker.matched(t))
    }
    expect(tracker.tuning).toBe(RAW_TUNING)
    expect(states.at(-1)).toBe(true)
    // Once matched it never flickers back out on this noise.
    const first = states.indexOf(true)
    expect(states.slice(first).every(Boolean)).toBe(true)
  })

  test('hidden past 25 degrees of roll, and after a second with no events', () => {
    const tracker = new LevelTracker()
    for (let t = 0; t < 2000; t += 16) tracker.push(fused(30, 0), t)
    expect(tracker.visible(2000)).toBe(false)
    for (let t = 2000; t < 4000; t += 16) tracker.push(fused(0, 0), t)
    expect(tracker.visible(4000)).toBe(true)
    expect(tracker.visible(5100)).toBe(false)
  })

  test('the stored angles are the median of the last half second', () => {
    const tracker = new LevelTracker()
    for (let t = 0; t <= 2000; t += 16) tracker.push(fused(2, -1), t)
    const ref = tracker.reference(2000)
    expect(ref?.roll).toBeCloseTo(2, 3)
    expect(ref?.pitch).toBeCloseTo(-1, 3)
    expect(tracker.reference(4000)).toBeNull()
    expect(new LevelTracker().reference(0)).toBeNull()
  })
})

describe('the words', () => {
  test('0.5 degree steps that only change when moved by 0.5 degrees', () => {
    expect(steppedDegrees(null, 2.26)).toBe(2.5)
    expect(steppedDegrees(2.5, 2.1)).toBe(2.5)
    expect(steppedDegrees(2.5, 2.9)).toBe(2.5)
    expect(steppedDegrees(2.5, 3.0)).toBe(3)
    expect(steppedDegrees(null, -4.98)).toBe(5)
  })

  test('roll first, then pitch, each with its direction', () => {
    expect(levelWords({ roll: 2.4, pitch: 5 }, { roll: 2.5, pitch: 5 }, FUSED_TUNING)).toBe('Tilt right 2.5°')
    expect(levelWords({ roll: -3, pitch: 0 }, { roll: 3, pitch: 0 }, FUSED_TUNING)).toBe('Tilt left 3°')
    expect(levelWords({ roll: 0.2, pitch: -3 }, { roll: 0, pitch: 3 }, FUSED_TUNING)).toBe('Top away 3°')
    expect(levelWords({ roll: 0.2, pitch: 2 }, { roll: 0, pitch: 2 }, FUSED_TUNING)).toBe('Top toward 2°')
    expect(levelWords({ roll: 0.5, pitch: 1 }, { roll: 0.5, pitch: 1 }, FUSED_TUNING)).toBeNull()
  })
})

describe('mirror mode level', () => {
  test('roll is relaxed to in 2.0 out 4.0; pitch keeps 1.5 / 3.0', () => {
    expect(MIRROR_ROLL).toEqual({ enter: 2.0, leave: 4.0 })
    expect(mirrorTuning(FUSED_TUNING).pitch).toEqual(FUSED_TUNING.pitch)
    const tracker = new LevelTracker()
    tracker.setMirror(true)
    const stand = new LevelTracker()
    let mirrorMatched = false
    let standMatched = false
    for (let t = 0; t < 1500; t += 16) {
      tracker.push(fused(1.8, 0), t)
      stand.push(fused(1.8, 0), t)
      mirrorMatched = tracker.matched(t)
      standMatched = stand.matched(t)
    }
    expect(mirrorMatched).toBe(true)
    expect(standMatched).toBe(false)
  })

  test('mirror words put pitch first and say which way to tilt the top', () => {
    const tuning = mirrorTuning(FUSED_TUNING)
    expect(levelWords({ roll: 3, pitch: 2 }, { roll: 3, pitch: 2 }, tuning, true)).toBe('Tilt top away 2°')
    expect(levelWords({ roll: 0, pitch: -2 }, { roll: 0, pitch: 2 }, tuning, true)).toBe('Tilt top toward you 2°')
    expect(levelWords({ roll: 2.5, pitch: 0 }, { roll: 2.5, pitch: 0 }, tuning, true)).toBe('Tilt right 2.5°')
    expect(levelWords({ roll: 1.8, pitch: 1 }, { roll: 2, pitch: 1 }, tuning, true)).toBeNull()
  })
})
