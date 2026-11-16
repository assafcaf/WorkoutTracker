// v7 (study §1.8): which lifts the Program tab's "Needs a decision" lists, on the stats fixture as of
// Thu 15 Oct 18:05 (Asia/Jerusalem), the moment scripts/render-states/stats-45.json pins.
import { expect, test } from 'vitest'
import sessionsJson from '../test/fixtures/stats/sessions.json'
import { loadCatalog, loadPrograms } from '../data/catalog'
import { programDecisions } from './programDecisions'
import { liftStatuses } from './stats/status'
import type { Program, Session } from '../types'

const sessions = sessionsJson as unknown as Session[]
const catalog = loadCatalog()
const resolve = (id: string) => catalog.get(id)
const program = loadPrograms().find((p) => p.id === 'assaf-ab-2026')!
const NOW = Date.parse('2026-10-15T18:05:00+03:00')

test('v7 programDecisions lists only the lifts whose status needs a decision, most pressing first', () => {
  const decisions = programDecisions(program, sessions, resolve, NOW)

  expect(decisions.map((status) => [status.exerciseId, status.kind])).toEqual([
    ['db-bench-press', 'stalled'],
    ['narrow-grip-pull-down', 'lowered'],
    ['push-ups', 'ready'],
    ['seated-biceps-curls', 'ready'],
  ])
  // Every word is the lift's one status, as Progress and the Lift page say it.
  const all = liftStatuses(program, sessions, resolve, NOW)
  for (const status of decisions) expect(status).toEqual(all.get(status.exerciseId))
  expect(decisions.every((status) => status.decision)).toBe(true)
})

test('v7 programDecisions leaves out a lift no shown Workout plans', () => {
  const hidden: Program = {
    ...program,
    workouts: program.workouts.map((workout) =>
      workout.exercises.some((plan) => plan.exerciseId === 'db-bench-press') ? { ...workout, hidden: true } : workout,
    ),
  }
  const ids = programDecisions(hidden, sessions, resolve, NOW).map((status) => status.exerciseId)
  expect(ids).not.toContain('db-bench-press')
  expect(ids).toContain('narrow-grip-pull-down')
})
