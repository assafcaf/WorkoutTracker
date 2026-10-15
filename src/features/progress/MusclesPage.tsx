import { useMemo, useRef, useState } from 'react'
import { resolveExercise } from '../../data/resolve'
import { applyBodyweight } from '../../domain/bodyweight'
import { regionsFor, toRegionCounts, type Region, type Resolve } from '../../domain/muscles'
import { numberText } from '../../domain/stats/copy'
import {
  muscleContributors,
  muscleWeeks,
  plannedPerWeek,
  STATS_MUSCLES,
  thisWeekMuscles,
  windowAverage,
} from '../../domain/stats/muscles'
import type { Exercise, LibraryExercise, Muscle, Program, Session } from '../../types'
import { AppShell } from '../../ui/AppShell'
import { BodyMap } from '../../ui/body/BodyMap'
import { BodyMapLegend } from '../../ui/body/BodyMapLegend'
import { Segmented } from '../../ui/controls'
import type { Services } from '../../services'
import { useServiceData } from '../useServiceData'
import type { ProgressPageProps } from './pages'
import './MusclesPage.css'

/** What the page draws from: the finished Sessions, the active Program and what resolves a lift. */
export type MusclesData = {
  sessions: Session[]
  program: Program
  resolve: Resolve
  library: Map<string, LibraryExercise>
}

export type MusclesViewProps = { data: MusclesData; now: number; onBack: (() => void) | undefined }

type Span = 'two-weeks' | 'this-week'

type Row = { muscle: Muscle; label: string; done: number; still: number; plan: number }

const LABELS: Partial<Record<Muscle, string>> = {
  quadriceps: 'Quads',
  abdominals: 'Abs',
  'middle back': 'Mid back',
}

const label = (muscle: Muscle): string => LABELS[muscle] ?? muscle.charAt(0).toUpperCase() + muscle.slice(1)

/** Whole numbers, half up. */
const whole = (n: number): string => String(Math.round(n))

const BAND = { from: 10, to: 20 } as const
const WEEK_MS_DAYS = 7
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const dayMonth = (ms: number): string => `${new Date(ms).getDate()} ${MONTHS[new Date(ms).getMonth()]}`
const addDays = (ms: number, days: number): number => {
  const d = new Date(ms)
  d.setDate(d.getDate() + days)
  return d.getTime()
}

type Model = {
  rows: Row[]
  /** `28 Sep – 11 Oct`, or null when there is no window to date. */
  range: string | null
  rangeNote?: string
  sentence: string
  from: number
  to: number
  /** Complete weeks the contributors are averaged over (1 for This week). */
  weeks: number
}

function build(data: MusclesData, now: number, span: Span): Model {
  const { sessions, program, resolve, library } = data
  const planned = plannedPerWeek(program, resolve, library)
  const weeks = muscleWeeks(sessions, now, resolve, library)

  if (span === 'this-week') {
    const current = weeks.find((w) => w.inProgress)
    const owed = thisWeekMuscles(sessions, program, now, resolve, library)
    const rows = STATS_MUSCLES.map((muscle): Row => {
      const value = owed.get(muscle)
      const done = value?.done ?? 0
      const still = value?.stillPlanned ?? 0
      return { muscle, label: label(muscle), done, still, plan: done + still }
    })
    return {
      rows,
      range: null,
      sentence: 'This week so far, with the sets the rotation still owes.',
      from: current?.start ?? now,
      to: Infinity,
      weeks: 1,
    }
  }

  const complete = weeks.filter((w) => !w.inProgress).slice(-2)
  const average = windowAverage(sessions, now, resolve, library)
  const rows = STATS_MUSCLES.map(
    (muscle): Row => ({
      muscle,
      label: label(muscle),
      done: average.get(muscle) ?? 0,
      still: 0,
      plan: planned.get(muscle) ?? 0,
    }),
  )
  if (complete.length === 0) {
    return {
      rows,
      range: null,
      sentence: 'Two-week averages start after your first full week.',
      from: now,
      to: now,
      weeks: 1,
    }
  }
  const from = complete[0].start
  const last = complete[complete.length - 1].start
  const to = addDays(last, WEEK_MS_DAYS)
  const under = rows.filter((r) => r.plan > 0 && r.done < r.plan - 0.5)
  const top = rows.filter((r) => r.done >= 18)
  const topText =
    top.length === 0
      ? ''
      : ` ${top.map((r) => `${r.label} ${whole(r.done)}`).join(' and ')} sit at the top of the typical ${BAND.from}–${BAND.to}.`
  const sentence =
    (under.length === 0
      ? `On plan for ${complete.length === 1 ? '1 week' : `${complete.length} weeks`}.`
      : `Under plan for ${complete.length === 1 ? '1 week' : `${complete.length} weeks`}: ${under
          .map((r) => `${r.label} ${whole(r.done)} of ${whole(r.plan)}`)
          .join(', ')}.`) + topText
  return {
    rows,
    range: `${dayMonth(from)} – ${dayMonth(addDays(last, WEEK_MS_DAYS - 1))}`,
    rangeNote: `last ${complete.length === 1 ? 'complete week' : `${complete.length} complete weeks`}`,
    sentence,
    from,
    to,
    weeks: complete.length,
  }
}

function Bullet({ row, max }: { row: Row; max: number }): JSX.Element {
  const pct = (n: number): string => `${Math.min(100, (n / max) * 100)}%`
  const under = row.still === 0 && row.plan > 0 && row.done < row.plan - 0.5
  return (
    <span className="muscles-bullet" aria-hidden="true">
      <span
        className="muscles-bullet-band"
        data-part="band"
        style={{ left: pct(BAND.from), width: `${((BAND.to - BAND.from) / max) * 100}%` }}
      />
      {row.done > 0 ? (
        <span className="muscles-bullet-done" data-part="done" data-under={under} style={{ width: pct(row.done) }} />
      ) : null}
      {row.still > 0 ? (
        <span
          className="muscles-bullet-still"
          data-part="still"
          style={{ left: pct(row.done), width: `${(row.still / max) * 100}%` }}
        />
      ) : null}
      {row.plan > 0 ? <span className="muscles-bullet-plan" data-part="plan" style={{ left: pct(row.plan) }} /> : null}
    </span>
  )
}

/** The Muscles page's drawing, over loaded data: the 2-week window or this week. */
export function MusclesView({ data, now, onBack }: MusclesViewProps): JSX.Element {
  const [span, setSpan] = useState<Span>('two-weeks')
  const [open, setOpen] = useState<Muscle | null>(null)
  const rowRefs = useRef(new Map<Muscle, HTMLElement>())
  const model = useMemo(() => build(data, now, span), [data, now, span])

  const rows = [...model.rows].sort(
    (a, b) => a.done - b.done || STATS_MUSCLES.indexOf(a.muscle) - STATS_MUSCLES.indexOf(b.muscle),
  )
  const max = Math.max(25, ...rows.map((r) => Math.ceil(Math.max(r.done + r.still, r.plan))))

  const doneByMuscle = new Map(model.rows.map((r) => [r.muscle, r.done] as const))
  const regionCounts = toRegionCounts(doneByMuscle)

  const jump = (region: Region): void => {
    const muscle = STATS_MUSCLES.find((m) => regionsFor(m).includes(region))
    if (!muscle) return
    setOpen(muscle)
    rowRefs.current.get(muscle)?.scrollIntoView?.({ block: 'center' })
  }

  const arithmetic = (row: Row): string => {
    const parts = muscleContributors(data.sessions, row.muscle, model.from, model.to, data.resolve, data.library)
      .map((c) => ({ name: c.name, sets: c.sets / model.weeks }))
      .sort((a, b) => b.sets - a.sets || a.name.localeCompare(b.name))
    const total = parts.reduce((sum, p) => sum + p.sets, 0)
    return `${row.label} ${numberText(total)} = ${parts.map((p) => `${p.name} ${numberText(p.sets)}`).join(' · ')}`
  }

  return (
    <AppShell title="Muscles" onBack={onBack}>
      <div className="muscles-page">
        {model.range ? (
          <p className="muscles-range">
            <span>{model.range}</span>
            {model.rangeNote ? ` · ${model.rangeNote}` : ''}
          </p>
        ) : null}
        <div className="muscles-lead">
          <p className="muscles-sentence">{model.sentence}</p>
          <div className="muscles-map">
            <BodyMap counts={regionCounts} scale="week" onRegionTap={jump} />
          </div>
        </div>
        <div className="muscles-map-legend">
          <BodyMapLegend scale="week" />
        </div>
        <Segmented
          name="muscles-window"
          label="Window"
          value={span}
          options={[
            { value: 'two-weeks', label: '2 weeks' },
            { value: 'this-week', label: 'This week' },
          ]}
          onChange={(next) => {
            setSpan(next)
            setOpen(null)
          }}
        />
        <p className="muscles-legend">
          done · {span === 'this-week' ? 'still planned · ' : ''}tick is the plan · shaded band is the typical 10–20 · tap a muscle for its lifts
        </p>
        <ul className="muscles-rows">
          {rows.map((row) => (
            <li
              key={row.muscle}
              className="muscles-item"
              ref={(el) => {
                if (el) rowRefs.current.set(row.muscle, el)
              }}
            >
              <button
                type="button"
                className="btn-quiet muscles-row"
                data-muscle={row.muscle}
                aria-expanded={open === row.muscle}
                onClick={() => setOpen(open === row.muscle ? null : row.muscle)}
              >
                <span className="muscles-row-head">
                  <span className="muscles-row-name">{row.label}</span>
                  <span className="muscles-row-value">
                    {whole(row.done)}
                    <span className="muscles-row-plan">
                      {` · plan ${whole(row.plan)}`}
                      {row.still > 0 ? ` · ${whole(row.still)} still planned` : ''}
                    </span>
                  </span>
                </span>
                <Bullet row={row} max={max} />
              </button>
              {open === row.muscle ? <p className="muscles-contrib">{arithmetic(row)}</p> : null}
            </li>
          ))}
        </ul>
        <p className="muscles-note">
          Sets: 1 per primary muscle, ½ per secondary, working sets only. Forearms and traps are counted in each
          lift&apos;s detail.
        </p>
      </div>
    </AppShell>
  )
}

async function load(s: Services): Promise<{ data: MusclesData | null }> {
  const { catalog, library } = await s.catalog.load()
  const libraryMap = new Map(library.map((entry) => [entry.id, entry] as const))
  const overrides = await s.preferences.bodyweightOverrides().catch(() => ({}))
  const resolve = (id: string): Exercise | undefined => {
    const exercise = resolveExercise(id, catalog, libraryMap)
    return exercise && applyBodyweight(exercise, overrides)
  }
  const sessions = await s.sessions.list().catch((): Session[] => [])
  const { programs, activeProgramId } = await s.programs.load()
  const program = programs.find((p) => p.id === activeProgramId)
  return { data: program ? { sessions, program, resolve, library: libraryMap } : null }
}

/** The Progress tab's Muscles page: loads the Sessions and the active Program, then draws them. */
export function MusclesPage({ onBack }: ProgressPageProps<'muscles'>): JSX.Element {
  const loaded = useServiceData(load, ['programs', 'sessions', 'preferences'])
  const [now] = useState(() => Date.now())
  if (loaded.status !== 'ready') {
    return (
      <AppShell title="Muscles" onBack={onBack}>
        {loaded.status === 'error' ? <p className="muscles-note">Muscles could not be read.</p> : null}
      </AppShell>
    )
  }
  if (!loaded.data.data) {
    return (
      <AppShell title="Muscles" onBack={onBack}>
        <p className="muscles-note">Pick a Program to see your muscles against its plan.</p>
      </AppShell>
    )
  }
  return <MusclesView data={loaded.data.data} now={now} onBack={onBack} />
}
