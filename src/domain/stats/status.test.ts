// v6 [V5-03, V6-02, V6-04, V6-05; report §6.1, §6.4]: one status per lift, from one place, with one
// action sentence that the card, the list, the Lift page and the Why? all end with.
// Fixture: the stats Sessions at Thu 15 Oct 2026 18:05 (Asia/Jerusalem).
import { describe, expect, it } from 'vitest'
import sessionsJson from '../../test/fixtures/stats/sessions.json'
import { loadCatalog, loadPrograms } from '../../data/catalog'
import type { Exercise, ExercisePlan, Session, SetEntry } from '../../types'
import { isEased, liftAdvice, liftStatus, liftStatuses } from './status'

process.env.TZ = 'Asia/Jerusalem'

const sessions = sessionsJson as unknown as Session[]
const catalog = loadCatalog()
const resolve = (id: string) => catalog.get(id)
const program = loadPrograms().find((p) => p.id === 'assaf-ab-2026')!
const planOf = (id: string): ExercisePlan | undefined =>
  program.workouts.flatMap((w) => w.exercises).find((e) => e.exerciseId === id)
const NOW = new Date(2026, 9, 15, 18, 5).getTime()
const all = liftStatuses(program, sessions, resolve, NOW)
const of = (id: string) => all.get(id)!

// §6.4: the expected status and action of five stats-45 lifts.
const EXPECTED: [string, string, string][] = [
  ['narrow-grip-pull-down', 'Lowered', 'Stay at 46.25 kg until all 3 sets reach 12.'],
  ['push-ups', 'Ready', 'Add load or a harder variation.'],
  ['db-bench-press', 'Stalled', 'Try a variation for 4 weeks.'],
  ['seated-biceps-curls', 'Ready', 'Next time: 15 kg.'],
  ['back-squat', 'Moving', 'Next time: 62.5 kg × 9.'],
]

describe('v6 §6.4 the expected statuses on stats-45', () => {
  it('the pull-down is Lowered, Push-ups and biceps curls Ready, DB bench Stalled, Back squat Moving, each with its action', () => {
    expect(EXPECTED.map(([id]) => [id, of(id).label, of(id).action])).toEqual(EXPECTED)
  })

  it('four lifts need a decision: the pull-down, push-ups, DB bench press and biceps curls', () => {
    const ids = [...all.values()].filter((s) => s.decision).map((s) => s.exerciseId).sort()
    expect(ids).toEqual(['db-bench-press', 'narrow-grip-pull-down', 'push-ups', 'seated-biceps-curls'])
  })
})

describe('v6 §6.1 the rules behind them', () => {
  it('a lowered load is never Slipping, and its evidence shows the note', () => {
    const s = of('narrow-grip-pull-down')
    expect(s.evidence).toBe('46.25 kg × 9 · down from 47.5 kg on Wed 7 Oct · note: “Right elbow sore on pull-downs, dropped…”')
    expect(s.why[0]).toContain('with the note “Right elbow sore on pull-downs, dropped the weight”')
    expect(JSON.stringify(s)).not.toMatch(/Slipping|slipping/)
    expect(s.next).toEqual({ lever: 46.25, reps: 12 })
  })

  it('reps above the range land in Ready (b): the first set reached the top in each of the last 3 sessions', () => {
    const s = of('push-ups')
    expect(s.why[0]).toBe(
      'Your first set reached 15 or more, the top of your 10–15 range, in each of your last 3 sessions. Reps above the range mean the weight is too light.',
    )
    // Bodyweight at BW: add load or a harder variation, with a Swap link -- never "one more set".
    expect(s.swap).toBe(true)
    expect(JSON.stringify(s)).not.toMatch(/one more set/)
  })

  it('V6-04 a deload already inside the stall is not offered again: a variation, naming the deload week', () => {
    const s = of('db-bench-press')
    expect(s.why[0]).toContain('deload week of 21–25 Sep')
    expect(s.swap).toBe(true)
    expect(JSON.stringify(s)).not.toMatch(/Deload once/)
  })

  it('a stall with no deload inside offers one: deload once, then back', () => {
    const noDeload = sessions.filter((x) => !x.deload)
    const s = liftStatuses(program, noDeload, resolve, NOW).get('db-bench-press')!
    expect(s.label).toBe('Stalled')
    expect(s.action).toBe('Deload once: 12 kg × 10, then back to 13 kg.')
    expect(s.next).toEqual({ lever: 12, reps: 10 })
  })

  it('every status ends its Why? with its action sentence, and lists the last 4 sessions', () => {
    for (const s of all.values()) {
      expect(s.why.at(-1)).toBe(s.action)
      expect(s.why.length).toBe(6)
    }
    expect(of('db-bench-press').why).toContain('Wed 14 Oct · 13 kg × 9·9·8·7')
  })

  it('one place: the single-lift status equals the dashboard one for every lift', () => {
    for (const [id, s] of all) expect(liftStatus(resolve(id)!, planOf(id), sessions, NOW)).toEqual(s)
  })

  it('the next load is a pure value for Train and Now', () => {
    expect(of('seated-biceps-curls').next).toEqual({ lever: 15, reps: 10 })
    expect(of('back-squat').next).toEqual({ lever: 62.5, reps: 9 })
  })

  it('V6-05 after 21 days away every lift is on a Break, easing the load', () => {
    const later = new Date(2026, 10, 15, 12).getTime()
    const away = liftStatuses(program, sessions, resolve, later)
    expect([...away.values()].every((s) => s.label === 'Break')).toBe(true)
    // deloadWeight: 10 % of 14 kg in whole 1 kg steps.
    expect(away.get('seated-biceps-curls')!.action).toBe('Ease back in: 13 kg next time.')
    expect(away.get('seated-biceps-curls')!.evidence).toBe('Last done Mon 12 Oct · 34 days ago')
  })
})

describe('v6 §6.1 on hand-built Sessions', () => {
  const squat = resolve('back-squat') as Exercise
  const plan: ExercisePlan = { exerciseId: 'back-squat', sets: 3, repRange: [8, 10], restSeconds: 120 }
  const DAY = 24 * 3600_000
  const T0 = new Date(2026, 9, 1, 10).getTime()
  const one = (i: number, sets: [number, number, (0 | 1 | 2 | 3)?][]): Session => ({
    id: `s${i}`,
    programId: 'p',
    workoutId: 'w',
    startedAt: T0 + i * DAY,
    finishedAt: T0 + i * DAY + 3600_000,
    entries: sets.map(([kg, reps, rir], k): SetEntry => ({
      exerciseId: 'back-squat',
      setIndex: k + 1,
      weightKg: kg,
      reps,
      loggedAt: T0 + i * DAY + k,
      ...(rir === undefined ? {} : { rir }),
    })),
  })
  const base = [0, 1, 2].map((i) => one(i, [[55, 8], [55, 8], [55, 8]]))
  const at = (sessionsIn: Session[]) => liftStatus(squat, plan, sessionsIn, T0 + 5 * DAY)!

  it('fewer than 4 sessions is Too new', () => {
    const s = at(base)
    expect(s.label).toBe('Too new')
    expect(s.action).toBe('Log 1 more session for a verdict.')
  })

  it('a full bar with every set to failure is Hold', () => {
    const s = at([...base, one(3, [[60, 10, 0], [60, 10, 0], [60, 10, 0]])])
    expect(s.label).toBe('Hold')
    expect(s.action).toBe('Next time: 60 kg again, with a rep to spare.')
  })

  it('a full bar with 2 or more reps to spare in every set takes two steps', () => {
    const s = at([...base, one(3, [[60, 10, 2], [60, 10, 3], [60, 11, 2]])])
    expect(s.action).toBe('Next time: 65 kg.')
  })

  it('fewer top-set reps at the same load twice in a row is Slipping', () => {
    const s = at([one(0, [[60, 9]]), one(1, [[60, 10]]), one(2, [[60, 8]]), one(3, [[60, 8]])])
    expect(s.label).toBe('Slipping')
    expect(s.action).toBe('Next time: stay at 60 kg and aim for 10.')
  })
})

describe('V6-01 the advice that reaches the bar: one value for Train, Program and Now', () => {
  it('a Ready lift offers its next load when it differs from the Preset', () => {
    expect(liftAdvice(of('seated-biceps-curls'), 14)).toEqual({ kind: 'up', lever: 15, text: 'Ready for 15 kg', use: 'Use 15 kg' })
  })

  it('no advice where the next load is the Preset: the pull-down (Lowered), Back squat (Moving)', () => {
    expect(liftAdvice(of('narrow-grip-pull-down'), 46.25)).toBeNull()
    expect(liftAdvice(of('back-squat'), 62.5)).toBeNull()
  })

  it('no load to offer when the action is a change of exercise: DB bench press, Push-ups at BW', () => {
    expect(liftAdvice(of('db-bench-press'), 13)).toBeNull()
    expect(liftAdvice(of('push-ups'), 0)).toBeNull()
  })

  it('no advice without a status or a Preset load', () => {
    expect(liftAdvice(undefined, 14)).toBeNull()
    expect(liftAdvice(of('seated-biceps-curls'), null)).toBeNull()
  })

  it('a stall with no deload inside offers the deload load', () => {
    const plan: ExercisePlan = { exerciseId: 'x', sets: 1, repRange: [8, 10], restSeconds: 90 }
    const ex: Exercise = { id: 'x', name: 'X', weightStep: 2.5, startWeight: null, bodyweight: false, libraryId: 'x' }
    const day = 86_400_000
    const list: Session[] = [0, 1, 2, 3, 4].map((i) => ({
      id: `s${i}`,
      programId: 'p',
      workoutId: 'w',
      startedAt: NOW - (10 - i) * day,
      finishedAt: NOW - (10 - i) * day + 1,
      entries: [{ exerciseId: 'x', setIndex: 1, weightKg: 60, reps: 8, loggedAt: 0 }],
    }))
    const s = liftStatus(ex, plan, list, NOW)!
    expect(s.label).toBe('Stalled')
    expect(liftAdvice(s, 60)).toEqual({ kind: 'down', lever: 55, text: 'Deload once: 55 kg', use: 'Use 55 kg' })
  })

  it('V6-05 a Break is eased in the Preset itself: Train says so, no load to dial in', () => {
    const later = new Date(2026, 10, 15, 12).getTime()
    const away = liftStatuses(program, sessions, resolve, later)
    expect(liftAdvice(away.get('seated-biceps-curls'), 13)).toEqual({
      kind: 'eased',
      lever: 13,
      text: 'Eased after 34 days off',
      use: null,
    })
    expect(liftAdvice(away.get('hyper-extension'), 5, true)).toBeNull()
    expect(isEased(away.get('seated-biceps-curls'))).toBe(true)
    expect(isEased(of('seated-biceps-curls'))).toBe(false)
  })
})
