import { useContext, useState, type ReactNode } from 'react'
import { SettingsButton, ShellChromeContext } from '../../ui/AppShell'
import { CalendarWeekCells } from '../../ui/CalendarWeek'
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

/** A workout the dock offers to start: its name, when it was last done and its minutes (estimate). */
export type DockWorkout = { workoutId: string; name: string; last: string | null; minutes: number }

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
  /** Opens the Sessions tab: the week strip is a button to it (V3-09). */
  onOpenSessions?(): void
}

/** The sync state in words: the cloud button's name and tooltip (V3-08), never a visible line. */
function syncText(sync: Exclude<DashboardSync, { kind: 'offline' }>): string {
  switch (sync.kind) {
    case 'syncing':
      return 'Syncing…'
    case 'synced':
      return `Synced ${sync.ago}`
    case 'local':
      return 'Saved on this phone'
    case 'failed':
      return 'Not synced · saved on this phone'
  }
}

/**
 * The header's cloud (V3-08): it presses to sync, and carries the sync state as its name and as a
 * quiet mark (a tick once synced, a dot when the last sync failed). Offline it is no button, only
 * the crossed-out cloud, named for what that means.
 */
function SyncButton({ sync, onSync }: { sync: DashboardSync; onSync(): void }): JSX.Element {
  if (sync.kind === 'offline') {
    return (
      <span className="dashboard-sync-offline" role="img" aria-label="Offline · saved on this phone">
        <Icon name="CloudOff" size={22} />
      </span>
    )
  }
  const text = syncText(sync)
  return (
    <button
      type="button"
      className="icon-btn dashboard-icon-btn"
      aria-label={`Sync now · ${text}`}
      title={text}
      data-sync={sync.kind}
      onClick={onSync}
    >
      <Icon name={sync.kind === 'synced' ? 'CloudCheck' : 'Cloud'} size={22} />
      {sync.kind === 'failed' ? <span className="dashboard-sync-dot" aria-hidden="true" /> : null}
    </button>
  )
}

/**
 * "This week" at the top of Train (V2-05, V3-09): the Sessions calendar's current week, drawn
 * with the same cells (the workout's letter in its colour, today outlined), then done of
 * planned. The whole strip is one button to Sessions; its name says the week in words.
 */
function WeekStripRow({ week, onOpen }: { week: WeekStrip; onOpen?: () => void }): JSX.Element {
  const done = week.days
    .filter((day) => day.workout)
    .map((day) => `${day.workoutName ?? day.workout} ${day.name}`)
  const label = `This week, ${week.done} of ${week.planned}: ${done.length > 0 ? done.join(', ') : 'no sessions yet'}`
  const content = (
    <>
      <span className="dashboard-week-grid" aria-hidden="true">
        <span className="dashboard-week-initials">
          {week.days.map((day) => (
            <span key={day.key} className="dashboard-week-initial" data-today={day.today || undefined}>
              {day.initial}
            </span>
          ))}
        </span>
        <CalendarWeekCells
          cells={week.days.map((day) => ({
            key: day.key,
            letter: day.workout,
            tone: day.tone ?? null,
            today: day.today,
            future: day.future ?? false,
          }))}
        />
      </span>
      <span className="dashboard-week-count" aria-hidden="true">
        {`${week.done} of ${week.planned}`}
      </span>
    </>
  )
  if (!onOpen) {
    return (
      <div className="dashboard-week" role="img" aria-label={label}>
        {content}
      </div>
    )
  }
  return (
    <button type="button" className="dashboard-week cell" aria-label={`${label}. Open Sessions`} onClick={onOpen}>
      {content}
      <span className="dashboard-week-chevron" aria-hidden="true">
        <Icon name="ChevronRight" size={16} />
      </span>
    </button>
  )
}

/**
 * `3 × 70 kg`: the planned Sets at the Set 1 Preset; `3 sets` with no weight to go on; and when
 * the Sets ramp, `4 sets · 47.5 → 62.5 kg` (V5-07).
 */
function presetText(lift: TrainLiftRow): string | null {
  if (lift.sets === undefined) return null
  if (lift.load && lift.topLoad) return `${lift.sets} sets · ${lift.load.replace(/ kg$/, '')} → ${lift.topLoad}`
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

/**
 * The tab's header (V3-08): the Workout on offer as the title ("Workout B") over the day and when
 * it was last done, then the cloud and the gear. With no Workout to offer it reads "Train".
 */
function Header({
  title,
  subtitle,
  sync,
  onSync,
  onOpenSettings,
}: { title: string; subtitle: string } & Pick<DashboardViewProps, 'sync' | 'onSync' | 'onOpenSettings'>): JSX.Element {
  // The app root's header slot ("Update ready") rides beside the Dashboard's own buttons.
  const { trailing } = useContext(ShellChromeContext)
  return (
    // The tab's one header: the shell around the Dashboard draws none of its own (`ownHeader`),
    // so this one carries the shell header's classes too.
    <header className="dashboard-header app-header">
      <div className="dashboard-heading">
        <h1 className="dashboard-title">{title}</h1>
        <p className="dashboard-status">{subtitle}</p>
      </div>
      {trailing ? <div className="dashboard-header-trailing app-header-trailing">{trailing}</div> : null}
      <div className="dashboard-header-actions">
        <SyncButton sync={sync} onSync={onSync} />
        {/* The shell's gear, which carries the backup-due marker when a backup is due. */}
        <SettingsButton onOpen={onOpenSettings} />
      </div>
    </header>
  )
}

/** The dock while a Session is in progress: the way back into it (the header names it). */
function ResumeDock({ resume }: { resume: DashboardResume }): JSX.Element {
  return (
    <div className="dashboard-dock">
      <button type="button" className="btn-primary dashboard-start resume-workout" onClick={resume.onResume}>
        {`Resume ${resume.workoutName}`}
      </button>
    </div>
  )
}

/**
 * The dock (V3-08): the offered workout's time and "Change" on one line, over its start button.
 * The header names the workout and when it was last done; the rows show its size. A Program of
 * several workouts can offer another in the due one's place: "Change" steps through them.
 */
function StartDock({
  offered,
  workouts,
  onChange,
  onStart,
}: {
  offered: DockWorkout
  workouts: DockWorkout[]
  onChange(workoutId: string): void
  onStart(workoutId: string): void
}): JSX.Element {
  function next(): void {
    const index = workouts.findIndex((workout) => workout.workoutId === offered.workoutId)
    onChange(workouts[(index + 1) % workouts.length].workoutId)
  }

  return (
    <div className="dashboard-dock">
      <div className="dashboard-due-row">
        <p className="dashboard-due-size">{`~${offered.minutes} min`}</p>
        {workouts.length > 1 ? (
          <button type="button" className="btn-quiet dashboard-change" aria-label="Choose another workout" onClick={next}>
            Change
          </button>
        ) : null}
      </div>
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
  // The title is the Workout on offer (V3-08); a Session in progress names its own, and with no
  // Workout to offer (no Program yet, still loading) the tab's name stands in.
  let title = props.resume ? props.resume.workoutName : 'Train'
  let subtitle = props.resume ? `${props.today} · in progress` : props.today

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
        {data.week ? <WeekStripRow week={data.week} onOpen={props.onOpenSessions} /> : null}
        {card ? <DueCard card={card} /> : null}
      </>
    )
    if (!props.resume && offered) {
      title = offered.name
      subtitle = offered.last ? `${props.today} · last done ${offered.last}` : props.today
    }
    if (!dock && due && offered) {
      dock = (
        <StartDock
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
      <Header
        title={title}
        subtitle={subtitle}
        sync={props.sync}
        onSync={props.onSync}
        onOpenSettings={props.onOpenSettings}
      />
      {props.notices ? <div className="dashboard-notices">{props.notices}</div> : null}
      {body}
      {dock}
    </div>
  )
}
