import { useState } from 'react'
import { resolveExercise } from '../../data/resolve'
import { applyBodyweight } from '../../domain/bodyweight'
import {
  liftChange,
  liftRecords,
  loggedLifts,
  pointsInRange,
  recordAts,
  searchEntries,
  shortDay,
  type LiftRange,
  type SearchEntry,
} from '../../domain/lifts'
import { progression, type Progression } from '../../domain/progression'
import { seriesFor, type Series } from '../../domain/series'
import { loadText } from '../../domain/setText'
import { volumeSeries } from '../../domain/volume'
import type { Resolve } from '../../domain/muscles'
import type { Exercise, ExercisePlan, Program, Session } from '../../types'
import { BarChart } from '../../ui/charts/BarChart'
import { LineChart } from '../../ui/charts/LineChart'
import { Segmented } from '../../ui/controls'
import { Icon } from '../../ui/icons'
import { DetailOverlay } from '../overlays/DetailOverlay'
import { useServiceData } from '../useServiceData'
import './LiftsScreen.css'

/** How many search results the list shows before asking for a narrower search. */
const MAX_RESULTS = 50

const RANGES: { value: LiftRange; label: string }[] = [
  { value: '1M', label: '1M' },
  { value: '3M', label: '3M' },
  { value: '1Y', label: '1Y' },
]

const RANGE_WORDS: Record<LiftRange, string> = { '1M': 'month', '3M': 'three months', '1Y': 'year' }

export type LiftsViewProps = {
  /** Every finished Session, any order. */
  sessions: Session[]
  programs: Program[]
  resolve: Resolve
  /** The catalog's exercises first, then the rest of the library: what the search looks through. */
  searchable: SearchEntry[]
  /** Opens an exercise's detail (the library id). */
  onOpenExercise(libraryId: string): void
  /** Today, for the chart's ranges and its dates; the clock when omitted. */
  now?: Date
}

/** The Exercises a session holds `exerciseId` in, newest first. */
function sessionsHolding(sessions: Session[], exerciseId: string): Session[] {
  return sessions
    .filter((session) => session.entries.some((entry) => entry.exerciseId === exerciseId))
    .sort((a, b) => b.startedAt - a.startedAt)
}

function firstPlan(programs: Program[], exerciseId: string): ExercisePlan | undefined {
  for (const program of programs) {
    for (const workout of program.workouts) {
      const plan = workout.exercises.find((candidate) => candidate.exerciseId === exerciseId)
      if (plan) return plan
    }
  }
  return undefined
}

/** The exercise's own plan, or the plan it was last swapped in for (as Stats reads it). */
function planFor(exerciseId: string, sessions: Session[], programs: Program[]): ExercisePlan | undefined {
  const own = firstPlan(programs, exerciseId)
  if (own) return own
  for (const session of sessionsHolding(sessions, exerciseId)) {
    const planned = Object.entries(session.swaps ?? {}).find(([, doneInstead]) => doneInstead === exerciseId)
    if (planned) return firstPlan(programs, planned[0])
  }
  return undefined
}

const oneDecimal = (value: number): string => (Math.round(value * 10) / 10).toFixed(1)

/** The hero number and its caption for a series: e1RM in kg, reps, or a signed Load. */
function headline(series: Series, value: number): { value: string; caption: string; unit: string } {
  switch (series.kind) {
    case 'e1rm':
      return { value: `${oneDecimal(value)} kg`, caption: 'Estimated 1RM', unit: 'kg' }
    case 'reps':
      return { value: `${Math.round(value)} reps`, caption: 'Reps per session', unit: 'reps' }
    case 'load':
      return { value: loadText({ weightKg: null, loadKg: value }), caption: 'Heaviest load', unit: 'kg' }
  }
}

/** How far a lift moved since `since`: `+8.3 kg since 21 Sep`, or `No change since 21 Sep`. */
function changeText(delta: number, unit: string, since: string): string {
  const rounded = Math.round(delta * 10) / 10
  if (rounded === 0) return `No change since ${since}`
  return `${signed(rounded, unit)} since ${since}`
}

function signed(rounded: number, unit: string): string {
  const text = Number.isInteger(rounded) ? String(Math.abs(rounded)) : Math.abs(rounded).toFixed(1)
  return `${rounded < 0 ? '−' : '+'}${text} ${unit}`
}

/** The "Next" row: what to lift next time, and how the last session got there. */
function NextRow({ progress }: { progress: Progression }): JSX.Element {
  const { suggestion, isFull, workingWeightKg, achievedReps, targetReps } = progress
  let text: string
  if (isFull && suggestion?.kind === 'add-weight') text = `Next: ${String(suggestion.nextWeightKg)} kg`
  else if (isFull && suggestion?.kind === 'add-load') text = `Next: ${loadText({ weightKg: null, loadKg: suggestion.nextLoadKg })}`
  else if (isFull && suggestion?.kind === 'add-set') text = 'Next: add a set'
  else if (workingWeightKg !== null) text = `Next: stay at ${String(workingWeightKg)} kg`
  else text = 'Next: same again'
  return (
    <div className="card lifts-next">
      <Icon name={isFull ? 'ArrowUp' : 'ArrowRight'} size={18} />
      <span className="lifts-next-text">{text}</span>
      <span
        className="lifts-next-note"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={targetReps}
        aria-valuenow={achievedReps}
        aria-valuetext={`${achievedReps} of ${targetReps} reps`}
      >
        {isFull ? 'top of range hit' : `${achievedReps} of ${targetReps} reps`}
      </span>
    </div>
  )
}

function LiftCard({
  exercise,
  sessions,
  programs,
  now,
}: {
  exercise: Exercise
  sessions: Session[]
  programs: Program[]
  now: Date
}): JSX.Element {
  const [range, setRange] = useState<LiftRange>('1M')
  const series = seriesFor(exercise, sessions)
  const shown: Series = { kind: series.kind, points: pointsInRange(series.points, range, now) }
  const change = liftChange(shown.points) ?? liftChange(series.points)
  const head = change ? headline(series, change.latest) : null
  const plan = planFor(exercise.id, sessions, programs)
  const newest = sessionsHolding(sessions, exercise.id)[0]
  const lastEntries = newest
    ? newest.entries.filter((entry) => entry.exerciseId === exercise.id).sort((a, b) => a.setIndex - b.setIndex)
    : []
  const records = liftRecords(exercise, sessions)

  return (
    <>
      <section className="card lifts-card" aria-label={exercise.name}>
        <div className="lifts-card-head">
          <h2 className="lifts-card-title">{exercise.name}</h2>
          <Segmented name="lifts-range" label="Range" value={range} options={RANGES} onChange={setRange} />
        </div>
        {head && change ? (
          <>
            <div className="lifts-hero">
              <span className="lifts-hero-value">{head.value}</span>
              <span className="lifts-hero-change">
                {shown.points.length > 1 ? changeText(change.delta, head.unit, shortDay(change.since, now)) : ''}
              </span>
              {shown.points.length > 0 ? (
                <span className="lifts-legend">
                  <i className="lifts-legend-dot" aria-hidden="true" />
                  Record
                </span>
              ) : null}
            </div>
            <div className="lifts-hero-caption">{head.caption}</div>
          </>
        ) : null}
        {shown.points.length > 0 ? (
          <LineChart series={shown} title={`${exercise.name} ${head?.caption.toLowerCase() ?? ''}`} recordAts={recordAts(series.points).filter((at) => shown.points.some((point) => point.at === at))} compactDates />
        ) : (
          <p className="lifts-empty">{`No ${exercise.name} sessions in the last ${RANGE_WORDS[range]}.`}</p>
        )}
      </section>
      {plan ? <NextRow progress={progression(exercise, plan, lastEntries)} /> : null}
      {records.length > 0 ? (
        <div className="card lifts-records">
          <table className="lifts-table">
            <thead>
              <tr>
                <th className="lifts-th">Record</th>
                <th className="lifts-th lifts-num">Best</th>
                <th className="lifts-th lifts-num">Date</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={record.kind} className="lifts-record">
                  <td className="lifts-td">{record.label}</td>
                  <td className="lifts-td lifts-num lifts-best">{record.best}</td>
                  <td className="lifts-td lifts-num lifts-date">{shortDay(record.at, now)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </>
  )
}

/** The volume chart Stats drew, kept one tap away under the lift. */
function Volume({ sessions, resolve, programs }: Pick<LiftsViewProps, 'sessions' | 'resolve' | 'programs'>): JSX.Element | null {
  const points = volumeSeries(sessions, resolve, programs)
  if (points.length === 0) return null
  const bodyweightPoints = points.filter((point) => point.bodyweightReps > 0)
  const latestBodyweight = bodyweightPoints[bodyweightPoints.length - 1]
  return (
    <>
      {latestBodyweight ? (
        <p className="lifts-note">{`${latestBodyweight.workoutName}: ${latestBodyweight.bodyweightReps} bodyweight reps`}</p>
      ) : null}
      <details className="card lifts-volume">
        <summary className="lifts-volume-summary">
          Volume per session
          <Icon name="ChevronDown" size={18} />
        </summary>
        <BarChart
          bars={points.map((point) => ({ at: point.at, label: point.workoutName, value: point.kg }))}
          title="Volume per session"
        />
        {bodyweightPoints.length > 0 ? (
          <ul className="lifts-bodyweight-reps">
            {bodyweightPoints.map((point) => (
              <li key={point.at}>{`${point.workoutName}: ${point.bodyweightReps} bodyweight reps`}</li>
            ))}
          </ul>
        ) : null}
      </details>
    </>
  )
}

/**
 * The Lifts tab (redesign S6b): a search over every exercise, chips of the trainee's own lifts,
 * and for the chosen lift its estimated 1RM over 1M/3M/1Y with records marked, what to lift next,
 * and its records; then the bodyweight-reps note and the volume chart Stats used to carry.
 */
export function LiftsView({ sessions, programs, resolve, searchable, onOpenExercise, now = new Date() }: LiftsViewProps): JSX.Element {
  const [query, setQuery] = useState('')
  const lifts = loggedLifts(sessions, programs, resolve)
  const [chosenId, setChosenId] = useState<string | undefined>(undefined)
  const chosen = lifts.find((lift) => lift.id === chosenId) ?? lifts[0]

  const needle = query.trim().toLowerCase()
  const results = needle === '' ? [] : searchable.filter((entry) => entry.name.toLowerCase().includes(needle))

  return (
    <div className="lifts">
      <label className="lifts-search">
        <Icon name="Search" size={18} />
        <input
          type="search"
          className="lifts-search-input"
          aria-label="Search exercises"
          placeholder={`Search ${searchable.length} exercises`}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      {needle !== '' ? (
        results.length === 0 ? (
          <p className="lifts-empty">{`No exercise matches "${query.trim()}".`}</p>
        ) : (
          <ul className="card lifts-results" aria-label="Search results">
            {results.slice(0, MAX_RESULTS).map((entry) => (
              <li key={entry.libraryId}>
                <button type="button" className="cell lifts-result" onClick={() => onOpenExercise(entry.libraryId)}>
                  <span className="lifts-result-name">{entry.name}</span>
                  {entry.muscle ? <span className="lifts-result-muscle">{entry.muscle}</span> : null}
                  <Icon name="ChevronRight" size={18} />
                </button>
              </li>
            ))}
            {results.length > MAX_RESULTS ? (
              <li className="lifts-result-more">{`${results.length - MAX_RESULTS} more: narrow the search to see them.`}</li>
            ) : null}
          </ul>
        )
      ) : chosen ? (
        <>
          <div className="lifts-chips" role="group" aria-label="Your lifts">
            {lifts.map((lift) => (
              <button
                key={lift.id}
                type="button"
                className="chip lifts-chip"
                aria-pressed={lift.id === chosen.id}
                onClick={() => setChosenId(lift.id)}
              >
                {lift.name}
              </button>
            ))}
          </div>
          <LiftCard key={chosen.id} exercise={chosen} sessions={sessions} programs={programs} now={now} />
          <Volume sessions={sessions} resolve={resolve} programs={programs} />
        </>
      ) : (
        <p className="lifts-empty">No sets yet. Log a set and your lifts, their estimated 1RM and records show here.</p>
      )}
    </div>
  )
}

/**
 * The Lifts tab as its own container over services: loads the finished Sessions, Programs,
 * catalog, library and the trainee's Bodyweight overrides, refreshes on the `'sessions'`,
 * `'programs'` and `'preferences'` topics, and opens an exercise's detail over itself. Renders
 * the tab's content only; the shell around it (title "Lifts", tab bar) is the caller's.
 */
export function LiftsScreen(): JSX.Element | null {
  const [openLibraryId, setOpenLibraryId] = useState<string | null>(null)
  const sessionsData = useServiceData((services) => services.sessions.list(), ['sessions'])
  const programsData = useServiceData(
    (services) => services.programs.load().then((loaded) => loaded.programs),
    ['programs'],
  )
  const catalogData = useServiceData((services) => services.catalog.load(), [])
  const overridesData = useServiceData(
    (services) => services.preferences.bodyweightOverrides().catch((): Record<string, boolean> => ({})),
    ['preferences'],
  )
  const gymEquipment = useServiceData((services) => services.preferences.gymEquipment(), ['preferences'])

  if (sessionsData.status !== 'ready' || programsData.status !== 'ready' || catalogData.status !== 'ready') {
    return null
  }
  const { catalog, library, videos } = catalogData.data
  const libraryMap = new Map(library.map((entry) => [entry.id, entry] as const))
  const overrides = overridesData.status === 'ready' ? overridesData.data : {}
  const resolve: Resolve = (id) => {
    const exercise = resolveExercise(id, catalog, libraryMap)
    return exercise && applyBodyweight(exercise, overrides)
  }

  return (
    <>
      <LiftsView
        sessions={sessionsData.data}
        programs={programsData.data}
        resolve={resolve}
        searchable={searchEntries(catalog, library)}
        onOpenExercise={setOpenLibraryId}
      />
      {openLibraryId === null ? null : (
        <DetailOverlay
          libraryId={openLibraryId}
          catalog={catalog}
          library={library}
          videos={videos}
          gymEquipment={gymEquipment.status === 'ready' ? gymEquipment.data : null}
          onBack={() => setOpenLibraryId(null)}
          onOpenDetail={setOpenLibraryId}
        />
      )}
    </>
  )
}
