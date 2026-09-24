import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { validateEntry } from '../domain/dial'
import { presetForSet } from '../domain/prefill'
import { restState } from '../domain/rest'
import { logSet } from '../storage/sessionStore'
import { useActionBarSlot } from './actionBarSlot'
import { ExerciseInfoLink } from './ExerciseInfoLink'
import { RepsDial } from './RepsDial'
import { useWakeLock } from './useWakeLock'
import { WeightDial } from './WeightDial'
import './SetScreen.css'
import type { Exercise, ExercisePlan, Session, SetEntry } from '../types'

export type SetScreenProps = {
  exercise: Exercise
  plan: ExercisePlan
  setIndex: number
  sessionId: string
  lastEntries: SetEntry[]
  onLogged(session: Session, nextSetIndex: number): void
  /**
   * Told that an extra set past the plan was opened, with the set index it opened at. Optional
   * so a caller that offers no extra set -- and E1-T5's own tests -- need not pass it; the
   * "Add set" control is only rendered when it is given.
   */
  onAddSet?(exerciseId: string, nextSetIndex: number): void
  /**
   * Told that "Exercise info" was tapped for the exercise on screen, so the caller can open the
   * in-app detail overlay for it (E5-T8). Optional so a caller with nothing to open it onto --
   * src/ui/useWakeLock.test.ts's `renderSetScreen`, predating this prop -- need not pass it; the
   * button itself always renders, it just has nothing to tell if untapped.
   */
  onOpenInfo?(exerciseId: string): void
  /**
   * Told that "Alternatives" was tapped for the exercise on screen, so the caller can open the
   * ranked alternatives list for it (E5-T12). Optional for the same reason `onOpenInfo` is --
   * `src/ui/useWakeLock.test.ts`'s `renderSetScreen`, predating this prop, need not pass it.
   *
   * STUB (E5-T12 test-designer): accepted but not yet wired to the "Alternatives" button.
   */
  onOpenAlternatives?(exerciseId: string): void
  /**
   * Whether the set on the dials was opened by "Add set" as an extra set past the plan (E6-T1).
   * A screen opened past the plan with `extra` false is in the done state. Optional, read as
   * `false`, so the callers predating it (E1's and the wake lock's tests) need not pass it.
   */
  extra?: boolean
}

/**
 * The set counter's text (E6-T1): "Set 2 of 3" | "Set 4 · extra" | "All 3 sets logged" |
 * "4 sets logged · 3 planned". `loggedCount` is this Session's Sets for the Exercise.
 */
export function setCounterText(
  setIndex: number,
  plannedSets: number,
  loggedCount: number,
  done: boolean,
): string {
  if (done) {
    return loggedCount > plannedSets
      ? `${loggedCount} sets logged · ${plannedSets} planned`
      : `All ${plannedSets} sets logged`
  }
  return setIndex > plannedSets ? `Set ${setIndex} · extra` : `Set ${setIndex} of ${plannedSets}`
}

/** How often the rest timer re-reads the clock; it derives everything from timestamps. */
const TICK_MS = 500

/** The set on the dials: which one it is and the two values it will be logged with. */
type OpenSet = { setIndex: number; weightKg: number | null; reps: number }

/** The remaining rest as "m:ss", counting the part-second still to go as a whole one. */
function formatRest(remainingSeconds: number): string {
  const total = Math.ceil(remainingSeconds)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

/**
 * The entries the next set presets from: the just-logged one laid over the history, so set 3
 * opens on what set 2 was actually lifted with rather than on last week's numbers.
 */
function mergeEntry(entries: SetEntry[], entry: SetEntry): SetEntry[] {
  const merged = [...entries]
  const at = merged.findIndex(
    (stored) => stored.exerciseId === entry.exerciseId && stored.setIndex === entry.setIndex,
  )
  if (at >= 0) merged[at] = entry
  else merged.push(entry)
  return merged
}

function openSetFor(
  exercise: Exercise,
  plan: ExercisePlan,
  setIndex: number,
  lastEntries: SetEntry[],
): OpenSet {
  return { setIndex, ...presetForSet({ exercise, plan, setIndex, lastEntries }) }
}

/**
 * The screen one set is logged from: the two dials, the keypad behind each readout, the rest
 * timer and the log button.
 *
 * The screen owns which set is open. Logging persists the set through the session store, then
 * opens the next one preset from the entry just logged; `onLogged` tells the caller, which
 * owns the navigation. An entry `validateEntry` rejects is shown inline and written nowhere --
 * the rule is E1-T2's, the message is this screen's.
 */
export function SetScreen(props: SetScreenProps): JSX.Element {
  const { exercise, plan, sessionId, onLogged, onAddSet, onOpenInfo, onOpenAlternatives } = props

  const [history, setHistory] = useState<SetEntry[]>(props.lastEntries)
  const [open, setOpen] = useState<OpenSet>(() =>
    openSetFor(exercise, plan, props.setIndex, props.lastEntries),
  )
  // An extra set opened by "Add set" stays open until it is logged; past the plan, anything
  // else is the done state, which offers only "Add set".
  const [extraOpen, setExtraOpen] = useState<boolean>(props.extra ?? false)
  // Sets are opened in order, so the ones before the opened set are this session's so far;
  // every log then recounts from the session it was written to.
  const [loggedCount, setLoggedCount] = useState<number>(props.setIndex - 1)
  const [error, setError] = useState<string | null>(null)
  const [lastLoggedAt, setLastLoggedAt] = useState<number | null>(null)
  const [now, setNow] = useState<number>(() => Date.now())

  // The controls belong to the screen's bottom edge, which inside the shell is the sticky
  // action bar; outside one -- the screen rendered bare -- they stay where they are written.
  const actionBar = useActionBarSlot()

  useWakeLock(true)

  // The rest left is a function of the clock, so a slept phone cannot desync it: re-read the
  // time on a tick rather than counting down a number of our own.
  useEffect(() => {
    if (lastLoggedAt === null) return
    setNow(Date.now())
    const tick = setInterval(() => setNow(Date.now()), TICK_MS)
    return () => clearInterval(tick)
  }, [lastLoggedAt])

  const rest = restState(lastLoggedAt, plan.restSeconds, now)
  const done = open.setIndex > plan.sets && !extraOpen

  async function log(): Promise<void> {
    const validation = validateEntry(open.weightKg, open.reps)
    if (!validation.ok) {
      setError(validation.error)
      return
    }

    const loggedAt = Date.now()
    const entry: SetEntry = {
      exerciseId: exercise.id,
      setIndex: open.setIndex,
      weightKg: open.weightKg,
      reps: open.reps,
      loggedAt,
    }

    try {
      const session = await logSet(sessionId, entry)
      const merged = mergeEntry(history, entry)
      const nextSetIndex = open.setIndex + 1
      setError(null)
      setHistory(merged)
      setLastLoggedAt(loggedAt)
      setOpen(openSetFor(exercise, plan, nextSetIndex, merged))
      setExtraOpen(false)
      setLoggedCount(
        session.entries.filter((logged) => logged.exerciseId === exercise.id).length,
      )
      onLogged(session, nextSetIndex)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    }
  }

  /** Opens one extra set here, and tells the caller, which may reopen it as an extra set. */
  function addSet(add: NonNullable<SetScreenProps['onAddSet']>): void {
    setExtraOpen(true)
    add(exercise.id, open.setIndex)
  }

  // Past the plan the screen is done: every planned set is logged, so "Log set" is withheld and
  // only an extra set is offered -- and only to a caller that knows what to do with it.
  const actions = !done ? (
    <button type="button" className="log-set" onClick={() => void log()}>
      Log set
    </button>
  ) : onAddSet !== undefined ? (
    <button type="button" className="add-set" onClick={() => addSet(onAddSet)}>
      Add set
    </button>
  ) : null

  return (
    <div className="set-screen">
      {/* The exercise's name is the shell's own header title (`AppShell`'s `<h1>`, set by every
          caller to `exercise.name`); a second heading here would duplicate it verbatim, which
          collides for a caller matching an exercise's set screen by its accessible name alone
          (E5-T12's S7, opening a swapped-in exercise's set screen). */}
      <ExerciseInfoLink exercise={exercise} onOpen={() => onOpenInfo?.(exercise.id)} />
      <button
        type="button"
        className="open-alternatives"
        onClick={() => onOpenAlternatives?.(exercise.id)}
      >
        Alternatives
      </button>
      <p className="set-counter">{setCounterText(open.setIndex, plan.sets, loggedCount, done)}</p>

      <WeightDial
        exercise={exercise}
        value={open.weightKg}
        onChange={(weightKg) => setOpen({ ...open, weightKg })}
      />
      <RepsDial value={open.reps} onChange={(reps) => setOpen({ ...open, reps })} />

      {error === null ? null : (
        <p className="set-error" role="alert">
          {error}
        </p>
      )}

      {actionBar === null ? actions : createPortal(actions, actionBar)}

      <p className="rest-timer">
        <span role="timer" aria-label="Rest remaining">
          {formatRest(rest.remainingSeconds)}
        </span>
        {rest.isOver ? ' rest over' : ' rest'}
      </p>
    </div>
  )
}
