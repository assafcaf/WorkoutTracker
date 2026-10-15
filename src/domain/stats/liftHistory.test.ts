// E18-T3 [O4]: per-lift Session history against the stats fixture (expected.json) and a few
// hand-built Sessions for the failure paths. Expected values are the fixture's, not computed here.
import { describe, expect, it } from 'vitest'
import expectedJson from '../../test/fixtures/stats/expected.json'
import sessionsJson from '../../test/fixtures/stats/sessions.json'
import { loadCatalog, loadPrograms } from '../../data/catalog'
import type { Exercise, ExercisePlan, Session, SetEntry } from '../../types'
import { formatSet } from '../setText'
import { buildLiftHistories, leverOf } from './liftHistory'

type Point = {
  date: string
  deload: boolean
  sets: string
  warmups: string | null
  topLever: number
  topReps: number
  totalReps: number
  e1rm: number | null
}
type Lift = { e1rmShown: boolean; points: Point[] }
const expectedLifts = (expectedJson as unknown as { lifts: Record<string, Lift> }).lifts
const sessions = sessionsJson as unknown as Session[]

const catalog = loadCatalog()
const resolve = (id: string) => catalog.get(id)
const plans = new Map<string, ExercisePlan>()
for (const w of loadPrograms().find((p) => p.id === 'assaf-ab-2026')!.workouts) {
  for (const e of w.exercises) plans.set(e.exerciseId, e)
}
const planOf = (id: string) => plans.get(id)

const day = (ms: number) => new Date(ms).toLocaleDateString('sv-SE', { timeZone: 'Asia/Jerusalem' })
const text = (s: SetEntry) =>
  formatSet(s) + (s.kind === 'drop' || s.kind === 'failure' ? ` (${s.kind})` : '')

describe('E18-T3 O4 lift history on the fixture', () => {
  let built: ReturnType<typeof buildLiftHistories> | undefined
  const hist = () => (built ??= buildLiftHistories(sessions, resolve, planOf))
  const histories = {
    get: (id: string) => hist().get(id),
    keys: () => hist().keys(),
    get size() {
      return hist().size
    },
  }

  it('O4 builds a history for each of the 14 lifts and no other', () => {
    expect([...histories.keys()].sort()).toEqual(Object.keys(expectedLifts).sort())
    expect(histories.size).toBe(14)
  })

  it('O4 gives each lift one point per Session on the expected dates, oldest first', () => {
    for (const [id, lift] of Object.entries(expectedLifts)) {
      const points = histories.get(id)!.points
      expect(points.map((p) => day(p.startedAt)), id).toEqual(lift.points.map((p) => p.date))
    }
  })

  it('O4 lists working sets (drop and failure included) and warm-ups as the fixture does', () => {
    for (const [id, lift] of Object.entries(expectedLifts)) {
      const points = histories.get(id)!.points
      lift.points.forEach((exp, i) => {
        expect(points[i].workingSets.map(text).join(' · '), `${id} ${exp.date} sets`).toBe(exp.sets)
        expect(points[i].warmups.map(text).join(' · ') || null, `${id} ${exp.date} warm-ups`).toBe(
          exp.warmups,
        )
      })
    }
  })

  it('O4 takes the top set from straight sets: lever and the most reps at it', () => {
    for (const [id, lift] of Object.entries(expectedLifts)) {
      const points = histories.get(id)!.points
      lift.points.forEach((exp, i) => {
        expect(points[i].top, `${id} ${exp.date}`).toEqual({ lever: exp.topLever, reps: exp.topReps })
      })
    }
  })

  it('O4 carries the deload flag of the Session: Mon 21, Wed 23 and Fri 25 Sep', () => {
    const flagged = new Set<string>()
    for (const [id, lift] of Object.entries(expectedLifts)) {
      const points = histories.get(id)!.points
      lift.points.forEach((exp, i) => {
        expect(points[i].deload, `${id} ${exp.date}`).toBe(exp.deload)
        if (points[i].deload) flagged.add(exp.date)
      })
    }
    expect([...flagged].sort()).toEqual(['2026-09-21', '2026-09-23', '2026-09-25'])
  })

  it('O4 gives e1RM only to the 5 e1RM lifts, matching the fixture to a tenth', () => {
    const e1rmLifts = Object.entries(expectedLifts).filter(([, l]) => l.e1rmShown)
    expect(e1rmLifts.map(([id]) => id).sort()).toEqual([
      'back-squat',
      'db-bench-press',
      'deadlift',
      'machine-row',
      'machine-shoulder-press',
    ])
    for (const [id, lift] of Object.entries(expectedLifts)) {
      const h = histories.get(id)!
      expect(h.e1rmLift, id).toBe(lift.e1rmShown)
      lift.points.forEach((exp, i) => {
        const got = h.points[i].e1rm
        if (!lift.e1rmShown) {
          expect(got, `${id} ${exp.date}`).toBeNull()
        } else {
          expect(got, `${id} ${exp.date}`).not.toBeNull()
          expect(Math.abs((got as number) - (exp.e1rm as number)), `${id} ${exp.date}`).toBeLessThan(
            0.051,
          )
        }
      })
    }
  })

  it('O4 keeps e1RM unrounded in the engine', () => {
    // Back squat Mon 22 Jun: best straight set <= 10 reps is 35 x 10, 45 x 9, 50 x 7 -> 61.67
    const first = histories.get('back-squat')!.points[0]
    expect(first.e1rm).toBeCloseTo(50 * (1 + 7 / 30), 9)
  })
})

describe('E18-T3 O4 lever and top set rules on hand-built Sessions', () => {
  const ex = (id: string, bodyweight: boolean): Exercise => ({
    id,
    name: id,
    weightStep: 2.5,
    startWeight: null,
    bodyweight,
    libraryId: id,
  })
  const exercises = new Map([
    ['lift', ex('lift', false)],
    ['pull', ex('pull', true)],
  ])
  const res = (id: string) => exercises.get(id)
  const plan = (topRep: number): ExercisePlan => ({
    exerciseId: 'lift',
    sets: 3,
    repRange: [topRep - 2, topRep],
    restSeconds: 90,
  })
  const set = (
    exerciseId: string,
    n: number,
    weightKg: number | null,
    reps: number,
    extra: Partial<SetEntry> = {},
  ): SetEntry => ({ exerciseId, setIndex: n, weightKg, reps, loggedAt: n, ...extra })
  const sess = (id: string, startedAt: number, entries: SetEntry[], deload = false): Session => ({
    id,
    programId: 'p',
    workoutId: 'w',
    startedAt,
    finishedAt: startedAt + 1,
    entries,
    ...(deload ? { deload: true as const } : {}),
  })

  it('O4 R-L: a loaded lever is weightKg; a Bodyweight lever is the signed Load, BW being 0', () => {
    expect(leverOf({ weightKg: 62.5 }, false)).toBe(62.5)
    expect(leverOf({ weightKg: null }, true)).toBe(0)
    expect(leverOf({ weightKg: null, loadKg: 5 }, true)).toBe(5)
    expect(leverOf({ weightKg: null, loadKg: -19 }, true)).toBe(-19)
  })

  it('O4 R-W: a warm-up is not a working set and never the top set', () => {
    const h = buildLiftHistories(
      [sess('a', 1000, [set('lift', 1, 100, 5, { kind: 'warmup' }), set('lift', 2, 60, 8)])],
      res,
      () => plan(8),
    ).get('lift')!
    expect(h.points[0].workingSets.map((s) => s.weightKg)).toEqual([60])
    expect(h.points[0].warmups.map((s) => s.weightKg)).toEqual([100])
    expect(h.points[0].top).toEqual({ lever: 60, reps: 8 })
  })

  it('O4 R-T: a heavier drop set counts as a working set but is not the top set', () => {
    const h = buildLiftHistories(
      [
        sess('a', 1000, [
          set('lift', 1, 60, 8),
          set('lift', 2, 70, 12, { kind: 'drop' }),
          set('lift', 3, 60, 9, { kind: 'failure' }),
        ]),
      ],
      res,
      () => plan(8),
    ).get('lift')!
    expect(h.points[0].workingSets).toHaveLength(3)
    expect(h.points[0].top).toEqual({ lever: 60, reps: 9 })
  })

  it('O4 R-T: a Session with only drop sets has no top set', () => {
    const h = buildLiftHistories(
      [sess('a', 1000, [set('lift', 1, 60, 8, { kind: 'drop' })])],
      res,
      () => plan(8),
    ).get('lift')!
    expect(h.points[0].top).toBeNull()
    expect(h.points[0].e1rm).toBeNull()
  })

  it('O4 R-T: on a Bodyweight lift the top set is the highest signed Load, ties to most reps', () => {
    const h = buildLiftHistories(
      [
        sess('a', 1000, [
          set('pull', 1, null, 9, { loadKg: -21 }),
          set('pull', 2, null, 5, { loadKg: -19 }),
          set('pull', 3, null, 6, { loadKg: -19 }),
        ]),
        sess('b', 2000, [set('pull', 1, null, 12), set('pull', 2, null, 10)]),
      ],
      res,
      () => undefined,
    ).get('pull')!
    expect(h.points[0].top).toEqual({ lever: -19, reps: 6 })
    expect(h.points[1].top).toEqual({ lever: 0, reps: 12 })
    expect(h.e1rmLift).toBe(false)
    expect(h.points[0].e1rm).toBeNull()
  })

  it('O4 R-E: e1RM is Epley of the best straight set of 10 reps or fewer', () => {
    const h = buildLiftHistories(
      [
        sess('a', 1000, [
          set('lift', 1, 40, 12), // over 10 reps: ignored
          set('lift', 2, 50, 8),
          set('lift', 3, 90, 5, { kind: 'drop' }), // drop: ignored
        ]),
      ],
      res,
      () => plan(8),
    ).get('lift')!
    expect(h.e1rmLift).toBe(true)
    expect(h.points[0].e1rm).toBeCloseTo(50 * (1 + 8 / 30), 9)
  })

  it('O4 R-E: a lift whose Plan top rep is above 10, or that has no Plan, has no e1RM', () => {
    const data = [sess('a', 1000, [set('lift', 1, 50, 8)])]
    const wide = buildLiftHistories(data, res, () => plan(12)).get('lift')!
    expect(wide.e1rmLift).toBe(false)
    expect(wide.points[0].e1rm).toBeNull()
    const none = buildLiftHistories(data, res, () => undefined).get('lift')!
    expect(none.e1rmLift).toBe(false)
    expect(none.points[0].e1rm).toBeNull()
  })

  it('O4 a deload Session is flagged on its point', () => {
    const h = buildLiftHistories(
      [sess('a', 1000, [set('lift', 1, 50, 8)]), sess('b', 2000, [set('lift', 1, 45, 8)], true)],
      res,
      () => plan(8),
    ).get('lift')!
    expect(h.points.map((p) => p.deload)).toEqual([false, true])
  })

  it('O4 skips an Exercise that cannot be resolved, and gives nothing for no Sessions', () => {
    const h = buildLiftHistories([sess('a', 1000, [set('ghost', 1, 50, 8)])], res, () => undefined)
    expect(h.has('ghost')).toBe(false)
    expect(buildLiftHistories([], res, () => undefined).size).toBe(0)
  })

  it('O4 orders points oldest first whatever order the Sessions arrive in', () => {
    const h = buildLiftHistories(
      [sess('b', 2000, [set('lift', 1, 55, 8)]), sess('a', 1000, [set('lift', 1, 50, 8)])],
      res,
      () => plan(8),
    ).get('lift')!
    expect(h.points.map((p) => p.sessionId)).toEqual(['a', 'b'])
  })
})
