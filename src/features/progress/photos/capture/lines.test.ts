// photos v2: the ghost, the video and the lines share one contain fit.
import { describe, expect, test } from 'vitest'
import { MIN_LINE_GAP, containedBox, movedLines } from './lines'

describe('containedBox', () => {
  test('the same aspect fills the box', () => {
    expect(containedBox(3 / 4, 3 / 4)).toEqual({ left: 0, top: 0, width: 1, height: 1 })
  })

  test('a wider image is letterboxed top and bottom', () => {
    const box = containedBox(4 / 3, 3 / 4)
    expect(box.width).toBe(1)
    expect(box.height).toBeCloseTo(9 / 16)
    expect(box.top).toBeCloseTo((1 - 9 / 16) / 2)
  })

  test('a taller image (a 9:16 stream in a 3:4 box) is pillarboxed', () => {
    const box = containedBox(9 / 16, 3 / 4)
    expect(box.height).toBe(1)
    expect(box.width).toBeCloseTo(0.75)
    expect(box.left).toBeCloseTo(0.125)
  })

  test('a bad aspect falls back to the whole box', () => {
    expect(containedBox(0, 3 / 4)).toEqual({ left: 0, top: 0, width: 1, height: 1 })
  })
})

describe('movedLines', () => {
  test('moves one line and keeps it on the photo and apart from the other', () => {
    expect(movedLines({ head: 0.1, feet: 0.9 }, 'head', -0.05).head).toBeCloseTo(0.05)
    expect(movedLines({ head: 0.1, feet: 0.9 }, 'head', -0.5).head).toBe(0)
    expect(movedLines({ head: 0.1, feet: 0.9 }, 'feet', 0.5).feet).toBe(1)
    expect(movedLines({ head: 0.1, feet: 0.9 }, 'head', 0.9).head).toBeCloseTo(0.9 - MIN_LINE_GAP)
    expect(movedLines({ head: 0.1, feet: 0.9 }, 'feet', -0.9).feet).toBeCloseTo(0.1 + MIN_LINE_GAP)
  })
})
