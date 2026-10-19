import { readFileSync } from 'node:fs'
import { beforeEach, expect, test } from 'vitest'
import {
  HEALTH_READY_KEY,
  HEALTH_SHORTCUT_NAME,
  HEALTH_SHORTCUT_STEPS,
  healthShortcutUrl,
  markHealthReady,
  readHealthReady,
} from './healthShortcut'
import type { Session } from '../types'

beforeEach(() => localStorage.clear())

const START = Date.UTC(2026, 9, 12, 10, 0, 0)
const SESSION: Session = {
  id: 's1',
  programId: 'p',
  workoutId: 'w',
  startedAt: START,
  finishedAt: START + 52 * 60_000 + 40_000,
  entries: [],
}

test('O30 the URL runs the named Shortcut with the Workout as URI-encoded JSON text', () => {
  const prefix = 'shortcuts://run-shortcut?name=Workout%20Tracker%20to%20Health&input=text&text='
  const url = healthShortcutUrl(SESSION, 'Workout A')
  expect(url.startsWith(prefix)).toBe(true)
  expect(JSON.parse(decodeURIComponent(url.slice(prefix.length)))).toEqual({
    workout: 'Workout A',
    start: new Date(START).toISOString(),
    end: new Date(START + 52 * 60_000 + 40_000).toISOString(),
    minutes: 53,
  })
})

test('O4 every in-app step key phrase appears in the setup doc', () => {
  const doc = readFileSync('docs/apple-health-shortcut.md', 'utf8')
  expect(HEALTH_SHORTCUT_STEPS.length).toBeGreaterThanOrEqual(6)
  for (const step of HEALTH_SHORTCUT_STEPS) {
    expect(step.text).toContain(step.key)
    expect(doc).toContain(step.key)
  }
})

test('O1 the steps cover the name, the dictionary values, the dates and Log Workout', () => {
  const all = HEALTH_SHORTCUT_STEPS.map((s) => s.text).join('\n')
  expect(HEALTH_SHORTCUT_NAME).toBe('Workout Tracker to Health')
  for (const phrase of [
    'Workout Tracker to Health',
    'Text',
    'Get Dictionary from Input',
    'Get Dictionary Value',
    'workout',
    'start',
    'end',
    'minutes',
    'Get Dates from Input',
    'Log Workout',
    'Traditional Strength Training',
  ]) {
    expect(all).toContain(phrase)
  }
})

test('O2 ready is false until marked, then stored under healthShortcutReady', () => {
  expect(HEALTH_READY_KEY).toBe('healthShortcutReady')
  expect(readHealthReady()).toBe(false)
  markHealthReady()
  expect(readHealthReady()).toBe(true)
  expect(localStorage.getItem('healthShortcutReady')).not.toBeNull()
})
