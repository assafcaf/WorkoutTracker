// E18-T3 [O5 O6 O7]: records, the one record count and the bests table against the stats fixture
// (expected.json), plus hand-built Sessions for the rank order and the failure paths.
import { describe, expect, it } from 'vitest'
import expectedJson from '../../test/fixtures/stats/expected.json'
import sessionsJson from '../../test/fixtures/stats/sessions.json'
import { loadCatalog, loadPrograms } from '../../data/catalog'
import type { Exercise, ExercisePlan, Session, SetEntry } from '../../types'
import { buildLiftHistories } from './liftHistory'
import { computeRecords, liftBests, recordCount } from './records'

type Pr = { kind: string; text: string; gain: string }
type Point = { date: string; pr: Pr | null; alsoBeat: Pr[] | null }
type Lift = { name: string; points: Point[]; records: Record<string, string> }
type Expected = {
  lifts: Record<string, Lift>
  sessions: { date: string; prs: string[] }[]
}
const expected = expectedJson as unknown as Expected
const sessions = sessionsJson as unknown as Session[]

const catalog = loadCatalog()
const resolve = (id: string) => catalog.get(id)
const plans = new Map<string, ExercisePlan>()
for (const w of loadPrograms().find((p) => p.id === 'assaf-ab-2026')!.workouts) {
  for (const e of w.exercises) plans.set(e.exerciseId, e)
}
const planOf = (id: string) => plans.get(id)

const zone = 'Asia/Jerusalem'
const day = (ms: number) => new Date(ms).toLocaleDateString('sv-SE', { timeZone: zone })
const label = (ms: number) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).formatToParts(ms)
  const get = (t: string) => parts.find((p) => p.type === t)!.value
  return `${get('weekday')} ${get('day')} ${get('month')}`
}
const sessionOn = (date: string) => sessions.find((s) => day(s.startedAt) === date)!

/** `62.5 kg × 8`, `BW−19 × 6`, `BW+5 × 12`, `BW × 15` -> lever and reps. */
function parseSet(t: string): { lever: number; reps: number } {
  const m = /^(?:BW([+−]\d+(?:\.\d+)?)?|(\d+(?:\.\d+)?) kg) × (\d+)$/.exec(t)
  if (!m) throw new Error(`unparsed set text: ${t}`)
  const lever = m[2] !== undefined ? Number(m[2]) : m[1] ? Number(m[1].replace('−', '-')) : 0
  return { lever, reps: Number(m[3]) }
}
/** `+2.5 kg`, `−2 kg assistance`, `+1 rep`, `+2 reps` -> the magnitude. */
const parseGain = (t: string) => Number(/(\d+(?:\.\d+)?)/.exec(t)![1])

type Records = ReturnType<typeof computeRecords>
let cachedRecords: Records | undefined
/** Computed on first use, so a missing implementation fails a test, not the collection. */
const allRecords = () => (cachedRecords ??= computeRecords(sessions, resolve, planOf))
const lazyRecords = () => new Proxy([] as Records, { get: (_t, k) => Reflect.get(allRecords(), k) })

describe('E18-T3 O5 records on the fixture', () => {
  const records = lazyRecords()
  it('O5 totals 201 records in 45 Sessions, and never more than one per lift per Session', () => {
    expect(records).toHaveLength(201)
    const keys = records.map((r) => `${r.sessionId}|${r.exerciseId}`)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('O5 matches every lift record to the fixture: kind, set and gain', () => {
    const want = new Map<string, { kind: string; lever: number; reps: number; gain: number }>()
    for (const [id, lift] of Object.entries(expected.lifts)) {
      for (const p of lift.points) {
        if (!p.pr) continue
        const { lever, reps } = parseSet(p.pr.text)
        want.set(`${sessionOn(p.date).id}|${id}`, {
          kind: p.pr.kind,
          lever,
          reps,
          gain: parseGain(p.pr.gain),
        })
      }
    }
    expect(want.size).toBe(201)
    const got = new Map<string, Records[number]>(
      records.map((r): [string, Records[number]] => [`${r.sessionId}|${r.exerciseId}`, r]),
    )
    expect([...got.keys()].sort()).toEqual([...want.keys()].sort())
    for (const [key, w] of want) {
      const r = got.get(key)!
      expect(r.kind, key).toBe(w.kind)
      expect({ lever: r.lever, reps: r.reps }, key).toEqual({ lever: w.lever, reps: w.reps })
      expect(r.gain, key).toBeCloseTo(w.gain, 6)
    }
  })

  it('O5 keeps the lower-ranked kinds beaten that Session as alsoBeat, for the readout only', () => {
    for (const [id, lift] of Object.entries(expected.lifts)) {
      for (const p of lift.points) {
        if (!p.pr) continue
        const r = records.find((x) => x.sessionId === sessionOn(p.date).id && x.exerciseId === id)!
        expect(
          r.alsoBeat.map((a) => a.kind),
          `${id} ${p.date}`,
        ).toEqual((p.alsoBeat ?? []).map((a) => a.kind))
        r.alsoBeat.forEach((a, i) => {
          // the fixture rounds both 1RMs to a tenth, so their difference may be 0.1 off
          expect(Math.abs(a.gain - parseGain(p.alsoBeat![i].gain)), `${id} ${p.date}`).toBeLessThan(
            0.11,
          )
        })
      }
    }
  })

  it('O5 sets no record in a lift first Session (baseline) or in a deload Session', () => {
    const histories = buildLiftHistories(sessions, resolve, planOf)
    for (const h of histories.values()) {
      const baseline = h.points[0].sessionId
      const deloads = h.points.filter((p) => p.deload).map((p) => p.sessionId)
      const mine = records.filter((r) => r.exerciseId === h.exerciseId).map((r) => r.sessionId)
      expect(mine, h.exerciseId).not.toContain(baseline)
      for (const d of deloads) expect(mine, h.exerciseId).not.toContain(d)
    }
    for (const date of ['2026-09-21', '2026-09-23', '2026-09-25']) {
      expect(records.filter((r) => r.sessionId === sessionOn(date).id)).toHaveLength(0)
    }
  })

  it('O5 Wed 14 Oct has 4 records, each Heaviest weight: squat, lunges, shoulder press, push-down', () => {
    const id = sessionOn('2026-10-14').id
    const mine = records.filter((r) => r.sessionId === id)
    expect(mine.map((r) => r.exerciseId).sort()).toEqual([
      'cable-push-down',
      'lunges',
      'machine-shoulder-press',
      'back-squat',
    ].sort())
    expect(mine.every((r) => r.kind === 'Heaviest weight')).toBe(true)
  })

  it('O5 names the assisted and first-load records: Least assistance and First added load', () => {
    const kinds = new Map<string, number>()
    for (const r of records) kinds.set(r.kind, (kinds.get(r.kind) ?? 0) + 1)
    expect(Object.fromEntries(kinds)).toEqual({
      'Heaviest weight': 56,
      'Rep record': 140,
      'Least assistance': 4,
      'First added load': 1,
    })
  })
})

describe('E18-T3 O6 the one record count', () => {
  const records = lazyRecords()
  it('O6 answers for every Session with the fixture count: Wed 14 Oct is 4, Mon 12 Oct is 5', () => {
    expect(recordCount(records, sessionOn('2026-10-14').id)).toBe(4)
    expect(recordCount(records, sessionOn('2026-10-12').id)).toBe(5)
  })

  it('O6 equals the fixture prs of every Session, and sums to 201', () => {
    let total = 0
    expected.sessions.forEach((s) => {
      const n = recordCount(records, sessionOn(s.date).id)
      expect(n, s.date).toBe(s.prs.length)
      total += n
    })
    expect(total).toBe(201)
  })

  it('O6 counts alsoBeat kinds for nothing: a Session with an also-beaten 1RM counts one', () => {
    const squat = records.find((r) => r.alsoBeat.length > 0)!
    const same = records.filter((r) => r.sessionId === squat.sessionId).length
    expect(recordCount(records, squat.sessionId)).toBe(same)
  })

  it('O6 answers 0 for a Session with no records or one it has never heard of', () => {
    expect(recordCount(records, sessionOn('2026-06-22').id)).toBe(0)
    expect(recordCount(records, 'nope')).toBe(0)
    expect(recordCount([], sessionOn('2026-10-14').id)).toBe(0)
  })
})

describe('E18-T3 O7 per-lift bests table on the fixture', () => {
  const histories = {
    get: (id: string) => buildLiftHistories(sessions, resolve, planOf).get(id),
  }
  /** Parse the fixture's `value · Wed 14 Oct` into the numbers a BestRow carries. */
  function parseBest(name: string, v: string) {
    const [val, date] = v.split(' · ')
    if (name === 'Best estimated 1RM') return { e1rm: Number(val.replace(' kg', '')), date }
    if (name.startsWith('Most reps')) return { reps: Number(val), date }
    return { ...parseSet(val), date }
  }

  it('O7 equals brief-data records for all 14 lifts: labels in order, values, and dates', () => {
    for (const [id, lift] of Object.entries(expected.lifts)) {
      const rows = liftBests(histories.get(id)!)
      expect(
        rows.map((r) => r.label),
        id,
      ).toEqual(Object.keys(lift.records))
      for (const row of rows) {
        const want = parseBest(row.label, lift.records[row.label])
        expect(label(row.at), `${id} ${row.label} date`).toBe(want.date)
        if ('e1rm' in want) {
          expect(Math.abs((row.e1rm as number) - (want.e1rm as number)), `${id} ${row.label}`).toBeLessThan(0.051)
        }
        if ('reps' in want) expect(row.reps, `${id} ${row.label} reps`).toBe(want.reps)
        if ('lever' in want) expect(row.lever, `${id} ${row.label} lever`).toBe(want.lever)
      }
    }
  })

  it('O7 Back squat: Heaviest set 62.5 kg x 8 on Wed 14 Oct, best estimated 1RM 80.0 on Fri 9 Oct', () => {
    const rows = liftBests(histories.get('back-squat')!)
    expect(rows[0]).toMatchObject({ label: 'Heaviest set', lever: 62.5, reps: 8 })
    expect(label(rows[0].at)).toBe('Wed 14 Oct')
    expect(rows[1].label).toBe('Best estimated 1RM')
    expect(rows[1].e1rm).toBeCloseTo(80, 1)
    expect(label(rows[1].at)).toBe('Fri 9 Oct')
  })

  it('O7 Assisted pull-ups: Least assistance BW-19 x 6 on Mon 12 Oct, never a negative kilogram label', () => {
    const rows = liftBests(histories.get('assisted-pull-ups')!)
    expect(rows[0]).toMatchObject({ label: 'Least assistance', lever: -19, reps: 6 })
    expect(rows[1].label).toBe('Most reps at BW−19')
    expect(rows.every((r) => !/-\d+ kg/.test(r.label))).toBe(true)
  })

  it('O7 plain Bodyweight lifts show Most reps in a set, earliest date on a tie', () => {
    const rows = liftBests(histories.get('push-ups')!)
    expect(rows.map((r) => r.label)).toEqual(['Most reps in a set'])
    expect(rows[0].reps).toBe(17)
    expect(label(rows[0].at)).toBe('Mon 3 Aug')
  })

  it('O7 Bodyweight with Load shows added load, bodyweight-only reps and reps at the current lever', () => {
    const rows = liftBests(histories.get('hyper-extension')!)
    expect(rows.map((r) => r.label)).toEqual([
      'Heaviest added load',
      'Most reps, bodyweight only',
      'Most reps at BW+5',
    ])
    expect(rows[0]).toMatchObject({ lever: 5, reps: 12 })
    expect(rows[1].reps).toBe(15)
    expect(label(rows[1].at)).toBe('Mon 13 Jul')
    expect(label(rows[2].at)).toBe('Wed 7 Oct')
  })
})

describe('E18-T3 O5 rank order and failure paths on hand-built Sessions', () => {
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
  const plan = (id: string): ExercisePlan | undefined =>
    id === 'lift' ? { exerciseId: 'lift', sets: 3, repRange: [6, 8], restSeconds: 90 } : undefined
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
  const run = (list: Session[]) => computeRecords(list, res, plan)

  it('O5 the first Session of a lift is its baseline: no record', () => {
    expect(run([sess('a', 1000, [set('lift', 1, 50, 8)])])).toEqual([])
  })

  it('O5 a heavier top lever is a Heaviest weight record with the weight gained', () => {
    const r = run([
      sess('a', 1000, [set('lift', 1, 50, 8)]),
      sess('b', 2000, [set('lift', 1, 52.5, 6)]),
    ])
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ sessionId: 'b', kind: 'Heaviest weight', lever: 52.5, reps: 6, gain: 2.5 })
  })

  it('O5 more reps at a lever already lifted is a Rep record, and the highest lever wins among them', () => {
    const r = run([
      sess('a', 1000, [set('lift', 1, 40, 10), set('lift', 2, 50, 8)]),
      sess('b', 2000, [set('lift', 1, 40, 12), set('lift', 2, 50, 9)]),
    ])
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ kind: 'Rep record', lever: 50, reps: 9, gain: 1 })
  })

  it('O5 equal reps at the same lever is no record', () => {
    expect(
      run([sess('a', 1000, [set('lift', 1, 50, 8)]), sess('b', 2000, [set('lift', 1, 50, 8)])]),
    ).toEqual([])
  })

  it('O5 a heavier Session that also beats the 1RM is one Heaviest weight record, 1RM as alsoBeat', () => {
    const r = run([
      sess('a', 1000, [set('lift', 1, 50, 8)]),
      sess('b', 2000, [set('lift', 1, 52.5, 8)]),
    ])
    expect(r).toHaveLength(1)
    expect(r[0].kind).toBe('Heaviest weight')
    expect(r[0].alsoBeat.map((a) => a.kind)).toEqual(['Estimated 1RM'])
    expect(recordCount(r, 'b')).toBe(1)
  })

  it('O5 a drop set never sets a record, however heavy or long', () => {
    const r = run([
      sess('a', 1000, [set('lift', 1, 50, 8)]),
      sess('b', 2000, [set('lift', 1, 50, 8), set('lift', 2, 70, 15, { kind: 'drop' })]),
    ])
    expect(r).toEqual([])
  })

  it('O5 a warm-up never sets a record', () => {
    const r = run([
      sess('a', 1000, [set('lift', 1, 50, 8)]),
      sess('b', 2000, [set('lift', 1, 90, 5, { kind: 'warmup' }), set('lift', 2, 50, 8)]),
    ])
    expect(r).toEqual([])
  })

  it('O5 a deload Session sets no record, but its levers count as earlier for the next Session', () => {
    const r = run([
      sess('a', 1000, [set('lift', 1, 50, 8)]),
      sess('b', 2000, [set('lift', 1, 60, 8)], true),
      sess('c', 3000, [set('lift', 1, 60, 8)]),
    ])
    expect(r).toEqual([])
  })

  it('O5 assisted: less assistance is Least assistance, gain the kg of assistance dropped', () => {
    const r = run([
      sess('a', 1000, [set('pull', 1, null, 7, { loadKg: -21 })]),
      sess('b', 2000, [set('pull', 1, null, 5, { loadKg: -19 })]),
    ])
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ kind: 'Least assistance', lever: -19, reps: 5, gain: 2 })
  })

  it('O5 Bodyweight lift: first positive Load after bodyweight only is First added load', () => {
    const r = run([
      sess('a', 1000, [set('pull', 1, null, 15)]),
      sess('b', 2000, [set('pull', 1, null, 12, { loadKg: 5 })]),
    ])
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ kind: 'First added load', lever: 5, reps: 12, gain: 5 })
  })

  it('O5 plain Bodyweight lift: more reps is a Rep record gaining the reps', () => {
    const r = run([
      sess('a', 1000, [set('pull', 1, null, 12)]),
      sess('b', 2000, [set('pull', 1, null, 14)]),
    ])
    expect(r[0]).toMatchObject({ kind: 'Rep record', lever: 0, reps: 14, gain: 2 })
  })

  it('O5 skips an unresolvable Exercise and gives nothing for no Sessions', () => {
    expect(
      run([sess('a', 1000, [set('ghost', 1, 50, 8)]), sess('b', 2000, [set('ghost', 1, 60, 8)])]),
    ).toEqual([])
    expect(run([])).toEqual([])
  })
})
