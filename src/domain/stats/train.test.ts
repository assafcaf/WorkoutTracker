// E18-T5 [O24 engine half]: Train's due workout, each lift's next step and the duration estimate.
import { beforeAll, describe, expect, it } from 'vitest'
import expectedJson from '../../test/fixtures/stats/expected.json'
import sessionsJson from '../../test/fixtures/stats/sessions.json'
import { loadCatalog, loadPrograms } from '../../data/catalog'
import type { ExercisePlan, Program, Session } from '../../types'
import { buildLiftHistories } from './liftHistory'
import type { LiftHistory } from './liftHistory'
import { dueWorkoutCard } from './train'
import type { DueWorkoutCard } from './train'
import { nextStep } from './verdict'

type Lift = { nextStep: { repsAtTop: number; target: number; ready: boolean } }
const expectedLifts = (expectedJson as unknown as { lifts: Record<string, Lift> }).lifts
const fixtureSessions = sessionsJson as unknown as Session[]

const catalog = loadCatalog()
const resolve = (id: string) => catalog.get(id)
const program = loadPrograms().find((p) => p.id === 'assaf-ab-2026')!
const plans = new Map<string, ExercisePlan>()
for (const w of program.workouts) for (const e of w.exercises) plans.set(e.exerciseId, e)
const planOf = (id: string) => plans.get(id)

describe('E18-T5 O24 due workout card on the fixture', () => {
  let histories: Map<string, LiftHistory>
  let card: DueWorkoutCard
  beforeAll(() => {
    histories = buildLiftHistories(fixtureSessions, resolve, planOf)
    card = dueWorkoutCard(program, fixtureSessions, resolve, histories)!
  })

  it('O24 the due workout after Wed 14 Oct (Workout A) is Workout B, last done Mon 12 Oct', () => {
    expect(card.workout.id).toBe('workout-b')
    expect(new Date(card.lastDoneAt!).toLocaleDateString('sv-SE', { timeZone: 'Asia/Jerusalem' })).toBe('2026-10-12')
  })

  it('O24 lists the workout\'s lifts in Plan order with their names', () => {
    const planned = program.workouts.find((w) => w.id === 'workout-b')!.exercises.map((e) => e.exerciseId)
    expect(card.lifts.map((l) => l.exerciseId)).toEqual(planned)
    expect(card.lifts.map((l) => l.name)).toEqual(planned.map((id) => catalog.get(id)!.name))
  })

  it('O24 each lift carries its next step: reps of target, as in expected.json', () => {
    for (const l of card.lifts) {
      const want = expectedLifts[l.exerciseId].nextStep
      expect(l.step, l.exerciseId).toMatchObject({
        repsAtTop: want.repsAtTop,
        target: want.target,
        ready: want.ready,
      })
    }
  })

  it('O24 each lift\'s step is the one verdict.nextStep gives', () => {
    for (const l of card.lifts) {
      const direct = nextStep(histories.get(l.exerciseId)!, planOf(l.exerciseId), catalog.get(l.exerciseId)!)
      expect(l.step, l.exerciseId).toEqual(direct)
    }
  })

  it('O24 Deadlift reads 14 of 20 and Seated biceps curls is ready to try 15 kg', () => {
    const by = Object.fromEntries(card.lifts.map((l) => [l.exerciseId, l.step!]))
    expect(by['deadlift']).toMatchObject({ repsAtTop: 14, target: 20, lever: 70, ready: false })
    expect(by['seated-biceps-curls']).toMatchObject({ repsAtTop: 36, target: 36, ready: true })
    expect(by['seated-biceps-curls'].suggest).toEqual({ kind: 'lever', lever: 15 })
  })

  it('O24 the estimate is the median of the workout\'s last logged durations, 66 min', () => {
    expect(card.minutes).toBe(66)
    expect(card.estimate).toBe('logged')
  })
})

// ---- hand-built programs ---------------------------------------------------------------------

const MIN = 60_000
function prog(): Program {
  const one = (exerciseId: string): ExercisePlan => ({
    exerciseId,
    sets: 2,
    repRange: [8, 10],
    restSeconds: 90,
  })
  return {
    id: 'p',
    name: 'P',
    units: 'kg',
    sessionsPerWeek: 3,
    workouts: [
      { id: 'wa', name: 'A', exercises: [one('back-squat')] },
      { id: 'wb', name: 'B', exercises: [one('deadlift')] },
    ],
  }
}
function done(i: number, workoutId: string, minutes: number | null, programId = 'p'): Session {
  const startedAt = new Date(2026, 8, 1 + 2 * i, 18).getTime()
  return {
    id: `h${i}`,
    programId,
    workoutId,
    startedAt,
    finishedAt: minutes === null ? null : startedAt + minutes * MIN,
    entries: [],
  }
}
const card = (sessions: Session[], p = prog()) =>
  dueWorkoutCard(p, sessions, resolve, new Map())

describe('E18-T5 O24 duration estimate rules', () => {
  // the Plan estimate for the hand program: 2 sets x 40 s + (2 x 90 s - last rest 90 s) = 170 s -> 3 min
  it('O24 with 3 logged durations of the due workout the estimate is their median', () => {
    // A due (last was B). A took 60, 70, 80; B took 20, 20, 20, which must not count.
    const sessions = [
      done(0, 'wa', 60),
      done(1, 'wb', 20),
      done(2, 'wa', 70),
      done(3, 'wb', 20),
      done(4, 'wa', 80),
      done(5, 'wb', 20),
    ]
    const c = card(sessions)!
    expect(c.workout.id).toBe('wa')
    expect(c.minutes).toBe(70)
    expect(c.estimate).toBe('logged')
  })

  it('O24 an even number of logged durations averages the middle two', () => {
    const sessions = [
      done(0, 'wa', 60),
      done(1, 'wb', 20),
      done(2, 'wa', 70),
      done(3, 'wb', 20),
      done(4, 'wa', 80),
      done(5, 'wb', 20),
      done(6, 'wa', 90),
      done(7, 'wb', 20),
    ]
    expect(card(sessions)!.minutes).toBe(75)
  })

  it('O24 with only 2 logged durations the estimate falls back to the Plan', () => {
    const sessions = [done(0, 'wa', 60), done(1, 'wb', 20), done(2, 'wa', 70), done(3, 'wb', 20)]
    const c = card(sessions)!
    expect(c.workout.id).toBe('wa')
    expect(c.minutes).toBe(3)
    expect(c.estimate).toBe('plan')
  })

  it('O24 a Session still in progress has no logged duration', () => {
    const sessions = [done(0, 'wa', 60), done(1, 'wb', 20), done(2, 'wa', 70), done(3, 'wb', 20), done(4, 'wa', null), done(5, 'wb', 20)]
    const c = card(sessions)!
    expect(c.minutes).toBe(3)
    expect(c.estimate).toBe('plan')
  })

  it('O24 Sessions of another Program do not feed the estimate', () => {
    const sessions = [
      done(0, 'wa', 60, 'other'),
      done(1, 'wa', 70, 'other'),
      done(2, 'wa', 80, 'other'),
      done(3, 'wb', 20),
    ]
    const c = card(sessions)!
    expect(c.workout.id).toBe('wa')
    expect(c.estimate).toBe('plan')
  })

  it('O24 a Program with no Sessions makes its first workout due, never done', () => {
    const c = card([])!
    expect(c.workout.id).toBe('wa')
    expect(c.lastDoneAt).toBeNull()
    expect(c.estimate).toBe('plan')
  })
})

describe('E18-T5 O24 failure paths', () => {
  it('O24 a lift never logged is listed with no next step', () => {
    const c = card([])!
    expect(c.lifts).toEqual([{ exerciseId: 'back-squat', name: catalog.get('back-squat')!.name, step: null }])
  })

  it('O24 an Exercise that cannot be resolved is left off the card', () => {
    const p = prog()
    p.workouts[0].exercises.push({ exerciseId: 'no-such-exercise', sets: 3, repRange: [8, 10], restSeconds: 60 })
    const c = card([], p)!
    expect(c.lifts.map((l) => l.exerciseId)).toEqual(['back-squat'])
  })

  it('O24 a Program whose workouts are all hidden has no due workout', () => {
    const p = prog()
    for (const w of p.workouts) w.hidden = true
    expect(card([], p)).toBeNull()
  })
})
