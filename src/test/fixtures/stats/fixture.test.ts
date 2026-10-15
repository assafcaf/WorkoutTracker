// E18-T1 [O1]: the stats fixture, rebuilt in app format from the audit seed plus the brief's
// realism adjustments, and the render states that seed it.
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

type Entry = {
  exerciseId: string
  setIndex: number
  weightKg?: number
  loadKg?: number
  reps: number
  kind?: string
}
type Sess = { id: string; startedAt: number; note?: string; deload?: boolean; entries: Entry[] }
type Point = { date: string; sets: string; warmups: string | null; note: string | null; deload: boolean }
type BriefData = {
  today: string
  sessions: { date: string; deload: boolean; note: string | null; prs: unknown[] }[]
  lifts: Record<string, { verdict: string; nextStep: unknown; points: Point[] }>
  weeks: unknown[]
}

const root = resolve(__dirname, '..', '..', '..', '..')
const read = <T>(rel: string): T => JSON.parse(readFileSync(join(root, rel), 'utf8')) as T
const brief = read<BriefData>('docs/design/stats-2026-10/brief-data.json')
const loadSessions = () => read<Sess[]>('src/test/fixtures/stats/sessions.json')

const fmt = (n: number) => String(n)
function text(e: Entry): string {
  const kind = e.kind === 'drop' || e.kind === 'failure' ? ` (${e.kind})` : ''
  return base(e) + kind
}
function base(e: Entry): string {
  if (e.loadKg !== undefined && e.loadKg !== null) {
    return `BW${e.loadKg > 0 ? '+' : '−'}${fmt(Math.abs(e.loadKg))} × ${e.reps}`
  }
  if (e.weightKg === undefined || e.weightKg === null) return `BW × ${e.reps}`
  return `${fmt(e.weightKg)} × ${e.reps}`
}
// The date a Session was started on, in the zone the seed was written in.
const day = (ms: number) => new Date(ms).toLocaleDateString('sv-SE', { timeZone: 'Asia/Jerusalem' })

describe('E18-T1 stats fixture', () => {
  it('O1 holds the 45 Sessions of the brief, in order, on the brief dates', () => {
    const sessions = loadSessions()
    expect(sessions).toHaveLength(45)
    expect(sessions.map((s) => day(s.startedAt))).toEqual(brief.sessions.map((s) => s.date))
  })

  it('O1 marks exactly Mon 21, Wed 23 and Fri 25 Sep as deload Sessions', () => {
    const sessions = loadSessions()
    const marked = sessions.filter((s) => s.deload === true).map((s) => day(s.startedAt))
    expect(marked).toEqual(['2026-09-21', '2026-09-23', '2026-09-25'])
  })

  it('O1 matches every lift working sets and warm-ups to brief-data points', () => {
    const sessions = loadSessions()
    let checked = 0
    for (const [id, lift] of Object.entries(brief.lifts)) {
      for (const p of lift.points) {
        const s = sessions.find((x) => day(x.startedAt) === p.date)!
        const mine = s.entries.filter((e) => e.exerciseId === id).sort((a, b) => a.setIndex - b.setIndex)
        const work = mine.filter((e) => e.kind !== 'warmup').map(text).join(' · ')
        const warm = mine.filter((e) => e.kind === 'warmup').map(text).join(' · ')
        expect(work, `${id} ${p.date} working sets`).toBe(p.sets)
        expect(warm || null, `${id} ${p.date} warm-ups`).toBe(p.warmups)
        checked++
      }
    }
    expect(checked).toBeGreaterThan(300)
  })

  it('O1 carries the brief Session notes on the brief dates', () => {
    const sessions = loadSessions()
    const got = sessions.map((s) => s.note ?? null)
    expect(got).toEqual(brief.sessions.map((s) => s.note))
  })

  it('O1 writes expected.json with verdicts, records, next steps, points, weeks and muscle tables', () => {
    const expected = read<{
      lifts: BriefData['lifts']
      sessions: BriefData['sessions']
      weeks: unknown[]
      plannedMuscleSetsPerWeek: unknown
      muscleSetsAvgLast2FullWeeks: unknown
    }>('src/test/fixtures/stats/expected.json')
    expect(Object.keys(expected.lifts).sort()).toEqual(Object.keys(brief.lifts).sort())
    expect(expected.lifts['narrow-grip-pull-down'].verdict).toBe('slipping')
    expect(expected.lifts['back-squat'].points).toHaveLength(brief.lifts['back-squat'].points.length)
    expect(expected.sessions).toHaveLength(45)
    expect(expected.weeks).toEqual(brief.weeks)
    expect(expected.muscleSetsAvgLast2FullWeeks).toBeDefined()
    expect(expected.plannedMuscleSetsPerWeek).toBeDefined()
  })

  it('O1 rebuilds the same files when the fixture builder runs', () => {
    const out = mkdtempSync(join(tmpdir(), 'stats-fixture-'))
    const builder = join(root, 'scripts/stats-fixture/build.mjs')
    expect(existsSync(builder), 'the fixture builder exists').toBe(true)
    execFileSync(process.execPath, [builder, '--out', out], { cwd: root, stdio: 'pipe' })
    for (const f of ['sessions.json', 'expected.json']) {
      expect(readFileSync(join(out, f), 'utf8')).toBe(readFileSync(join(root, 'src/test/fixtures/stats', f), 'utf8'))
    }
  }, 60_000)

  it('O2 seeds the render states: 45 Sessions at Thu 15 Oct, 1 at Tue 23 Jun, 3 at Sat 27 Jun', () => {
    const cases: [string, number, string][] = [
      ['stats-45', 45, '2026-10-15T18:05:00+03:00'],
      ['stats-1', 1, '2026-06-23T18:05:00+03:00'],
      ['stats-3', 3, '2026-06-27T18:05:00+03:00'],
    ]
    const sessions = loadSessions()
    for (const [name, n, now] of cases) {
      const st = read<{ sessions: Sess[]; settings: object; now: string; timezone: string }>(`scripts/render-states/${name}.json`)
      expect(st.sessions, name).toHaveLength(n)
      expect(st.sessions.map((s) => s.id), name).toEqual(sessions.slice(0, n).map((s) => s.id))
      expect(st.now, name).toBe(now)
      expect(st.timezone, name).toBe('Asia/Jerusalem')
      expect(st.settings, name).toBeDefined()
    }
  })
})
