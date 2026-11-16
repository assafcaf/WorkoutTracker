// V6-01, V6-05 (UX iteration 6, wave 3): Train's rows and the Program tab's kg column read one
// value per lift -- the Preset, eased on a Break, and the advice the lift's status gives -- the
// same value the Set screen offers and Progress says. Fixture: the stats Sessions (stats-45).
import { describe, expect, it } from 'vitest'
import sessionsJson from '../../test/fixtures/stats/sessions.json'
import { loadCatalog, loadPrograms } from '../../data/catalog'
import { appliedStep, liftStatus } from '../../domain/stats/status'
import { lastEntriesOf } from '../../domain/planLoad'
import { presetForSet } from '../../domain/prefill'
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
    // V7R-01: the step up is the Preset itself -- Set 1 opens on 15 kg -- and the advice is the
    // way back to the 14 kg it came up from. Program's cell still reads "14 ↑15".
    const biceps = plan('seated-biceps-curls')
    expect(biceps.load).toBe('15 kg')
    expect(biceps.before).toEqual({ load: '14 kg' })
    expect(biceps.advice).toEqual({ kind: 'up', lever: 15, text: 'Up from 14 kg', use: 'Back to 14 kg', from: 14 })
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

describe('V7R-01 the workout page shows what Start presets', () => {
  it('for every lift, a step up the page shows (`advice.lever`) is the Preset the Session opens on', () => {
    for (const p of program.workouts.flatMap((w) => w.exercises)) {
      const exercise = catalog.get(p.exerciseId)
      if (!exercise) continue
      const lift = liftPlan(exercise, p, sessions, NOW)
      const lastEntries = lastEntriesOf(sessions, p.exerciseId)
      const opened = presetForSet({
        exercise,
        plan: p,
        setIndex: 1,
        lastEntries,
        today: [],
        stepUp: appliedStep(lift.advice),
      })
      const kg = exercise.bodyweight ? (opened.loadKg ?? 0) : opened.weightKg
      if (lift.advice?.kind === 'up') expect([p.exerciseId, lift.top]).toEqual([p.exerciseId, lift.advice.lever])
      if (!exercise.bodyweight && lift.topLoad === undefined && lift.load !== null) {
        expect([p.exerciseId, `${kg} kg`]).toEqual([p.exerciseId, lift.load])
      }
    }
  })

  it('curls open 15 x 10, the bottom of the range, after 14 x 12 x 3', () => {
    const exercise = catalog.get('seated-biceps-curls')!
    const lift = liftPlan(exercise, planOf('seated-biceps-curls'), sessions, NOW)
    const opened = presetForSet({
      exercise,
      plan: planOf('seated-biceps-curls'),
      setIndex: 1,
      lastEntries: lastEntriesOf(sessions, 'seated-biceps-curls'),
      today: [],
      stepUp: appliedStep(lift.advice),
    })
    expect(opened).toEqual({ weightKg: 15, reps: planOf('seated-biceps-curls').repRange[0] })
  })
})

describe('V6-05 a Break eases the Preset for one Session', () => {
  it('after 34 days off, biceps curls open on the eased 13 kg that Progress names', () => {
    const biceps = plan('seated-biceps-curls', LATER)
    expect(biceps.load).toBe('13 kg')
    // V7R-03: the lift was last done 34 days ago, but the line says the trainee's days off -- 32,
    // since the last Session of any Workout -- as Home does.
    expect(biceps.advice).toEqual({ kind: 'eased', lever: 13, text: 'Eased after 32 days off', use: null })
    expect(kgCellText(biceps)).toBe('13')
    expect(liftStatus(catalog.get('seated-biceps-curls')!, planOf('seated-biceps-curls'), sessions, LATER)!.action).toBe(
      'Ease back in: 13 kg next time.',
    )
  })

  it('a Bodyweight lift on a Break keeps its Load: nothing to ease', () => {
    expect(plan('push-ups', LATER).load).toBe('BW')
  })
})
