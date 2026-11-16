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
  stallSuggestion,
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
    // v6: the counts are each lift's one status (status.ts).
    expect(home.stage).toBe('full')
    expect(home.sentence).toBe('10 of 14 lifts moving.')
    expect(home.counts).toBe('= 1 stalled · ↓ 1 lowered · ↑ 2 ready · ↑ 10 moving')
    expect(home.climbed).toBe('12 of 14 lifts stepped up since Fri 18 Sep.')
    expect(home.adherence).toBe('2 of 3 this week')
  })

  it('V3-11 the lead line joins the verdict and the climbed clause in one sentence', () => {
    // v6 §6.2: one true headline -- this week's sessions and how many lifts need a decision.
    expect(home.lead).toBe('This week 2 of 3 sessions · 4 lifts need a decision')
  })

  it('O11 the attention list is slipping, then stalled by longest stall, then ready', () => {
    // v6 §6.2: one card per lift, Break > Slipping > Stalled > Lowered > Ready > Hold, at most 4.
    expect(home.cards.map((c) => [c.exerciseId, c.kind])).toEqual([
      ['db-bench-press', 'stalled'],
      ['narrow-grip-pull-down', 'lowered'],
      ['push-ups', 'ready'],
      ['seated-biceps-curls', 'ready'],
    ])
    expect(new Set(home.cards.map((c) => c.exerciseId)).size).toBe(home.cards.length)
    expect(home.moreDecisions).toBe(0)
  })

  it('O11 a slipping card quotes the first slipping Session\'s note, cut to three words', () => {
    // v6: a lowered load is "Lowered", never slipping; its visible evidence quotes the note's
    // first 6 words and its Why? the whole note (V6-07).
    const pullDown = home.cards[1]
    expect(pullDown.label).toBe('Lowered')
    expect(pullDown.evidence).toBe('46.25 kg × 9 · down from 47.5 kg on Wed 7 Oct · note: “Right elbow sore on pull-downs, dropped…”')
    expect(pullDown.suggestion).toBe('Stay at 46.25 kg until all 3 sets reach 12.')
  })

  it('O11 a stalled card gives its weeks whole, its sessions and its date', () => {
    const bench = home.cards[0]
    expect(bench.label).toBe('Stalled')
    expect(bench.evidence).toBe('13 kg × 9 · no new best since Fri 7 Aug')
    expect(bench.suggestion).toBe('Try a variation for 4 weeks.')
    expect(bench.swap).toBe(true)
  })

  it('O11 a ready card is phrased as a suggestion', () => {
    const curls = home.cards[3]
    expect(curls.evidence).toBe('14 kg × 12·12·12 on Mon 12 Oct')
    expect(curls.suggestion).toBe('Next time: 15 kg.')
  })

  it('O11 a stalled card\'s Why? holds the rule, the 4 Sessions\' top sets and the bar to clear', () => {
    const why = home.cards[0].why
    for (const line of lastFour('db-bench-press')) expect(why.some((l) => l.startsWith(line))).toBe(true)
    expect(why[0]).toContain('A new best needs 13 kg × 10.')
    expect(why.at(-1)).toBe('Try a variation for 4 weeks.')
    expect(why).toHaveLength(6) // rule + 4 sessions + action
  })

  it('O11 a Bodyweight stall states its bar in reps of one set', () => {
    // v6: Push-ups at 15 in every first set on a 10–15 plan are Ready, not stalled.
    const pushUps = home.cards[2]
    expect(pushUps.label).toBe('Ready')
    expect(pushUps.suggestion).toBe('Add load or a harder variation.')
    expect(pushUps.swap).toBe(true)
  })

  it('O11 a slipping card\'s Why? shows the 4 top sets and the best to get back to', () => {
    const why = home.cards[1].why
    expect(why[0]).toContain('the app moves you back up to 47.5 kg')
    expect(why).toContain('Mon 12 Oct · 46.25 kg × 9·8·8')
  })

  it('R-C no sentence of the home has an exclamation mark', () => {
    const all = [home.sentence, home.counts, home.climbed, home.adherence, home.lead, ...home.cards.flatMap((c) => [c.evidence, c.suggestion, ...c.why])]
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

describe('E19 O4 the home follows the week start', () => {
  it('E19 O4 with Wednesday the adherence on Thu 15 Oct is 1 of 3 this week', () => {
    expect(homeCopy(program, fixtureSessions, resolve, NOW, 3).adherence).toBe('1 of 3 this week')
  })

  it('E19 O4 without a week start it is still 2 of 3 this week', () => {
    expect(homeCopy(program, fixtureSessions, resolve, NOW).adherence).toBe('2 of 3 this week')
  })
})

describe('E21-T3 O8 a stalled lift names its deload weight', () => {
  const histories = buildLiftHistories(fixtureSessions, resolve, planOf)

  it('O8 stallSuggestion of a stalled loaded lift names the deload weight of its top lever', () => {
    expect(stallSuggestion(histories.get('db-bench-press')!, resolve('db-bench-press')!)).toBe(
      'Try a deload: 12 kg for one session',
    )
  })

  it('O8 stallSuggestion of a stalled Bodyweight lift keeps the lighter-week line', () => {
    expect(stallSuggestion(histories.get('push-ups')!, resolve('push-ups')!)).toBe(
      'Consider a lighter week or a variation',
    )
  })

  it('O8 the stalled cards: loaded names the deload weight, Bodyweight keeps the line; Why? unchanged', () => {
    // v6 (V6-04): one action per status, from status.ts. DB bench press already had a deload
    // inside its stall, so it is offered a variation, not another deload; with that deload
    // gone it is offered one deload at 12 kg. No card offers "a lighter week" any more.
    const home = homeCopy(program, fixtureSessions, resolve, NOW)
    const bench = home.cards.find((c) => c.exerciseId === 'db-bench-press')!
    expect(bench.suggestion).toBe('Try a variation for 4 weeks.')
    expect(home.cards.map((c) => c.suggestion)).not.toContain('Consider a lighter week or a variation')
    const noDeload = homeCopy(program, fixtureSessions.filter((s) => !s.deload), resolve, NOW)
    expect(noDeload.cards.find((c) => c.exerciseId === 'db-bench-press')!.suggestion).toBe(
      'Deload once: 12 kg x 10, then back to 13 kg.'.replace(' x ', ' \u00d7 '),
    )
  })
})

describe('E21-T3 O9 two steps and hold in words', () => {
  const step = (over: Partial<NextStep>): NextStep => ({ repsAtTop: 30, target: 30, lever: 65, ready: true, ...over })

  it('O9 two steps read "Try 67.5 kg next · 2 steps"', () => {
    expect(suggestionText(step({ steps: 2, suggest: { kind: 'lever', lever: 67.5 } }), false)).toBe(
      'Try 67.5 kg next · 2 steps',
    )
  })

  it('O9 one step reads as today', () => {
    expect(suggestionText(step({ suggest: { kind: 'lever', lever: 67.5 } }), false)).toBe('Try 67.5 kg next')
  })

  it('O9 a hold reads "Stay at 60 kg: every set at RIR 0" from the step lever', () => {
    expect(suggestionText(step({ lever: 60, ready: false, hold: true }), false)).toBe(
      'Stay at 60 kg: every set at RIR 0',
    )
  })

  const withCurlsRir = (rir: 0 | 2) =>
    fixtureSessions.map((s) =>
      s.id !== 'seed-43'
        ? s
        : { ...s, entries: s.entries.map((e) => (e.exerciseId === 'seated-biceps-curls' ? { ...e, rir } : e)) },
    )

  it('O9 a held lift is not counted ready and gets no card', () => {
    // v6: a full bar with every set at RIR 0 is Hold, not Ready: it gets no Ready card, but its
    // own Hold card (Hold needs a decision too, section 6.2).
    const home = homeCopy(program, withCurlsRir(0), resolve, NOW)
    expect(home.statuses.get('seated-biceps-curls')!.label).toBe('Hold')
    expect(home.statuses.get('seated-biceps-curls')!.action).toBe('Next time: 14 kg again, with a rep to spare.')
    expect(home.cards.some((c) => c.exerciseId === 'seated-biceps-curls' && c.kind === 'ready')).toBe(false)
  })

  it('O9 an easy full bar is counted ready and its card reads two steps', () => {
    const home = homeCopy(program, withCurlsRir(2), resolve, NOW)
    expect(home.statuses.get('seated-biceps-curls')!.label).toBe('Ready')
    expect(home.cards.find((c) => c.exerciseId === 'seated-biceps-curls')!.suggestion).toBe('Next time: 16 kg.')
  })
})
