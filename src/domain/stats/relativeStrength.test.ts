import { describe, expect, it } from 'vitest'
import type { BodyLog } from '../../types'
import { relativeStrength } from './relativeStrength'

const at = (m: number, d: number, h = 18) => new Date(2026, m, d, h).getTime()
const log: BodyLog = [
  { day: '2026-10-01', weightKg: 80 },
  { day: '2026-10-15', weightKg: 78.5 },
]

describe('E26-T3 O9 relativeStrength', () => {
  it('O9 divides est. strength by the bodyweight on or before the session, to two decimals', () => {
    expect(relativeStrength(116, log, at(9, 10))).toEqual({ ratio: 1.45, text: '1.45 × bodyweight' })
  })
  it('O9 uses the entry logged on the session day itself', () => {
    expect(relativeStrength(157, log, at(9, 15, 7))).toEqual({ ratio: 2, text: '2.00 × bodyweight' })
  })
  it('O9 rounds to two decimals', () => {
    expect(relativeStrength(100, log, at(9, 10))?.text).toBe('1.25 × bodyweight')
    expect(relativeStrength(90, log, at(9, 10))?.ratio).toBe(1.13)
  })
  it('O9 shows nothing with no bodyweight on or before the session', () => {
    expect(relativeStrength(116, log, at(8, 30))).toBeNull()
    expect(relativeStrength(116, [], at(9, 10))).toBeNull()
    expect(relativeStrength(116, [{ day: '2026-10-01', waistCm: 85 }], at(9, 10))).toBeNull()
  })
})
