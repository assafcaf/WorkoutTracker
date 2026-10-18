import { expect, test } from 'vitest'
import { healthShortcutUrl } from './healthShortcut'
import type { Session } from '../types'

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
