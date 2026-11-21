import type { ReactNode } from 'react'
import { AppShell } from '../../ui/AppShell'
import { SetFigure } from '../../ui/figures'
import { Icon } from '../../ui/icons'
import './DashboardScreen.css'
import type { TrainCard, TrainLiftRow } from './trainCard'

/** One Program a new trainee can choose (DX-04): its name and `3× a week · 2 workouts`. */
export type ProgramOption = {
  id: string
  name: string
  summary: string
}

export type DashboardData =
  | { kind: 'loading' }
  | {
      kind: 'no-program'
      options: ProgramOption[]
      /** Nothing can be stored: a Program cannot be taken up. */
      canUse: boolean
      /** Makes `id` the active Program; Train then shows its first Workout. */
      onChoose(id: string): void
    }
  | {
      kind: 'ready'
      /** The workout due with each lift's next step; `null` when the Program has no workout. */
      card: TrainCard | null
      due: DockWorkout | null
      /** The card of every other workout, by workout id: a Session in progress may be one of them. */
      cards?: Record<string, TrainCard>
      /** DX-01: the one meta line, `Thursday · 2 of 3 this week` or `Rest day · next: …`. */
      meta?: string
      /** DX-01: a rest day: Start reads "Start … anyway", in outline. */
      rest?: boolean
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

/**
 * A Session in progress (DX-09): Train shows its Workout's Plans and no Start. `onResume` is set
 * only where no live strip offers the way back (no app root); then the dock is Resume.
 */
export type DashboardResume = {
  workoutName: string
  programName: string
  workoutId?: string
  onResume?(): void
}

export type DashboardViewProps = {
  data: DashboardData
  onStartWorkout(workoutId: string): void
  /** Notes drawn under the header (storage unavailable, a stale active Program). */
  notices?: ReactNode
  /** A Session in progress. */
  resume?: DashboardResume | null
  /** V6-03: opens the one Lift page: each lift's name is a button to it. */
  onOpenLift?(exerciseId: string): void
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

/** The dock with no live strip to resume from (no app root): the way back into the Session. */
function ResumeDock({ resume }: { resume: DashboardResume }): JSX.Element {
  return (
    <div className="dashboard-dock">
      <button type="button" className="btn-primary dashboard-start" onClick={resume.onResume}>
        {`Resume ${resume.workoutName}`}
      </button>
    </div>
  )
}

/**
 * The dock (DX-01): the workout's size and time over its one Start. On a rest day Start stays,
 * in outline, as "Start … anyway".
 */
function StartDock({
  offered,
  sets,
  rest,
  onStart,
}: {
  offered: DockWorkout
  sets: number | null
  rest: boolean
  onStart(workoutId: string): void
}): JSX.Element {
  return (
    <div className="dashboard-dock">
      <p className="dashboard-due-size">{sets ? `${sets} sets · about ${offered.minutes} min` : `about ${offered.minutes} min`}</p>
      {rest ? (
        <button type="button" className="btn-secondary dashboard-start" onClick={() => onStart(offered.workoutId)}>
          {`Start ${offered.name} anyway`}
        </button>
      ) : (
        <button type="button" className="btn-primary dashboard-start" onClick={() => onStart(offered.workoutId)}>
          {`Start ${offered.name}`}
        </button>
      )}
    </div>
  )
}

/**
 * DX-04 first run: "Choose a Program" as one plain row per Program (name, `3× a week · 2
 * workouts`). A row makes it the active Program; Train then shows its first Workout.
 */
export function ProgramChoices({
  options,
  canUse,
  onChoose,
}: {
  options: ProgramOption[]
  canUse: boolean
  onChoose(id: string): void
}): JSX.Element {
  return (
    <ul className="program-choices" aria-label="Programs">
      {options.map((option) => (
        <li key={option.id}>
          <button
            type="button"
            className="program-choice cell"
            disabled={!canUse}
            onClick={() => onChoose(option.id)}
          >
            <span className="program-choice-text">
              <span className="program-choice-name">{option.name}</span>
              <span className="program-choice-summary">{option.summary}</span>
            </span>
            <Icon name="ChevronRight" size={18} />
          </button>
        </li>
      ))}
    </ul>
  )
}

/**
 * The Train tab (DX-01): today's Workout inside the Shell. Its name is the tab's title and one
 * quiet meta line sits under it; then the change note ("Same as Monday, except curls move up to
 * 15 kg."), the Plan list, and one Start over the tab bar with the workout's size above it.
 *
 * A Session in progress (DX-09) shows its own Workout's Plans and no Start: the live strip is the
 * one way back. A new trainee (DX-04) chooses a Program here first.
 */
export function DashboardView(props: DashboardViewProps): JSX.Element {
  const { data, resume = null } = props
  let title = 'Train'
  let meta: string | undefined
  let body: ReactNode = null
  let dock: ReactNode = resume?.onResume ? <ResumeDock resume={resume} /> : null

  if (data.kind === 'no-program') {
    title = 'Choose a Program'
    body = <ProgramChoices options={data.options} canUse={data.canUse} onChoose={data.onChoose} />
  } else if (data.kind === 'ready') {
    const { due } = data
    if (resume) {
      title = resume.workoutName
      meta = 'In progress'
      const card =
        resume.workoutId === undefined
          ? null
          : resume.workoutId === due?.workoutId
            ? data.card
            : (data.cards?.[resume.workoutId] ?? null)
      body = card ? <DueCard card={card} onOpenLift={props.onOpenLift} /> : null
    } else if (due) {
      title = due.name
      meta = data.meta
      const card = data.card
      body = (
        <>
          {card ? <Headline card={card} offered={due} /> : null}
          {card ? <DueCard card={card} onOpenLift={props.onOpenLift} /> : null}
        </>
      )
      const sets = card?.lifts.reduce((sum, lift) => sum + (lift.sets ?? 0), 0) ?? 0
      dock = <StartDock offered={due} sets={sets > 0 ? sets : null} rest={data.rest ?? false} onStart={props.onStartWorkout} />
    }
  }

  return (
    <AppShell title={title} subtitle={meta}>
      <div className="dashboard">
        {props.notices ? <div className="dashboard-notices">{props.notices}</div> : null}
        {body}
        {dock}
      </div>
    </AppShell>
  )
}
