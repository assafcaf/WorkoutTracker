import { describe, expect, it } from 'vitest'
import type { Session } from '../../types'
import type { ImportDraft } from './types'
import { buildSessions, skipDuplicates } from './sessions'

const T0 = Date.UTC(2024, 2, 5, 10, 0, 0)
const NOW = 1_800_000_000_000
const isBw = (id: string) => id === 'pull-up'
let n = 0
const newId = () => `id${++n}`

function draft(over: Partial<ImportDraft> = {}): ImportDraft {
  return {
    workoutName: 'Push Day',
    startedAt: T0,
    finishedAt: T0 + 3_600_000,
    sets: [{ name: 'Bench', weightKg: 80, reps: 5 }],
    ...over,
  }
}
const build = (drafts: ImportDraft[], choices: Record<string, string | null>, source: 'Strong' | 'Hevy' = 'Strong') =>
  buildSessions(drafts, choices, source, NOW, newId, isBw)

describe('buildSessions', () => {
  it('O11: builds a Session with programId Strong or Hevy, workoutId the workout name, updatedAt now', () => {
    const r = build([draft()], { Bench: 'bench-press' })
    expect(r.sessions).toHaveLength(1)
    const s = r.sessions[0]
    expect(s.programId).toBe('Strong')
    expect(s.workoutId).toBe('Push Day')
    expect(s.updatedAt).toBe(NOW)
    expect(s.startedAt).toBe(T0)
    expect(s.id).toMatch(/^id\d+$/)
    expect(build([draft()], { Bench: 'bench-press' }, 'Hevy').sessions[0].programId).toBe('Hevy')
  })

  it('O11: a blank workout name becomes Imported workout', () => {
    expect(build([draft({ workoutName: '  ' })], { Bench: 'bench-press' }).sessions[0].workoutId).toBe('Imported workout')
    expect(build([draft({ workoutName: '' })], { Bench: 'bench-press' }).sessions[0].workoutId).toBe('Imported workout')
  })

  it('O11: cuts the note to 500 characters and leaves it absent when none', () => {
    const long = build([draft({ note: 'x'.repeat(800) })], { Bench: 'bench-press' }).sessions[0]
    expect(long.note).toBe('x'.repeat(500))
    expect(build([draft()], { Bench: 'bench-press' }).sessions[0].note).toBeUndefined()
  })

  it('O11: numbers Sets per Exercise from 1 in file order, one second apart from the start', () => {
    const d = draft({
      sets: [
        { name: 'Bench', weightKg: 80, reps: 5 },
        { name: 'Squat', weightKg: 100, reps: 5 },
        { name: 'Bench', weightKg: 82.5, reps: 4 },
      ],
    })
    const e = build([d], { Bench: 'bench-press', Squat: 'back-squat' }).sessions[0].entries
    expect(e.map((x) => [x.exerciseId, x.setIndex, x.weightKg, x.reps])).toEqual([
      ['bench-press', 1, 80, 5],
      ['back-squat', 1, 100, 5],
      ['bench-press', 2, 82.5, 4],
    ])
    expect(e[1].loggedAt - e[0].loggedAt).toBe(1000)
    expect(e[2].loggedAt - e[1].loggedAt).toBe(1000)
    expect(e[0].loggedAt).toBeGreaterThanOrEqual(T0)
    expect(e[0].loggedAt).toBeLessThanOrEqual(T0 + 1000)
  })

  it('O11: kind only when not working, rir only when known', () => {
    const d = draft({
      sets: [
        { name: 'Bench', weightKg: 60, reps: 8, kind: 'warmup' },
        { name: 'Bench', weightKg: 80, reps: 5, kind: undefined, rir: 2 },
        { name: 'Bench', weightKg: 80, reps: 5 },
      ],
    })
    const e = build([d], { Bench: 'bench-press' }).sessions[0].entries
    expect(e[0].kind).toBe('warmup')
    expect('rir' in e[0]).toBe(false)
    expect('kind' in e[1]).toBe(false)
    expect(e[1].rir).toBe(2)
    expect('kind' in e[2]).toBe(false)
    expect('rir' in e[2]).toBe(false)
  })

  it('O11: two source names chosen as the same Exercise merge in file order', () => {
    const d = draft({
      sets: [
        { name: 'Bench', weightKg: 80, reps: 5 },
        { name: 'Bench Press (Barbell)', weightKg: 85, reps: 3 },
      ],
    })
    const e = build([d], { Bench: 'bench-press', 'Bench Press (Barbell)': 'bench-press' }).sessions[0].entries
    expect(e.map((x) => [x.exerciseId, x.setIndex, x.weightKg])).toEqual([
      ['bench-press', 1, 80],
      ['bench-press', 2, 85],
    ])
  })

  it('O11: on a Bodyweight Exercise a weight above 0 becomes loadKg and weightKg is null', () => {
    const d = draft({
      sets: [
        { name: 'Pull', weightKg: 10, reps: 6 },
        { name: 'Pull', weightKg: 0, reps: 8 },
        { name: 'Pull', weightKg: null, reps: 8 },
      ],
    })
    const e = build([d], { Pull: 'pull-up' }).sessions[0].entries
    expect(e[0].weightKg).toBeNull()
    expect(e[0].loadKg).toBe(10)
    expect(e[1].weightKg).toBeNull()
    expect('loadKg' in e[1]).toBe(false)
    expect(e[2].weightKg).toBeNull()
    expect('loadKg' in e[2]).toBe(false)
  })

  it('O11: elsewhere a blank or 0 weight is null and no loadKg is written', () => {
    const d = draft({
      sets: [
        { name: 'Bench', weightKg: 0, reps: 5 },
        { name: 'Bench', weightKg: null, reps: 5 },
        { name: 'Bench', weightKg: 20, reps: 5 },
      ],
    })
    const e = build([d], { Bench: 'bench-press' }).sessions[0].entries
    expect(e.map((x) => x.weightKg)).toEqual([null, null, 20])
    expect(e.every((x) => !('loadKg' in x))).toBe(true)
  })

  it('O11: finishedAt is at least the last Set loggedAt', () => {
    const sets = Array.from({ length: 10 }, () => ({ name: 'Bench', weightKg: 80, reps: 5 }))
    const s = build([draft({ finishedAt: T0, sets })], { Bench: 'bench-press' }).sessions[0]
    const last = Math.max(...s.entries.map((x) => x.loggedAt))
    expect(s.finishedAt).not.toBeNull()
    expect(s.finishedAt as number).toBeGreaterThanOrEqual(last)
  })

  it('O11: left-out names drop their Sets and are counted', () => {
    const d = draft({
      sets: [
        { name: 'Bench', weightKg: 80, reps: 5 },
        { name: 'Odd', weightKg: 5, reps: 5 },
        { name: 'Odd', weightKg: 5, reps: 5 },
      ],
    })
    const r = build([d], { Bench: 'bench-press', Odd: null })
    expect(r.leftOut).toBe(2)
    expect(r.sessions[0].entries).toHaveLength(1)
    expect(r.sessions[0].entries[0].exerciseId).toBe('bench-press')
  })

  it('O11: a draft left with no Sets becomes no Session', () => {
    const r = build([draft({ sets: [{ name: 'Odd', weightKg: 5, reps: 5 }] }), draft({ startedAt: T0 + 86_400_000 })], {
      Odd: null,
      Bench: 'bench-press',
    })
    expect(r.sessions).toHaveLength(1)
    expect(r.sessions[0].startedAt).toBe(T0 + 86_400_000)
    expect(r.leftOut).toBe(1)
  })
})

function sess(over: Partial<Session> & { ex?: string[] } = {}): Session {
  const { ex = ['bench-press'], ...rest } = over
  return {
    id: `s${Math.random()}`,
    programId: 'Strong',
    workoutId: 'Push Day',
    startedAt: T0,
    finishedAt: T0 + 1000,
    entries: ex.map((exerciseId, i) => ({ exerciseId, setIndex: 1, weightKg: 50, reps: 5, loggedAt: T0 + i * 1000 })),
    ...rest,
  }
}

describe('skipDuplicates', () => {
  it('O12: skips an incoming Session in the same minute with the same Exercise set as a live stored one', () => {
    const r = skipDuplicates([sess({ ex: ['a', 'b'] })], [sess({ startedAt: T0 + 30_000, ex: ['b', 'a', 'a'] })])
    expect(r.sessions).toHaveLength(0)
    expect(r.skipped).toBe(1)
  })

  it('O12: keeps a Session in another minute or with a different Exercise set', () => {
    const other = sess({ startedAt: T0 + 120_000 })
    const diff = sess({ ex: ['bench-press', 'squat'] })
    const r = skipDuplicates([sess()], [other, diff])
    expect(r.sessions).toEqual([other, diff])
    expect(r.skipped).toBe(0)
  })

  it('O12: a deleted stored Session does not count', () => {
    const r = skipDuplicates([sess({ deletedAt: NOW })], [sess()])
    expect(r.sessions).toHaveLength(1)
    expect(r.skipped).toBe(0)
  })

  it('O12: a second copy within the incoming list is skipped and counted', () => {
    const a = sess({ id: 'a' })
    const b = sess({ id: 'b', startedAt: T0 + 5_000 })
    const r = skipDuplicates([], [a, b])
    expect(r.sessions).toEqual([a])
    expect(r.skipped).toBe(1)
  })
})
