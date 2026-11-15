import { useContext, useState, type ReactNode } from 'react'
import { SettingsButton, ShellChromeContext } from '../../ui/AppShell'
import { Icon } from '../../ui/icons'
import './DashboardScreen.css'
import type { TrainCard, TrainLiftRow, WeekStrip } from './trainCard'

/** How the header's second line reads the phone's cloud copy. */
export type DashboardSync =
  | { kind: 'offline' }
  | { kind: 'syncing' }
  | { kind: 'synced'; ago: string }
  | { kind: 'local' }
  | { kind: 'failed' }

/** One Program the new trainee can pick, with each of its workouts' size. */
export type ProgramOption = {
  id: string
  name: string
  summary: string
  workouts: { name: string; summary: string }[]
}

export type DashboardData =
  | { kind: 'loading' }
  | {
      kind: 'no-program'
      options: ProgramOption[]
      selectedId: string | null
      canUse: boolean
      onSelect(id: string): void
      onUse(id: string): void
    }
  | {
      kind: 'ready'
      /** The workout due with each lift's next step; `null` when the Program has no workout. */
      card: TrainCard | null
      due: DockWorkout | null
      /**
       * Every workout of the Program the dock can offer in place of the one due, in Program
       * order (the due one among them). Omitted or one long: the dock offers the due one only.
       */
      workouts?: DockWorkout[]
      /**
       * The card of each workout the dock can offer, by workout id, so "Change" redraws the card
       * for the one chosen (V1-21). The due one falls back to `card`.
       */
      cards?: Record<string, TrainCard>
      /** This week's strip, drawn at the top of Train (V2-05); omitted, none is drawn. */
      week?: WeekStrip
    }

/** A workout the dock offers to start: its name, when it was last done and its size. */
export type DockWorkout = { workoutId: string; name: string; last: string | null; summary: string }

/** The Session in progress the dock offers to resume in place of a start. */
export type DashboardResume = { workoutName: string; programName: string; onResume(): void }

export type DashboardViewProps = {
  /** Today, as `formatDay` reads it: `Tue 13 Oct`. */
  today: string
  sync: DashboardSync
  data: DashboardData
  onSync(): void
  onOpenSettings(): void
  onStartWorkout(workoutId: string): void
  /** Notes drawn under the header (storage unavailable, a backup due). */
  notices?: ReactNode
  /** A Session in progress: the dock resumes it rather than starting another. */
  resume?: DashboardResume | null
}

function SyncLine({ today, sync }: { today: string; sync: DashboardSync }): JSX.Element {
  if (sync.kind === 'offline') {
    return (
      <p className="dashboard-status dashboard-status-offline">
        <Icon name="CloudOff" size={16} />
        Offline · saved on this phone
      </p>
    )
  }
  const tail = {
    syncing: 'Syncing…',
    synced: sync.kind === 'synced' ? `Synced ${sync.ago}` : '',
    local: 'Saved on this phone',
    failed: 'Not synced · saved on this phone',
  }[sync.kind]
  return <p className="dashboard-status">{`${today} · ${tail}`}</p>
}

/** "This week" at the top of Train (V2-05): each day with the workout done on it, and done of planned. */
function WeekStripRow({ week }: { week: WeekStrip }): JSX.Element {
  return (
    <section className="dashboard-week" aria-label="This week">
      <span className="dashboard-week-title">This week</span>
      <ol className="dashboard-week-days">
        {week.days.map((day) => (
          <li
            key={day.key}
            className={day.today ? 'dashboard-week-day dashboard-week-today' : 'dashboard-week-day'}
            aria-label={day.workout ? `${day.name} ${day.workout}` : day.name}
            aria-current={day.today ? 'date' : undefined}
          >
            <span className="dashboard-week-initial" aria-hidden="true">
              {day.initial}
            </span>
            {day.workout ? (
              <span className="dashboard-week-done" aria-hidden="true">
                {day.workout}
              </span>
            ) : (
              <span className="dashboard-week-rest" aria-hidden="true" />
            )}
          </li>
        ))}
      </ol>
      <span className="dashboard-week-count">{`${week.done} of ${week.planned}`}</span>
    </section>
  )
}

/** `3 × 70 kg`: the planned Sets at the Set 1 Preset; `3 sets` with no weight to go on. */
function presetText(lift: TrainLiftRow): string | null {
  if (lift.sets === undefined) return null
  return lift.load ? `${lift.sets} × ${lift.load}` : `${lift.sets} sets`
}

/** The row's second line: the step up when the lift is ready, or the hold. */
function stepNote(lift: TrainLiftRow): JSX.Element | null {
  if (!lift.step) return null
  if (lift.step.hold) return <span className="dashboard-step-hold">{`stay at ${lift.step.at}`}</span>
  if (!lift.step.suggest) return null
  return (
    <span className="dashboard-step-ready">
      <Icon name="ArrowUp" size={14} />
      {`step up · ${lift.step.suggest}`}
    </span>
  )
}

/**
 * Today's Workout as it will be lifted (V2-05): one row per Plan with its Sets at the Set 1
 * Preset and the rep range, and a step-up marker on a lift that is ready. The workout's name,
 * size and duration live in the dock under it.
 */
function DueCard({ card }: { card: TrainCard }): JSX.Element {
  return (
    <section className="dashboard-train" aria-label={card.name}>
      {card.deload ? <p className="dashboard-step-deload">Deload week · Presets 10% lighter</p> : null}
      {card.lifts.length > 0 ? (
        <ul className="dashboard-steps" aria-label={`${card.name} lifts`}>
          {card.lifts.map((lift) => {
            const preset = presetText(lift)
            const note = stepNote(lift)
            return (
              <li key={lift.exerciseId} className="dashboard-step">
                <div className="dashboard-step-line">
                  <span className="dashboard-step-name">{lift.name}</span>
                  {preset ? (
                    <span className="dashboard-step-text">
                      <span className="dashboard-step-preset">{preset}</span>
                      {lift.reps ? <span className="dashboard-step-reps">{` · ${lift.reps}`}</span> : null}
                    </span>
                  ) : null}
                </div>
                {note ? <div className="dashboard-step-note">{note}</div> : null}
              </li>
            )
          })}
        </ul>
      ) : null}
    </section>
  )
}

function Header({
  today,
  sync,
  onSync,
  onOpenSettings,
}: Pick<DashboardViewProps, 'today' | 'sync' | 'onSync' | 'onOpenSettings'>): JSX.Element {
  // The app root's header slot ("Update ready") rides beside the Dashboard's own buttons.
  const { trailing } = useContext(ShellChromeContext)
  return (
    // The tab's one header: the shell around the Dashboard draws none of its own (`ownHeader`),
    // so this one carries the shell header's classes too.
    <header className="dashboard-header app-header">
      <div className="dashboard-heading">
        <h1 className="dashboard-title">Train</h1>
        <SyncLine today={today} sync={sync} />
      </div>
      {trailing ? <div className="dashboard-header-trailing app-header-trailing">{trailing}</div> : null}
      <div className="dashboard-header-actions">
        {sync.kind === 'offline' ? null : (
          <button type="button" className="icon-btn dashboard-icon-btn" aria-label="Sync now" onClick={onSync}>
            <Icon name={sync.kind === 'synced' ? 'CloudCheck' : 'Cloud'} size={22} />
          </button>
        )}
        {/* The shell's gear, which carries the backup-due marker when a backup is due. */}
        <SettingsButton onOpen={onOpenSettings} />
      </div>
    </header>
  )
}

/** The dock while a Session is in progress: its workout, and the way back into it. */
function ResumeDock({ resume }: { resume: DashboardResume }): JSX.Element {
  return (
    <div className="dashboard-dock">
      <p className="dashboard-due">
        <span className="dashboard-due-name">{`${resume.workoutName} in progress`}</span>
      </p>
      <p className="dashboard-due-size">{resume.programName}</p>
      <button type="button" className="btn-primary dashboard-start resume-workout" onClick={resume.onResume}>
        {`Resume ${resume.workoutName}`}
      </button>
    </div>
  )
}

/**
 * The dock with the workout due and its start button. A Program of several workouts can offer
 * another in its place: "Change" steps through them, and the line drops "due" off any other.
 */
function StartDock({
  due,
  offered,
  workouts,
  onChange,
  onStart,
}: {
  due: DockWorkout
  offered: DockWorkout
  workouts: DockWorkout[]
  onChange(workoutId: string): void
  onStart(workoutId: string): void
}): JSX.Element {
  const isDue = offered.workoutId === due.workoutId

  function next(): void {
    const index = workouts.findIndex((workout) => workout.workoutId === offered.workoutId)
    onChange(workouts[(index + 1) % workouts.length].workoutId)
  }

  return (
    <div className="dashboard-dock">
      <div className="dashboard-due-row">
        <p className="dashboard-due">
          <span className="dashboard-due-name">{isDue ? `${offered.name} due` : offered.name}</span>
          {offered.last ? <span className="dashboard-due-last">{` · last ${offered.last}`}</span> : null}
        </p>
        {workouts.length > 1 ? (
          <button type="button" className="btn-quiet dashboard-change" aria-label="Choose another workout" onClick={next}>
            Change
          </button>
        ) : null}
      </div>
      <p className="dashboard-due-size">{offered.summary}</p>
      <button type="button" className="btn-primary dashboard-start" onClick={() => onStart(offered.workoutId)}>
        {`Start ${offered.name}`}
      </button>
    </div>
  )
}

/**
 * The Train home screen (E18 O24, V2-05): this week's strip, the workout due as Set 1 opens each
 * lift, and its start button docked at the bottom. With no Program yet it offers the Programs to pick from instead.
 */
export function DashboardView(props: DashboardViewProps): JSX.Element {
  const { data } = props
  // The workout "Change" picked, held here so the card and the dock show the same one (V1-21).
  // It is forgotten when the workout due changes.
  const dueId = data.kind === 'ready' ? (data.due?.workoutId ?? null) : null
  const [chosen, setChosen] = useState<{ dueId: string | null; workoutId: string | null }>({ dueId, workoutId: null })
  if (chosen.dueId !== dueId) setChosen({ dueId, workoutId: null })
  let body: JSX.Element | null = null
  // A Session in progress is resumable whatever else the Dashboard is still working out. The
  // dock keeps its place in the tree as the data arrives, so a press on it is never lost.
  let dock: JSX.Element | null = props.resume ? <ResumeDock resume={props.resume} /> : null

  if (data.kind === 'no-program') {
    const selected = data.options.find((option) => option.id === data.selectedId) ?? null
    body = (
      <>
        <section className="card dashboard-pick" aria-labelledby="dashboard-pick-title">
          <h2 className="dashboard-pick-title" id="dashboard-pick-title">
            No program yet
          </h2>
          <p className="dashboard-pick-lead">Pick a program to get a plan for every session.</p>
          {data.options.map((option) => (
            <button
              key={option.id}
              type="button"
              className="btn-secondary dashboard-program"
              aria-pressed={option.id === data.selectedId}
              onClick={() => data.onSelect(option.id)}
            >
              <span className="dashboard-program-head">
                <span className="dashboard-program-text">
                  <span className="dashboard-program-name">{option.name}</span>
                  <span className="dashboard-program-summary">{option.summary}</span>
                </span>
                {option.id === data.selectedId ? (
                  <span className="dashboard-program-check">
                    <Icon name="Check" size={14} />
                  </span>
                ) : null}
              </span>
              {option.workouts.map((workout) => (
                <span key={workout.name} className="dashboard-program-workout">
                  <span className="dashboard-program-workout-name">{workout.name}</span>
                  <span className="dashboard-program-workout-size">{workout.summary}</span>
                </span>
              ))}
            </button>
          ))}
        </section>
      </>
    )
    dock = (
      <div className="dashboard-dock">
        <button
          type="button"
          className="btn-primary dashboard-start"
          disabled={!selected || !data.canUse}
          onClick={() => selected && data.onUse(selected.id)}
        >
          {selected ? `Use ${selected.name}` : 'Pick a program'}
        </button>
      </div>
    )
  } else if (data.kind === 'ready') {
    const { due } = data
    const workouts = data.workouts ?? (due ? [due] : [])
    const offered =
      (due && chosen.dueId === dueId && workouts.find((workout) => workout.workoutId === chosen.workoutId)) || due
    const card =
      offered && due && offered.workoutId !== due.workoutId ? (data.cards?.[offered.workoutId] ?? null) : data.card
    body = (
      <>
        {data.week ? <WeekStripRow week={data.week} /> : null}
        {card ? <DueCard card={card} /> : null}
      </>
    )
    if (!dock && due && offered) {
      dock = (
        <StartDock
          due={due}
          offered={offered}
          workouts={workouts}
          onChange={(workoutId) => setChosen({ dueId, workoutId })}
          onStart={props.onStartWorkout}
        />
      )
    }
  }

  return (
    <div className="dashboard">
      <Header {...props} />
      {props.notices ? <div className="dashboard-notices">{props.notices}</div> : null}
      {body}
      {dock}
    </div>
  )
}
