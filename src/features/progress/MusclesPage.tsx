import { useMemo, useRef, useState } from 'react'
import { resolveExercise } from '../../data/resolve'
import { applyBodyweight } from '../../domain/bodyweight'
import { regionsFor, toRegionCounts, type Region, type Resolve } from '../../domain/muscles'
import { muscleLabel } from '../../domain/muscleLabels'
import { startOfWeek } from '../../domain/sessionsView'
import { WEEKLY_SET_RANGE, weeklyStanding, type Standing } from '../../domain/setRange'
import { numberText } from '../../domain/stats/copy'
import {
  muscleContributors,
  muscleWeeks,
  plannedPerWeek,
  STATS_MUSCLES,
  thisWeekMuscles,
  windowAverage,
} from '../../domain/stats/muscles'
import type { Weekday } from '../../domain/stats/weeks'
import type { Exercise, LibraryExercise, Muscle, Program, Session } from '../../types'
import { AppShell } from '../../ui/AppShell'
import { BodyMap } from '../../ui/body/BodyMap'
import { BodyMapLegend } from '../../ui/body/BodyMapLegend'
import { Segmented } from '../../ui/controls'
import { HeatCell, HeatLegend } from '../../ui/RegionHeat'
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
  /** The weekday weeks begin on; Monday when omitted. */
  weekStart?: Weekday
}

export type MusclesViewProps = { data: MusclesData; now: number; onBack: (() => void) | undefined }

type Span = 'two-weeks' | 'this-week' | 'four-weeks'

type Row = { muscle: Muscle; label: string; done: number; still: number; plan: number }

const label = muscleLabel

/** Whole numbers, half up. */
const whole = (n: number): string => String(Math.round(n))

const BAND = { from: WEEKLY_SET_RANGE.min, to: WEEKLY_SET_RANGE.max } as const

/** Where a weekly count sits against the typical range, on the whole number the row prints. */
const standingOf = (n: number): Standing => weeklyStanding(n)

/**
 * A row's standing against the Weekly set range, in words (V1-26, DX-03): ` · below 10–20`,
 * ` · above 10–20`, nothing within. One range, one verdict: a plan that sets a low count does not
 * excuse it, so this page, the Progress row and the Program tab say the same thing.
 */
const standingText = (n: number): string => {
  const standing = standingOf(n)
  return standing === 'within' ? '' : ` · ${standing} ${BAND.from}–${BAND.to}`
}
/** DX-03: the plan is news only where it differs from what was done (this week: done and still planned). */
const planDiffers = (row: Row): boolean => row.plan > 0 && whole(row.plan) !== whole(row.done + row.still)
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
  const weekStart = data.weekStart ?? 1
  const planned = plannedPerWeek(program, resolve, library)
  const weeks = muscleWeeks(sessions, now, resolve, library, weekStart)

  if (span === 'this-week') {
    const current = weeks.find((w) => w.inProgress)
    const owed = thisWeekMuscles(sessions, program, now, resolve, library, weekStart)
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
  const average = windowAverage(sessions, now, resolve, library, undefined, weekStart)
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
  // Near the top of the range, and over it, said apart (V1-26): 21 is above 10–20, not at its top.
  const named = (list: Row[]): string => list.map((r) => `${r.label} ${whole(r.done)}`).join(' and ')
  const above = rows.filter((r) => standingOf(r.done) === 'above')
  // DX-03: the rows below the range are named too, so the sentence never reads "on plan" alone
  // over rows that say "below 10–20".
  const below = rows.filter((r) => standingOf(r.done) === 'below')
  const belowNames = below.length > 2 ? `${below.length} muscles` : named(below)
  const topText =
    (above.length === 0
      ? ''
      : ` ${named(above)} ${above.length === 1 ? 'is' : 'are'} above the typical ${BAND.from}–${BAND.to}.`) +
    (below.length === 0
      ? ''
      : ` ${belowNames} ${below.length === 1 ? 'is' : 'are'} below ${above.length === 0 ? `the typical ${BAND.from}–${BAND.to}` : 'it'}.`)
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

const HEAT_WEEKS = 4

/** One calendar week's column of the matrix: its start and each muscle's sets. */
type MuscleColumn = { start: number; inProgress: boolean; sets: Map<Muscle, number> }

/** The last `HEAT_WEEKS` calendar weeks ending with `now`'s, empty weeks included, oldest first. */
function lastWeeks(data: MusclesData, now: number): MuscleColumn[] {
  const weekStart = data.weekStart ?? 1
  const byStart = new Map(
    muscleWeeks(data.sessions, now, data.resolve, data.library, weekStart).map((week) => [week.start, week] as const),
  )
  const current = startOfWeek(now, weekStart)
  return Array.from({ length: HEAT_WEEKS }, (_, index) => {
    const start = addDays(current, -7 * (HEAT_WEEKS - 1 - index))
    return byStart.get(start) ?? { start, inProgress: false, sets: new Map<Muscle, number>() }
  })
}

/** One half of the week heat table: a row label and one heat square per week. */
function WeekHeatHalf({ muscles, weeks }: { muscles: readonly Muscle[]; weeks: MuscleColumn[] }): JSX.Element {
  return (
    <table className="week-heat">
      <thead>
        <tr>
          <th scope="col">
            <span className="muscles-visually-hidden">Muscle</span>
          </th>
          {weeks.map((week) => (
            <th key={week.start} scope="col" className="week-heat-week" data-in-progress={week.inProgress || undefined}>
              {new Date(week.start).getDate()}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {muscles.map((muscle) => (
          <tr key={muscle} data-muscle={muscle}>
            <th scope="row" className="week-heat-label">
              {label(muscle)}
            </th>
            {weeks.map((week) => {
              const count = Math.round(week.sets.get(muscle) ?? 0)
              return (
                <td key={week.start}>
                  <HeatCell count={count} scale="week" title={`${label(muscle)} ${count} sets`} />
                </td>
              )
            })}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/** Muscle sets by calendar week (V2-06): the 12 muscles down, the last four weeks across. */
function MuscleWeeks({ weeks }: { weeks: MuscleColumn[] }): JSX.Element {
  const half = Math.ceil(STATS_MUSCLES.length / 2)
  return (
    <section className="muscles-weeks" aria-label="Muscle sets by week">
      <div className="week-heat-halves">
        <WeekHeatHalf muscles={STATS_MUSCLES.slice(0, half)} weeks={weeks} />
        <WeekHeatHalf muscles={STATS_MUSCLES.slice(half)} weeks={weeks} />
      </div>
      <HeatLegend scale="week" />
    </section>
  )
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
      {planDiffers(row) ? <span className="muscles-bullet-plan" data-part="plan" style={{ left: pct(row.plan) }} /> : null}
    </span>
  )
}

/** The Muscles page's drawing, over loaded data: the 2-week window or this week. */
export function MusclesView({ data, now, onBack }: MusclesViewProps): JSX.Element {
  const [span, setSpan] = useState<Span>('two-weeks')
  const [open, setOpen] = useState<Muscle | null>(null)
  const rowRefs = useRef(new Map<Muscle, HTMLElement>())
  const fourWeeks = span === 'four-weeks'
  const weekColumns = useMemo(() => (fourWeeks ? lastWeeks(data, now) : []), [data, now, fourWeeks])
  const model = useMemo(() => {
    if (!fourWeeks) return build(data, now, span)
    // The 4 weeks segment: its own range line and sentence; the map shades each muscle's
    // weekly average over the four columns.
    const base = build(data, now, 'two-weeks')
    const first = weekColumns[0].start
    const last = weekColumns[weekColumns.length - 1].start
    const rows = base.rows.map((row) => ({
      ...row,
      done: weekColumns.reduce((sum, week) => sum + (week.sets.get(row.muscle) ?? 0), 0) / weekColumns.length,
    }))
    return {
      ...base,
      rows,
      range: `weeks of ${dayMonth(first)} – ${dayMonth(last)}`,
      rangeNote: undefined,
      sentence: 'Sets per muscle in each of the last 4 weeks, this week so far last.',
    }
  }, [data, now, span, fourWeeks, weekColumns])

  const rows = [...model.rows].sort(
    (a, b) => a.done - b.done || STATS_MUSCLES.indexOf(a.muscle) - STATS_MUSCLES.indexOf(b.muscle),
  )
  const max = Math.max(25, ...rows.map((r) => Math.ceil(Math.max(r.done + r.still, r.plan))))

  const doneByMuscle = new Map(model.rows.map((r) => [r.muscle, r.done] as const))
  const regionCounts = toRegionCounts(doneByMuscle)

  const jump = (region: Region): void => {
    const muscle = STATS_MUSCLES.find((m) => regionsFor(m).includes(region))
    if (!muscle) return
    // The rows (and their contributors) are the 2-week and This week views; 4 weeks is a matrix.
    if (fourWeeks) setSpan('two-weeks')
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
            { value: 'this-week', label: 'This week' },
            { value: 'two-weeks', label: '2 weeks' },
            { value: 'four-weeks', label: '4 weeks' },
          ]}
          onChange={(next) => {
            setSpan(next)
            setOpen(null)
          }}
        />
        {fourWeeks ? <MuscleWeeks weeks={weekColumns} /> : null}
        {fourWeeks ? null : (
          <>
            <p className="muscles-legend">
              Band: {BAND.from}–{BAND.to} sets a week · tick: the plan, where it differs
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
                        {/* V6-19: the count has its unit: this week's sets, else a weekly average. */}
                        {`${whole(row.done)} ${span === 'this-week' ? 'sets' : 'sets/week'}`}
                        {/* This week counts what is still planned too: 2 done of 12 is not "below". */}
                        {standingText(row.done + row.still)}
                        {row.still > 0 || planDiffers(row) ? (
                          <span className="muscles-row-plan">
                            {row.still > 0 ? ` · ${whole(row.still)} still planned` : ''}
                            {planDiffers(row) ? ` · plan ${whole(row.plan)}` : ''}
                          </span>
                        ) : null}
                      </span>
                    </span>
                    <Bullet row={row} max={max} />
                  </button>
                  {open === row.muscle ? <p className="muscles-contrib">{arithmetic(row)}</p> : null}
                </li>
              ))}
            </ul>
          </>
        )}
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
  const stored = await s.preferences.weekStart().catch(() => 1)
  const weekStart = (Number.isInteger(stored) && stored >= 0 && stored <= 6 ? stored : 1) as Weekday
  return { data: program ? { sessions, program, resolve, library: libraryMap, weekStart } : null }
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
