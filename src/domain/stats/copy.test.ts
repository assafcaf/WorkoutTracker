// E18-T7 [O11 R-C]: the home's generated sentences, the number formats and the small text helpers.
// Expected strings are the spec's / brief's literals or read from expected.json, never built by
// the code under test.
import { describe, expect, it } from 'vitest'
import expectedJson from '../../test/fixtures/stats/expected.json'
import sessionsJson from '../../test/fixtures/stats/sessions.json'
import { loadCatalog, loadPrograms } from '../../data/catalog'
import type { ExercisePlan, Session } from '../../types'
import {
  compareText,
  homeCopy,
  humanDate,
  leverText,
  nextStepText,
  suggestionText,
  topText,
  verdictLabel,
} from './copy'
import { buildLiftHistories } from './liftHistory'
import { compareAgo } from './ladder'
import type { Compare } from './ladder'
import type { NextStep } from './verdict'

process.env.TZ = 'Asia/Jerusalem' // the zone the fixture was written in

type Point = { label: string; deload: boolean; top: string | null }
type Lift = { prescription: string; points: Point[] }
const expectedLifts = (expectedJson as unknown as { lifts: Record<string, Lift> }).lifts
const fixtureSessions = sessionsJson as unknown as Session[]

const catalog = loadCatalog()
const resolve = (id: string) => catalog.get(id)
const program = loadPrograms().find((p) => p.id === 'assaf-ab-2026')!
const plans = new Map<string, ExercisePlan>()
for (const w of program.workouts) for (const e of w.exercises) plans.set(e.exerciseId, e)
const planOf = (id: string) => plans.get(id)
const planIds = program.workouts.flatMap((w) => w.exercises.map((e) => e.exerciseId))

const NOW = new Date(2026, 9, 15, 18, 5).getTime() // Thu 15 Oct 2026
/** "Wed 14 Oct · 13 kg × 9" for each of the lift's last 4 non-deload points (expected.json). */
const lastFour = (id: string) =>
  expectedLifts[id].points.filter((p) => !p.deload).slice(-4).map((p) => `${p.label} · ${p.top}`)

describe('E18-T7 R-C number and word formats', () => {
  it('R-C lever: kilograms, BW, BW+n, BW−n with U+2212, never a negative kilogram', () => {
    expect(leverText(62.5, false)).toBe('62.5 kg')
    expect(leverText(13, false)).toBe('13 kg')
    expect(leverText(46.25, false)).toBe('46.25 kg')
    expect(leverText(0, true)).toBe('BW')
    expect(leverText(5, true)).toBe('BW+5')
    expect(leverText(-19, true)).toBe('BW−19')
  })

  it('R-C top set: "<lever> × <reps>" with U+00D7', () => {
    expect(topText({ lever: 13, reps: 9 }, false)).toBe('13 kg × 9')
    expect(topText({ lever: 0, reps: 15 }, true)).toBe('BW × 15')
    expect(topText({ lever: -19, reps: 6 }, true)).toBe('BW−19 × 6')
  })

  it('R-C dates are human, local time, never ISO: "Wed 14 Oct"', () => {
    expect(humanDate(new Date(2026, 9, 14, 17, 44).getTime())).toBe('Wed 14 Oct')
    expect(humanDate(new Date(2026, 5, 22, 23, 59).getTime())).toBe('Mon 22 Jun')
  })

  it('R-C verdict words and glyphs exactly', () => {
    expect(verdictLabel('moving')).toBe('▲ Moving')
    expect(verdictLabel('stalled')).toBe('■ Stalled')
    expect(verdictLabel('slipping')).toBe('▼ Slipping')
    expect(verdictLabel('too new')).toBe('○ Too new')
  })
})

describe('E18-T7 O18 next step and suggestion text', () => {
  const step = (over: Partial<NextStep>): NextStep => ({ repsAtTop: 15, target: 20, lever: 62.5, ready: false, ...over })

  it('O18 a step in progress reads "<reps> of <target> reps at <lever>" and offers no suggestion', () => {
    expect(nextStepText(step({}), false)).toBe('15 of 20 reps at 62.5 kg')
    expect(nextStepText(step({ repsAtTop: 44, target: 45, lever: 0 }), true)).toBe('44 of 45 reps at BW')
    expect(suggestionText(step({}), false)).toBeNull()
  })

  it('O18 a ready loaded lift is phrased as a suggestion: "Try 15 kg next"', () => {
    const ready = step({ repsAtTop: 36, target: 36, lever: 14, ready: true, suggest: { kind: 'lever', lever: 15 } })
    expect(nextStepText(ready, false)).toBe('36 of 36 reps at 14 kg')
    expect(suggestionText(ready, false)).toBe('Try 15 kg next')
  })

  it('O18 a ready Bodyweight lift with Load suggests the next Load; a plain one suggests a set', () => {
    const assisted = step({ lever: -19, ready: true, suggest: { kind: 'lever', lever: -17 } })
    expect(suggestionText(assisted, true)).toBe('Try BW−17 next')
    const plain = step({ lever: 0, repsAtTop: 45, target: 45, ready: true, suggest: { kind: 'set' } })
    expect(suggestionText(plain, true)).toBe('Try one more set next')
  })
})

describe('E18-T7 O21 the "4 weeks ago" compare text', () => {
  it('O21 an unchanged top set reads "13 × 9 → 13 × 9 · no change" (fixture, DB bench press)', () => {
    const history = buildLiftHistories(fixtureSessions, resolve, planOf).get('db-bench-press')!
    expect(compareText(compareAgo(history, NOW), false)).toBe('13 × 9 → 13 × 9 · no change')
  })

  it('O21 up and down name the direction; Bodyweight levers keep their BW label', () => {
    const side = (lever: number, reps: number) => ({ sessionId: 's', startedAt: 0, lever, reps })
    const up: Compare = { then: side(60, 10), now: side(62.5, 8), change: 'up' }
    const down: Compare = { then: side(47.5, 10), now: side(46.25, 9), change: 'down' }
    const assisted: Compare = { then: side(-21, 8), now: side(-19, 6), change: 'up' }
    expect(compareText(up, false)).toBe('60 × 10 → 62.5 × 8 · up')
    expect(compareText(down, false)).toBe('47.5 × 10 → 46.25 × 9 · down')
    expect(compareText(assisted, true)).toBe('BW−21 × 8 → BW−19 × 6 · up')
  })

  it('O21 no compare (before the 4th Session) gives no text', () => {
    expect(compareText(null, false)).toBeNull()
  })
})

describe('E18-T7 O11 the home on the fixture at Thu 15 Oct 18:05', () => {
  const home = homeCopy(program, fixtureSessions, resolve, NOW)

  it('O11 is the full home; the verdict sentence, count row, climbed clause and adherence come from the engine', () => {
    expect(home.stage).toBe('full')
    expect(home.sentence).toBe('11 of 14 lifts moving.')
    expect(home.counts).toBe('▲ 11 moving · ■ 2 stalled · ▼ 1 slipping · ↑ 1 ready')
    expect(home.climbed).toBe('12 of 14 lifts stepped up since Fri 18 Sep.')
    expect(home.adherence).toBe('2 of 3 this week')
  })

  it('O11 the attention list is slipping, then stalled by longest stall, then ready', () => {
    expect(home.cards.map((c) => [c.exerciseId, c.kind])).toEqual([
      ['narrow-grip-pull-down', 'slipping'],
      ['push-ups', 'stalled'],
      ['db-bench-press', 'stalled'],
      ['seated-biceps-curls', 'ready'],
    ])
  })

  it('O11 a slipping card quotes the first slipping Session\'s note, cut to three words', () => {
    const card = home.cards[0]
    expect(card.sentence).toBe(
      "Narrow-grip pull-down: slipping, 46.25 kg × 9 on Mon 12 Oct, below 47.5 kg × 10 on Mon 28 Sep, after 'Right elbow sore…'",
    )
    expect(card.suggestion).toBe('Consider a lighter week or a variation')
  })

  it('O11 a stalled card gives its weeks whole, its sessions and its date', () => {
    expect(home.cards[1].sentence).toBe('Push-ups: stalled for 10 weeks, 11 sessions without a record since Mon 3 Aug.')
    expect(home.cards[2].sentence).toBe('DB bench press: stalled for 10 weeks, 10 sessions without a record since Fri 7 Aug.')
    expect(home.cards[2].suggestion).toBe('Consider a lighter week or a variation')
  })

  it('O11 a ready card is phrased as a suggestion', () => {
    expect(home.cards[3].sentence).toBe('Seated biceps curls: ready, 36 of 36 reps at 14 kg.')
    expect(home.cards[3].suggestion).toBe('Try 15 kg next')
  })

  it('O11 a stalled card\'s Why? holds the rule, the 4 Sessions\' top sets and the bar to clear', () => {
    const why = home.cards[2].why
    for (const line of lastFour('db-bench-press')) expect(why).toContain(line)
    expect(why.some((l) => l.includes('A record needs 13 kg × 10'))).toBe(true)
    expect(why.length).toBeGreaterThanOrEqual(6) // rule + 4 top sets + bar
  })

  it('O11 a Bodyweight stall states its bar in reps of one set', () => {
    const why = home.cards[1].why
    for (const line of lastFour('push-ups')) expect(why).toContain(line)
    expect(why.some((l) => l.includes('A record needs 18 reps in one set'))).toBe(true)
  })

  it('O11 a slipping card\'s Why? shows the 4 top sets and the best to get back to', () => {
    const why = home.cards[0].why
    for (const line of lastFour('narrow-grip-pull-down')) expect(why).toContain(line)
    expect(why.some((l) => l.includes('47.5 kg × 10'))).toBe(true)
  })

  it('R-C no sentence of the home has an exclamation mark', () => {
    const all = [home.sentence, home.counts, home.climbed, home.adherence, ...home.cards.flatMap((c) => [c.sentence, c.suggestion, ...c.why])]
    expect(all.filter((s) => s !== '')).not.toHaveLength(0)
    expect(all.filter((s) => s.includes('!'))).toEqual([])
  })
})

describe('E18-T7 O11 the sparse homes', () => {
  const firstN = (n: number) => fixtureSessions.slice(0, n)
  const NOW_1 = new Date(2026, 5, 23, 12).getTime() // Tue 23 Jun, a day after the first Session
  const NOW_3 = new Date(2026, 5, 27, 12).getTime() // Sat 27 Jun

  it('O11 with no Sessions: the expectation list, no cards, no starting points', () => {
    const home = homeCopy(program, [], resolve, NOW)
    expect(home.stage).toBe('empty')
    expect(home.expectations.length).toBeGreaterThan(0)
    expect(home.cards).toEqual([])
    expect(home.startingPoints).toEqual([])
    expect(home.counts).toBe('')
  })

  it('O11 with 1 Session: every lift of the Plan as a starting point; unlogged lifts show their prescription', () => {
    const home = homeCopy(program, firstN(1), resolve, NOW_1)
    expect(home.stage).toBe('starting')
    expect(home.startingPoints.map((p) => p.exerciseId)).toEqual(planIds)
    const by = Object.fromEntries(home.startingPoints.map((p) => [p.exerciseId, p]))
    expect(by['back-squat']).toMatchObject({ name: 'Back squat', value: '50 kg × 7', note: 'Too new · 3 more' })
    expect(by['deadlift'].value).toBe(expectedLifts['deadlift'].prescription)
    expect(by['deadlift'].note).toBe('')
    expect(home.cards).toEqual([])
  })

  it('O11 with 3 Sessions: "Too early to call", A lifts 2 more, B lifts 3 more, no delta anywhere', () => {
    const home = homeCopy(program, firstN(3), resolve, NOW_3)
    expect(home.stage).toBe('early')
    expect(home.sentence).toBe('Too early to call')
    const by = Object.fromEntries(home.startingPoints.map((p) => [p.exerciseId, p]))
    expect(by['back-squat']).toMatchObject({ value: '50 kg × 8', note: 'Too new · 2 more' })
    expect(by['deadlift']).toMatchObject({ value: '55 kg × 8', note: 'Too new · 3 more' })
    expect(home.cards).toEqual([])
    expect(home.counts).toBe('')
    expect(home.climbed).toBe('')
    const text = JSON.stringify(home)
    expect(text).not.toContain('→')
    expect(text).not.toContain('stalled')
    expect(text).not.toContain('slipping')
  })
})
