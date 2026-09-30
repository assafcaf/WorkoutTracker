import { expect, test } from 'vitest'
import { loadCatalog } from '../data/catalog'
import { buildLadder, loadLadder, stepWeight, validateEntry } from './dial'
import type { Exercise } from '../types'

// Real catalog fixtures, per the ticket's guidance: prefer the real 14-exercise catalog over
// hand-rolled fixtures for O8.
const catalog = loadCatalog()

function exerciseOf(id: string): Exercise {
  const exercise = catalog.get(id)
  if (!exercise) throw new Error(`fixture error: no exercise ${id} in the loaded catalog`)
  return exercise
}

const machineShoulderPress = exerciseOf('machine-shoulder-press')
const backSquat = exerciseOf('back-squat')
const pushUps = exerciseOf('push-ups')

test('O8 the weight dial advances one notch on machine-shoulder-press from 7.5kg to 8.75kg', () => {
  expect(stepWeight(7.5, 1, machineShoulderPress)).toBe(8.75)
})

test('O8 the weight dial advances one notch on back-squat from 60kg to 62.5kg', () => {
  expect(stepWeight(60, 1, backSquat)).toBe(62.5)
})

test('O8 stepWeight from an off-ladder value moves up to the next rung', () => {
  expect(stepWeight(63, 1, backSquat)).toBe(65)
})

test('O8 stepWeight from an off-ladder value moves down to the next lower rung', () => {
  expect(stepWeight(63, -1, backSquat)).toBe(60)
})

test('O8 stepWeight steps down one notch on back-squat from 62.5kg to 60kg', () => {
  expect(stepWeight(62.5, -1, backSquat)).toBe(60)
})

test('O8 buildLadder starts back-squats ladder at its weight step and steps by its weight step, with the start weight still a rung', () => {
  const ladder = buildLadder(backSquat)

  expect(ladder.slice(0, 5)).toEqual([2.5, 5, 7.5, 10, 12.5])
  expect(ladder).toContain(50)
})

test('O8 a first-ever Set still opens the weight Dial on the start weight', () => {
  expect(backSquat.startWeight).toBe(50)
})

test('O8 stepWeight moves the Dial from the start weight down to one weightStep below it', () => {
  expect(stepWeight(50, -1, backSquat)).toBe(47.5)
})

test('O8 buildLadder returns an empty ladder for a bodyweight exercise', () => {
  expect(buildLadder(pushUps)).toEqual([])
})

test('O11 validateEntry accepts the minimum weight of 0kg', () => {
  expect(validateEntry(0, 10)).toEqual({ ok: true })
})

test('O11 validateEntry accepts the maximum weight of 500kg', () => {
  expect(validateEntry(500, 10)).toEqual({ ok: true })
})

test('O11 validateEntry rejects a weight just below 0kg naming the accepted range', () => {
  const result = validateEntry(-1, 10)

  expect(result.ok).toBe(false)
  expect((result as { ok: false; error: string }).error).toContain('0')
  expect((result as { ok: false; error: string }).error).toContain('500')
})

test('O11 validateEntry rejects a weight just above 500kg naming the accepted range', () => {
  const result = validateEntry(500.1, 10)

  expect(result.ok).toBe(false)
  expect((result as { ok: false; error: string }).error).toContain('0')
  expect((result as { ok: false; error: string }).error).toContain('500')
})

test('O11 validateEntry accepts a null weight as bodyweight', () => {
  expect(validateEntry(null, 10)).toEqual({ ok: true })
})

test('O11 validateEntry accepts the minimum reps of 0.5', () => {
  expect(validateEntry(50, 0.5)).toEqual({ ok: true })
})

test('O11 validateEntry accepts the maximum reps of 100', () => {
  expect(validateEntry(50, 100)).toEqual({ ok: true })
})

test('O11 validateEntry rejects reps just below 0.5 naming the accepted range', () => {
  const result = validateEntry(50, 0.4)

  expect(result.ok).toBe(false)
  expect((result as { ok: false; error: string }).error).toContain('0.5')
  expect((result as { ok: false; error: string }).error).toContain('100')
})

test('O11 validateEntry rejects reps just above 100 naming the accepted range', () => {
  const result = validateEntry(50, 100.1)

  expect(result.ok).toBe(false)
  expect((result as { ok: false; error: string }).error).toContain('0.5')
  expect((result as { ok: false; error: string }).error).toContain('100')
})

// --- E14-T14: the Load Dial's Ladder and the Load's range (O17) -------------------------------

test('O17 loadLadder(1) runs from -60 to +100 in 1 kg Rungs: 161 of them', () => {
  const ladder = loadLadder(1)

  expect(ladder).toHaveLength(161)
  expect(ladder[0]).toBe(-60)
  expect(ladder[1]).toBe(-59)
  expect(ladder[160]).toBe(100)
})

test('O17 loadLadder(1) has plain bodyweight, 0, as a Rung between -20 and +10', () => {
  const ladder = loadLadder(1)

  expect(ladder[40]).toBe(-20)
  expect(ladder[60]).toBe(0)
  expect(ladder[70]).toBe(10)
})

test('O17 loadLadder(2.5) runs from -60 to +100 in 2.5 kg Rungs: 65 of them, 0 among them', () => {
  const ladder = loadLadder(2.5)

  expect(ladder).toHaveLength(65)
  expect(ladder.slice(0, 3)).toEqual([-60, -57.5, -55])
  expect(ladder[24]).toBe(0)
  expect(ladder[64]).toBe(100)
})

test('O17 loadLadder(1.25) has no floating-point drift: 8.75 is a Rung and +100 the last', () => {
  const ladder = loadLadder(1.25)

  expect(ladder).toHaveLength(129)
  expect(ladder).toContain(8.75)
  expect(ladder).toContain(0)
  expect(ladder[128]).toBe(100)
})

test('O17 validateEntry accepts a Load of -60 and of +100, the ends of the range', () => {
  expect(validateEntry(null, 8, -60)).toEqual({ ok: true })
  expect(validateEntry(null, 8, 100)).toEqual({ ok: true })
})

test('O17 validateEntry rejects a Load just above +100', () => {
  expect(validateEntry(null, 8, 100.5).ok).toBe(false)
})

test('O17 validateEntry rejects a Load just below -60', () => {
  expect(validateEntry(null, 8, -60.5).ok).toBe(false)
})
