// v7 Home (docs/design/competitors-2026-11/home/home.md §6): the landing dashboard's model at the
// five clocks of the design, over the stats Sessions (stats-45: a Mon/Wed/Fri A/B lifter).
import { describe, expect, it } from 'vitest'
import sessionsJson from '../../test/fixtures/stats/sessions.json'
import { loadCatalog, loadPrograms } from '../../data/catalog'
import type { Program, Session } from '../../types'
import { homeModelOf, shortLiftName, usualDays, type HomeInput } from './homeModel'

process.env.TZ = 'Asia/Jerusalem'

const sessions = sessionsJson as unknown as Session[]
const catalog = loadCatalog()
const programs = loadPrograms()
const program = programs.find((p) => p.id === 'assaf-ab-2026')!
const resolve = (id: string) => catalog.get(id)

const TRAINING = new Date(2026, 9, 16, 7, 40).getTime() // Fri 16 Oct
const REST = new Date(2026, 9, 15, 18, 5).getTime() // Thu 15 Oct
const BREAK = new Date(2026, 10, 9, 7, 40).getTime() // Mon 9 Nov
const DONE = new Date(2026, 9, 14, 19, 20).getTime() // Wed 14 Oct, A finished 18:55

function model(now: number, over: Partial<HomeInput> = {}) {
  return homeModelOf({
    program,
    programs,
    sessions: sessions.filter((s) => s.startedAt <= now),
    resolve,
    now,
    weekStartsOn: 1,
    reminders: null,
    live: false,
    ...over,
  })
}

describe('usualDays', () => {
  it('reads Mon, Wed and Fri for the stats lifter', () => {
    expect(usualDays(sessions, TRAINING, 1)).toEqual([1, 3, 5])
  })

  it('is empty for a trainee with no Sessions', () => {
    expect(usualDays([], TRAINING, 1)).toEqual([])
  })
})

describe('homeModelOf: the five moments', () => {
  it('(a) training day: Workout B, 2 of 3, curls up to 15 kg, an ink Start', () => {
    const m = model(TRAINING)
    expect(m.state).toBe('training')
    expect(m.date).toBe('Fri 16 Oct')
    expect(m.today.label).toBe('Today')
    expect(m.today.title).toBe('Workout B')
    expect(m.today.lines).toEqual(['7 lifts · about 66 min'])
    expect(m.today.up).toBe('Curls up to 15 kg')
    expect(m.today.ring).toEqual({
      done: 2,
      planned: 3,
      arcs: [{ kind: 'done', tone: 'pull' }, { kind: 'done', tone: 'push' }, { kind: 'due' }],
    })
    expect(m.today.target).toEqual({ kind: 'workout' })
    expect(m.lifts.verdict).toEqual({ text: '12 of 14 moving', tone: 'up' })
    expect(m.lifts.rows.map((r) => [r.letter, r.lines.length])).toEqual([
      ['A', 7],
      ['B', 7],
    ])
    expect(m.calendar.count).toBe(30)
    expect(m.calendar.weeks).toHaveLength(12)
    expect(m.calendar.months.filter(Boolean)).toEqual(['Aug', 'Sep', 'Oct'])
    expect(m.last).toMatchObject({ kind: 'session', day: 'Wed 14 Oct', detail: '71 min', up: { count: 5, of: 7 }, prs: 4 })
    expect(m.dock).toEqual({ kind: 'start', workoutId: 'workout-b', label: 'Start Workout B', style: 'ink' })
  })

  it('(b) rest day: On track, next Workout B on Friday, the Start bar as an outline', () => {
    const m = model(REST)
    expect(m.state).toBe('rest')
    expect(m.today).toMatchObject({ label: 'Rest day', title: 'On track', lines: ['Next: Workout B, Friday'] })
    expect(m.today.ring?.arcs.map((a) => a.kind)).toEqual(['done', 'done', 'open'])
    expect(m.dock).toMatchObject({ kind: 'start', label: 'Start Workout B', style: 'outline' })
  })

  it('(c) after 26 days off: Welcome back, eased loads, grey lines, no verdict on Last time', () => {
    const m = model(BREAK)
    expect(m.state).toBe('break')
    expect(m.today).toMatchObject({
      label: 'Welcome back',
      title: 'Workout B',
      lines: ['26 days off · loads eased 10 % for today'],
      up: null,
    })
    expect(m.today.ring).toMatchObject({ done: 0, planned: 3 })
    expect(m.today.ring?.arcs.map((a) => a.kind)).toEqual(['due', 'open', 'open'])
    expect(m.lifts.verdict).toEqual({ text: 'As you left them', tone: 'flat' })
    expect(m.lifts.rows.flatMap((r) => r.lines).every((l) => l.tone === 'grey' || l.tone === 'new')).toBe(true)
    expect(m.calendar.count).toBe(21)
    expect(m.last).toMatchObject({ kind: 'session', day: 'Wed 14 Oct', detail: '26 days ago', up: null, prs: 0 })
    expect(m.dock).toMatchObject({ kind: 'start', label: 'Start Workout B', style: 'ink' })
  })

  it('(d) just finished: Done today, 5 of 7 lifts up, 4 PRs, no Start bar', () => {
    const m = model(DONE)
    expect(m.state).toBe('done')
    expect(m.today).toMatchObject({ label: 'Done today', title: 'Workout A', lines: ['71 min · 23 sets'], up: '5 of 7 lifts', prs: 4 })
    expect(m.today.target).toMatchObject({ kind: 'session' })
    expect(m.today.ring?.arcs.map((a) => a.kind)).toEqual(['done', 'done', 'open'])
    const prLifts = m.lifts.rows.flatMap((r) => r.lines).filter((l) => l.pr).map((l) => l.exerciseId)
    expect(prLifts).toHaveLength(4)
    expect(m.last).toMatchObject({ kind: 'next', workoutName: 'Workout B', day: 'Friday' })
    expect(m.dock).toBeNull()
  })

  it('(e) a new trainee: pick a plan, an empty grid with today outlined, Start is the pick', () => {
    const m = homeModelOf({
      program: null,
      programs,
      sessions: [],
      resolve,
      now: TRAINING,
      weekStartsOn: 1,
      reminders: null,
      live: false,
    })
    expect(m.state).toBe('new')
    expect(m.today.label).toBe('Pick a plan')
    expect(m.plans.map((p) => p.name)).toEqual(programs.filter((p: Program) => !p.hidden).map((p) => p.name))
    expect(m.plans[0].firstWorkout).not.toBeNull()
    expect(m.calendar.count).toBe(0)
    expect(m.calendar.weeks.flatMap((w) => w.days).filter((d) => d.today)).toHaveLength(1)
    expect(m.last).toBeNull()
    expect(m.dock).toEqual({ kind: 'pick' })
  })

  it('a live Session is the Resume moment', () => {
    const m = model(TRAINING, { live: true })
    expect(m.state).toBe('live')
    expect(m.dock).toEqual({ kind: 'resume' })
  })
})

describe('homeModelOf: rest day or training day (§4)', () => {
  it('without Reminders a Thursday is a rest day for a Mon/Wed/Fri lifter', () => {
    expect(model(REST).state).toBe('rest')
  })

  it('Reminders on Thursday make Thursday a training day', () => {
    expect(model(REST, { reminders: [4] }).state).toBe('training')
  })

  it('Reminders on Mon/Wed only make Friday a rest day', () => {
    expect(model(TRAINING, { reminders: [1, 3] }).state).toBe('rest')
  })

  it('a week already at its planned count makes the rest of the week rest days', () => {
    const extra: Session = {
      id: 'extra-thu',
      programId: program.id,
      workoutId: 'workout-b',
      startedAt: new Date(2026, 9, 15, 8).getTime(),
      finishedAt: new Date(2026, 9, 15, 9).getTime(),
      entries: [],
    }
    const m = model(TRAINING, { sessions: [...sessions.filter((s) => s.startedAt <= TRAINING), extra] })
    expect(m.state).toBe('rest')
    expect(m.today.title).toBe('On track')
  })

  it('a behind-pace week says what is next and never "On track"', () => {
    // Only Monday's Session this week, read on Thursday with Friday the only training day left.
    const behind = sessions.filter((s) => s.startedAt < new Date(2026, 9, 13).getTime())
    const m = model(REST, { sessions: behind })
    expect(m.state).toBe('rest')
    expect(m.today.title).not.toBe('On track')
    expect(m.today.lines).toEqual(['Next: Friday'])
  })
})

describe('homeModelOf: PRs', () => {
  it('a rep best never counts toward the PR tag (DB bench 13 × 9 on Wed 14 Oct)', () => {
    const m = model(DONE)
    const bench = m.lifts.rows.flatMap((r) => r.lines).find((l) => l.exerciseId === 'db-bench-press')!
    expect(bench.pr).toBe(false)
    expect(m.today.prs).toBe(4)
  })
})

describe('shortLiftName', () => {
  it('keeps a short name and shortens a long one to its noun', () => {
    expect(shortLiftName('Seated biceps curls')).toBe('Curls')
    expect(shortLiftName('Back squat')).toBe('Back squat')
  })
})
