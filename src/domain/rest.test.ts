import { expect, test } from 'vitest'
import { restState } from './rest'

// back-squat's plan (src/data/programs/assaf-ab-2026.json, workout-a) prescribes
// restSeconds: 180, per the ticket. Timestamps are epoch milliseconds, as in SetEntry.loggedAt.
const restSeconds = 180

test('O14 restState shows 1:20 (80 seconds) remaining 100s into a 180s rest', () => {
  const lastLoggedAt = 0
  const now = 100_000 // 100s later, in ms

  expect(restState(lastLoggedAt, restSeconds, now)).toEqual({
    remainingSeconds: 80,
    isOver: false,
  })
})

test('O14 restState shows 0:00 remaining and reports rest as over 200s into a 180s rest', () => {
  const lastLoggedAt = 0
  const now = 200_000 // 200s later, in ms

  expect(restState(lastLoggedAt, restSeconds, now)).toEqual({
    remainingSeconds: 0,
    isOver: true,
  })
})

test('O14 restState is over exactly at the restSeconds boundary', () => {
  const lastLoggedAt = 0
  const now = 180_000 // exactly 180s later, in ms

  expect(restState(lastLoggedAt, restSeconds, now)).toEqual({
    remainingSeconds: 0,
    isOver: true,
  })
})

test('O14 restState reports rest as over when no set has been logged', () => {
  expect(restState(null, restSeconds, 0)).toEqual({
    remainingSeconds: 0,
    isOver: true,
  })
})
