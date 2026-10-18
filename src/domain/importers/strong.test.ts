import { describe, expect, it } from 'vitest'
import { parseStrong } from './strong'

const H = 'Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Reps,Distance,Seconds,Notes,Workout Notes,RPE'
const at = (y: number, m: number, d: number, h: number, mi: number, s: number) =>
  new Date(y, m - 1, d, h, mi, s).getTime()

function csv(...rows: string[]) {
  return [H, ...rows].join('\n') + '\n'
}

describe('parseStrong: comma export (O4)', () => {
  it('O4 groups rows into one draft per date and workout, in first-appearance order', () => {
    const r = parseStrong(
      csv(
        '2024-03-05 18:30:00,Push,1h 5m,Bench Press,1,60,8,0,0,,,',
        '2024-03-05 18:30:00,Push,1h 5m,Bench Press,2,62.5,6,0,0,,,',
        '2024-03-05 18:30:00,Pull,45m,Row,1,50,10,0,0,,,',
        '2024-03-07 18:30:00,Push,1h,Bench Press,1,65,5,0,0,,,',
      ),
    )
    expect(r.drafts.map((d) => d.workoutName)).toEqual(['Push', 'Pull', 'Push'])
    expect(r.drafts.map((d) => d.sets.length)).toEqual([2, 1, 1])
    expect(r.drafts[0].startedAt).toBe(at(2024, 3, 5, 18, 30, 0))
    expect(r.drafts[2].startedAt).toBe(at(2024, 3, 7, 18, 30, 0))
  })

  it('O4 keeps sets in file order with exercise name, weight and reps', () => {
    const r = parseStrong(
      csv(
        '2024-03-05 18:30:00,Push,1h,Bench Press,1,60,8,0,0,,,',
        '2024-03-05 18:30:00,Push,1h,Fly,1,12.5,12,0,0,,,',
        '2024-03-05 18:30:00,Push,1h,Bench Press,2,62.5,6,0,0,,,',
      ),
    )
    expect(r.drafts[0].sets).toEqual([
      { name: 'Bench Press', weightKg: 60, reps: 8 },
      { name: 'Fly', weightKg: 12.5, reps: 12 },
      { name: 'Bench Press', weightKg: 62.5, reps: 6 },
    ])
  })

  it.each([
    ['1h 5m', 3900],
    ['45m', 2700],
    ['1h', 3600],
  ])('O4 reads Duration %s as finishing %i seconds after the start', (dur, secs) => {
    const r = parseStrong(csv(`2024-03-05 18:30:00,Push,${dur},Bench Press,1,60,8,0,0,,,`))
    expect(r.drafts[0].finishedAt - r.drafts[0].startedAt).toBe(secs * 1000)
  })

  it('O4 reads a Duration (sec) column as seconds', () => {
    const text =
      'Date,Workout Name,Duration (sec),Exercise Name,Set Order,Weight (kg),Reps\n2024-03-05 18:30:00,Push,1800,Bench Press,1,60,8\n'
    const r = parseStrong(text)
    expect(r.drafts[0].finishedAt - r.drafts[0].startedAt).toBe(1800000)
  })

  it('O4 maps Set Order W, D and F to warmup, drop and failure kinds', () => {
    const r = parseStrong(
      csv(
        '2024-03-05 18:30:00,Push,1h,Bench Press,W,20,10,0,0,,,',
        '2024-03-05 18:30:00,Push,1h,Bench Press,D,40,8,0,0,,,',
        '2024-03-05 18:30:00,Push,1h,Bench Press,F,60,5,0,0,,,',
      ),
    )
    expect(r.drafts[0].sets.map((s) => s.kind)).toEqual(['warmup', 'drop', 'failure'])
  })

  it('O4 leaves a numbered Set Order as a working set with no kind key', () => {
    const r = parseStrong(csv('2024-03-05 18:30:00,Push,1h,Bench Press,3,60,8,0,0,,,'))
    expect(r.drafts[0].sets).toHaveLength(1)
    expect('kind' in r.drafts[0].sets[0]).toBe(false)
  })

  it('O4 turns RPE into rir, and omits rir when RPE is blank', () => {
    const r = parseStrong(
      csv(
        '2024-03-05 18:30:00,Push,1h,Bench Press,1,60,8,0,0,,,8',
        '2024-03-05 18:30:00,Push,1h,Bench Press,2,60,8,0,0,,,',
      ),
    )
    expect(r.drafts[0].sets[0].rir).toBe(2)
    expect('rir' in r.drafts[0].sets[1]).toBe(false)
  })

  it('O4 takes the Workout Notes as the draft note and ignores per-set Notes', () => {
    const r = parseStrong(csv('2024-03-05 18:30:00,Push,1h,Bench Press,1,60,8,0,0,felt heavy,Great day,'))
    expect(r.drafts[0].note).toBe('Great day')
    expect(JSON.stringify(r.drafts[0].sets)).not.toContain('felt heavy')
  })

  it('O4 omits the note when Workout Notes is blank', () => {
    const r = parseStrong(csv('2024-03-05 18:30:00,Push,1h,Bench Press,1,60,8,0,0,,,'))
    expect(r.drafts).toHaveLength(1)
    expect('note' in r.drafts[0]).toBe(false)
  })

  it('O4 leaves out and counts Rest Timer rows', () => {
    const r = parseStrong(
      csv(
        '2024-03-05 18:30:00,Push,1h,Bench Press,1,60,8,0,0,,,',
        '2024-03-05 18:30:00,Push,1h,Bench Press,Rest Timer,0,0,0,90,,,',
      ),
    )
    expect(r.drafts[0].sets).toHaveLength(1)
    expect(r.leftOut).toBe(1)
  })

  it('O4 leaves out and counts rows with zero or blank reps', () => {
    const r = parseStrong(
      csv(
        '2024-03-05 18:30:00,Push,1h,Bench Press,1,60,8,0,0,,,',
        '2024-03-05 18:30:00,Push,1h,Run,1,0,0,5000,1500,,,',
        '2024-03-05 18:30:00,Push,1h,Bench Press,2,60,,0,0,,,',
      ),
    )
    expect(r.drafts[0].sets).toHaveLength(1)
    expect(r.leftOut).toBe(2)
  })

  it('O4 counts nothing as left out for a clean file', () => {
    const r = parseStrong(csv('2024-03-05 18:30:00,Push,1h,Bench Press,1,60,8,0,0,,,'))
    expect(r.drafts).toHaveLength(1)
    expect(r.leftOut).toBe(0)
  })

  it.each(['Date', 'Exercise Name', 'Set Order', 'Reps'])('O4 throws naming the missing %s column', (col) => {
    const header = H.split(',')
      .filter((h) => h !== col)
      .join(',')
    expect(() => parseStrong(header + '\n')).toThrowError(col)
  })
})

describe('parseStrong: units and older export (O5)', () => {
  const SEMI =
    'Date;Workout Name;Exercise Name;Set Order;Weight;Weight Unit;Reps;RPE;Distance;Distance Unit;Seconds;Notes;Workout Notes;Workout Duration\n'

  it('O5 reads a semicolon export by column name, converting lbs rows to kg and kg rows as is', () => {
    const r = parseStrong(
      SEMI +
        '2024-03-05 18:30:00;Push;Bench Press;1;135;lbs;5;;0;;0;;;3600\n' +
        '2024-03-05 18:30:00;Push;Bench Press;2;60;kg;5;;0;;0;;;3600\n',
    )
    expect(r.unit).toBe('stated')
    expect(r.drafts[0].sets.map((s) => s.weightKg)).toEqual([61.2, 60])
    expect(r.drafts[0].finishedAt - r.drafts[0].startedAt).toBe(3600000)
  })

  it('O5 converts a Weight (lbs) header column to kg and reports stated', () => {
    const text =
      'Date,Workout Name,Exercise Name,Set Order,Weight (lbs),Reps\n2024-03-05 18:30:00,Push,Bench Press,1,225,5\n'
    const r = parseStrong(text)
    expect(r.unit).toBe('stated')
    expect(r.drafts[0].sets[0].weightKg).toBe(102.1)
  })

  it('O5 reads a Weight (kg) header column as kg regardless of the unit argument', () => {
    const text =
      'Date,Workout Name,Exercise Name,Set Order,Weight (kg),Reps\n2024-03-05 18:30:00,Push,Bench Press,1,100,5\n'
    const r = parseStrong(text, 'lbs')
    expect(r.unit).toBe('stated')
    expect(r.drafts[0].sets[0].weightKg).toBe(100)
  })

  it('O5 reports unstated for a plain Weight column and reads it in kg by default', () => {
    const r = parseStrong(csv('2024-03-05 18:30:00,Push,1h,Bench Press,1,100,5,0,0,,,'))
    expect(r.unit).toBe('unstated')
    expect(r.drafts[0].sets[0].weightKg).toBe(100)
  })

  it('O5 reads an unstated Weight column in lbs when the unit argument says lbs', () => {
    const r = parseStrong(csv('2024-03-05 18:30:00,Push,1h,Bench Press,1,225,5,0,0,,,'), 'lbs')
    expect(r.unit).toBe('unstated')
    expect(r.drafts[0].sets[0].weightKg).toBe(102.1)
  })
})
