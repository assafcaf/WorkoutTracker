// v7 design-language foundations (docs/design/competitors-2026-11/study.md §3, §6 steps 1-3):
// SetFigure, SetCell, StatusMark and PrTag, read as the DOM they render and the CSS they paint;
// and the trust check of §1.5 -- a rep best (Deadlift 70 × 8 after 70 × 7, its est. strength
// under the 90.0 best) wears a PR tag nowhere.
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { render, screen, within } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import sessionsJson from '../../test/fixtures/stats/sessions.json'
import { loadCatalog, loadPrograms } from '../../data/catalog'
import { loadLibrary } from '../../data/library'
import { isPrSet } from '../../domain/prMoment'
import { computeRecords, isRealRecord, liftPrs, sessionPrs } from '../../domain/stats/records'
import { buildLiftHistories } from '../../domain/stats/liftHistory'
import { declarationsFor } from '../../test/cssAudit'
import { LiftPageView } from '../../features/progress/LiftPage'
import { SessionSummary } from '../SessionSummary'
import type { LibraryExercise, Session, SetEntry } from '../../types'
import { PrTag, SetCell, SetFigure, StatusMark, statusTone } from '.'

process.env.TZ = 'Asia/Jerusalem' // the zone the stats fixture was written in

const here = dirname(fileURLToPath(import.meta.url))
const figuresCss = readFileSync(join(here, 'figures.css'), 'utf-8')
const componentsCss = readFileSync(join(here, '..', '..', 'styles', 'components.css'), 'utf-8')

describe('SetFigure', () => {
  it('writes a Set as load, × and reps, the × in its own ink-3 span', () => {
    const { container } = render(<SetFigure set={{ weightKg: 70, reps: 8 }} />)
    const figure = container.querySelector('.set-figure') as HTMLElement
    expect(figure.textContent).toBe('70×8')
    expect(figure.querySelector('.set-figure-times')?.textContent).toBe('×')
    expect(figure.querySelector('.set-figure-unit')).toBeNull()
    expect(declarationsFor(figuresCss, '.set-figure-times').get('color')).toBe('var(--color-muted)')
  })

  it('writes a weight alone with its unit: 70 kg, the unit in ink-3', () => {
    const { container } = render(<SetFigure set={{ weightKg: 70 }} />)
    expect(container.textContent).toBe('70 kg')
    expect(container.querySelector('.set-figure-unit')?.textContent).toBe(' kg')
    expect(declarationsFor(figuresCss, '.set-figure-unit').get('color')).toBe('var(--color-muted)')
  })

  it('writes repeated Sets at one load as 46.25 × 9 · 8 · 8', () => {
    const { container } = render(<SetFigure set={{ weightKg: 46.25, reps: 9 }} moreReps={[8, 8]} />)
    expect(container.textContent).toBe('46.25×9 · 8 · 8')
  })

  it('writes bodyweight as BW, BW+5 and BW−19 with a true minus, and never a unit', () => {
    const { container } = render(
      <>
        <SetFigure set={{ weightKg: null, reps: 15 }} />
        <SetFigure set={{ weightKg: null, loadKg: 5, reps: 12 }} />
        <SetFigure set={{ weightKg: null, loadKg: -19, reps: 6 }} />
      </>,
    )
    expect([...container.querySelectorAll('.set-figure')].map((f) => f.textContent)).toEqual([
      'BW×15',
      'BW+5×12',
      'BW−19×6',
    ])
  })

  it('stacks load over ×reps on request, and adds the site class', () => {
    const { container } = render(<SetFigure set={{ weightKg: 60, reps: 10 }} stack className="all-cell-figure" />)
    const figure = container.querySelector('.set-figure') as HTMLElement
    expect(figure).toHaveAttribute('data-stack', 'true')
    expect(figure).toHaveClass('all-cell-figure')
    expect([...figure.children].map((part) => part.textContent)).toEqual(['60', '×10'])
  })
})

describe('SetCell', () => {
  const figure = <SetFigure set={{ weightKg: 70, reps: 7 }} />

  it('draws its state as data-state, with the state mark: ✓ when done, PR when pr, none otherwise', () => {
    const { container } = render(
      <>
        <SetCell state="planned" index={3}>{figure}</SetCell>
        <SetCell state="current" index={2}>{figure}</SetCell>
        <SetCell state="done" index={1}>{figure}</SetCell>
        <SetCell state="pr" index={1}>{figure}</SetCell>
      </>,
    )
    const cells = [...container.querySelectorAll('.setcell')]
    expect(cells.map((cell) => cell.getAttribute('data-state'))).toEqual(['planned', 'current', 'done', 'pr'])
    expect(cells.map((cell) => cell.querySelector('svg') !== null)).toEqual([false, false, true, false])
    expect(cells.map((cell) => cell.querySelector('.tag-pr') !== null)).toEqual([false, false, false, true])
    expect(cells[0].querySelector('.set-cell-head')?.textContent).toBe('3')
  })

  it('is a button wearing the cell role when it has onClick, and a div or span otherwise', () => {
    const onClick = vi.fn()
    const { container } = render(
      <>
        <SetCell state="done" onClick={onClick} aria-label="Set 1 · 70 × 7">{figure}</SetCell>
        <SetCell state="planned" as="span">{figure}</SetCell>
      </>,
    )
    const button = screen.getByRole('button', { name: 'Set 1 · 70 × 7' })
    expect(button).toHaveClass('setcell', 'cell')
    button.click()
    expect(onClick).toHaveBeenCalledOnce()
    expect(container.querySelector('span.setcell')).not.toBeNull()
  })

  it('lets the site replace the mark, or draw none', () => {
    const { container } = render(
      <>
        <SetCell state="done" mark={null}>{figure}</SetCell>
        <SetCell state="current" mark={<PrTag />}>{figure}</SetCell>
      </>,
    )
    const [plain, editing] = [...container.querySelectorAll('.setcell')]
    expect(plain.querySelector('svg')).toBeNull()
    expect(editing.querySelector('.tag-pr')).not.toBeNull()
  })

  it('paints the four states: planned dashed ink-3, current in live, done and pr on the surface with a hairline', () => {
    const rule = (state: string) => declarationsFor(figuresCss, `.setcell[data-state='${state}']`)
    expect(rule('planned').get('border')).toBe('1.5px dashed var(--color-muted)')
    expect(rule('planned').get('color')).toBe('var(--color-muted)')
    expect(rule('current').get('border')).toBe('2px solid var(--color-live)')
    for (const state of ['done', 'pr']) {
      expect(rule(state).get('border')).toBe('1px solid var(--color-hairline)')
      expect(rule(state).get('background')).toBe('var(--color-surface)')
    }
  })
})

describe('StatusMark', () => {
  it('Moving and Ready are up, Lowered and Slipping are down, the rest flat', () => {
    expect(statusTone('moving')).toBe('up')
    expect(statusTone('ready')).toBe('up')
    expect(statusTone('lowered')).toBe('down')
    expect(statusTone('slipping')).toBe('down')
    for (const kind of ['stalled', 'hold', 'break', 'too new'] as const) expect(statusTone(kind)).toBe('flat')
  })

  it('is one glyph-and-word text in the tone colour, with no box and no border', () => {
    render(
      <StatusMark tone="up" glyph="↑">
        Ready
      </StatusMark>,
    )
    const mark = screen.getByText('↑ Ready')
    expect(mark).toHaveAttribute('data-tone', 'up')
    expect(declarationsFor(figuresCss, ".status-mark[data-tone='up']").get('color')).toBe('var(--color-up)')
    expect(declarationsFor(figuresCss, ".status-mark[data-tone='down']").get('color')).toBe('var(--color-down)')
    expect(declarationsFor(figuresCss, ".status-mark[data-tone='flat']").get('color')).toBe('var(--color-muted)')
    for (const tone of ['up', 'flat', 'down']) {
      const rule = declarationsFor(figuresCss, `.status-mark[data-tone='${tone}']`)
      expect([...rule.keys()]).toEqual(['color'])
    }
  })
})

describe('PrTag', () => {
  it('is the gold PR tag, named Personal record unless told otherwise', () => {
    render(
      <>
        <PrTag />
        <PrTag label={null} className="x" />
      </>,
    )
    const [named, plain] = screen.getAllByText('PR')
    expect(named).toHaveClass('tag', 'tag-pr')
    expect(named).toHaveAttribute('aria-label', 'Personal record')
    expect(plain).not.toHaveAttribute('aria-label')
    expect(plain).toHaveClass('x')
    const rule = declarationsFor(componentsCss, '.tag-pr')
    expect(rule.get('color')).toBe('var(--color-pr)')
    expect(rule.get('background')).toBe('var(--color-pr-tint)')
  })
})

// --- §1.5: a rep best is never a PR -------------------------------------------------------------

describe('v7 a rep best (Deadlift 70 × 8 after 70 × 7) shows no PR tag anywhere', () => {
  const sessions = sessionsJson as unknown as Session[]
  const catalog = loadCatalog()
  const resolve = (id: string) => catalog.get(id)
  const program = loadPrograms().find((p) => p.id === 'assaf-ab-2026')!
  const day = (ms: number) => new Date(ms).toLocaleDateString('sv-SE', { timeZone: 'Asia/Jerusalem' })
  const mon12 = sessions.find((s) => day(s.startedAt) === '2026-10-12')!
  const workout = program.workouts.find((w) => w.id === mon12.workoutId)!
  const plan = workout.exercises.find((p) => p.exerciseId === 'deadlift')!
  const planFor = (id: string) => workout.exercises.find((p) => p.exerciseId === id)
  const START = new Date(2026, 9, 15, 18, 0).getTime()
  const entry = (setIndex: number, weightKg: number, reps: number): SetEntry => ({
    exerciseId: 'deadlift',
    setIndex,
    weightKg,
    reps,
    loggedAt: START + setIndex * 240_000,
  })
  // Thursday's Workout B: the deadlift ramp of Mon 12 Oct (60 × 10, 70 × 7, 70 × 7) with one more
  // rep on set 2. 70 × 8 is not heavier than 70, and its est. strength (88.7) is under the 90.0
  // that 67.5 × 10 set on Wed 7 Oct.
  const thursday: Session = {
    id: 'thu-15-oct',
    programId: mon12.programId,
    workoutId: mon12.workoutId,
    startedAt: START,
    finishedAt: START + 30 * 60_000,
    entries: [entry(1, 60, 10), entry(2, 70, 8), entry(3, 70, 7)],
  }
  const all = [...sessions, thursday]
  let library: Map<string, LibraryExercise>

  beforeAll(async () => {
    library = await loadLibrary()
  })

  it('the engine calls it a rep best: a Session best, not a real record, no PR, no PR moment', () => {
    const records = computeRecords(all, resolve, planFor).filter(
      (r) => r.sessionId === thursday.id && r.exerciseId === 'deadlift',
    )
    expect(records).toHaveLength(1)
    expect(records[0]).toMatchObject({ kind: 'Rep record', lever: 70, reps: 8 })
    expect(isRealRecord(records[0])).toBe(false)
    expect(sessionPrs(records, thursday.id)).toEqual([])
    const deadlift = resolve('deadlift')!
    const history = buildLiftHistories(all, resolve, planFor).get('deadlift')!
    expect(liftPrs(history).has(thursday.id)).toBe(false)
    // The track's and the All grid's PR test (prMoment / isPrSet) on each of Thursday's Sets.
    for (const set of thursday.entries) {
      expect(isPrSet(deadlift, plan, sessions, thursday, set), `${set.weightKg} × ${set.reps}`).toBe(false)
    }
  })

  it('the Lift page tags no Set of Thursday', () => {
    render(
      <LiftPageView
        exerciseId="deadlift"
        sessions={all}
        program={program}
        resolve={resolve}
        now={START + 3_600_000}
      />,
    )
    const rows = within(screen.getByRole('list', { name: 'Sessions' })).getAllByRole('listitem')
    const thu = rows.find((row) => row.textContent?.startsWith('Thu 15 Oct')) as HTMLElement
    expect(thu.querySelector('.lift-log-sets')?.textContent).toBe('60×10 · 70×8 · 70×7')
    expect(thu.querySelector('.tag-pr')).toBeNull()
  })

  it("Thursday's summary tags no PR and counts none", () => {
    render(
      <SessionSummary
        session={thursday}
        resolve={resolve}
        library={library}
        workoutName={workout.name}
        earlierSessions={sessions}
        planFor={planFor}
        workout={workout}
        program={program}
        onClose={vi.fn()}
        onEdit={vi.fn()}
      />,
    )
    const dialog = screen.getByRole('dialog', { name: 'Session summary' })
    expect(dialog.querySelector('.tag-pr')).toBeNull()
    expect(dialog.querySelector('[data-kpi="prs"]')).toBeNull()
  })
})
