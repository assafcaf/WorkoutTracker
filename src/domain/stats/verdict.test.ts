// E18-T5 [O8 O9 O10]: verdicts (R-V), next step (R-N) and steps climbed (R-S) against the stats
// fixture (expected.json) and hand-built histories for the boundaries and failure paths.
// Expected values are the fixture's or literals, never computed by the code under test.
import { beforeAll, describe, expect, it } from 'vitest'
import expectedJson from '../../test/fixtures/stats/expected.json'
import sessionsJson from '../../test/fixtures/stats/sessions.json'
import { loadCatalog, loadPrograms } from '../../data/catalog'
import type { Exercise, ExercisePlan, Session, SetEntry } from '../../types'
import { buildLiftHistories } from './liftHistory'
import type { LiftHistory, LiftPoint } from './liftHistory'
import { computeRecords } from './records'
import type { SessionRecord } from './records'
import { nextStep, stepsClimbed, verdictOf, verdicts } from './verdict'

process.env.TZ = 'Asia/Jerusalem' // the zone the fixture was written in

type Lift = {
  workout: string
  verdict: string
  nextStep: { repsAtTop: number; target: number; at: string; ready: boolean }
}
const expectedLifts = (expectedJson as unknown as { lifts: Record<string, Lift> }).lifts
const fixtureSessions = sessionsJson as unknown as Session[]

const catalog = loadCatalog()
const resolve = (id: string) => catalog.get(id)
const plans = new Map<string, ExercisePlan>()
for (const w of loadPrograms().find((p) => p.id === 'assaf-ab-2026')!.workouts) {
  for (const e of w.exercises) plans.set(e.exerciseId, e)
}
const planOf = (id: string) => plans.get(id)

const NOW = new Date(2026, 9, 15, 18, 5).getTime() // Thu 15 Oct 2026
const WEEK = 7 * 24 * 3600 * 1000
const day = (ms: number) => new Date(ms).toLocaleDateString('sv-SE')
/** "62.5 kg" -> 62.5, "BW" -> 0, "BW+5" -> 5, "BW−19" (U+2212) -> -19. */
const leverOfLabel = (at: string): number => {
  const m = /^BW(?:([+−])(\d+(?:\.\d+)?))?$/.exec(at)
  if (m) return m[1] === undefined ? 0 : (m[1] === '+' ? 1 : -1) * Number(m[2])
  return Number(at.replace(' kg', ''))
}

function analyse(sessions: Session[]) {
  const histories = buildLiftHistories(sessions, resolve, planOf)
  const records = computeRecords(sessions, resolve, planOf)
  return { histories, records }
}

// ---- hand-built histories ----------------------------------------------------------------

type TopSpec = [lever: number, reps: number] | null
function point(i: number, top: TopSpec, deload = false, startedAt?: number): LiftPoint {
  return {
    sessionId: `s${i}`,
    startedAt: startedAt ?? new Date(2026, 5, 1 + 2 * i, 18).getTime(),
    deload,
    workingSets: [],
    warmups: [],
    top: top ? { lever: top[0], reps: top[1] } : null,
    e1rm: null,
  }
}
function history(points: LiftPoint[], bodyweight = false, id = 'lift'): LiftHistory {
  return { exerciseId: id, bodyweight, e1rmLift: false, points }
}
function rec(sessionId: string, exerciseId = 'lift', kind: SessionRecord['kind'] = 'Heaviest weight'): SessionRecord {
  return { exerciseId, sessionId, kind, lever: 0, reps: 1, gain: 1, alsoBeat: [] }
}

describe('E18-T5 O8 verdicts on the fixture', () => {
  let all: ReturnType<typeof verdicts>
  beforeAll(() => {
    const { histories, records } = analyse(fixtureSessions)
    all = verdicts(histories, records, NOW)
  })

  it('O8 gives each of the 14 lifts the verdict in expected.json', () => {
    expect([...all.keys()].sort()).toEqual(Object.keys(expectedLifts).sort())
    for (const [id, lift] of Object.entries(expectedLifts)) {
      expect(all.get(id)!.kind, id).toBe(lift.verdict)
    }
  })

  it('O8 counts 11 moving, 2 stalled and 1 slipping', () => {
    const kinds = [...all.values()].map((v) => v.kind)
    expect(kinds.filter((k) => k === 'moving')).toHaveLength(11)
    expect(kinds.filter((k) => k === 'stalled')).toHaveLength(2)
    expect(kinds.filter((k) => k === 'slipping')).toHaveLength(1)
    expect(kinds.filter((k) => k === 'too new')).toHaveLength(0)
  })

  it('O8 gives DB bench press its stall facts: since Fri 7 Aug, 10 Sessions, 9.9 weeks', () => {
    const v = all.get('db-bench-press')!
    expect(day(v.since!)).toBe('2026-08-07')
    expect(v.sessionsSince).toBe(10)
    expect(Math.round(v.weeks! * 10) / 10).toBe(9.9)
  })

  it('O8 gives Push-ups its stall facts: since Mon 3 Aug, 11 Sessions, 10.4 weeks', () => {
    const v = all.get('push-ups')!
    expect(day(v.since!)).toBe('2026-08-03')
    expect(v.sessionsSince).toBe(11)
    expect(Math.round(v.weeks! * 10) / 10).toBe(10.4)
  })

  it('O8 says Narrow-grip pull-down slips below 47.5 kg x 10 of Mon 28 Sep', () => {
    const v = all.get('narrow-grip-pull-down')!
    expect(v.bestBefore).toMatchObject({ lever: 47.5, reps: 10 })
    expect(day(v.bestBefore!.startedAt)).toBe('2026-09-28')
  })

  it('O8 counts deload-free Sessions as n and carries no stall facts on a moving lift', () => {
    const v = all.get('back-squat')!
    expect(v.n).toBe(21) // 23 Sessions of Workout A minus the 2 deloads
    expect(v.since).toBeUndefined()
    expect(v.more).toBeUndefined()
  })

  it('O8 after 1 Session every Workout A lift is too new with 3 more', () => {
    const one = analyse(fixtureSessions.slice(0, 1))
    const v = verdicts(one.histories, one.records, NOW)
    const aLifts = Object.entries(expectedLifts).filter(([, l]) => l.workout === 'A')
    expect([...v.keys()].sort()).toEqual(aLifts.map(([id]) => id).sort())
    for (const [id] of aLifts) {
      expect(v.get(id), id).toMatchObject({ kind: 'too new', n: 1, more: 3 })
    }
  })

  it('O8 after 3 Sessions A lifts need 2 more and B lifts 3 more', () => {
    const three = analyse(fixtureSessions.slice(0, 3))
    const v = verdicts(three.histories, three.records, NOW)
    for (const [id, lift] of Object.entries(expectedLifts)) {
      const expectedMore = lift.workout === 'A' ? 2 : 3
      expect(v.get(id), id).toMatchObject({ kind: 'too new', more: expectedMore })
    }
  })
})

describe('E18-T5 O8 verdict rules on hand-built histories', () => {
  it('O8 a lift with 3 non-deload Sessions is too new with 1 more, whatever its records', () => {
    const h = history([point(0, [50, 8]), point(1, [52.5, 8]), point(2, [55, 8])])
    const v = verdictOf(h, [rec('s1'), rec('s2')], NOW)
    expect(v).toMatchObject({ kind: 'too new', n: 3, more: 1 })
  })

  it('O8 a lift with no Sessions is too new with 4 more', () => {
    expect(verdictOf(history([]), [], NOW)).toMatchObject({ kind: 'too new', n: 0, more: 4 })
  })

  it('O8 a deload Session does not count toward n', () => {
    const h = history([point(0, [50, 8]), point(1, [45, 8], true), point(2, [50, 8]), point(3, [52.5, 8])])
    expect(verdictOf(h, [rec('s3')], NOW)).toMatchObject({ kind: 'too new', n: 3, more: 1 })
  })

  it('O8 4 Sessions with a record among the last 4 is moving', () => {
    const h = history([point(0, [50, 8]), point(1, [50, 8]), point(2, [50, 8]), point(3, [52.5, 8])])
    expect(verdictOf(h, [rec('s3')], NOW).kind).toBe('moving')
  })

  it('O8 a gap between Sessions never counts against a lift', () => {
    const long = new Date(2025, 0, 1).getTime()
    const h = history([
      point(0, [50, 8], false, long),
      point(1, [50, 8], false, long + 2 * WEEK),
      point(2, [50, 8], false, long + 40 * WEEK),
      point(3, [52.5, 8], false, NOW - WEEK),
    ])
    expect(verdictOf(h, [rec('s3')], NOW).kind).toBe('moving')
  })

  it('O8 no record in the last 4 is stalled since the last record, with its Session count', () => {
    const h = history([
      point(0, [50, 8]),
      point(1, [52.5, 8]), // record
      point(2, [52.5, 8]),
      point(3, [52.5, 8]),
      point(4, [52.5, 8]),
      point(5, [52.5, 8]),
    ])
    const v = verdictOf(h, [rec('s1')], NOW)
    expect(v.kind).toBe('stalled')
    expect(v.since).toBe(h.points[1].startedAt)
    expect(v.sessionsSince).toBe(4)
    expect(v.weeks).toBeCloseTo((NOW - h.points[1].startedAt) / WEEK, 5)
  })

  it('O8 a stall counts the weeks to today, not to the lift\'s last Session', () => {
    const h = history([point(0, [50, 8]), point(1, [50, 8]), point(2, [50, 8]), point(3, [50, 8])])
    const v = verdictOf(h, [], NOW)
    expect(v.weeks).toBeCloseTo((NOW - h.points[0].startedAt) / WEEK, 5)
  })

  it('O8 with no record at all the stall runs from the baseline Session', () => {
    const h = history([point(0, [50, 8]), point(1, [50, 8]), point(2, [50, 8]), point(3, [50, 8])])
    const v = verdictOf(h, [], NOW)
    expect(v.kind).toBe('stalled')
    expect(v.since).toBe(h.points[0].startedAt)
    expect(v.sessionsSince).toBe(3)
  })

  it('O8 a deload Session is skipped when counting Sessions since the stall began', () => {
    const h = history([
      point(0, [50, 8]),
      point(1, [52.5, 8]),
      point(2, [52.5, 8]),
      point(3, [47.5, 8], true),
      point(4, [52.5, 8]),
      point(5, [52.5, 8]),
      point(6, [52.5, 8]),
    ])
    const v = verdictOf(h, [rec('s1')], NOW)
    expect(v.kind).toBe('stalled')
    expect(v.sessionsSince).toBe(4)
  })

  it('O8 a record in the oldest of the last 4 Sessions keeps a lift moving', () => {
    const h = history([
      point(0, [50, 8]),
      point(1, [52.5, 8]),
      point(2, [52.5, 8]),
      point(3, [52.5, 8]),
      point(4, [52.5, 8]),
    ])
    expect(verdictOf(h, [rec('s1')], NOW).kind).toBe('moving')
  })

  it('O8 the last 2 Sessions both below the best of the 4 before them is slipping', () => {
    const h = history([
      point(0, [50, 8]),
      point(1, [55, 8]),
      point(2, [52.5, 8]),
      point(3, [52.5, 8]),
      point(4, [50, 8]),
      point(5, [50, 8]),
    ])
    const v = verdictOf(h, [], NOW)
    expect(v.kind).toBe('slipping')
    expect(v.bestBefore).toEqual({ lever: 55, reps: 8, startedAt: h.points[1].startedAt })
  })

  it('O8 slipping looks at the 4 Sessions before the last 2 and no further back', () => {
    // Session 0 (60 kg) is older than the 4 before the last 2, so the best of those 4 is 52.5.
    const h = history([
      point(0, [60, 8]),
      point(1, [52.5, 8]),
      point(2, [52.5, 8]),
      point(3, [50, 8]),
      point(4, [50, 8]),
      point(5, [53, 8]),
      point(6, [53, 8]),
    ])
    const v = verdictOf(h, [], NOW)
    expect(v.kind).toBe('stalled')
  })

  it('O8 with only 4 Sessions slipping compares the last 2 against the 2 before them', () => {
    const h = history([point(0, [60, 8]), point(1, [55, 8]), point(2, [50, 8]), point(3, [50, 8])])
    expect(verdictOf(h, [], NOW)).toMatchObject({ kind: 'slipping', bestBefore: { lever: 60, reps: 8 } })
  })

  it('O8 the same lever with fewer reps counts as below', () => {
    const h = history([
      point(0, [50, 10]),
      point(1, [50, 10]),
      point(2, [50, 10]),
      point(3, [50, 9]),
      point(4, [50, 9]),
    ])
    expect(verdictOf(h, [], NOW)).toMatchObject({ kind: 'slipping', bestBefore: { lever: 50, reps: 10 } })
  })

  it('O8 equal to the earlier best is not below, so the lift is stalled instead', () => {
    const h = history([point(0, [50, 10]), point(1, [50, 10]), point(2, [50, 10]), point(3, [50, 10])])
    expect(verdictOf(h, [], NOW).kind).toBe('stalled')
  })

  it('O8 only one of the last 2 below the earlier best is not slipping', () => {
    const h = history([point(0, [60, 8]), point(1, [60, 8]), point(2, [50, 8]), point(3, [60, 8])])
    expect(verdictOf(h, [], NOW).kind).toBe('stalled')
  })

  it('O8 slipping on a deload-laden history skips the deload Session', () => {
    const h = history([
      point(0, [60, 8]),
      point(1, [60, 8]),
      point(2, [40, 8], true),
      point(3, [55, 8]),
      point(4, [55, 8]),
    ])
    expect(verdictOf(h, [], NOW)).toMatchObject({ kind: 'slipping', n: 4 })
  })

  it('O8 an assisted lift slips when its lever falls (more assistance is lower)', () => {
    const h = history(
      [point(0, [-10, 8]), point(1, [-8, 8]), point(2, [-12, 8]), point(3, [-12, 8])],
      true,
    )
    expect(verdictOf(h, [], NOW)).toMatchObject({ kind: 'slipping', bestBefore: { lever: -8, reps: 8 } })
  })
})

// ---- O9 next step ----------------------------------------------------------------------------

const exercise = (over: Partial<Exercise> = {}): Exercise => ({
  id: 'lift',
  name: 'Lift',
  weightStep: 2.5,
  startWeight: null,
  bodyweight: false,
  libraryId: 'x',
  ...over,
})
const plan = (sets: number, lo: number, hi: number): ExercisePlan => ({
  exerciseId: 'lift',
  sets,
  repRange: [lo, hi],
  restSeconds: 90,
})
let setSeq = 0
function set(lever: number, reps: number, kind?: SetEntry['kind'], bodyweight = false): SetEntry {
  setSeq += 1
  return {
    ...(kind ? { kind } : {}),
    exerciseId: 'lift',
    setIndex: setSeq,
    weightKg: bodyweight ? null : lever,
    reps,
    loggedAt: 0,
    ...(bodyweight && lever !== 0 ? { loadKg: lever } : {}),
  }
}
function withSets(i: number, sets: SetEntry[], top: TopSpec): LiftPoint {
  return { ...point(i, top), workingSets: sets }
}

describe('E18-T5 O9 next step', () => {
  let histories: Map<string, LiftHistory>
  beforeAll(() => {
    histories = analyse(fixtureSessions).histories
  })

  it('O9 each fixture lift reports repsAtTop of target at its lever, as in expected.json', () => {
    for (const [id, lift] of Object.entries(expectedLifts)) {
      const step = nextStep(histories.get(id)!, planOf(id), resolve(id)!)!
      expect(step, id).not.toBeNull()
      expect(step.repsAtTop, id).toBe(lift.nextStep.repsAtTop)
      expect(step.target, id).toBe(lift.nextStep.target)
      expect(step.lever, id).toBeCloseTo(leverOfLabel(lift.nextStep.at), 6)
      expect(step.ready, id).toBe(lift.nextStep.ready)
    }
  })

  it('O9 only Seated biceps curls is ready, and it suggests 15 kg', () => {
    const ready = Object.keys(expectedLifts).filter(
      (id) => nextStep(histories.get(id)!, planOf(id), resolve(id)!)!.ready,
    )
    expect(ready).toEqual(['seated-biceps-curls'])
    const step = nextStep(histories.get('seated-biceps-curls')!, planOf('seated-biceps-curls'), resolve('seated-biceps-curls')!)!
    expect(step.suggest).toEqual({ kind: 'lever', lever: 15 })
  })

  it('O9 a lift that is not ready carries no suggestion', () => {
    const step = nextStep(histories.get('back-squat')!, planOf('back-squat'), resolve('back-squat')!)!
    expect(step.suggest).toBeUndefined()
  })

  it('O9 a full loaded lift suggests one weightStep up', () => {
    const h = history([withSets(0, [set(60, 10), set(60, 10), set(60, 10)], [60, 10])])
    const step = nextStep(h, plan(3, 8, 10), exercise({ weightStep: 2.5 }))!
    expect(step).toMatchObject({ repsAtTop: 30, target: 30, lever: 60, ready: true })
    expect(step.suggest).toEqual({ kind: 'lever', lever: 62.5 })
  })

  it('O9 one rep short of the target is not ready', () => {
    const h = history([withSets(0, [set(60, 10), set(60, 10), set(60, 9)], [60, 10])])
    const step = nextStep(h, plan(3, 8, 10), exercise())!
    expect(step).toMatchObject({ repsAtTop: 29, target: 30, ready: false })
  })

  it('O9 counts only the latest Session, at its top lever, in straight sets', () => {
    const older = withSets(0, [set(60, 10), set(60, 10), set(60, 10)], [60, 10])
    const latest = withSets(
      1,
      [set(40, 10, 'warmup'), set(60, 8), set(60, 8), set(60, 6, 'failure'), set(50, 10, 'drop'), set(55, 10)],
      [60, 8],
    )
    const step = nextStep(history([older, latest]), plan(3, 8, 10), exercise())!
    expect(step).toMatchObject({ repsAtTop: 22, lever: 60, ready: false })
  })

  it('O9 a drop set at the top lever does not add reps', () => {
    const latest = withSets(0, [set(60, 10), set(60, 10), set(60, 10, 'drop')], [60, 10])
    expect(nextStep(history([latest]), plan(3, 8, 10), exercise())!.repsAtTop).toBe(20)
  })

  it('O9 a Bodyweight lift with a Load suggests one Load step up', () => {
    const latest = withSets(0, [set(5, 15, undefined, true), set(5, 15, undefined, true), set(5, 15, undefined, true)], [5, 15])
    const h = history([latest], true)
    const step = nextStep(h, plan(3, 10, 15), exercise({ bodyweight: true, weightStep: 1 }))!
    expect(step).toMatchObject({ lever: 5, ready: true })
    expect(step.suggest).toEqual({ kind: 'lever', lever: 6 })
  })

  it('O9 an assisted lift suggests less assistance, a higher lever', () => {
    const latest = withSets(
      0,
      [set(-19, 8, undefined, true), set(-19, 8, undefined, true), set(-19, 8, undefined, true), set(-19, 8, undefined, true)],
      [-19, 8],
    )
    const h = history([latest], true)
    const step = nextStep(h, plan(4, 5, 8), exercise({ bodyweight: true, weightStep: 2 }))!
    expect(step).toMatchObject({ lever: -19, ready: true })
    expect(step.suggest).toEqual({ kind: 'lever', lever: -17 })
  })

  it('O9 a plain Bodyweight lift at its target suggests adding a set', () => {
    const latest = withSets(0, [set(0, 15, undefined, true), set(0, 15, undefined, true), set(0, 15, undefined, true)], [0, 15])
    const h = history([latest], true)
    const step = nextStep(h, plan(3, 10, 15), exercise({ bodyweight: true, weightStep: 1 }))!
    expect(step).toMatchObject({ lever: 0, ready: true })
    expect(step.suggest).toEqual({ kind: 'set' })
  })

  it('O9 a lift with no Plan in the active Program has no next step', () => {
    const h = history([withSets(0, [set(60, 10)], [60, 10])])
    expect(nextStep(h, undefined, exercise())).toBeNull()
  })

  it('O9 a lift with no Sessions has no next step', () => {
    expect(nextStep(history([]), plan(3, 8, 10), exercise())).toBeNull()
  })
})

// ---- O10 steps climbed -----------------------------------------------------------------------

describe('E18-T5 O10 steps climbed', () => {
  it('O10 12 of 14 lifts climbed since Fri 18 Sep, all but DB bench press and Push-ups', () => {
    const { histories, records } = analyse(fixtureSessions)
    const r = stepsClimbed(histories, records, NOW)
    expect(r.climbed).toBe(12)
    expect(r.of).toBe(14)
    expect(day(r.since)).toBe('2026-09-18')
    expect(Object.keys(expectedLifts).filter((id) => !r.ids.includes(id)).sort()).toEqual([
      'db-bench-press',
      'push-ups',
    ])
  })

  it('O10 the window starts at local midnight of the first of the 28 days ending today', () => {
    const r = stepsClimbed(new Map(), [], NOW)
    expect(r.since).toBe(new Date(2026, 8, 18, 0, 0).getTime())
    expect(r.climbed).toBe(0)
    expect(r.of).toBe(0)
  })

  const mk = (id: string, startedAt: number, kind: SessionRecord['kind']) => {
    const p = { ...point(9, [50, 8], false, startedAt), sessionId: `${id}-s` }
    return {
      h: history([p], false, id),
      r: rec(`${id}-s`, id, kind),
    }
  }
  const climbedIds = (items: { h: LiftHistory; r: SessionRecord }[]) =>
    stepsClimbed(new Map(items.map((i) => [i.h.exerciseId, i.h])), items.map((i) => i.r), NOW).ids

  it('O10 a Heaviest weight record at 00:30 on the first day counts', () => {
    expect(climbedIds([mk('a', new Date(2026, 8, 18, 0, 30).getTime(), 'Heaviest weight')])).toEqual(['a'])
  })

  it('O10 a Heaviest weight record at 23:30 the day before the window does not count', () => {
    expect(climbedIds([mk('a', new Date(2026, 8, 17, 23, 30).getTime(), 'Heaviest weight')])).toEqual([])
  })

  it('O10 Least assistance and First added load count as climbs', () => {
    const t = new Date(2026, 9, 1, 18).getTime()
    expect(climbedIds([mk('b', t, 'Least assistance'), mk('c', t, 'First added load')])).toEqual(['b', 'c'])
  })

  it('O10 a Rep record or an Estimated 1RM is not a step climbed', () => {
    const t = new Date(2026, 9, 1, 18).getTime()
    expect(climbedIds([mk('a', t, 'Rep record'), mk('b', t, 'Estimated 1RM')])).toEqual([])
  })

  it('O10 a lift with several climbs in the window counts once', () => {
    const t = new Date(2026, 9, 1, 18).getTime()
    const p1 = { ...point(0, [50, 8], false, t), sessionId: 'x1' }
    const p2 = { ...point(1, [52.5, 8], false, t + 3 * 24 * 3600 * 1000), sessionId: 'x2' }
    const h = history([p1, p2], false, 'x')
    const r = stepsClimbed(new Map([['x', h]]), [rec('x1', 'x'), rec('x2', 'x')], NOW)
    expect(r).toMatchObject({ climbed: 1, ids: ['x'], of: 1 })
  })
})

describe('E21-T1 O3 next step reads effort and skips deloads', () => {
  const rirSets = (lever: number, reps: number, rirs: Array<0 | 1 | 2 | 3 | undefined>): SetEntry[] =>
    rirs.map((rir) => ({ ...set(lever, reps), ...(rir === undefined ? {} : { rir }) }))
  const ex = exercise({ weightStep: 2.5 })
  const pl = plan(3, 8, 10)

  it('O3 a full bar at RIRs 2, 3, 2 suggests two weightSteps up with steps 2', () => {
    const h = history([withSets(0, rirSets(60, 10, [2, 3, 2]), [60, 10])])
    const step = nextStep(h, pl, ex)!
    expect(step).toMatchObject({ ready: true, lever: 60, steps: 2 })
    expect(step.suggest).toEqual({ kind: 'lever', lever: 65 })
    expect(step.hold).toBeUndefined()
  })

  it('O3 a full bar at RIR 0 throughout is not ready, holds, and has no suggestion', () => {
    const h = history([withSets(0, rirSets(60, 10, [0, 0, 0]), [60, 10])])
    const step = nextStep(h, pl, ex)!
    expect(step).toMatchObject({ repsAtTop: 30, target: 30, lever: 60, ready: false, hold: true })
    expect(step.suggest).toBeUndefined()
    expect(step.steps).toBeUndefined()
  })

  it('O3 a full bar with no RIR is one step with neither steps nor hold', () => {
    const h = history([withSets(0, rirSets(60, 10, [undefined, undefined, undefined]), [60, 10])])
    const step = nextStep(h, pl, ex)!
    expect(step.ready).toBe(true)
    expect(step.suggest).toEqual({ kind: 'lever', lever: 62.5 })
    expect(step.steps).toBeUndefined()
    expect(step.hold).toBeUndefined()
  })

  it('O3 a bar that is not full carries no hold or steps whatever the RIRs', () => {
    const h = history([withSets(0, rirSets(60, 9, [0, 0, 0]), [60, 9])])
    const step = nextStep(h, pl, ex)!
    expect(step).toMatchObject({ ready: false })
    expect(step.hold).toBeUndefined()
    expect(step.steps).toBeUndefined()
    expect(step.suggest).toBeUndefined()
  })

  it('O3 a latest deload Session is skipped: the step reads the newest non-deload Session', () => {
    const easy = withSets(0, rirSets(60, 10, [3, 3, 3]), [60, 10])
    const deload = { ...withSets(1, rirSets(54, 10, [3, 3, 3]), [54, 10]), deload: true }
    const step = nextStep(history([easy, deload]), pl, ex)!
    expect(step).toMatchObject({ lever: 60, ready: true, steps: 2 })
    expect(step.suggest).toEqual({ kind: 'lever', lever: 65 })
  })

  it('O3 a history of only deload Sessions has no next step', () => {
    const d = { ...withSets(0, rirSets(54, 10, [3, 3, 3]), [54, 10]), deload: true }
    expect(nextStep(history([d]), pl, ex)).toBeNull()
  })

  it('O3 a plain Bodyweight lift after an easy full bar still suggests one more set, never two', () => {
    const h = history([withSets(0, rirSets(0, 15, [3, 3, 3]).map((s) => ({ ...s, weightKg: null })), [0, 15])], true)
    const step = nextStep(h, plan(3, 10, 15), exercise({ bodyweight: true, weightStep: 1 }))!
    expect(step.suggest).toEqual({ kind: 'set' })
  })

  it('O3 on the E18 fixture only Seated biceps curls is ready, suggesting 15 kg, with nothing held', () => {
    const { histories } = analyse(fixtureSessions)
    const steps = Object.keys(expectedLifts).map((id) => [id, nextStep(histories.get(id)!, planOf(id), resolve(id)!)!] as const)
    expect(steps.filter(([, s]) => s.ready).map(([id]) => id)).toEqual(['seated-biceps-curls'])
    expect(steps.filter(([, s]) => s.hold).map(([id]) => id)).toEqual([])
    expect(steps.find(([id]) => id === 'seated-biceps-curls')![1].suggest).toEqual({ kind: 'lever', lever: 15 })
  })
})
