// Mirror mode: compare and the viewer flip a mirror photo only next to a stand photo.
import { describe, expect, test } from 'vitest'
import { flipNextTo, mirroredPoints, modeOf, pairFlips } from './flip'
import { transformOf } from './photoFrame'

const mirror = { mode: 'mirror' as const }
const stand = { mode: 'stand' as const }
const old = {}

describe('flip for display', () => {
  test('a photo without a mode counts as stand', () => {
    expect(modeOf(old)).toBe('stand')
    expect(modeOf(mirror)).toBe('mirror')
  })

  test('a mirror photo flips next to a stand photo, or an old photo with no mode', () => {
    expect(flipNextTo(mirror, [stand])).toBe(true)
    expect(flipNextTo(mirror, [old])).toBe(true)
  })

  test('same-mode pairs never flip, and a stand photo never flips', () => {
    expect(flipNextTo(mirror, [mirror])).toBe(false)
    expect(flipNextTo(stand, [mirror])).toBe(false)
    expect(flipNextTo(old, [stand])).toBe(false)
  })

  test('in a pair only the mirror one flips; Flip turns the after photo over as well', () => {
    expect(pairFlips(mirror, stand)).toEqual({ before: true, after: false })
    expect(pairFlips(stand, mirror)).toEqual({ before: false, after: true })
    expect(pairFlips(mirror, mirror)).toEqual({ before: false, after: false })
    expect(pairFlips(mirror, mirror, true)).toEqual({ before: false, after: true })
    expect(pairFlips(stand, mirror, true)).toEqual({ before: false, after: false })
  })

  test('the flip is applied before the align transform, display only', () => {
    const aligned = { align: { scale: 1.1, rotate: 2, dx: 0.1, dy: 0 } }
    expect(transformOf(aligned, true).transform).toBe('scaleX(-1) translate(10%, 0%) rotate(2deg) scale(1.1)')
    expect(transformOf({ align: null }, true).transform).toBe('scaleX(-1)')
    expect(transformOf({ align: null })).toEqual({})
  })

  test('auto-align against the other mode negates x of each point, labels untouched', () => {
    expect(mirroredPoints([{ x: 0.3, y: 0.2, visibility: 0.9 }])).toEqual([{ x: 0.7, y: 0.2, visibility: 0.9 }])
  })
})
