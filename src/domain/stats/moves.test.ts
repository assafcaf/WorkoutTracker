// E18-T7 [O18 O25 O26]: a Session in words (moves, Next time, the volume line, the week heading)
// against the stats fixture. Expected strings are the spec's / brief's literals or read from
// expected.json, never built by the code under test.
import { describe, expect, it } from 'vitest'
import expectedJson from '../../test/fixtures/stats/expected.json'
import sessionsJson from '../../test/fixtures/stats/sessions.json'
import { loadCatalog, loadPrograms } from '../../data/catalog'
import type { Session } from '../../types'
import { nextTime, sessionMoves, summaryWeek, volumeLine } from './moves'

process.env.TZ = 'Asia/Jerusalem' // the zone the fixture was written in

const fixtureSessions = sessionsJson as unknown as Session[]
const expectedSessions = (expectedJson as unknown as { sessions: { label: string }[] }).sessions
const catalog = loadCatalog()
const resolve = (id: string) => catalog.get(id)
const program = loadPrograms().find((p) => p.id === 'assaf-ab-2026')!

/** The fixture Session shown in expected.json as `label` (same order in both files). */
const idOf = (label: string): string => {
  const i = expectedSessions.findIndex((s) => s.label === label)
  if (i < 0) throw new Error(`no fixture Session ${label}`)
  return fixtureSessions[i].id
}
const movesOf = (label: string, sessions: Session[] = fixtureSessions) =>
  Object.fromEntries(sessionMoves(idOf(label), sessions, resolve, program).map((m) => [m.exerciseId, m]))

describe('E18-T7 O18 moves of Wed 14 Oct (Workout A) in words', () => {
  const moves = sessionMoves(idOf('Wed 14 Oct'), fixtureSessions, resolve, program)
  const by = Object.fromEntries(moves.map((m) => [m.exerciseId, m.text]))

  it('O18 lists the Session\'s lifts in Plan order with their names and top sets', () => {
    expect(moves.map((m) => m.exerciseId)).toEqual([
      'back-squat', 'lunges', 'db-bench-press', 'push-ups',
      'machine-shoulder-press', 'lateral-raises', 'cable-push-down',
    ])
    expect(moves[0]).toMatchObject({ name: 'Back squat', top: '62.5 kg × 8' })
    expect(moves[3]).toMatchObject({ name: 'Push-ups', top: 'BW × 15' })
  })

  it('O18 a heavier top set reads "Stepped up to <lever> · +<gain> · record"', () => {
    expect(by['back-squat']).toBe('Stepped up to 62.5 kg · +2.5 kg · record')
    expect(by['lunges']).toBe('Stepped up to 13 kg · +1 kg · record')
    expect(by['machine-shoulder-press']).toBe('Stepped up to 12.5 kg · +1.25 kg · record')
    expect(by['cable-push-down']).toBe('Stepped up to 32.5 kg · +2.5 kg · record')
  })

  it('O18 a stalled lift at the same weight reads "Held <lever> · <reps of target> · stalled <n> sessions"', () => {
    expect(by['db-bench-press']).toBe('Held 13 kg · 33 of 40 · stalled 10 sessions')
  })

  it('O18 fewer total reps at the same lever reads "Fewer reps · <now> vs <before>", even when stalled', () => {
    expect(by['push-ups']).toBe('Fewer reps · 44 vs 47')
  })

  it('O18 the same straight sets read "Same"; a drop set adds nothing', () => {
    expect(by['lateral-raises']).toBe('Same')
  })
})

describe('E18-T7 O18 other kinds of move', () => {
  it('O18 less assistance and a first added load name their R-R gain', () => {
    const m = movesOf('Wed 7 Oct')
    expect(m['assisted-pull-ups'].text).toBe('Stepped up to BW−19 · −2 kg assistance · record')
    expect(m['hyper-extension'].text).toBe('Stepped up to BW+5 · +5 kg · record')
  })

  it('O18 a lower top lever reads "Stepped down to <lever> · −<diff>", with no record', () => {
    expect(movesOf('Wed 7 Oct')['narrow-grip-pull-down'].text).toBe('Stepped down to 46.25 kg · −1.25 kg')
  })

  it('O18 the Session after a deload compares with the last non-deload Session of the lift', () => {
    expect(movesOf('Mon 28 Sep')['deadlift'].text).toBe('Stepped up to 67.5 kg · +2.5 kg · record')
  })

  it('O18 a deload Session\'s lifts read "Deload" and are not compared', () => {
    const texts = sessionMoves(idOf('Mon 21 Sep'), fixtureSessions, resolve, program).map((m) => m.text)
    expect(texts.length).toBeGreaterThan(0)
    expect(new Set(texts)).toEqual(new Set(['Deload']))
  })

  it('O18 a lift\'s first Session reads "First session" (a baseline, not a record)', () => {
    const texts = sessionMoves(idOf('Mon 22 Jun'), fixtureSessions, resolve, program).map((m) => m.text)
    expect(texts.length).toBe(7)
    expect(new Set(texts)).toEqual(new Set(['First session']))
  })

  it('O18 later Sessions are ignored: Wed 14 Oct read from the first 44 Sessions gives the same moves', () => {
    const upTo = fixtureSessions.slice(0, expectedSessions.findIndex((s) => s.label === 'Wed 14 Oct') + 1)
    expect(Object.keys(movesOf('Wed 14 Oct', upTo))).toHaveLength(7)
    expect(movesOf('Wed 14 Oct', upTo)).toEqual(movesOf('Wed 14 Oct'))
    const earlier = fixtureSessions.slice(0, expectedSessions.findIndex((s) => s.label === 'Fri 9 Oct') + 1)
    expect(movesOf('Fri 9 Oct', earlier)).toEqual(movesOf('Fri 9 Oct'))
  })
})

describe('E18-T7 O18 Next time of Wed 14 Oct', () => {
  const lines = nextTime(idOf('Wed 14 Oct'), fixtureSessions, resolve, program)

  it('O18 names each of the Session\'s lifts with its next step', () => {
    expect(lines).toContain('Back squat · 15 of 20 reps at 62.5 kg')
    expect(lines).toContain('Push-ups · 44 of 45 reps at BW')
  })

  it('O18 adds a ready lift of the other Workout as "<name> is ready for <next lever>"', () => {
    expect(lines).toContain('Seated biceps curls is ready for 15 kg')
  })

  it('O18 holds the 7 lifts of the Session and the one ready lift, nothing else', () => {
    expect(lines).toHaveLength(8)
  })
})

describe('E18-T7 O25 the volume line compares a Workout with its own kind', () => {
  it('O18 Wed 14 Oct reads "4,185 kg · down 10 % on Fri 9 Oct" (A with A)', () => {
    expect(volumeLine(idOf('Wed 14 Oct'), fixtureSessions, resolve)).toBe('4,185 kg · down 10 % on Fri 9 Oct')
  })

  it('O25 Fri 9 Oct (A) compares with Mon 5 Oct, not with Wed 7 Oct (B): up 8 %', () => {
    expect(volumeLine(idOf('Fri 9 Oct'), fixtureSessions, resolve)).toBe('4,669 kg · up 8 % on Mon 5 Oct')
  })

  it('O25 Mon 12 Oct (B) compares with Wed 7 Oct (B): down 2 %', () => {
    expect(volumeLine(idOf('Mon 12 Oct'), fixtureSessions, resolve)).toBe('6,815 kg · down 2 % on Wed 7 Oct')
  })

  it('O25 a change that rounds to 0 % reads "same as <date>"', () => {
    expect(volumeLine(idOf('Wed 7 Oct'), fixtureSessions, resolve)).toBe('6,929 kg · same as Fri 2 Oct')
  })

  it('O25 the first Session of its Workout has no comparison', () => {
    expect(volumeLine(idOf('Mon 22 Jun'), fixtureSessions, resolve)).toBe('2,632 kg')
  })
})

describe('E18-T7 O26 the summary week heading', () => {
  it('O26 Wed 14 Oct reads "What Wed did for your week" and "2 of 3 sessions · 47 of 69 sets"', () => {
    expect(summaryWeek(idOf('Wed 14 Oct'), fixtureSessions, program)).toEqual({
      heading: 'What Wed did for your week',
      line: '2 of 3 sessions · 47 of 69 sets',
    })
  })

  it('O26 counts only Sessions up to the one named: Mon 22 Jun is 1 of 3 sessions, 24 of 69 sets', () => {
    expect(summaryWeek(idOf('Mon 22 Jun'), fixtureSessions, program)).toEqual({
      heading: 'What Mon did for your week',
      line: '1 of 3 sessions · 24 of 69 sets',
    })
  })
})
