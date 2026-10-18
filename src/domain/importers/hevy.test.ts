import { describe, expect, it } from 'vitest'
import { parseHevy } from './hevy'

const H = 'title,start_time,end_time,description,exercise_title,superset_id,exercise_notes,set_index,set_type,weight_kg,reps,distance_km,duration_seconds,rpe'

describe('parseHevy', () => {
  it('reads both date forms as local time', () => {
    const text = [
      H,
      'Push,"15 Jan 2026, 18:05","15 Jan 2026, 19:10",,Bench Press,,,0,normal,60,8,,,',
      'Pull,2026-01-16 07:30:00,2026-01-16 08:15:00,,Row,,,0,normal,50,10,,,',
    ].join('\n')
    const r = parseHevy(text)
    expect(r.unit).toBe('stated')
    expect(r.drafts).toHaveLength(2)
    expect(r.drafts[0].workoutName).toBe('Push')
    expect(r.drafts[0].startedAt).toBe(new Date(2026, 0, 15, 18, 5).getTime())
    expect(r.drafts[0].finishedAt).toBe(new Date(2026, 0, 15, 19, 10).getTime())
    expect(r.drafts[1].startedAt).toBe(new Date(2026, 0, 16, 7, 30).getTime())
    expect(r.drafts[1].finishedAt).toBe(new Date(2026, 0, 16, 8, 15).getTime())
  })

  it('reads columns by name in any order', () => {
    const text = [
      'reps,weight_kg,exercise_title,title,end_time,start_time',
      '5,100,Squat,Legs,2026-01-15 19:00:00,2026-01-15 18:00:00',
    ].join('\n')
    const r = parseHevy(text)
    expect(r.drafts[0].workoutName).toBe('Legs')
    expect(r.drafts[0].sets).toEqual([{ name: 'Squat', weightKg: 100, reps: 5 }])
  })

  it('maps set_type, rpe to RIR, and description to the note', () => {
    const text = [
      H,
      'Push,2026-01-15 18:05:00,2026-01-15 19:10:00,Felt strong,Bench Press,,,0,warmup,40,10,,,',
      'Push,2026-01-15 18:05:00,2026-01-15 19:10:00,Felt strong,Bench Press,,,1,normal,60,8,,,8',
      'Push,2026-01-15 18:05:00,2026-01-15 19:10:00,Felt strong,Bench Press,,,2,dropset,50,8,,,',
      'Push,2026-01-15 18:05:00,2026-01-15 19:10:00,Felt strong,Bench Press,,,3,failure,60,6,,,',
    ].join('\n')
    const r = parseHevy(text)
    expect(r.drafts).toHaveLength(1)
    const d = r.drafts[0]
    expect(d.note).toBe('Felt strong')
    expect(d.sets.map((s) => s.kind)).toEqual(['warmup', undefined, 'drop', 'failure'])
    expect(d.sets.map((s) => s.rir)).toEqual([undefined, 2, undefined, undefined])
    expect(d.sets.map((s) => s.reps)).toEqual([10, 8, 8, 6])
  })

  it('groups per start time and title', () => {
    const text = [
      H,
      'Push,2026-01-15 18:05:00,2026-01-15 19:10:00,,Bench,,,0,normal,60,8,,,',
      'Push,2026-01-15 18:05:00,2026-01-15 19:10:00,,Fly,,,0,normal,20,12,,,',
      'Push,2026-01-17 18:05:00,2026-01-17 19:10:00,,Bench,,,0,normal,62,8,,,',
      'Pull,2026-01-15 18:05:00,2026-01-15 19:10:00,,Row,,,0,normal,50,8,,,',
    ].join('\n')
    const r = parseHevy(text)
    expect(r.drafts).toHaveLength(3)
    const push = r.drafts.find((d) => d.workoutName === 'Push' && d.sets.length === 2)
    expect(push?.sets.map((s) => s.name)).toEqual(['Bench', 'Fly'])
  })

  it('leaves out rows with no reps and counts them', () => {
    const text = [
      H,
      'Push,2026-01-15 18:05:00,2026-01-15 19:10:00,,Bench,,,0,normal,60,8,,,',
      'Push,2026-01-15 18:05:00,2026-01-15 19:10:00,,Plank,,,0,normal,,,,60,',
      'Push,2026-01-15 18:05:00,2026-01-15 19:10:00,,Run,,,0,normal,,,2,600,',
    ].join('\n')
    const r = parseHevy(text)
    expect(r.leftOut).toBe(2)
    expect(r.drafts[0].sets).toHaveLength(1)
  })

  it('converts a weight_lbs export to kg', () => {
    const text = [
      'title,start_time,end_time,description,exercise_title,superset_id,exercise_notes,set_index,set_type,weight_lbs,reps,distance_miles,duration_seconds,rpe',
      'Push,2026-01-15 18:05:00,2026-01-15 19:10:00,,Bench,,,0,normal,225,5,,,',
    ].join('\n')
    const r = parseHevy(text)
    expect(r.unit).toBe('stated')
    expect(r.drafts[0].sets[0].weightKg).toBe(102.1)
  })

  it('refuses a file with no weight column, naming weight_kg', () => {
    const text = [
      'title,start_time,end_time,exercise_title,reps',
      'Push,2026-01-15 18:05:00,2026-01-15 19:10:00,Bench,5',
    ].join('\n')
    expect(() => parseHevy(text)).toThrow(/weight_kg/)
  })
})
