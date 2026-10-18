// E18-T6 [O16 O17 O21-data]: ladder geometry, range cuts and the `4 weeks ago` compare, against
// the stats fixture and a few hand-built Sessions. Expected values are the fixture's / hand-checked.
import { describe, expect, it } from 'vitest'
import sessionsJson from '../../test/fixtures/stats/sessions.json'
import { loadCatalog, loadPrograms } from '../../data/catalog'
import type { ExercisePlan, Session, SetEntry } from '../../types'
import { buildLadder, compareAgo, cutLadder } from './ladder'
import { buildLiftHistories } from './liftHistory'

process.env.TZ = 'Asia/Jerusalem' // the zone the fixture was written in

const sessions = sessionsJson as unknown as Session[]
const catalog = loadCatalog()
const resolve = (id: string) => catalog.get(id)
const program = loadPrograms().find((p) => p.id === 'assaf-ab-2026')!
const plans = new Map<string, ExercisePlan>()
for (const w of program.workouts) for (const e of w.exercises) plans.set(e.exerciseId, e)
const planOf = (id: string) => plans.get(id)
const NOW = new Date(2026, 9, 15, 18, 5).getTime() // Thu 15 Oct 2026
const local = (m: number, d: number) => new Date(2026, m - 1, d).getTime()

let built: ReturnType<typeof buildLiftHistories> | undefined
const history = (id: string) => (built ??= buildLiftHistories(sessions, resolve, planOf)).get(id)!
const ladderOf = (id: string) => buildLadder(history(id), { sessions, program })
const day = (ms: number) => new Date(ms).toLocaleDateString('sv-SE')

describe('E18-T6 O16 ladder geometry on the fixture', () => {
  it('O16 Back squat treads are 50 to 62.5 kg in date order, each with a target of 20', () => {
    const l = ladderOf('back-squat')
    expect(l.treads.map((t) => t.lever)).toEqual([50, 52.5, 55, 57.5, 60, 62.5])
    expect(l.treads.map((t) => t.target)).toEqual([20, 20, 20, 20, 20, 20])
  })

  it('O16 Back squat deload Sessions are points off every tread', () => {
    const l = ladderOf('back-squat')
    const deloads = l.points.filter((p) => p.deload)
    expect(deloads.map((p) => day(p.startedAt))).toEqual(['2026-09-21', '2026-09-25'])
    const onTreads = new Set(l.treads.flatMap((t) => t.sessionIds))
    for (const p of deloads) expect(onTreads.has(p.sessionId)).toBe(false)
    expect(l.points).toHaveLength(23)
    expect(onTreads.size).toBe(21)
  })

  it('O16 Back squat gaps are the week of 10 Aug `No sessions` and 14 Sep `No A session`', () => {
    expect(ladderOf('back-squat').gaps).toEqual([
      { weekStart: local(8, 10), label: 'No sessions' },
      { weekStart: local(9, 14), label: 'No A session' },
    ])
  })

  it('O16 each Back squat Session has a reps-at-top bar with its tread target', () => {
    const p = ladderOf('back-squat').points
    expect(p[0]).toMatchObject({ lever: 50, reps: 13, target: 20 }) // 50 x 7 + 50 x 6
    expect(p[p.length - 1]).toMatchObject({ lever: 62.5, reps: 15, target: 20 }) // 62.5 x 8 + x 7
  })

  it('O16 a deload point keeps its reps at its own lever and has no target', () => {
    const p = ladderOf('back-squat').points.filter((x) => x.deload)
    expect(p.map((x) => [x.lever, x.reps, x.target])).toEqual([
      [50, 10, null],
      [52.5, 7, null],
    ])
  })

  it('O16 Assisted pull-ups treads climb BW-27 to BW-19 and a tread survives a deload between its Sessions', () => {
    const l = ladderOf('assisted-pull-ups')
    expect(l.treads.map((t) => t.lever)).toEqual([-27, -25, -23, -21, -19])
    expect(l.treads.map((t) => t.target)).toEqual([32, 32, 32, 32, 32])
    expect(l.treads[3].sessionIds).toHaveLength(4) // 9 Sep, 14 Sep, (deload 23 Sep), 28 Sep, 2 Oct
    expect(l.points[l.points.length - 1]).toMatchObject({ lever: -19, reps: 23, target: 32 })
  })

  it('O16 Hyper-extension is one series: a BW tread of 19 Sessions, then a BW+5 tread of 2', () => {
    const l = ladderOf('hyper-extension')
    expect(l.treads.map((t) => [t.lever, t.sessionIds.length, t.target])).toEqual([
      [0, 19, 45],
      [5, 2, 45],
    ])
  })

  it('O16 Push-ups bars count failure sets at the top lever', () => {
    const l = ladderOf('push-ups')
    expect(l.treads.map((t) => t.lever)).toEqual([0])
    const p = l.points.find((x) => day(x.startedAt) === '2026-10-09')!
    expect(p).toMatchObject({ lever: 0, reps: 47, target: 45 })
  })
})

describe('E18-T6 O16 ladder geometry on hand-built Sessions', () => {
  const set = (n: number, w: number, reps: number, extra: Partial<SetEntry> = {}): SetEntry => ({
    exerciseId: 'db-bench-press',
    setIndex: n,
    weightKg: w,
    reps,
    loggedAt: n,
    ...extra,
  })
  const sess = (id: string, startedAt: number, entries: SetEntry[]): Session => ({
    id,
    programId: 'assaf-ab-2026',
    workoutId: 'workout-a',
    startedAt,
    finishedAt: startedAt + 1,
    entries,
  })
  const at = (n: number) => new Date(2026, 8, 1 + n * 7, 10).getTime() // weekly, from Tue 1 Sep
  const lift = (ss: Session[], withPlan = true) =>
    buildLiftHistories(ss, resolve, (id) => (withPlan ? planOf(id) : undefined)).get('db-bench-press')!

  it('O16 a lever that drops starts a new tread and one that returns starts another', () => {
    const ss = [10, 10, 8, 10].map((w, i) => sess(`s${i}`, at(i), [set(0, w, 8), set(1, w, 8)]))
    const l = buildLadder(lift(ss), { sessions: ss, program })
    expect(l.treads.map((t) => t.lever)).toEqual([10, 8, 10])
    expect(l.treads.map((t) => t.sessionIds)).toEqual([['s0', 's1'], ['s2'], ['s3']])
  })

  it('O16 a drop set is not in the bar or the target: 2 straight sets of 8 reps against 2 x 10', () => {
    const ss = [sess('s0', at(0), [set(0, 10, 8), set(1, 10, 8), set(2, 10, 6, { kind: 'drop' })])]
    const l = buildLadder(lift(ss), { sessions: ss, program })
    expect(l.points[0]).toMatchObject({ lever: 10, reps: 16, target: 20 })
  })

  it('O16 a lift with no Plan has treads and bars but no target', () => {
    const ss = [10, 12].map((w, i) => sess(`s${i}`, at(i), [set(0, w, 8)]))
    const l = buildLadder(lift(ss, false), { sessions: ss, program: undefined })
    expect(l.treads.map((t) => [t.lever, t.target])).toEqual([
      [10, null],
      [12, null],
    ])
    expect(l.points.map((p) => p.target)).toEqual([null, null])
  })

  it('O16 a calendar week with no Session at all between two Sessions is a `No sessions` gap', () => {
    // Tue 1 Sep (week of 31 Aug) and Thu 17 Sep (week of 14 Sep): the week of 7 Sep is empty.
    const ss = [
      sess('a', new Date(2026, 8, 1, 10).getTime(), [set(0, 10, 8)]),
      sess('b', new Date(2026, 8, 17, 10).getTime(), [set(0, 10, 8)]),
    ]
    const l = buildLadder(lift(ss), { sessions: ss, program })
    expect(l.gaps).toEqual([{ weekStart: local(9, 7), label: 'No sessions' }])
  })

  it('O16 consecutive weeks give no gap', () => {
    const ss = [
      sess('a', new Date(2026, 8, 1, 10).getTime(), [set(0, 10, 8)]),
      sess('b', new Date(2026, 8, 8, 10).getTime(), [set(0, 10, 8)]),
    ]
    expect(buildLadder(lift(ss), { sessions: ss, program }).gaps).toEqual([])
  })
})

describe('E18-T6 O17 range cuts', () => {
  it('O17 Step holds the current tread and the two before it', () => {
    const l = cutLadder(ladderOf('back-squat'), 'step', NOW)
    expect(l.treads.map((t) => t.lever)).toEqual([57.5, 60, 62.5])
    expect(l.points).toHaveLength(12) // 6 + 2 deload + 3 + 1
    expect(day(l.points[0].startedAt)).toBe('2026-08-19')
    expect(l.gaps).toEqual([{ weekStart: local(9, 14), label: 'No A session' }])
  })

  it('O17 Step on a lift with two treads holds both', () => {
    const l = cutLadder(ladderOf('hyper-extension'), 'step', NOW)
    expect(l.treads.map((t) => t.lever)).toEqual([0, 5])
    expect(l.points).toHaveLength(22)
  })

  it('O17 3M holds 18 Back squat Sessions, 2 of them deload, and both gaps', () => {
    const l = cutLadder(ladderOf('back-squat'), '3M', NOW)
    expect(l.points).toHaveLength(18)
    expect(l.points.filter((p) => p.deload)).toHaveLength(2)
    expect(day(l.points[0].startedAt)).toBe('2026-07-15')
    expect(l.treads.map((t) => t.lever)).toEqual([52.5, 55, 57.5, 60, 62.5])
    expect(l.treads[0].sessionIds).toHaveLength(3)
    expect(l.gaps.map((g) => g.label)).toEqual(['No sessions', 'No A session'])
  })

  it('O17 1Y and All keep every Back squat Session', () => {
    const base = ladderOf('back-squat')
    for (const range of ['1Y', 'all'] as const) {
      const l = cutLadder(base, range, NOW)
      expect(l.points).toHaveLength(23)
      expect(l.treads).toHaveLength(6)
      expect(l.gaps).toHaveLength(2)
    }
  })

  it('O17 3M does not change the ladder it was given', () => {
    const base = ladderOf('back-squat')
    cutLadder(base, '3M', NOW)
    expect(base.points).toHaveLength(23)
  })
})

describe('E18-T6 O21 the 4 weeks ago compare', () => {
  it('O21 DB bench press is 13 x 9 then and now, no change', () => {
    const c = compareAgo(history('db-bench-press'), NOW)!
    expect(day(c.then.startedAt)).toBe('2026-09-11')
    expect(c.then).toMatchObject({ lever: 13, reps: 9 })
    expect(day(c.now.startedAt)).toBe('2026-10-14')
    expect(c.now).toMatchObject({ lever: 13, reps: 9 })
    expect(c.change).toBe('same')
  })

  it('O21 Back squat 57.5 x 10 then and 62.5 x 8 now is up', () => {
    const c = compareAgo(history('back-squat'), NOW)!
    expect(c.then).toMatchObject({ lever: 57.5, reps: 10 })
    expect(c.now).toMatchObject({ lever: 62.5, reps: 8 })
    expect(c.change).toBe('up')
  })

  it('O21 Push-ups 17 reps then and 15 now is down', () => {
    const c = compareAgo(history('push-ups'), NOW)!
    expect(c.then).toMatchObject({ lever: 0, reps: 17 })
    expect(c.now).toMatchObject({ lever: 0, reps: 15 })
    expect(c.change).toBe('down')
  })

  it('O21 Assisted pull-ups BW-21 then and BW-19 now is up (less assistance)', () => {
    const c = compareAgo(history('assisted-pull-ups'), NOW)!
    expect(c.then).toMatchObject({ lever: -21, reps: 5 })
    expect(c.now).toMatchObject({ lever: -19, reps: 6 })
    expect(c.change).toBe('up')
  })

  it('O21 a deload Session is never the then side', () => {
    // 4 weeks before Fri 23 Oct is Fri 25 Sep, a deload; the Session then is the last real one.
    const c = compareAgo(history('back-squat'), new Date(2026, 9, 23, 18, 5).getTime())!
    expect(day(c.then.startedAt)).toBe('2026-09-11')
    expect(c.then).toMatchObject({ lever: 57.5, reps: 10 })
  })

  const mk = (id: string, ms: number): Session => ({
    id,
    programId: 'assaf-ab-2026',
    workoutId: 'workout-a',
    startedAt: ms,
    finishedAt: ms + 1,
    entries: [{ exerciseId: 'db-bench-press', setIndex: 0, weightKg: 10, reps: 8, loggedAt: 0 }],
  })

  it('O21 there is no compare before the 4th non-deload Session', () => {
    const ss = [mk('a', new Date(2026, 7, 1, 10).getTime()), mk('b', new Date(2026, 7, 8, 10).getTime()), mk('c', new Date(2026, 9, 14, 10).getTime())]
    const h = buildLiftHistories(ss, resolve, planOf).get('db-bench-press')!
    expect(compareAgo(h, NOW)).toBeNull()
  })

  it('O21 there is no compare when nothing was done 4 weeks ago', () => {
    const ss = [1, 2, 3, 4].map((d) => mk(`s${d}`, new Date(2026, 9, 5 + d, 10).getTime()))
    const h = buildLiftHistories(ss, resolve, planOf).get('db-bench-press')!
    expect(compareAgo(h, NOW)).toBeNull()
  })
})

describe('E19 O4 gaps follow the week start', () => {
  const set = (n: number, w: number): SetEntry => ({
    exerciseId: 'db-bench-press',
    setIndex: n,
    weightKg: w,
    reps: 8,
    loggedAt: n,
  })
  const sess = (id: string, startedAt: number): Session => ({
    id,
    programId: 'assaf-ab-2026',
    workoutId: 'workout-a',
    startedAt,
    finishedAt: startedAt + 1,
    entries: [set(0, 10), set(1, 10)],
  })

  it('E19 O4 Sessions on Fri 4 and Sat 12 Sep leave the Saturday week of 5 Sep as the gap with Saturday, none with Monday', () => {
    const ss = [sess('fri', new Date(2026, 8, 4, 10).getTime()), sess('sat', new Date(2026, 8, 12, 10).getTime())]
    const h = buildLiftHistories(ss, resolve, planOf).get('db-bench-press')!
    expect(buildLadder(h, { sessions: ss, program }, 6).gaps).toEqual([
      { weekStart: new Date(2026, 8, 5).getTime(), label: 'No sessions' },
    ])
    expect(buildLadder(h, { sessions: ss, program }).gaps).toEqual([])
  })

  it('E19 O4 cutLadder with Wednesday keeps the gap of the Wednesday week holding the cut', () => {
    const gap = (m: number, d: number) => ({ weekStart: new Date(2026, m - 1, d).getTime(), label: 'No sessions' })
    const ladder = { exerciseId: 'db-bench-press', treads: [], points: [], gaps: [gap(9, 30), gap(10, 7)] }
    const now = new Date(2027, 0, 12, 10).getTime() // 3M back is Mon 12 Oct 2026
    expect(cutLadder(ladder, '3M', now, 3).gaps).toEqual([gap(10, 7)])
    expect(cutLadder(ladder, '3M', now).gaps).toEqual([])
  })
})
