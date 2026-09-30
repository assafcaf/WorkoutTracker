import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { validateEntry } from '../domain/dial'
import { presetForSet } from '../domain/prefill'
import { recordsSetBy } from '../domain/records'
import { adjustRest, formatOver, formatRest, restAfter } from '../domain/rest'
import type { RestAdjustment, RestState } from '../domain/rest'
import { useActionBarSlot } from './actionBarSlot'
import { ExerciseInfoLink } from './ExerciseInfoLink'
import { playRestOver, unlockRestSound } from './restSound'
import { RepsDial } from './RepsDial'
import { Toast } from './Toast'
import { useWakeLock } from './useWakeLock'
import { WeightDial } from './WeightDial'
import './SetScreen.css'
import type { MuscleFamily } from '../domain/muscles'
import type { Exercise, ExercisePlan, Session, SetEntry } from '../types'

export type SetScreenProps = {
  exercise: Exercise
  plan: ExercisePlan
  setIndex: number
  sessionId: string
  lastEntries: SetEntry[]
  /**
   * The last finished Session's entries for this Exercise (E12-T4), not merged with today's, shown
   * as the "Last time" line. Optional; empty or omitted shows no line.
   */
  lastTime?: SetEntry[]
  /**
   * This Session's Sets for the Exercise (E12-T3), listed in `setIndex` order and tappable to
   * edit. Optional so callers predating it need not pass it; omitted or empty shows no list.
   */
  logged?: SetEntry[]
  /** Stores new values for logged Set `setIndex` (E12-T3). */
  onEditSet?(setIndex: number, values: { weightKg: number | null; reps: number }): Promise<void>
  /** Removes logged Set `setIndex`, answering it so Undo can put it back (E12-T3). */
  onDeleteSet?(setIndex: number): Promise<SetEntry>
  /** Puts a deleted Set back exactly (E12-T3). */
  onRestoreSet?(entry: SetEntry): Promise<void>
  /**
   * Persists one Set to the Session `sessionId` and answers the Session as stored (E11-T10); a
   * rejection's message is shown under the set as it stands. The screen persists nothing itself.
   */
  onLog(sessionId: string, entry: SetEntry): Promise<Session>
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
   * Told that "Finish exercise" was tapped from the done state, so the caller can return to the
   * Workout's exercise list (E8-T4). Optional so a caller with nothing to return to -- every
   * test predating it -- need not pass it; when absent, the done state's action bar holds only
   * "Add set".
   */
  onFinishExercise?(): void
  /**
   * Whether the set on the dials was opened by "Add set" as an extra set past the plan (E6-T1).
   * A screen opened past the plan with `extra` false is in the done state. Optional, read as
   * `false`, so the callers predating it (E1's and the wake lock's tests) need not pass it.
   */
  extra?: boolean
  /**
   * When the session in progress was started, so the initial rest timer -- and the initial
   * log-confirmation message -- only ever reflect a Set actually logged in this Session, never
   * one carried over from `lastEntries`' history (E6-T2).
   *
   * Optional so `src/ui/useWakeLock.test.ts`'s `renderSetScreen`, predating this prop, need not
   * pass it; defaults to 0 so every history entry counts as logged in this Session, matching the
   * behaviour before this prop existed.
   */
  sessionStartedAt?: number
  /**
   * The stored weight step for this Exercise (E8-T8), or `null`/omitted to open on its catalog
   * `weightStep`. Read once, on open -- the Dial and Ladder then follow whatever is chosen from
   * the step control until the screen is reopened.
   */
  weightStep?: number | null
  /**
   * Told the weight step just chosen from the step control (E8-T8), so the caller can persist
   * it for this Exercise. Optional; the screen keeps using the new step for itself either way.
   */
  onWeightStepChange?(step: number): void
  /**
   * The current Exercise's first primary muscle's family (E10-T8), already resolved by the
   * caller (App.tsx, via the Library and `familyOf`) -- this component treats it as a plain
   * input and does not look it up itself. Optional: an Exercise with no library link, or a
   * caller predating this prop, passes nothing, and the "logged" confirmation then carries no
   * `data-family`.
   *
   * STUB (E10-T8 test-designer): accepted but not yet wired onto `.set-logged`.
   */
  family?: MuscleFamily
  /**
   * Finished Sessions started before this one (E13-T6), the baseline `recordsSetBy` measures a
   * Set against. Optional; omitted or empty means no Set is a record.
   */
  earlierSessions?: Session[]
  /**
   * The Session's latest Set, whichever Exercise it was, and the Plan rest of the Exercise it
   * belongs to (E13-T8), resolved by the caller; `null`/omitted shows no rest. Replaces the
   * per-Exercise seed from `lastEntries`; after a log the screen rests from the Set it just logged.
   */
  restFrom?: { entry: SetEntry; planRestSeconds: number } | null
  /**
   * Stores `restSeconds` as the rest after `entry` (E13-T8), from −15 s, +15 s or Skip.
   */
  onSetRest?(entry: SetEntry, restSeconds: number): Promise<void>
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

/** "80×8 · 80×8 · 80×7", in set order; a Bodyweight Set reads "BW×8". */
function lastTimeText(exerciseId: string, entries: SetEntry[]): string {
  return entries
    .filter((entry) => entry.exerciseId === exerciseId)
    .sort((a, b) => a.setIndex - b.setIndex)
    .map((entry) => `${entry.weightKg === null ? 'BW' : entry.weightKg}×${entry.reps}`)
    .join(' · ')
}

/** "New PR · Heaviest set, Best estimated 1RM · 85 kg × 5": every record's label, then the Set. */
function recordToastText(labels: string[], weightKg: number | null, reps: number): string {
  const load = weightKg === null ? `${reps} reps` : `${weightKg} kg × ${reps}`
  return `New PR · ${labels.join(', ')} · ${load}`
}

/** How often the rest timer re-reads the clock; it derives everything from timestamps. */
const TICK_MS = 500

/** How long Undo stays offered after a Set is deleted (E12-T3). */
const UNDO_MS = 5000

/** The set on the dials: which one it is and the two values it will be logged with. */
type OpenSet = { setIndex: number; weightKg: number | null; reps: number }

/**
 * The log-confirmation message for `setIndex`, once it has been logged with `weightKg` and
 * `reps`: "Set 2 logged · 50 kg × 8" for a loaded Exercise, "Set 2 logged · 12 reps" for a
 * Bodyweight one (`weightKg === null`) (E6-T2).
 */
export function loggedText(setIndex: number, weightKg: number | null, reps: number): string {
  const load = weightKg === null ? `${reps} reps` : `${weightKg} kg × ${reps}`
  return `Set ${setIndex} logged · ${load}`
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

/** The Set rest runs after, with the Plan rest of the Exercise it belongs to (E13-T8). */
type RestFrom = { entry: SetEntry; planRestSeconds: number }

/**
 * What identifies one rest period: the Set it follows and its length. The beep is tracked per
 * key, so a changed length is a new zero to sound at, and a re-render of the same one is not.
 */
function restKey(from: RestFrom | null): string | null {
  if (from === null) return null
  const { entry, planRestSeconds } = from
  return `${entry.exerciseId}#${entry.setIndex}@${entry.loggedAt}/${entry.restSeconds ?? planRestSeconds}`
}

/**
 * The screen one set is logged from: the two dials, the keypad behind each readout, the rest
 * timer and the log button.
 *
 * The screen owns which set is open. Logging persists the set through `onLog`, then
 * opens the next one preset from the entry just logged; `onLogged` tells the caller, which
 * owns the navigation. An entry `validateEntry` rejects is shown inline and written nowhere --
 * the rule is E1-T2's, the message is this screen's.
 */
export function SetScreen(props: SetScreenProps): JSX.Element {
  const {
    exercise,
    plan,
    sessionId,
    onLog,
    onLogged,
    onAddSet,
    onOpenInfo,
    onOpenAlternatives,
    onFinishExercise,
    family,
  } = props

  // The step chosen from the Dial's step control (E8-T8), read once on open from `weightStep`
  // and otherwise the catalog's own; the Dial and Ladder both follow it via `effectiveExercise`.
  const lastTime = lastTimeText(exercise.id, props.lastTime ?? [])
  const [weightStep, setWeightStep] = useState<number>(
    props.weightStep ?? exercise.weightStep,
  )
  const effectiveExercise: Exercise = { ...exercise, weightStep }

  function handleStepChange(step: number): void {
    setWeightStep(step)
    props.onWeightStepChange?.(step)
  }

  const [history, setHistory] = useState<SetEntry[]>(props.lastEntries)
  const [open, setOpen] = useState<OpenSet>(() =>
    openSetFor(exercise, plan, props.setIndex, props.lastEntries),
  )
  // An extra set opened by "Add set" stays open until it is logged; past the plan, anything
  // else is the done state, which offers only "Add set".
  const [extraOpen, setExtraOpen] = useState<boolean>(props.extra ?? false)
  // Sets are opened in order, so the ones before the opened set are this session's so far;
  // every log then recounts from the session it was written to.
  const [loggedCountState, setLoggedCount] = useState<number>(props.setIndex - 1)
  // Given `logged`, the caller's Sets are the count: it follows edits, deletes and restores.
  const loggedSets = (props.logged ?? [])
    .filter((entry) => entry.exerciseId === exercise.id)
    .sort((a, b) => a.setIndex - b.setIndex)
  const loggedCount = props.logged === undefined ? loggedCountState : loggedSets.length
  // The logged Set open for editing, if any (E12-T3), and the Set just deleted that Undo restores.
  const [editing, setEditing] = useState<number | null>(null)
  const [undo, setUndo] = useState<SetEntry | null>(null)
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function clearUndo(): void {
    if (undoTimer.current !== null) clearTimeout(undoTimer.current)
    undoTimer.current = null
    setUndo(null)
  }

  useEffect(
    () => () => {
      if (undoTimer.current !== null) clearTimeout(undoTimer.current)
    },
    [],
  )
  const [toast, setToast] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  // The Set rest follows: the caller's `restFrom` (the Session's latest Set), until this screen
  // logs one or adjusts the rest; a changed `restFrom` -- the stored adjustment, a delete -- wins.
  const [restFrom, setRestFrom] = useState<RestFrom | null>(props.restFrom ?? null)
  const propRestKey = restKey(props.restFrom ?? null)
  useEffect(() => {
    setRestFrom(props.restFrom ?? null)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the Set's identity and rest
  }, [propRestKey])
  const lastLoggedAt = restFrom === null ? null : restFrom.entry.loggedAt
  const currentRestKey = restKey(restFrom)
  const [loggedMessage, setLoggedMessage] = useState<string>('')
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

  // A logged Set holds a record for as long as it sets one against the earlier Sessions and this
  // Session's Sets before it, so the badge follows edits and deletes.
  const earlier = props.earlierSessions ?? []
  const thisSession: Session = {
    id: sessionId,
    programId: '',
    workoutId: '',
    startedAt: props.sessionStartedAt ?? 0,
    finishedAt: null,
    entries: props.logged ?? [],
  }
  const isRecordSet = (entry: SetEntry): boolean =>
    earlier.length > 0 && recordsSetBy(exercise, plan, earlier, thisSession, entry).length > 0

  const rest: RestState | null =
    restFrom === null ? null : restAfter(restFrom.entry, restFrom.planRestSeconds, now)
  const done = editing === null && open.setIndex > plan.sets && !extraOpen

  // Fires playRestOver once per rest period: only after this mount has actually seen the rest
  // running (isOver false) for the current Set, so a screen opened with rest already over --
  // e.g. from history -- never sounds, and a later tick on the same finished rest does not sound
  // again. A changed length (±15 s) keeps what was seen of the same Set and moves the zero;
  // Skip marks its key as already fired, so it ends the rest silently.
  const restOverTrackingRef = useRef<{
    key: string | null
    loggedAt: number | null
    seenRunning: boolean
    fired: boolean
  }>({ key: null, loggedAt: null, seenRunning: false, fired: false })
  const restIsOver = rest === null || rest.isOver

  useEffect(() => {
    const tracking = restOverTrackingRef.current
    if (tracking.key !== currentRestKey) {
      const sameSet = tracking.loggedAt === lastLoggedAt
      restOverTrackingRef.current = {
        key: currentRestKey,
        loggedAt: lastLoggedAt,
        seenRunning: sameSet && tracking.seenRunning,
        fired: false,
      }
    }
    const current = restOverTrackingRef.current
    if (!restIsOver) {
      current.seenRunning = true
    } else if (current.seenRunning && !current.fired) {
      current.fired = true
      playRestOver()
    }
  }, [currentRestKey, lastLoggedAt, restIsOver])

  /** −15 s, +15 s or Skip: the Set's new rest, shown now and stored through `onSetRest`. */
  function adjust(adjustment: RestAdjustment): void {
    if (restFrom === null) return
    const at = Date.now()
    const restSeconds = adjustRest(restFrom.entry, restFrom.planRestSeconds, adjustment, at)
    const next: RestFrom = { ...restFrom, entry: { ...restFrom.entry, restSeconds } }
    if (adjustment.kind === 'skip') {
      restOverTrackingRef.current = {
        key: restKey(next),
        loggedAt: next.entry.loggedAt,
        seenRunning: true,
        fired: true,
      }
    }
    setNow(at)
    setRestFrom(next)
    props.onSetRest?.(restFrom.entry, restSeconds).catch((cause: unknown) => {
      setError(cause instanceof Error ? cause.message : String(cause))
    })
  }

  async function log(): Promise<void> {
    unlockRestSound()
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
      const session = await onLog(sessionId, entry)
      const merged = mergeEntry(history, entry)
      const nextSetIndex = open.setIndex + 1
      setError(null)
      clearUndo()
      setHistory(merged)
      setRestFrom({ entry, planRestSeconds: plan.restSeconds })
      setLoggedMessage(loggedText(open.setIndex, open.weightKg, open.reps))
      setOpen(openSetFor(exercise, plan, nextSetIndex, merged))
      setExtraOpen(false)
      setLoggedCount(
        session.entries.filter((logged) => logged.exerciseId === exercise.id).length,
      )
      const records = recordsSetBy(exercise, plan, props.earlierSessions ?? [], session, entry)
      setToast(
        records.length === 0
          ? null
          : recordToastText(
              records.map((record) => record.label),
              entry.weightKg,
              entry.reps,
            ),
      )
      onLogged(session, nextSetIndex)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    }
  }

  function openLogged(entry: SetEntry): void {
    setError(null)
    setEditing(entry.setIndex)
    setOpen({ setIndex: entry.setIndex, weightKg: entry.weightKg, reps: entry.reps })
  }

  /** Back to the next Set to log, `next` being its index. */
  function returnToLogging(next: number, from: SetEntry[] = history): void {
    setError(null)
    setEditing(null)
    setExtraOpen(false)
    setOpen(openSetFor(exercise, plan, next, from))
  }

  async function saveSet(): Promise<void> {
    if (editing === null || props.onEditSet === undefined) return
    const validation = validateEntry(open.weightKg, open.reps)
    if (!validation.ok) {
      setError(validation.error)
      return
    }
    const values = { weightKg: open.weightKg, reps: open.reps }
    try {
      await props.onEditSet(editing, values)
      const before = loggedSets.find((entry) => entry.setIndex === editing)
      const merged = before === undefined ? history : mergeEntry(history, { ...before, ...values })
      setHistory(merged)
      returnToLogging(loggedSets.length + 1, merged)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    }
  }

  async function deleteSet(): Promise<void> {
    if (editing === null || props.onDeleteSet === undefined) return
    try {
      const removed = await props.onDeleteSet(editing)
      returnToLogging(loggedSets.length)
      if (undoTimer.current !== null) clearTimeout(undoTimer.current)
      setUndo(removed)
      undoTimer.current = setTimeout(() => {
        undoTimer.current = null
        setUndo(null)
      }, UNDO_MS)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    }
  }

  async function restoreSet(): Promise<void> {
    if (undo === null || props.onRestoreSet === undefined) return
    try {
      await props.onRestoreSet(undo)
      clearUndo()
      returnToLogging(loggedSets.length + 2)
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
  const actions = editing !== null ? (
    <>
      <button type="button" className="save-set" onClick={() => void saveSet()}>
        Save set
      </button>
      <button type="button" className="delete-set" onClick={() => void deleteSet()}>
        Delete set
      </button>
      <button
        type="button"
        className="cancel-edit"
        onClick={() => returnToLogging(loggedSets.length + 1)}
      >
        Cancel
      </button>
    </>
  ) : !done ? (
    <button type="button" className="log-set" onClick={() => void log()}>
      Log set
    </button>
  ) : (
    <>
      {onFinishExercise === undefined ? null : (
        <button type="button" className="finish-exercise" onClick={onFinishExercise}>
          Finish exercise
        </button>
      )}
      {onAddSet === undefined ? null : (
        <button type="button" className="add-set" onClick={() => addSet(onAddSet)}>
          Add set
        </button>
      )}
    </>
  )

  return (
    <div className="set-screen">
      {/* The exercise's name is the shell's own header title (`AppShell`'s `<h1>`, set by every
          caller to `exercise.name`); a second heading here would duplicate it verbatim, which
          collides for a caller matching an exercise's set screen by its accessible name alone
          (E5-T12's S7, opening a swapped-in exercise's set screen). */}
      <div className="set-screen-links">
        <ExerciseInfoLink exercise={exercise} onOpen={() => onOpenInfo?.(exercise.id)} />
        <button
          type="button"
          className="open-alternatives"
          onClick={() => onOpenAlternatives?.(exercise.id)}
        >
          Alternatives
        </button>
      </div>
      <p className="set-counter">{setCounterText(open.setIndex, plan.sets, loggedCount, done)}</p>

      {lastTime === '' ? null : <p className="set-last-time">Last time: {lastTime}</p>}

      {loggedSets.length === 0 ? null : (
        <ul className="logged-sets" aria-label="Sets logged">
          {loggedSets.map((entry) => (
            <li key={entry.setIndex}>
              <button
                type="button"
                className="logged-set"
                data-editing={editing === entry.setIndex ? 'true' : undefined}
                onClick={() => openLogged(entry)}
              >
                {entry.weightKg === null ? 'BW' : entry.weightKg} × {entry.reps}
              </button>
              {isRecordSet(entry) ? (
                <span className="pr-badge" aria-label="Personal record">
                  PR
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <WeightDial
        exercise={effectiveExercise}
        value={open.weightKg}
        onChange={(weightKg) => setOpen({ ...open, weightKg })}
        onStepChange={handleStepChange}
      />
      <RepsDial value={open.reps} onChange={(reps) => setOpen({ ...open, reps })} />

      {error === null ? null : (
        <p className="set-error" role="alert">
          {error}
        </p>
      )}

      {actionBar === null ? actions : createPortal(actions, actionBar)}

      {undo === null ? null : (
        <p role="status" className="set-undo">
          Set deleted
          <button type="button" className="undo-delete" onClick={() => void restoreSet()}>
            Undo
          </button>
        </p>
      )}

      {toast === null ? null : <Toast message={toast} onDismiss={() => setToast(null)} />}

      <p role="status" className="set-logged" data-family={family}>
        {loggedMessage}
      </p>

      {rest === null ? null : (
        <div className="rest-timer" data-over={rest.isOver ? 'true' : undefined}>
          <span className="rest-label">{rest.isOver ? 'Rest over' : 'Rest'}</span>
          <button type="button" className="rest-readout">
            <span role="timer" aria-label="Rest remaining">
              {rest.isOver ? formatOver(rest.overSeconds) : formatRest(rest.remainingSeconds)}
            </span>
            {rest.isOver ? ' over' : null}
          </button>
          {rest.isOver ? null : (
            <div className="rest-controls">
              <button
                type="button"
                className="rest-adjust"
                onClick={() => adjust({ kind: 'add', seconds: -15 })}
              >
                −15 s
              </button>
              <button
                type="button"
                className="rest-adjust"
                onClick={() => adjust({ kind: 'add', seconds: 15 })}
              >
                +15 s
              </button>
              <button type="button" className="rest-skip" onClick={() => adjust({ kind: 'skip' })}>
                Skip
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
