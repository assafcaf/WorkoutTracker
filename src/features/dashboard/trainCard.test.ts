// V6-01, V6-05 (UX iteration 6, wave 3): Train's rows and the Program tab's kg column read one
// value per lift -- the Preset, eased on a Break, and the advice the lift's status gives -- the
// same value the Set screen offers and Progress says. Fixture: the stats Sessions (stats-45).
import { describe, expect, it } from 'vitest'
import sessionsJson from '../../test/fixtures/stats/sessions.json'
import { loadCatalog, loadPrograms } from '../../data/catalog'
import { liftStatus } from '../../domain/stats/status'
import type { ExercisePlan, Session } from '../../types'
import { kgCellText, liftPlan } from './trainCard'

process.env.TZ = 'Asia/Jerusalem'

const sessions = sessionsJson as unknown as Session[]
const catalog = loadCatalog()
const program = loadPrograms().find((p) => p.id === 'assaf-ab-2026')!
const planOf = (id: string): ExercisePlan =>
  program.workouts.flatMap((w) => w.exercises).find((e) => e.exerciseId === id)!
const NOW = new Date(2026, 9, 15, 18, 5).getTime()
const LATER = new Date(2026, 10, 15, 12).getTime()
const plan = (id: string, now = NOW) => liftPlan(catalog.get(id)!, planOf(id), sessions, now)

describe('V6-01 Train, Program and Progress agree on each lift', () => {
  it('Seated biceps curls: opens on 14 kg, offers 15 kg as Progress says "Next time: 15 kg."', () => {
    const biceps = plan('seated-biceps-curls')
    expect(biceps.load).toBe('14 kg')
    expect(biceps.advice).toEqual({ kind: 'up', lever: 15, text: 'Ready for 15 kg', use: 'Use 15 kg' })
    expect(kgCellText(biceps)).toBe('14 ↑15')
    expect(liftStatus(catalog.get('seated-biceps-curls')!, planOf('seated-biceps-curls'), sessions, NOW)!.action).toBe(
      'Next time: 15 kg.',
    )
  })

  it('Narrow-grip pull-down: 46.25 kg everywhere, nothing else offered (Lowered: stay at it)', () => {
    const pull = plan('narrow-grip-pull-down')
    expect(pull.load).toBe('46.25 kg')
    expect(pull.advice).toBeNull()
    expect(kgCellText(pull)).toBe('46.25')
  })

  it('DB bench press: 13 kg, no load offered (Stalled: try a variation)', () => {
    const bench = plan('db-bench-press')
    expect(bench.load).toBe('13 kg')
    expect(bench.advice).toBeNull()
    expect(kgCellText(bench)).toBe('13')
  })

  it('a deload week offers no heavier load: the Presets are already 10 % lighter', () => {
    const biceps = liftPlan(catalog.get('seated-biceps-curls')!, planOf('seated-biceps-curls'), sessions, NOW, true)
    expect(biceps.load).toBe('13 kg')
    expect(biceps.advice).toBeNull()
  })

  it('Back squat: the ramp to 62.5 kg is the next load, so nothing more is offered', () => {
    const squat = plan('back-squat')
    expect(kgCellText(squat)).toBe('47.5 → 62.5')
    expect(squat.advice).toBeNull()
  })
})

describe('V6-05 a Break eases the Preset for one Session', () => {
  it('after 34 days off, biceps curls open on the eased 13 kg that Progress names', () => {
    const biceps = plan('seated-biceps-curls', LATER)
    expect(biceps.load).toBe('13 kg')
    expect(biceps.advice).toEqual({ kind: 'eased', lever: 13, text: 'Eased after 34 days off', use: null })
    expect(kgCellText(biceps)).toBe('13')
    expect(liftStatus(catalog.get('seated-biceps-curls')!, planOf('seated-biceps-curls'), sessions, LATER)!.action).toBe(
      'Ease back in: 13 kg next time.',
    )
  })

  it('a Bodyweight lift on a Break keeps its Load: nothing to ease', () => {
    expect(plan('push-ups', LATER).load).toBe('BW')
  })
})
