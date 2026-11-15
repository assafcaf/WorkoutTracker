// v6 [V5-06 V5-08]: one lift's measure, change, records and log; the PR rule of the lift page.
import { describe, expect, it } from 'vitest'
import sessionsJson from '../../test/fixtures/stats/sessions.json'
import { loadCatalog, loadPrograms } from '../../data/catalog'
import type { ExercisePlan, Session } from '../../types'
import { buildLiftHistories } from './liftHistory'
import { changeSince, changeText, changeTextFor, liftRecordRows, measureOf, measureText, sessionLog, storyPoints } from './liftStory'
import { isRecordSet } from './realRecord'

process.env.TZ = 'Asia/Jerusalem'

const sessions = sessionsJson as unknown as Session[]
const catalog = loadCatalog()
const program = loadPrograms().find((p) => p.id === 'assaf-ab-2026')!
const plans = new Map<string, ExercisePlan>()
for (const w of program.workouts) for (const e of w.exercises) plans.set(e.exerciseId, e)
const histories = buildLiftHistories(sessions, (id) => catalog.get(id), (id) => plans.get(id))
const h = (id: string) => histories.get(id)!

describe('v6 the measure a lift is charted by', () => {
  it('a loaded lift is its estimated max, a plain Bodyweight one its most reps, an assisted one its load', () => {
    expect(measureOf(h('back-squat'))).toBe('est')
    expect(measureOf(h('push-ups'))).toBe('reps')
    expect(measureOf(h('assisted-pull-ups'))).toBe('load')
  })

  it('each point carries its top set as a label and the estimated max of its best set', () => {
    const last = storyPoints(h('back-squat')).at(-1)!
    expect(last.label).toBe('62.5×8')
    // 62.5 × (1 + 8/30) = 79.17
    expect(measureText('est', last.value, false)).toBe('79.2 kg')
  })

  it('the change reads signed kilograms, reps, or assistance in words', () => {
    expect(changeText('est', 8.25)).toBe('+8.3 kg')
    expect(changeText('est', -2)).toBe('−2 kg')
    expect(changeText('reps', 2)).toBe('+2 reps')
    expect(changeText('est', 0.01)).toBe('no change')
    expect(changeTextFor(h('assisted-pull-ups'), 1.5)).toBe('1.5 kg less assistance')
  })

  it('the change runs from the first non-deload Session at or after the start to the latest', () => {
    const points = storyPoints(h('back-squat'))
    const change = changeSince(points, new Date(2026, 8, 15).getTime())!
    expect(change.since).toBe(points.find((p) => !p.deload && p.at >= new Date(2026, 8, 15).getTime())!.at)
    expect(changeSince(points.slice(0, 1), 0)).toBeNull()
  })
})

describe('v6 records and the log', () => {
  it('the Records are the heaviest set, the best est. max and the most reps in a set', () => {
    expect(liftRecordRows(h('back-squat')).map((r) => r.label)).toEqual(['Heaviest set', 'Best est. max', 'Most reps at 62.5 kg'])
    expect(liftRecordRows(h('push-ups')).map((r) => r.label)).toEqual(['Most reps in a set'])
    expect(liftRecordRows(h('assisted-pull-ups'))[0].label).toBe('Least assistance')
  })

  it('PR tags only where a Session really set a record: never every row', () => {
    for (const id of ['back-squat', 'deadlift', 'db-bench-press']) {
      const rows = sessionLog(h(id))
      expect(rows.filter((r) => r.record !== null).length).toBeLessThan(rows.length)
      expect(rows[rows.length - 1].record).toBeNull()
    }
    // DB bench press: nothing heavier or better than 13 kg x 9-10 since 7 Aug, so nothing since is tagged.
    const bench = sessionLog(h('db-bench-press'))
    expect(bench.filter((r) => r.record !== null && r.at > new Date(2026, 7, 8).getTime())).toEqual([])
    const log = sessionLog(h('back-squat'))
    expect(log.filter((r) => r.deload).every((r) => r.record === null)).toBe(true)
    expect(log[0].at).toBeGreaterThan(log[log.length - 1].at)
  })

  it('isRecordSet: heavier, or a better est. max; a rep best at a weight already lifted is not', () => {
    const before = [{ lever: 60, reps: 8 }]
    expect(isRecordSet({ lever: 62.5, reps: 5 }, before, false)).toBe('Heaviest weight')
    expect(isRecordSet({ lever: 60, reps: 10 }, before, false)).toBe('Best est. max')
    expect(isRecordSet({ lever: 60, reps: 8 }, before, false)).toBeNull()
    expect(isRecordSet({ lever: 50, reps: 9 }, before, false)).toBeNull()
    expect(isRecordSet({ lever: 60, reps: 9 }, [], false)).toBeNull()
    expect(isRecordSet({ lever: -17, reps: 5 }, [{ lever: -19, reps: 6 }], true)).toBe('Least assistance')
    expect(isRecordSet({ lever: 0, reps: 18 }, [{ lever: 0, reps: 17 }], true, true)).toBe('Most reps')
  })
})
