import { describe, expect, it } from 'vitest'
import { lbsToKg, rirFromRpe } from './units'

describe('lbsToKg', () => {
  it('converts at 0.45359237 rounded to 0.1 kg', () => {
    expect(lbsToKg(225)).toBe(102.1)
    expect(lbsToKg(135)).toBe(61.2)
    expect(lbsToKg(0)).toBe(0)
  })
})

describe('rirFromRpe', () => {
  it('answers 0 for RPE 10', () => {
    expect(rirFromRpe(10)).toBe(0)
  })
  it('answers 1 for 9 and 9.5', () => {
    expect(rirFromRpe(9)).toBe(1)
    expect(rirFromRpe(9.5)).toBe(1)
  })
  it('answers 2 for 8 and 8.5', () => {
    expect(rirFromRpe(8)).toBe(2)
    expect(rirFromRpe(8.5)).toBe(2)
  })
  it('answers 3 for 7.5 and below', () => {
    expect(rirFromRpe(7.5)).toBe(3)
    expect(rirFromRpe(6)).toBe(3)
  })
  it('answers nothing for a blank or 0 RPE', () => {
    expect(rirFromRpe(null)).toBeUndefined()
    expect(rirFromRpe(undefined)).toBeUndefined()
    expect(rirFromRpe(0)).toBeUndefined()
  })
})
