import { useContext, useState, type ReactNode } from 'react'
import { resolveExercise } from '../../data/resolve'
import { applyBodyweight } from '../../domain/bodyweight'
import { isDeloadWeek } from '../../domain/deload'
import type { Resolve } from '../../domain/muscles'
import type { Weekday } from '../../domain/stats/weeks'
import { ServiceError, type Services } from '../../services'
import type { Exercise, Program, Session } from '../../types'
import { SettingsButton, ShellChromeContext } from '../../ui/AppShell'
import { Icon } from '../../ui/icons'
import { ResumeCard } from '../../ui/ResumeCard'
import { useServiceData } from '../useServiceData'
import { homeModelOf, type HomeLast, type HomeModel, type HomeToday } from './homeModel'
import { WorkoutArrows } from '../../ui/WorkoutArrows'
import { LiftLines } from './LiftLines'
import { SessionGrid } from './SessionGrid'
import { WeekRing } from './WeekRing'
import './Home.css'

/** A Session in progress: Home's Today panel becomes its Resume card and the dock reads Resume. */
export type HomeResume = { workoutName: string; programName: string; onResume(): void }

export type HomeActions = {
  /** Starts `workoutId` of the active Program. */
  onStartWorkout(workoutId: string): void
  /** A new trainee's pick: makes `programId` the active Program and starts `workoutId`. */
  onPickPlan(programId: string, workoutId: string): void
  /** Opens the workout page (today's workout, or `workoutId` the arrows switched to). */
  onOpenToday(workoutId?: string): void
  onOpenSession(sessionId: string): void
  onOpenSessions(): void
  onOpenProgress(): void
  onOpenLift(exerciseId: string): void
  onOpenSettings(): void
}

export type HomeScreenProps = HomeActions & {
  /** The clock; `Date.now` unless a test fixes it. */
  now?: () => number
  resume?: HomeResume | null
  /** Notes drawn under the date (storage unavailable, a stale active Program). */
  notices?: ReactNode
  /** Nothing can be stored: the new trainee's pick cannot be kept. */
  canStart?: boolean
}

type Loaded = {
  programs: Program[]
  activeProgramId: string | null
  sessions: Session[]
  resolve: Resolve
  weekStartsOn: Weekday
  reminders: number[] | null
  deloadWeek: number | null
}

async function load(s: Services): Promise<Loaded> {
  const { catalog, library, bundledPrograms } = await s.catalog.load()
  const libraryMap = new Map(library.map((entry) => [entry.id, entry] as const))
  const overrides = await s.preferences.bodyweightOverrides().catch(() => ({}))
  const resolve = (id: string): Exercise | undefined => {
    const exercise = resolveExercise(id, catalog, libraryMap)
    return exercise && applyBodyweight(exercise, overrides)
  }
  const [sessions, weekStartsOn, reminders, deloadWeek] = await Promise.all([
    s.sessions.list().catch((): Session[] => []),
    s.preferences
      .weekStart()
      .then((day) => day as Weekday)
      .catch((): Weekday => 1),
    Promise.resolve()
      .then(() => s.push.reminders())
      .then((r) => r?.days ?? null)
      .catch((): null => null),
    s.preferences.deloadWeek().catch((): null => null),
  ])
  try {
    const loaded = await s.programs.load()
    return { programs: loaded.programs, activeProgramId: loaded.activeProgramId, sessions, resolve, weekStartsOn, reminders, deloadWeek }
  } catch (error) {
    if (!(error instanceof ServiceError) || error.code !== 'storage-unavailable') throw error
    // Nothing can be stored: the bundled Programs are offered to pick from, and none can be taken up.
    return { programs: bundledPrograms, activeProgramId: null, sessions, resolve, weekStartsOn, reminders, deloadWeek }
  }
}

/**
 * v7 Home, the landing dashboard (docs/design/competitors-2026-11/home/home.md): reads the
 * Programs, the Sessions and the preferences through the services, works the moment out with
 * `homeModelOf`, and renders `HomeView`.
 */
export function HomeScreen({ now = Date.now, resume = null, notices, canStart = true, ...actions }: HomeScreenProps): JSX.Element {
  const loaded = useServiceData(load, ['programs', 'sessions', 'preferences'])
  if (loaded.status !== 'ready') {
    return <HomeView model={null} date="" resume={resume} notices={notices} canStart={canStart} {...actions} />
  }
  const at = now()
  const { programs, activeProgramId, sessions, resolve, weekStartsOn, reminders, deloadWeek } = loaded.data
  const program = programs.find((p) => p.id === activeProgramId) ?? null
  const model = homeModelOf({
    program,
    programs,
    sessions,
    resolve,
    now: at,
    weekStartsOn,
    reminders,
    live: resume !== null,
    deload: isDeloadWeek(deloadWeek, at, weekStartsOn),
  })
  return <HomeView model={model} date={model.date} resume={resume} notices={notices} canStart={canStart} {...actions} />
}

export type HomeViewProps = HomeActions & {
  /** null while the services load. */
  model: HomeModel | null
  date: string
  resume: HomeResume | null
  notices?: ReactNode
  canStart: boolean
}

function todayName(today: HomeToday, target: string): string {
  const parts = [today.title ? `${today.label}: ${today.title}` : today.label, ...today.lines]
  if (today.up) parts.push(`Up: ${today.up}`)
  if (today.prs > 0) parts.push(`${today.prs} PR${today.prs === 1 ? '' : 's'}`)
  if (today.ring) parts.push(`${today.ring.done} of ${today.ring.planned} sessions this week`)
  return `${parts.join('. ')}. ${target}`
}

/** Block 1: the one surface panel, the week ring beside the day's workout. One button. */
function TodayPanel({ today, onOpen }: { today: HomeToday; onOpen(): void }): JSX.Element {
  const target = today.target?.kind === 'session' ? 'Open its summary.' : 'Open the workout.'
  return (
    <button type="button" className="home-today cell" aria-label={todayName(today, target)} onClick={onOpen}>
      {today.ring ? <WeekRing ring={today.ring} /> : null}
      <span className="home-today-text" aria-hidden="true">
        <span className="home-label">{today.label}</span>
        {today.title ? <span className="home-today-title">{today.title}</span> : null}
        {today.lines.map((line) => (
          <span key={line} className="home-today-line">
            {line}
          </span>
        ))}
        {today.up || today.prs > 0 ? (
          <span className="home-today-up">
            {today.up ? <span className="home-up">{`↑ ${today.up}`}</span> : null}
            {today.prs > 0 ? <span className="tag tag-pr home-pr">{`${today.prs} PR`}</span> : null}
          </span>
        ) : null}
      </span>
      <span className="home-chevron home-today-chevron" aria-hidden="true">
        <Icon name="ChevronRight" size={18} />
      </span>
    </button>
  )
}

/** Block 1 for a new trainee: the bundled Programs as radio rows; the dock starts the one picked. */
function PlanPicker({
  model,
  selectedId,
  onSelect,
}: {
  model: HomeModel
  selectedId: string | null
  onSelect(id: string): void
}): JSX.Element {
  return (
    <section className="home-plans" aria-labelledby="home-plans-label">
      <h2 className="home-label" id="home-plans-label">
        Pick a plan
      </h2>
      <div className="home-plan-list" role="radiogroup" aria-labelledby="home-plans-label">
        {model.plans.map((plan) => (
          <button
            key={plan.id}
            type="button"
            className="home-plan cell"
            role="radio"
            aria-checked={plan.id === selectedId}
            onClick={() => onSelect(plan.id)}
          >
            <span className="home-plan-radio" data-on={plan.id === selectedId ? 'true' : undefined} aria-hidden="true" />
            <span className="home-plan-text">
              <span className="home-plan-name">{plan.name}</span>
              <span className="home-plan-summary">{plan.summary}</span>
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}

/** Block 4: one ledger row, the last Session (or, just after one, what is next). */
function LastRow({ last, onOpenSession, onOpenToday }: { last: HomeLast; onOpenSession(id: string): void; onOpenToday(): void }): JSX.Element {
  if (last.kind === 'next') {
    return (
      <button
        type="button"
        className="home-last cell"
        aria-label={`Next: ${last.workoutName}${last.day ? `, ${last.day}` : ''}. Open the workout.`}
        onClick={onOpenToday}
      >
        <span className="home-chip" data-tone={last.tone} aria-hidden="true">
          {last.letter}
        </span>
        <span className="home-last-name" aria-hidden="true">
          {`Next: ${last.workoutName}`}
          {last.day ? <span className="home-last-detail">{` · ${last.day}`}</span> : null}
        </span>
        <span className="home-chevron" aria-hidden="true">
          <Icon name="ChevronRight" size={18} />
        </span>
      </button>
    )
  }
  const verdict = [
    last.up ? `${last.up.count} of ${last.up.of} lifts up` : null,
    last.prs > 0 ? `${last.prs} PR${last.prs === 1 ? '' : 's'}` : null,
  ].filter(Boolean)
  return (
    <button
      type="button"
      className="home-last cell"
      aria-label={`Last time: ${last.workoutName}, ${last.day}, ${last.detail}${verdict.length ? `. ${verdict.join(', ')}` : ''}. Open its summary.`}
      onClick={() => onOpenSession(last.sessionId)}
    >
      <span className="home-chip" data-tone={last.tone} aria-hidden="true">
        {last.letter}
      </span>
      <span className="home-last-name" aria-hidden="true">
        {last.day}
        <span className="home-last-detail">{` · ${last.detail}`}</span>
      </span>
      <span className="home-last-verdict" aria-hidden="true">
        {last.up && last.up.count > 0 ? <span className="home-up">{`↑ ${last.up.count} of ${last.up.of}`}</span> : null}
        {last.prs > 0 ? <span className="tag tag-pr home-pr">{`${last.prs} PR`}</span> : null}
      </span>
      <span className="home-chevron" aria-hidden="true">
        <Icon name="ChevronRight" size={18} />
      </span>
    </button>
  )
}

/**
 * Home's four blocks and its dock: Today (or Resume, or the plan pick), Lifts, Sessions and Last
 * time, each tapping through to its detail, and one Start bar docked above the tabs.
 */
export function HomeView(props: HomeViewProps): JSX.Element {
  const { model, resume } = props
  const { trailing } = useContext(ShellChromeContext)
  const [picked, setPicked] = useState<string | null>(null)
  const selectedId = picked ?? model?.plans[0]?.id ?? null
  const selected = model?.plans.find((plan) => plan.id === selectedId) ?? null

  // The workout the Today panel's ‹ › arrows switched to; forgotten when the due one changes.
  const workouts = model?.workouts ?? []
  const dueWorkoutId = model?.dueWorkoutId ?? null
  const [chosen, setChosen] = useState<{ dueId: string | null; workoutId: string | null }>({ dueId: dueWorkoutId, workoutId: null })
  if (chosen.dueId !== dueWorkoutId) setChosen({ dueId: dueWorkoutId, workoutId: null })
  const chosenWorkout =
    chosen.workoutId !== null && chosen.workoutId !== dueWorkoutId
      ? (workouts.find((w) => w.workoutId === chosen.workoutId) ?? null)
      : null
  const offeredId = chosenWorkout?.workoutId ?? dueWorkoutId
  const offeredIndex = Math.max(0, workouts.findIndex((w) => w.workoutId === offeredId))
  const step =
    workouts.length > 1
      ? {
          prev: workouts[(offeredIndex - 1 + workouts.length) % workouts.length],
          next: workouts[(offeredIndex + 1) % workouts.length],
          onStep: (workoutId: string) => setChosen({ dueId: dueWorkoutId, workoutId }),
        }
      : null
  const shownToday: HomeToday | null = model
    ? chosenWorkout
      ? { ...model.today, title: chosenWorkout.name, lines: chosenWorkout.lines, up: null, prs: 0 }
      : model.today
    : null

  let dock: JSX.Element | null = null
  if (resume) {
    dock = (
      <button type="button" className="btn-primary home-start" onClick={resume.onResume}>
        Resume
      </button>
    )
  } else if (model?.dock?.kind === 'start') {
    const { style } = model.dock
    const workoutId = chosenWorkout?.workoutId ?? model.dock.workoutId
    const label = chosenWorkout ? `Start ${chosenWorkout.name}` : model.dock.label
    dock = (
      <button type="button" className="btn-primary home-start" data-style={style} onClick={() => props.onStartWorkout(workoutId)}>
        {label}
      </button>
    )
  } else if (model?.dock?.kind === 'pick') {
    const first = selected?.firstWorkout ?? null
    dock = (
      <button
        type="button"
        className="btn-primary home-start"
        disabled={!selected || !first || !props.canStart}
        onClick={() => selected && first && props.onPickPlan(selected.id, first.id)}
      >
        {first ? `Start ${first.name}` : 'Pick a plan'}
      </button>
    )
  }

  const lifts = model?.lifts
  const liftsName = lifts?.verdict
    ? `Lifts, 12 weeks: ${lifts.verdict.text}. Open Progress.`
    : 'Lifts, 12 weeks. Open Progress.'

  return (
    <div className="home" data-state={model?.state}>
      <header className="home-top app-header">
        <h1 className="home-date">{props.date || 'Home'}</h1>
        {trailing ? <div className="home-trailing app-header-trailing">{trailing}</div> : null}
        <SettingsButton onOpen={props.onOpenSettings} />
      </header>
      {props.notices ? <div className="home-notices">{props.notices}</div> : null}
      {/* A Session in progress is resumable whatever else Home is still working out. */}
      {resume ? (
        <ResumeCard programName={resume.programName} workoutName={resume.workoutName} onResume={resume.onResume} />
      ) : null}
      {model === null ? null : (
        <>
          {resume ? null : model.state === 'new' ? (
            <PlanPicker model={model} selectedId={selectedId} onSelect={setPicked} />
          ) : (
            <WorkoutArrows step={step} className="home-today-row">
              <TodayPanel
                today={shownToday ?? model.today}
                onOpen={() => {
                  const target = model.today.target
                  if (target?.kind === 'session') props.onOpenSession(target.sessionId)
                  else if (target?.kind === 'workout') props.onOpenToday(chosenWorkout?.workoutId)
                }}
              />
            </WorkoutArrows>
          )}

          <section className="home-block" aria-label="Lifts">
            <button type="button" className="home-block-head cell" aria-label={liftsName} onClick={props.onOpenProgress}>
              <span className="home-label" aria-hidden="true">
                Lifts · 12 weeks
              </span>
              {/* V7R-07: the verdict and its chevron wrap as one, so "›" never sits on a line alone. */}
              <span className="home-block-end">
                {lifts?.verdict ? (
                  <span className="home-verdict" data-tone={lifts.verdict.tone} aria-hidden="true">
                    {lifts.verdict.tone === 'up' ? `↑ ${lifts.verdict.text}` : lifts.verdict.text}
                  </span>
                ) : null}
                <span className="home-chevron" aria-hidden="true">
                  <Icon name="ChevronRight" size={18} />
                </span>
              </span>
            </button>
            {lifts ? <LiftLines lifts={lifts} onOpenLift={props.onOpenLift} /> : null}
            {model.state === 'new' ? <p className="home-ghost-note">Each lift draws its line after 4 sessions.</p> : null}
          </section>

          <section className="home-block" aria-label="Sessions">
            <button
              type="button"
              className="home-sessions cell"
              aria-label={`Sessions: ${model.calendar.count} in the last 12 weeks. Open Sessions.`}
              onClick={props.onOpenSessions}
            >
              <span className="home-block-head-row" aria-hidden="true">
                <span className="home-label">Sessions · 12 weeks</span>
                <span className="home-chevron">
                  <Icon name="ChevronRight" size={18} />
                </span>
              </span>
              <span className="home-cal">
                <SessionGrid calendar={model.calendar} />
                <span className="home-cal-count" aria-hidden="true">
                  <span className="home-cal-number" data-zero={model.calendar.count === 0 ? 'true' : undefined}>
                    {model.calendar.count}
                  </span>
                  <span className="home-cal-caption">
                    {model.calendar.count === 0 ? 'Every session lands here' : 'sessions in 12 weeks'}
                  </span>
                </span>
              </span>
            </button>
          </section>

          {model.last ? <LastRow last={model.last} onOpenSession={props.onOpenSession} onOpenToday={props.onOpenToday} /> : null}
        </>
      )}
      {dock ? <div className="home-dock">{dock}</div> : null}
    </div>
  )
}
