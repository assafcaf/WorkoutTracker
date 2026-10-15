import { useContext, useState, type ReactNode } from 'react'
import { SettingsButton, ShellChromeContext } from '../../ui/AppShell'
import { Icon } from '../../ui/icons'
import './DashboardScreen.css'
import type { TrainCard } from './trainCard'

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

function DueCard({ card }: { card: TrainCard }): JSX.Element {
  const ready = card.lifts.filter((lift) => lift.step?.suggest)
  const note = card.estimate === 'logged' ? 'from your logged workouts' : 'planned'
  return (
    <section className="dashboard-train" aria-labelledby="dashboard-train-title">
      <div className="dashboard-card-head">
        <div className="dashboard-card-heading">
          <h2 className="dashboard-card-title" id="dashboard-train-title">
            {card.name}
          </h2>
          <span className="dashboard-card-next">
            {card.more && card.more > 0 ? `next · ${card.more} more this week` : 'next'}
          </span>
        </div>
      </div>
      <p className="dashboard-step-estimate">{`~${card.minutes} min · ${note}`}</p>
      {ready.length > 0 ? (
        <p className="dashboard-step-summary">
          <Icon name="ArrowUp" size={16} />
          {`${ready.length} ${ready.length === 1 ? 'lift' : 'lifts'} ready to step up: ${ready.map((lift) => lift.name.toLowerCase()).join(', ')}. ${ready
            .map((lift) => lift.step!.suggest!.replace(/^try /, 'Try '))
            .join(', ')} next.`}
        </p>
      ) : null}
      {card.lifts.length > 0 ? (
        <p className="dashboard-step-legend">
          <span>Reps at the current weight against the next step</span>
          <span className="dashboard-step-key">
            <i aria-hidden="true" /> = next step
          </span>
        </p>
      ) : null}
      {card.lifts.length > 0 ? (
        <ul className="dashboard-steps" aria-label={`${card.name} lifts`}>
          {card.lifts.map((lift) => (
            <li key={lift.exerciseId} className="dashboard-step">
              <div className="dashboard-step-line">
                <span className="dashboard-step-name">{lift.name}</span>
                {lift.step ? (
                  <span className="dashboard-step-text">
                    {lift.step.suggest ? (
                      <span className="dashboard-step-ready">{`${lift.step.reps} of ${lift.step.target} → ${lift.step.suggest}`}</span>
                    ) : (
                      <>
                        <span className="dashboard-step-count">{`${lift.step.reps} of ${lift.step.target}`}</span>
                        <span className="dashboard-step-at">{`at ${lift.step.at}`}</span>
                      </>
                    )}
                  </span>
                ) : (
                  <span className="dashboard-step-at">No sets yet</span>
                )}
              </div>
              {lift.step ? (
                <div
                  className="dashboard-step-bar"
                  role="progressbar"
                  aria-label={`${lift.name} ${lift.step.reps} of ${lift.step.target}`}
                  aria-valuemin={0}
                  aria-valuenow={lift.step.reps}
                  aria-valuemax={lift.step.target}
                  data-ready={lift.step.suggest ? 'true' : undefined}
                >
                  <i style={{ width: `${Math.min(100, (lift.step.reps / Math.max(1, lift.step.target)) * 100)}%` }} />
                </div>
              ) : null}
            </li>
          ))}
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
        <h1 className="dashboard-title">Dashboard</h1>
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
  workouts,
  onStart,
}: {
  due: DockWorkout
  workouts: DockWorkout[]
  onStart(workoutId: string): void
}): JSX.Element {
  const [chosenId, setChosenId] = useState(due.workoutId)
  const offered = workouts.find((workout) => workout.workoutId === chosenId) ?? due
  const isDue = offered.workoutId === due.workoutId

  function next(): void {
    const index = workouts.findIndex((workout) => workout.workoutId === offered.workoutId)
    setChosenId(workouts[(index + 1) % workouts.length].workoutId)
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
 * The Train home screen (E18 O24): the workout due with each lift's next step and a duration
 * estimate, and its start button docked at the bottom. With no Program yet it offers the Programs to pick from instead.
 */
export function DashboardView(props: DashboardViewProps): JSX.Element {
  const { data } = props
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
        <p className="dashboard-new-note">
          Sessions, lifts and muscle balance fill this page after your first workout.
        </p>
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
    body = data.card ? <DueCard card={data.card} /> : null
    if (!dock && due) {
      dock = <StartDock key={due.workoutId} due={due} workouts={data.workouts ?? [due]} onStart={props.onStartWorkout} />
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
