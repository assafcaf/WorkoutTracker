import { useContext, useState, type ReactNode } from 'react'
import { WorkoutArrows, type WorkoutRef, type WorkoutStep } from '../../ui/WorkoutArrows'
import { SettingsButton, ShellChromeContext } from '../../ui/AppShell'
import { CalendarWeekCells } from '../../ui/CalendarWeek'
import { SetFigure } from '../../ui/figures'
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
export type DockWorkout = {
  workoutId: string
  name: string
  last: string | null
  minutes: number
  /** V6-11: after a short Session of this Workout, the header's second line instead of the day. */
  finish?: string | null
  /** V6-08: this Workout's latest Session note, folded into the headline sentence (v7). */
  note?: string | null
  /** v7: when it was last done, as the headline says it: `Monday`, or `Fri 2 Oct` further back. */
  sameAs?: string | null
}

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
  /** The workout to open on instead of the one due: the one Home's arrows had switched to. */
  initialWorkoutId?: string
  /** Notes drawn under the header (storage unavailable, a backup due). */
  notices?: ReactNode
  /** A Session in progress: the dock resumes it rather than starting another. */
  resume?: DashboardResume | null
  /** Opens the Sessions tab: the week strip is a button to it (V3-09). */
  onOpenSessions?(): void
  /** V5-14: opens one past Session's summary: each done day of the week strip is a button to it. */
  onOpenSession?(sessionId: string): void
  /** V6-03: opens the one Lift page: each lift's name on the card is a button to it. */
  onOpenLift?(exerciseId: string): void
  /** v7: the workout page is pushed over Home; Back returns there. Unset, no Back is drawn. */
  onBack?(): void
}

/**
 * v7 (study §1.1): the sync state is shown only when a sync actually failed, and then as words
 * that press to try again. Synced, syncing, local or offline, the header says nothing about it.
 */
function SyncFailure({ sync, onSync }: { sync: DashboardSync; onSync(): void }): JSX.Element | null {
  if (sync.kind !== 'failed') return null
  return (
    <button
      type="button"
      className="btn-quiet dashboard-sync-failed"
      aria-label="Sync now · Not synced · saved on this phone"
      data-sync={sync.kind}
      onClick={onSync}
    >
      Not synced · Retry
    </button>
  )
}

/**
 * "This week" at the top of Train (V2-05, V3-09): the Sessions calendar's current week, drawn
 * with the same cells (the workout's letter in its colour, today outlined), then done of
 * planned. The whole strip is one button to Sessions; its name says the week in words.
 */
function WeekStripRow({
  week,
  onOpen,
  onOpenSession,
}: {
  week: WeekStrip
  onOpen?: () => void
  onOpenSession?: (sessionId: string) => void
}): JSX.Element {
  const done = week.days
    .filter((day) => day.workout)
    .map((day) => `${day.workoutName ?? day.workout} ${day.name}`)
  const label = `This week, ${week.done} of ${week.planned}: ${done.length > 0 ? done.join(', ') : 'no sessions yet'}`
  if (onOpenSession) return <WeekStripDays week={week} label={label} onOpen={onOpen} onOpenSession={onOpenSession} />
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
 * V5-14: the week strip as the Sessions calendar draws it, each done day its own button into
 * that workout's summary (named "Workout B, Mon 12 Oct"); the count and chevron are the button
 * to Sessions, named for the week as the whole strip was.
 */
function WeekStripDays({
  week,
  label,
  onOpen,
  onOpenSession,
}: {
  week: WeekStrip
  label: string
  onOpen?: () => void
  onOpenSession: (sessionId: string) => void
}): JSX.Element {
  const count = (
    <>
      <span className="dashboard-week-count" aria-hidden="true">
        {`${week.done} of ${week.planned}`}
      </span>
      {onOpen ? (
        <span className="dashboard-week-chevron" aria-hidden="true">
          <Icon name="ChevronRight" size={16} />
        </span>
      ) : null}
    </>
  )
  return (
    <div className="dashboard-week dashboard-week--days" role="group" aria-label={label}>
      <span className="dashboard-week-grid">
        <span className="dashboard-week-initials" aria-hidden="true">
          {week.days.map((day) => (
            <span key={day.key} className="dashboard-week-initial" data-today={day.today || undefined}>
              {day.initial}
            </span>
          ))}
        </span>
        <CalendarWeekCells
          cells={week.days.map((day) => {
            const sessionId = day.sessionId
            return {
              key: day.key,
              letter: day.workout,
              tone: day.tone ?? null,
              today: day.today,
              future: day.future ?? false,
              onOpen: sessionId === undefined ? undefined : () => onOpenSession(sessionId),
              label: day.label,
            }
          })}
        />
      </span>
      {onOpen ? (
        <button type="button" className="dashboard-week-open cell" aria-label={`${label}. Open Sessions`} onClick={onOpen}>
          {count}
        </button>
      ) : (
        count
      )}
    </div>
  )
}

/** `70 kg` -> 70 kg; `BW`, `BW+5`, `BW−19` -> the signed Load; a ramp's or an unknown text as is. */
function figureSet(load: string): { weightKg: number | null; loadKg?: number } | null {
  const kg = /^(\d+(?:\.\d+)?) kg$/.exec(load)
  if (kg) return { weightKg: Number(kg[1]) }
  if (load === 'BW') return { weightKg: null, loadKg: 0 }
  const bw = /^BW([+−])(\d+(?:\.\d+)?)$/.exec(load)
  if (bw) return { weightKg: null, loadKg: (bw[1] === '+' ? 1 : -1) * Number(bw[2]) }
  return null
}

/** A load as the ledger writes it (study §3, Numerals): the number, then a small ink-3 `kg`. */
function LoadText({ load }: { load: string }): JSX.Element {
  const set = figureSet(load)
  if (set) return <SetFigure set={set} className="dashboard-step-load" />
  return <span className="dashboard-step-load">{load}</span>
}

/** A lever as the row writes it, from a Bodyweight lift's signed Load or kg. */
function leverLoad(lever: number, bodyweight: boolean): string {
  const n = String(Math.round(lever * 100) / 100)
  if (!bodyweight) return `${n} kg`
  if (lever === 0) return 'BW'
  return lever > 0 ? `BW+${n}` : `BW−${String(Math.round(Math.abs(lever) * 100) / 100)}`
}

/**
 * v7 (study §1.1, step 4): one lift as today's Session opens it, `sets × kg`: `3 × 70 kg`, a ramp
 * `4 × 47.5 → 62.5 kg`, `3 sets` with no weight to go on. A lift that goes up today shows the new
 * load in the up colour; nothing else is coloured. No rep ranges: they live at the bar and on
 * Program.
 */
function PresetFigure({ lift }: { lift: TrainLiftRow }): JSX.Element | null {
  if (lift.sets === undefined) return null
  const up = lift.advice?.kind === 'up' ? lift.advice : null
  const load = up ? leverLoad(up.lever, lift.bodyweight ?? false) : lift.load
  if (!load) return <span className="dashboard-step-preset">{`${lift.sets} sets`}</span>
  return (
    <span className="dashboard-step-preset" data-up={up ? 'true' : undefined}>
      <span className="dashboard-step-sets">{lift.sets}</span>
      <span className="set-figure-times dashboard-step-times">×</span>
      {lift.topLoad && !up ? (
        <span className="dashboard-step-load">
          {`${load.replace(/ kg$/, '')} → ${lift.topLoad.replace(/ kg$/, '')}`}
          <span className="set-figure-unit"> kg</span>
        </span>
      ) : (
        <LoadText load={load} />
      )}
    </span>
  )
}

/**
 * The row's second line, only on a row that changes today: `↑ was 14 kg` when the lift goes up,
 * or the lighter load its status offers (`Deload once: 55 kg`).
 */
function stepNote(lift: TrainLiftRow): JSX.Element | null {
  const advice = lift.advice
  // A Break's eased Preset is said once, in the headline (V6-05), not on every row.
  if (!advice || advice.kind === 'eased') return null
  if (advice.kind === 'up') {
    // V7R-01: the Preset already holds the step, so "was" names the load it came up from.
    const was = lift.was !== undefined ? lift.was : lift.load
    return (
      <span className="dashboard-step-ready">
        <Icon name="ArrowUp" size={14} />
        <span>{was ? `was ${was}` : advice.text}</span>
      </span>
    )
  }
  return <span className="dashboard-step-hold">{advice.text}</span>
}

/** `Seated biceps curls` -> `curls`: a 3+ word name's noun, lower case, for the headline. */
function sentenceName(name: string): string {
  const words = name.trim().split(/\s+/)
  return (words.length >= 3 ? words[words.length - 1] : name).toLowerCase()
}

/**
 * v7 (study §1.1): the headline sentence of what changes today. "Same as Monday, except curls
 * move up to 15 kg." A deload week or a Break says so instead; a short Session's repeat and the
 * Workout's last note fold in as sentences of their own.
 */
function Headline({ card, offered }: { card: TrainCard; offered: DockWorkout }): JSX.Element {
  const changes: JSX.Element[] = []
  for (const lift of card.lifts) {
    const advice = lift.advice
    if (!advice || advice.kind === 'eased') continue
    const name = sentenceName(lift.name)
    const load = leverLoad(advice.lever, lift.bodyweight ?? false)
    const plural = /s$/.test(name)
    changes.push(
      <strong key={lift.exerciseId}>
        {advice.kind === 'up' ? `${name} ${plural ? 'move' : 'moves'} up to ${load}` : `${name} ${plural ? 'drop' : 'drops'} to ${load}`}
      </strong>,
    )
  }
  const eased = card.lifts.find((lift) => lift.advice?.kind === 'eased')?.advice
  const joined = changes.flatMap((change, i) => (i === 0 ? [change] : [i === changes.length - 1 ? ' and ' : ', ', change]))
  let lead: ReactNode
  if (card.deload) lead = 'Deload week: every load is 10 % lighter.'
  else if (card.eased) {
    const days = eased ? /(\d+) days off/.exec(eased.text)?.[1] : undefined
    lead = days ? `Back after ${days} days off: loads eased 10 % for today.` : 'Back after a break: loads eased for today.'
  } else {
    const same = offered.sameAs ?? offered.last
    if (same && changes.length > 0) lead = <>{`Same as ${same}, except `}{joined}.</>
    else if (same) lead = `Same as ${same}.`
    else if (changes.length > 0) lead = <>{'Today '}{joined}.</>
    else lead = `First time on ${offered.name}.`
  }
  return (
    <p className="dashboard-headline">
      {offered.finish ? <span className="dashboard-headline-part">{`${offered.finish}. `}</span> : null}
      {lead}
      {offered.note ? <span className="dashboard-headline-note">{` ${offered.note}`}</span> : null}
    </p>
  )
}

/**
 * Today's Workout as it will be lifted (V2-05, v7 step 4): one ledger row per Plan, its name and
 * `sets × kg`, with an ↑ only on the rows that change.
 */
function DueCard({ card, onOpenLift }: { card: TrainCard; onOpenLift?(exerciseId: string): void }): JSX.Element {
  return (
    <section className="dashboard-train" aria-label={card.name}>
      {card.lifts.length > 0 ? (
        <ul className="dashboard-steps" aria-label={`${card.name} lifts`}>
          {card.lifts.map((lift) => {
            const note = stepNote(lift)
            return (
              <li key={lift.exerciseId} className="dashboard-step">
                <div className="dashboard-step-line">
                  <div className="dashboard-step-main">
                    {onOpenLift ? (
                      // V6-03: the lift's name opens its Lift page.
                      <button
                        type="button"
                        className="dashboard-step-name lift-door btn-quiet"
                        onClick={() => onOpenLift(lift.exerciseId)}
                      >
                        {lift.name}
                      </button>
                    ) : (
                      <span className="dashboard-step-name">{lift.name}</span>
                    )}
                    {note ? <div className="dashboard-step-note">{note}</div> : null}
                  </div>
                  <PresetFigure lift={lift} />
                </div>
              </li>
            )
          })}
        </ul>
      ) : null}
    </section>
  )
}

/**
 * The workout page's header (v7): Back to Home, the day as a label, the sync only when it failed,
 * the gear; then the Workout on offer as the 40 px title and the headline sentence under it. With
 * no Workout to offer it reads "Train".
 */
/** The workouts either side of `offered` in Program order, wrapping; null with fewer than two. */
function stepOf(
  workouts: WorkoutRef[],
  offeredId: string,
  onStep: (workoutId: string) => void,
): WorkoutStep | null {
  if (workouts.length < 2) return null
  const index = Math.max(0, workouts.findIndex((workout) => workout.workoutId === offeredId))
  return {
    prev: workouts[(index - 1 + workouts.length) % workouts.length],
    next: workouts[(index + 1) % workouts.length],
    onStep,
  }
}

function Header({
  title,
  subtitle,
  headline,
  step = null,
  sync,
  onSync,
  onOpenSettings,
  onBack,
}: {
  title: string
  subtitle: string
  headline?: ReactNode
  step?: WorkoutStep | null
} & Pick<DashboardViewProps, 'sync' | 'onSync' | 'onOpenSettings' | 'onBack'>): JSX.Element {
  // The app root's header slot ("Update ready") rides beside the page's own buttons.
  const { trailing } = useContext(ShellChromeContext)
  return (
    // The page's one header: the shell around it draws none of its own (`ownHeader`), so this
    // one carries the shell header's classes too.
    <header className="dashboard-header app-header">
      <div className="dashboard-topline">
        {onBack ? (
          <button type="button" className="icon-btn dashboard-back" aria-label="Back" onClick={onBack}>
            <Icon name="ChevronLeft" size={24} />
          </button>
        ) : null}
        <p className="dashboard-status">{subtitle}</p>
        {trailing ? <div className="dashboard-header-trailing app-header-trailing">{trailing}</div> : null}
        <div className="dashboard-header-actions">
          <SyncFailure sync={sync} onSync={onSync} />
          {/* The shell's gear, which carries the backup-due marker when a backup is due. */}
          <SettingsButton onOpen={onOpenSettings} />
        </div>
      </div>
      <WorkoutArrows step={step} className="dashboard-title-row">
        <h1 className="dashboard-title">{title}</h1>
      </WorkoutArrows>
      {headline}
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
 * The dock (v7): the workout's size and time over its Start bar. Switching workout is the
 * title's ‹ › arrows (2026-11-17), not a button down here.
 */
function StartDock({
  offered,
  sets,
  onStart,
}: {
  offered: DockWorkout
  sets: number | null
  onStart(workoutId: string): void
}): JSX.Element {
  return (
    <div className="dashboard-dock">
      <div className="dashboard-due-row">
        <p className="dashboard-due-size">{sets ? `${sets} sets · about ${offered.minutes} min` : `about ${offered.minutes} min`}</p>
      </div>
      <button type="button" className="btn-primary dashboard-start" onClick={() => onStart(offered.workoutId)}>
        {`Start ${offered.name}`}
      </button>
    </div>
  )
}

/**
 * The workout page (v7, once the Train tab; E18 O24, V2-05): today's Workout under a headline of
 * what changes, this week's strip, each lift as Set 1 opens it, and Start docked at the bottom.
 * Home's Today panel opens it. With no Program yet it offers the Programs to pick from instead.
 */
export function DashboardView(props: DashboardViewProps): JSX.Element {
  const { data } = props
  // The workout "Change" picked, held here so the card and the dock show the same one (V1-21).
  // It is forgotten when the workout due changes.
  const dueId = data.kind === 'ready' ? (data.due?.workoutId ?? null) : null
  const [chosen, setChosen] = useState<{ dueId: string | null; workoutId: string | null }>({
    dueId,
    workoutId: props.initialWorkoutId ?? null,
  })
  if (chosen.dueId !== dueId) setChosen({ dueId, workoutId: props.initialWorkoutId ?? null })
  let body: JSX.Element | null = null
  // A Session in progress is resumable whatever else the Dashboard is still working out. The
  // dock keeps its place in the tree as the data arrives, so a press on it is never lost.
  let dock: JSX.Element | null = props.resume ? <ResumeDock resume={props.resume} /> : null
  // The title is the Workout on offer (V3-08); a Session in progress names its own, and with no
  // Workout to offer (no Program yet, still loading) the tab's name stands in.
  let title = props.resume ? props.resume.workoutName : 'Train'
  const subtitle = props.resume ? `${props.today} · in progress` : props.today
  let headline: ReactNode = null
  let step: WorkoutStep | null = null

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
        {data.week ? <WeekStripRow week={data.week} onOpen={props.onOpenSessions} onOpenSession={props.onOpenSession} /> : null}
        {card ? <DueCard card={card} onOpenLift={props.onOpenLift} /> : null}
      </>
    )
    if (!props.resume && offered) {
      title = offered.name
      step = stepOf(workouts, offered.workoutId, (workoutId) => setChosen({ dueId, workoutId }))
      headline = card ? <Headline card={card} offered={offered} /> : null
    }
    if (!dock && due && offered) {
      const sets = card?.lifts.reduce((sum, lift) => sum + (lift.sets ?? 0), 0) ?? 0
      dock = (
        <StartDock offered={offered} sets={sets > 0 ? sets : null} onStart={props.onStartWorkout} />
      )
    }
  }

  return (
    <div className="dashboard" data-page={props.onBack ? 'pushed' : undefined}>
      <Header
        title={title}
        subtitle={subtitle}
        headline={headline}
        step={step}
        sync={props.sync}
        onSync={props.onSync}
        onOpenSettings={props.onOpenSettings}
        onBack={props.onBack}
      />
      {props.notices ? <div className="dashboard-notices">{props.notices}</div> : null}
      {body}
      {dock}
    </div>
  )
}
