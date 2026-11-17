// photos v2: one cue at a time (tilt, then distance, then Matched).
import { describe, expect, test } from 'vitest'
import { pickCue } from './cue'

const level = (visible: boolean, matched: boolean, words: string | null = null) => ({ visible, matched, words })

describe('pickCue', () => {
  test('tilt comes first, even when the distance is off too', () => {
    expect(pickCue(level(true, false, 'Tilt left 2°'), { kind: 'measured', matched: false, word: 'Step back' })).toEqual({
      kind: 'level',
      text: 'Tilt left 2°',
    })
  })

  test('inside the level band but still dwelling says Hold still', () => {
    expect(pickCue(level(true, false), { kind: 'off' }).text).toBe('Hold still')
  })

  test('then distance, then "Step into frame" with no body', () => {
    expect(pickCue(level(true, true), { kind: 'measured', matched: false, word: 'Come closer' })).toEqual({
      kind: 'distance',
      text: 'Come closer',
    })
    expect(pickCue(level(true, true), { kind: 'no-body' })).toEqual({ kind: 'frame', text: 'Step into frame' })
  })

  test('a hidden level is skipped, so the distance cue still shows', () => {
    expect(pickCue(level(false, false, 'Tilt right 30°'), { kind: 'measured', matched: false, word: 'Step back' }).text).toBe('Step back')
  })

  test('all green is Matched; level alone is the given word ("Level" with no reference)', () => {
    expect(pickCue(level(true, true), { kind: 'measured', matched: true, word: null })).toEqual({ kind: 'matched', text: 'Matched' })
    expect(pickCue(level(true, true), { kind: 'off' }, 'Level')).toEqual({ kind: 'matched', text: 'Level' })
    expect(pickCue(level(false, false), { kind: 'measured', matched: true, word: null }).kind).toBe('matched')
  })

  test('nothing measured says nothing', () => {
    expect(pickCue(level(false, false), { kind: 'off' })).toEqual({ kind: 'none', text: '' })
    expect(pickCue(level(false, false), { kind: 'loading' })).toEqual({ kind: 'none', text: '' })
  })
})
