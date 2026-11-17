// Mirror mode: the auto-capture state machine (confirm, 3·2·1, stillness, tap).
import { describe, expect, test } from 'vitest'
import { AutoCapture, FIRST_PHOTO_CONFIRM_MS, rotationOf } from './autoCapture'

const run = (a: AutoCapture, from: number, to: number, input: { matched: boolean; auto?: boolean; rotation?: number | null; confirmMs?: number }) => {
  let last = a.update({ t: from, auto: true, rotation: 0, ...input })
  const fired: number[] = last.fire ? [from] : []
  for (let t = from + 50; t <= to; t += 50) {
    last = a.update({ t, auto: true, rotation: 0, ...input })
    if (last.fire) fired.push(t)
  }
  return { last, fired }
}

describe('auto-capture', () => {
  test('matched for 0.6 s, then a 1.5 s 3·2·1 countdown, then one shot', () => {
    const a = new AutoCapture()
    expect(a.update({ t: 0, matched: true, auto: true, rotation: 0 }).phase).toBe('confirming')
    expect(a.update({ t: 300, matched: true, auto: true, rotation: 0 }).progress).toBeCloseTo(0.5)
    const counting = a.update({ t: 600, matched: true, auto: true, rotation: 0 })
    expect(counting).toMatchObject({ phase: 'counting', count: 3, manual: false })
    expect(a.update({ t: 1150, matched: true, auto: true, rotation: 0 }).count).toBe(2)
  })

  test('the shot comes at 2.1 s and only once', () => {
    const { fired } = run(new AutoCapture(), 0, 4000, { matched: true })
    expect(fired).toEqual([2100])
  })

  test('a cue letting go during the confirm or the countdown cancels it', () => {
    const a = new AutoCapture()
    run(a, 0, 400, { matched: true })
    expect(a.update({ t: 450, matched: false, auto: true, rotation: 0 }).phase).toBe('idle')
    run(a, 500, 1500, { matched: true })
    expect(a.current).toBe('counting')
    expect(a.update({ t: 1550, matched: false, auto: true, rotation: 0 })).toMatchObject({ phase: 'idle', count: null })
  })

  test('auto off never starts; the first photo waits 1 s', () => {
    expect(run(new AutoCapture(), 0, 5000, { matched: true, auto: false }).fired).toEqual([])
    const a = new AutoCapture()
    run(a, 0, 900, { matched: true, confirmMs: FIRST_PHOTO_CONFIRM_MS })
    expect(a.current).toBe('confirming')
    run(a, 950, 1000, { matched: true, confirmMs: FIRST_PHOTO_CONFIRM_MS })
    expect(a.current).toBe('counting')
  })

  test('after the countdown it waits for the phone to be still, at most 0.4 s', () => {
    const a = new AutoCapture()
    run(a, 0, 2100, { matched: true, rotation: 40 })
    expect(a.current).toBe('steadying')
    expect(a.update({ t: 2200, matched: true, auto: true, rotation: 10 }).fire).toBe(true)
    const b = new AutoCapture()
    const { fired } = run(b, 0, 3000, { matched: true, rotation: 40 })
    expect(fired).toEqual([2500])
  })

  test('no rotation rate counts as still', () => {
    expect(run(new AutoCapture(), 0, 3000, { matched: true, rotation: null }).fired).toEqual([2100])
  })

  test('a tap starts a 2 s countdown without the cues; a second tap cancels it', () => {
    const a = new AutoCapture()
    a.tap(0)
    expect(a.update({ t: 0, matched: false, auto: true, rotation: 0 })).toMatchObject({ phase: 'counting', count: 2, manual: true })
    expect(a.update({ t: 1200, matched: false, auto: true, rotation: 0 }).count).toBe(1)
    expect(a.update({ t: 2000, matched: false, auto: true, rotation: 0 }).fire).toBe(true)
    const b = new AutoCapture()
    b.tap(0)
    b.update({ t: 500, matched: false, auto: true, rotation: 0 })
    b.tap(600)
    expect(run(b, 650, 4000, { matched: false }).fired).toEqual([])
  })

  test('a tap during an automatic countdown cancels it, and it re-arms only after the cues let go', () => {
    const a = new AutoCapture()
    run(a, 0, 800, { matched: true })
    a.tap(850)
    expect(run(a, 900, 4000, { matched: true }).fired).toEqual([])
    a.update({ t: 4050, matched: false, auto: true, rotation: 0 })
    expect(run(a, 4100, 7000, { matched: true }).fired).toEqual([6200])
  })

  test('rotationOf is the rate magnitude, null when a component is missing', () => {
    expect(rotationOf({ alpha: 3, beta: 4, gamma: 0 })).toBe(5)
    expect(rotationOf({ alpha: null, beta: 4, gamma: 0 })).toBeNull()
    expect(rotationOf(null)).toBeNull()
  })
})
