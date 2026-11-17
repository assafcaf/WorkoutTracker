// photos v2: the distance cue (docs/design/photos-2026-11/stability-and-distance.md section 3.4).
import { describe, expect, test } from 'vitest'
import {
  DistanceSmoother,
  POSE,
  barPosition,
  bodyLinesOf,
  bodyScaleOf,
  distanceTrigger,
  distanceWord,
  percentOff,
  scaleRatio,
  tickInterval,
} from './distance'
import { body } from './testPose'

describe('body scale', () => {
  test('shoulder-mid to ankle-mid and to hip-mid, as fractions of the frame height', () => {
    const scale = bodyScaleOf(body(1), 600, 800)
    expect(scale?.full).toBeCloseTo(0.6, 9)
    expect(scale?.torso).toBeCloseTo(0.2, 9)
  })

  test('the frame aspect is applied: a sideways offset counts in pixels, not normalised units', () => {
    const marks = body(1)
    marks[POSE.leftHip] = { x: 0.65, y: 0.4, visibility: 1 }
    marks[POSE.rightHip] = { x: 0.65, y: 0.4, visibility: 1 }
    // hip-mid is 0.15 of the width (90 px of 600) right of shoulder-mid and 0.2 of 800 (160 px) down.
    expect(bodyScaleOf(marks, 600, 800)?.torso).toBeCloseTo(Math.hypot(90, 160) / 800, 9)
  })

  test('hidden ankles: full is null and the torso stays', () => {
    const scale = bodyScaleOf(body(1, { [POSE.leftAnkle]: { visibility: 0.2 } }), 600, 800)
    expect(scale?.full).toBeNull()
    expect(scale?.torso).toBeCloseTo(0.2)
  })

  test('a hidden shoulder or hip means no measure ("Step into frame")', () => {
    expect(bodyScaleOf(body(1, { [POSE.rightShoulder]: { visibility: 0.4 } }), 600, 800)).toBeNull()
    expect(bodyScaleOf(body(1, { [POSE.leftHip]: { visibility: 0.1 } }), 600, 800)).toBeNull()
    expect(bodyScaleOf([], 600, 800)).toBeNull()
  })

  test('head and feet lines from the landmarks', () => {
    const lines = bodyLinesOf(body(1))
    expect(lines?.head).toBeCloseTo(0.1 - 0.6 * 0.1, 9)
    expect(lines?.feet).toBeCloseTo(0.83, 9)
    expect(bodyLinesOf(body(1, { [POSE.nose]: { visibility: 0 } }))).toBeNull()
  })
})

describe('the ratio', () => {
  const ref = { full: 0.6, torso: 0.2 }

  test('full over full when both have it', () => {
    expect(scaleRatio({ full: 0.66, torso: 0.3 }, ref)).toBeCloseTo(1.1)
  })

  test('torso over torso (torso x k_ref over S_ref) when the ankles are hidden now or on the reference', () => {
    expect(scaleRatio({ full: null, torso: 0.21 }, ref)).toBeCloseTo(1.05)
    expect(scaleRatio({ full: 0.66, torso: 0.19 }, { full: null, torso: 0.2 })).toBeCloseTo(0.95)
  })

  test('torso x k_ref equals full when the posture matches the reference', () => {
    const k = ref.full / ref.torso
    const now = { full: null, torso: 0.22 }
    expect(scaleRatio(now, ref)).toBeCloseTo((now.torso * k) / ref.full, 9)
  })
})

describe('ratio smoothing', () => {
  test('a constant ratio stays itself', () => {
    const s = new DistanceSmoother()
    for (let t = 0; t < 2000; t += 110) expect(s.push(1.07, t)).toBeCloseTo(1.07, 9)
  })

  test('noise of +-3 % at 9 Hz comes out within about 1.5 %', () => {
    const s = new DistanceSmoother()
    let seed = 5
    const rand = (): number => {
      seed = (seed * 1103515245 + 12345) % 2147483648
      return seed / 2147483648 - 0.5
    }
    const out: number[] = []
    for (let t = 0; t < 10000; t += 110) {
      const r = s.push(1 + rand() * 0.06, t)
      if (t > 2000) out.push(r)
    }
    const mean = out.reduce((a, b) => a + b, 0) / out.length
    const sd = Math.sqrt(out.reduce((a, b) => a + (b - mean) ** 2, 0) / out.length)
    expect(sd).toBeLessThan(0.015)
    expect(Math.abs(mean - 1)).toBeLessThan(0.01)
  })

  test('one bad inference (a spike) is removed by the median', () => {
    const s = new DistanceSmoother()
    for (let t = 0; t < 1000; t += 110) s.push(1, t)
    expect(s.push(1.5, 1100)).toBeCloseTo(1, 9)
  })

  test('symmetric in log: 10 % closer and 10 % farther settle equally fast', () => {
    const closer = new DistanceSmoother()
    const farther = new DistanceSmoother()
    for (let t = 0; t < 600; t += 110) {
      closer.push(1, t)
      farther.push(1, t)
    }
    let c = 1
    let f = 1
    for (let t = 660; t < 1200; t += 110) {
      c = closer.push(1.1, t)
      f = farther.push(1 / 1.1, t)
    }
    expect(Math.log(c)).toBeCloseTo(-Math.log(f), 9)
  })

  test('a step reaches 90 % of the way within about a second (tau 0.4 s plus the median)', () => {
    const s = new DistanceSmoother()
    for (let t = 0; t < 1000; t += 110) s.push(1, t)
    let reached = Number.NaN
    for (let t = 1100; t < 4000; t += 110) {
      if (s.push(1.1, t) > 1.09 && Number.isNaN(reached)) reached = t - 1100
    }
    expect(reached).toBeLessThan(1500)
  })
})

describe('the zone and the cue state', () => {
  test('green enters at 3 % after 500 ms and leaves only past 5 %', () => {
    const zone = distanceTrigger()
    expect(zone.update([0.04], 0)).toBe(false)
    expect(zone.update([0.02], 100)).toBe(false)
    expect(zone.update([0.02], 599)).toBe(false)
    expect(zone.update([-0.025], 600)).toBe(true)
    expect(zone.update([0.045], 700)).toBe(true)
    expect(zone.update([-0.049], 800)).toBe(true)
    expect(zone.update([0.051], 900)).toBe(false)
  })

  test('words: bigger in frame means step back, smaller means come closer, none in the zone', () => {
    expect(distanceWord(1.08, false)).toBe('Step back')
    expect(distanceWord(0.9, false)).toBe('Come closer')
    expect(distanceWord(1.02, false)).toBeNull()
    expect(distanceWord(1.04, true)).toBeNull()
  })

  test('the bar: closer is left, farther is right, clamped at +-20 %', () => {
    expect(barPosition(1)).toEqual({ position: 0, clamped: false })
    expect(barPosition(1.1).position).toBeCloseTo(-0.5)
    expect(barPosition(0.9).position).toBeCloseTo(0.5)
    expect(barPosition(1.5)).toEqual({ position: -1, clamped: true })
    expect(barPosition(0.5)).toEqual({ position: 1, clamped: true })
  })

  test('the number is whole percent off', () => {
    expect(percentOff(1.044)).toBe(4)
    expect(percentOff(0.93)).toBe(7)
  })

  test('ticks: slow far away, fast near the zone', () => {
    expect(tickInterval(1.2)).toBe(1000)
    expect(tickInterval(2)).toBe(1000)
    expect(tickInterval(1.03)).toBe(250)
    expect(tickInterval(0.9)).toBeGreaterThan(250)
    expect(tickInterval(0.9)).toBeLessThan(1000)
    expect(tickInterval(1.05)).toBeLessThan(tickInterval(1.15))
  })
})
