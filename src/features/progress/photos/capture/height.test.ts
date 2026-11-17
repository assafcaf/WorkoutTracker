// Mirror mode: phone height from pose and pitch, the hand by image side.
import { describe, expect, test } from 'vitest'
import { POSE } from './distance'
import {
  HORIZON_K,
  HeightSmoother,
  handOf,
  heightPosition,
  heightTrigger,
  heightWord,
  horizonRow,
  phoneHeightOf,
} from './height'
import { body } from './testPose'

describe('phone height', () => {
  test('k is about 0.75 for the plain wide lens', () => {
    expect(HORIZON_K).toBeCloseTo(0.75, 2)
  })

  test('a level phone puts the horizon at the frame middle; pitching up moves it down', () => {
    expect(horizonRow(0)).toBe(0.5)
    expect(horizonRow(5)).toBeCloseTo(0.5 + HORIZON_K * Math.tan((5 * Math.PI) / 180))
    expect(horizonRow(-5)).toBeLessThan(0.5)
  })

  test('h is the shoulders row against the horizon, in torso lengths', () => {
    // shoulders at 0.2, hips at 0.4: torso 0.2, shoulders 0.3 above the middle.
    expect(phoneHeightOf(body(1), 0)).toBeCloseTo(-1.5)
  })

  test('a higher phone (body lower in the frame) reads larger', () => {
    const lower = body(1, {
      [POSE.leftShoulder]: { y: 0.3 },
      [POSE.rightShoulder]: { y: 0.3 },
      [POSE.leftHip]: { y: 0.5 },
      [POSE.rightHip]: { y: 0.5 },
    })
    expect(phoneHeightOf(lower, 0)!).toBeGreaterThan(phoneHeightOf(body(1), 0)!)
  })

  test('the pitch term corrects the horizon, so tilting alone does not read as height', () => {
    const tilted = phoneHeightOf(body(1), 1.5)!
    expect(tilted).toBeCloseTo((0.2 - horizonRow(1.5)) / 0.2)
    expect(Math.abs(tilted - phoneHeightOf(body(1), 0)!)).toBeGreaterThan(0.08)
  })

  test('a hidden shoulder or hip gives no height', () => {
    expect(phoneHeightOf(body(1, { [POSE.leftHip]: { visibility: 0.2 } }), 0)).toBeNull()
  })
})

describe('height zone and words', () => {
  test('in at 0.10, out past 0.18, after 500 ms', () => {
    const z = heightTrigger()
    expect(z.update([0.09], 0)).toBe(false)
    expect(z.update([0.09], 500)).toBe(true)
    expect(z.update([0.17], 600)).toBe(true)
    expect(z.update([0.19], 700)).toBe(false)
  })

  test('higher than last time says Lower the phone; lower says Raise; only past the outer band', () => {
    expect(heightWord(0.3, false)).toBe('Lower the phone')
    expect(heightWord(-0.3, false)).toBe('Raise the phone')
    expect(heightWord(0.15, false)).toBeNull()
    expect(heightWord(-0.3, true)).toBeNull()
  })

  test('the smoother takes the median then an EMA, linear', () => {
    const s = new HeightSmoother()
    expect(s.push(1, 0)).toBe(1)
    s.push(1, 100)
    expect(s.push(9, 200)).toBe(1) // a spike: the median of 1, 1, 9 is 1
    for (let t = 300; t < 3000; t += 100) s.push(2, t)
    expect(s.value).toBeCloseTo(2, 2)
  })

  test('the dot position is clamped at half a torso either way', () => {
    expect(heightPosition(0.25)).toBe(0.5)
    expect(heightPosition(-2)).toBe(-1)
  })
})

describe('which hand', () => {
  test('the raised wrist right of the shoulders middle is the right hand', () => {
    expect(handOf(body(1, { 16: { x: 0.62, y: 0.12 }, 15: { x: 0.4, y: 0.5 } }))).toBe('right')
    expect(handOf(body(1, { 15: { x: 0.36, y: 0.1 }, 16: { x: 0.6, y: 0.5 } }))).toBe('left')
  })

  test('image side decides, not the landmark label (a reflection may swap them)', () => {
    expect(handOf(body(1, { 15: { x: 0.64, y: 0.1 }, 16: { x: 0.4, y: 0.5 } }))).toBe('right')
  })

  test('no wrist above the shoulders, or none seen, is unknown', () => {
    expect(handOf(body(1, { 15: { x: 0.4, y: 0.5 }, 16: { x: 0.6, y: 0.5 } }))).toBeNull()
    expect(handOf(body(1, { 15: { visibility: 0.1 }, 16: { visibility: 0.1 } }))).toBeNull()
  })
})
