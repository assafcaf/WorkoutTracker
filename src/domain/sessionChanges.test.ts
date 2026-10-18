import { describe, expect, it } from 'vitest'
import type { ExercisePlan, Program, Session, SetEntry, Workout } from '../types'
import { applySessionChanges, sessionChanges } from './sessionChanges'
import type { SessionChange } from './sessionChanges'

const plan = (exerciseId: string, sets = 3, extra: Partial<ExercisePlan> = {}): ExercisePlan => ({
  exerciseId,
  sets,
  repRange: [8, 12],
  restSeconds: 90,
  ...extra,
})

const workout: Workout = {
  id: 'w1',
  name: 'Push',
  exercises: [plan('bench'), plan('press', 2), plan('fly', 3)],
}

const set = (exerciseId: string, setIndex: number, kind?: SetEntry['kind']): SetEntry => ({
  ...(kind ? { kind } : {}),
  exerciseId,
  setIndex,
  weightKg: 20,
  reps: 10,
  loggedAt: 1000 + setIndex,
})

const sets = (exerciseId: string, n: number, kind?: SetEntry['kind']): SetEntry[] =>
  Array.from({ length: n }, (_, i) => set(exerciseId, i, kind))

const session = (over: Partial<Session> = {}): Session => ({
  id: 's1',
  programId: 'p1',
  workoutId: 'w1',
  startedAt: 1,
  finishedAt: null,
  entries: [],
  ...over,
})

describe('sessionChanges (O24)', () => {
  it('O24 answers [] when the Session did what the Workout planned', () => {
    const s = session({ entries: [...sets('bench', 3), ...sets('press', 2)] })
    expect(sessionChanges(s, workout)).toEqual([])
  })

  it('O24 answers [] for a Session with no entries', () => {
    expect(sessionChanges(session(), workout)).toEqual([])
  })

  it('O24 lists a swap from the planned Exercise to the one done', () => {
    const s = session({ swaps: { press: 'dips' }, entries: sets('dips', 2) })
    expect(sessionChanges(s, workout)).toEqual([{ kind: 'swap', from: 'press', to: 'dips' }])
  })

  it('O24 lists an added Exercise with the working Sets logged as its sets', () => {
    const added = plan('curl', 5, { restSeconds: 60, repRange: [10, 15] })
    const s = session({ added: [added], entries: sets('curl', 3) })
    expect(sessionChanges(s, workout)).toEqual([
      { kind: 'add', plan: { ...added, sets: 3 } },
    ])
  })

  it('O24 counts only working Sets: warm-ups are left out, drop and failure Sets count', () => {
    const added = plan('curl', 1)
    const s = session({
      added: [added],
      entries: [...sets('curl', 2, 'warmup'), set('curl', 2), set('curl', 3, 'drop'), set('curl', 4, 'failure')],
    })
    expect(sessionChanges(s, workout)).toEqual([{ kind: 'add', plan: { ...added, sets: 3 } }])
  })

  it('O24 leaves an added Exercise with no working Set logged out', () => {
    const s = session({
      added: [plan('curl'), plan('row')],
      entries: [...sets('curl', 2, 'warmup'), ...sets('row', 1)],
    })
    expect(sessionChanges(s, workout)).toEqual([
      { kind: 'add', plan: { ...plan('row'), sets: 1 } },
    ])
  })

  it('O24 lists an extended Plan when more working Sets were logged than planned', () => {
    const s = session({ entries: sets('press', 4) })
    expect(sessionChanges(s, workout)).toEqual([
      { kind: 'extend', exerciseId: 'press', from: 2, to: 4 },
    ])
  })

  it('O24 does not count warm-ups toward extending a Plan', () => {
    const s = session({ entries: [...sets('press', 2), ...sets('press', 3, 'warmup')] })
    expect(sessionChanges(s, workout)).toEqual([])
  })

  it('O24 does not list fewer Sets than planned', () => {
    const s = session({ entries: sets('bench', 1) })
    expect(sessionChanges(s, workout)).toEqual([])
  })

  it('O24 counts the Sets under the done id for a swapped Plan', () => {
    const s = session({ swaps: { press: 'dips' }, entries: sets('dips', 4) })
    expect(sessionChanges(s, workout)).toEqual([
      { kind: 'swap', from: 'press', to: 'dips' },
      { kind: 'extend', exerciseId: 'press', from: 2, to: 4 },
    ])
  })

  it('O24 orders by Workout order, a Plan swap before its extend, then added order', () => {
    const s = session({
      swaps: { fly: 'pec', bench: 'incline' },
      added: [plan('curl'), plan('row')],
      entries: [
        ...sets('row', 2),
        ...sets('curl', 1),
        ...sets('pec', 5),
        ...sets('press', 3),
        ...sets('incline', 3),
      ],
    })
    expect(sessionChanges(s, workout)).toEqual([
      { kind: 'swap', from: 'bench', to: 'incline' },
      { kind: 'extend', exerciseId: 'press', from: 2, to: 3 },
      { kind: 'swap', from: 'fly', to: 'pec' },
      { kind: 'extend', exerciseId: 'fly', from: 3, to: 5 },
      { kind: 'add', plan: { ...plan('curl'), sets: 1 } },
      { kind: 'add', plan: { ...plan('row'), sets: 2 } },
    ])
  })

  it('O24 does not mutate the Session or the Workout', () => {
    const s = session({ swaps: { press: 'dips' }, added: [plan('curl')], entries: sets('curl', 2) })
    const before = JSON.stringify([s, workout])
    sessionChanges(s, workout)
    expect(JSON.stringify([s, workout])).toBe(before)
  })
})

function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object') {
    Object.values(o).forEach(deepFreeze)
    Object.freeze(o)
  }
  return o
}

describe('applySessionChanges (O25)', () => {
  const other: Workout = { id: 'w2', name: 'Pull', exercises: [plan('row')] }
  const program = (): Program => ({
    id: 'p1',
    name: 'P',
    units: 'kg',
    sessionsPerWeek: 3,
    workouts: [workout, other],
  })

  it('O25 points a swapped Plan at the new Exercise, keeping its other fields', () => {
    const p: Program = {
      ...program(),
      workouts: [
        { ...workout, exercises: [plan('bench'), plan('press', 2, { startWeightKg: 30, amrapLast: true })] },
        other,
      ],
    }
    const out = applySessionChanges(p, 'w1', [{ kind: 'swap', from: 'press', to: 'dips' }])
    expect(out.workouts[0].exercises).toEqual([
      plan('bench'),
      plan('dips', 2, { startWeightKg: 30, amrapLast: true }),
    ])
  })

  it('O25 sets an extended Plan to the new sets', () => {
    const out = applySessionChanges(program(), 'w1', [
      { kind: 'extend', exerciseId: 'press', from: 2, to: 4 },
    ])
    expect(out.workouts[0].exercises).toEqual([plan('bench'), plan('press', 4), plan('fly')])
  })

  it('O25 appends added Plans in order', () => {
    const out = applySessionChanges(program(), 'w1', [
      { kind: 'add', plan: plan('curl', 2) },
      { kind: 'add', plan: plan('row', 1, { restSeconds: 45 }) },
    ])
    expect(out.workouts[0].exercises.map((e) => e.exerciseId)).toEqual([
      'bench', 'press', 'fly', 'curl', 'row',
    ])
    expect(out.workouts[0].exercises[4]).toEqual(plan('row', 1, { restSeconds: 45 }))
  })

  it('O25 matches a swapped and extended Plan by its original planned id', () => {
    const changes: SessionChange[] = [
      { kind: 'swap', from: 'press', to: 'dips' },
      { kind: 'extend', exerciseId: 'press', from: 2, to: 4 },
    ]
    const out = applySessionChanges(program(), 'w1', changes)
    expect(out.workouts[0].exercises[1]).toEqual(plan('dips', 4))
  })

  it('O25 leaves other Workouts and Program fields untouched', () => {
    const out = applySessionChanges(program(), 'w1', [{ kind: 'add', plan: plan('curl') }])
    expect(out.workouts[1]).toEqual(other)
    expect(out.id).toBe('p1')
    expect(out.sessionsPerWeek).toBe(3)
    expect(out.workouts[0].exercises).toHaveLength(4)
  })

  it('O25 does not mutate its input', () => {
    const p = deepFreeze(program())
    const changes = deepFreeze<SessionChange[]>([
      { kind: 'swap', from: 'press', to: 'dips' },
      { kind: 'extend', exerciseId: 'fly', from: 3, to: 5 },
      { kind: 'add', plan: plan('curl') },
    ])
    const out = applySessionChanges(p, 'w1', changes)
    expect(out.workouts[0].exercises).toHaveLength(4)
    expect(p.workouts[0].exercises).toHaveLength(3)
    expect(p.workouts[0].exercises[1].exerciseId).toBe('press')
  })

  it('O25 answers the Program unchanged for an unknown workoutId', () => {
    const p = program()
    const out = applySessionChanges(p, 'nope', [{ kind: 'add', plan: plan('curl') }])
    expect(out).toEqual(program())
  })

  it('O25 answers an equal Program for no changes', () => {
    expect(applySessionChanges(program(), 'w1', [])).toEqual(program())
  })
})
