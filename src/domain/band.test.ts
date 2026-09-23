import { expect, test } from 'vitest'
import { band } from './band'

// M5: a set count bands to one of four shades, on two different scales (E5-T17). Boundaries are
// hand-checked against the ticket's named ranges -- session: 0 / 1-2 / 3-5 / 6+; week: 0 / under
// 10 / 10-20 / over 20 -- not computed from `band` itself.

// --- session scale: 0 / 1-2 / 3-5 / 6+ ------------------------------------------------------

test('M5 a session count of 0 bands to 0', () => {
  expect(band(0, 'session')).toBe(0)
})

test('M5 a session count of 1 bands to 1', () => {
  expect(band(1, 'session')).toBe(1)
})

test('M5 a session count of 2 bands to 1', () => {
  expect(band(2, 'session')).toBe(1)
})

test('M5 a session count of 3 bands to 2', () => {
  expect(band(3, 'session')).toBe(2)
})

test('M5 a session count of 5 bands to 2', () => {
  expect(band(5, 'session')).toBe(2)
})

test('M5 a session count of 6 bands to 3', () => {
  expect(band(6, 'session')).toBe(3)
})

// --- week scale: 0 / under 10 / 10-20 / over 20 ----------------------------------------------

test('M5 a week count of 0 bands to 0', () => {
  expect(band(0, 'week')).toBe(0)
})

test('M5 a week count of 1 bands to 1', () => {
  expect(band(1, 'week')).toBe(1)
})

test('M5 a week count of 9 bands to 1', () => {
  expect(band(9, 'week')).toBe(1)
})

test('M5 a week count of 10 bands to 2', () => {
  expect(band(10, 'week')).toBe(2)
})

test('M5 a week count of 20 bands to 2', () => {
  expect(band(20, 'week')).toBe(2)
})

test('M5 a week count of 21 bands to 3', () => {
  expect(band(21, 'week')).toBe(3)
})
