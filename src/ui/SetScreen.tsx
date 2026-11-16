import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { validateEntry } from '../domain/dial'
import { formatDay } from '../domain/dates'
import { projectSet } from '../domain/liveProgress'
import { formatSet } from '../domain/setText'
import { deloadText } from '../domain/deload'
import { presetForSet } from '../domain/prefill'
import { countsTowardStats, workingSets } from '../domain/setKind'
import { prMoment, repBestMoment } from '../domain/prMoment'
import { formatPlates, plateChange, platesFor } from '../domain/plates'
import { prTargetReps, prTargetText } from '../domain/prTarget'
import { exerciseDoneLine, setComparison, setDelta } from '../domain/exerciseVerdict'
import { usualRestSeconds } from '../domain/usualRest'
import type { LiftAdvice } from '../domain/stats/status'
import { leverText } from '../domain/stats/words'
import { warmupRamp } from '../domain/warmup'
import type { WarmupStep } from '../domain/warmup'
import { adjustRest, formatOver, formatRest, restAfter, restLengthOf } from '../domain/rest'
import type { RestAdjustment, RestState } from '../domain/rest'
import { useActionBarSlot } from './actionBarSlot'
import { Segmented } from './controls'
import { Icon } from './icons'
import { PrTag, SetCell, SetFigure } from './figures'
import { RestPanel } from './live/RestPanel'
import { playPrSound, playRestOver, unlockRestSound } from './restSound'
import { RepsDial } from './RepsDial'
import { RestDial } from './RestDial'
import { SetKindRow, setKindLabel } from './SetKindRow'
import { Sheet } from './Sheet'
import { Snackbar } from './Snackbar'
import { useWakeLock } from './useWakeLock'
import { WeightDial } from './WeightDial'
import './SetScreen.css'
import type { MuscleFamily } from '../domain/muscles'
import type { Exercise, ExercisePlan, PlateInventory, Session, SetEntry, SetKind } from '../types'

/** The longest Exercise note, in characters (E14-T11). */
const EXERCISE_NOTE_MAX = 500

export type SetScreenProps = {
  /** The Session is a deload (E21): loaded Sets open on a lighter Preset, with a line saying so. */
  deload?: boolean
  /**
   * The Plate inventory (E15-T6), given only for a barbell Exercise; the Plate line under the
   * weight Dial reads from it. `null` or omitted shows no Plate line.
   */
  plates?: PlateInventory | null
  /** The Exercise note shown above the Dials (E14-T11); null or omitted shows Add note. */
  exerciseNote?: string | null
  /** Saves the Exercise note (500 characters at most); empty removes it (E14-T11). */
  onSaveExerciseNote?(text: string): Promise<void>
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
  onEditSet?(
    setIndex: number,
    values: { weightKg: number | null; reps: number; kind?: SetKind | null; loadKg?: number | null },
  ): Promise<void>
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
  /** Told that "History" was tapped for the exercise on screen (E16-T7). */
  onOpenHistory?(exerciseId: string): void
  /**
   * The done state's primary was tapped: "Back to <upNext> · set N" (V4-07), or "All exercises"
   * with nothing up next. The caller opens that Exercise on Now, or the Workout's list (E8-T4).
   * Optional so a caller with nothing to move on to -- every test predating it -- need not pass
   * it; when absent, the done state's action bar holds only "Add set".
   */
  onFinishExercise?(): void
  /**
   * The Exercise the Session is on (V4-07), the done state's primary "Back to <upNext> · set N"
   * for a finished Exercise reopened from All.
   */
  upNext?: string | null
  /** The working Set `upNext` is on, the primary's "· set 3" (V4-07). */
  upNextSet?: number
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
   * `weightStep`. Read once, on open. It is set in Program › Exercises (V1-16), not on Now.
   */
  weightStep?: number | null
  /**
   * No longer called (V1-16): the step control left the in-workout tools sheet for Program ›
   * Exercises, which stores the same setting. Kept so existing callers still type-check.
   */
  onWeightStepChange?(step: number): void
  /**
   * No longer called (V1-16): the Bodyweight switch left the in-workout tools sheet for Program ›
   * Exercises, which stores the same override; the caller hands in the Exercise already resolved
   * through it. Kept so existing callers still type-check.
   */
  onBodyweightChange?(value: boolean): Promise<void>
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
   * Finished Sessions started before this one (E13-T6), the baseline the record rule measures a
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
  /**
   * Stores `restSeconds`, just set on the rest Dial, as the rest of this Exercise's Plan in the
   * Session's Program (E13-T9), offered as "Use 2:30 for <Exercise>"; a rejection's message shows
   * inline.
   */
  onUseRestForExercise?(restSeconds: number): Promise<void>
  /**
   * The Session's Program's name (E13-T9), for the "Saved to <Program>" line once
   * `onUseRestForExercise` resolves.
   */
  programName?: string
  /** Whether Track effort is on (E14-T10): chips 0 1 2 3+ show under the logged-set status. */
  trackEffort?: boolean
  /** Stores (or with `null` clears) the RIR of logged Set `setIndex` (E14-T10). */
  onSetEffort?(setIndex: number, rir: 0 | 1 | 2 | 3 | null): Promise<void>
  /**
   * The rest of the Workout, shown under the projection line (the Live session's "Now" view,
   * Progress Dashboard S3): its compact rows. Omitted shows none.
   */
  upcoming?: ReactNode
  /** A logged Set to open for editing as the screen opens: a done cell tapped in "All". */
  editSetIndex?: number
  /**
   * V3-01: the Exercise just finished, handed over to this one with its rest still running. Its
   * Just done block, "Deadlift done · 1 PR · Add set" over its Sets and one comparison (V4-01),
   * shows on the dock for that rest.
   */
  handover?: Handover | null
  /** V3-01: the done state's primary once no Exercise is left, "Finish workout". */
  onFinishWorkout?(): void
  /**
   * V1-17: this Exercise was just swapped in for the planned one from Now. The screen opens with
   * the dark snackbar "Swapped from Deadlift" for UNDO_MS, as Delete set's does, until a Set is
   * logged here. V6: it carries no Undo of its own -- the lasting `swapFor` line's "Undo swap"
   * is the one Undo; `onUndo` is kept so callers still type-check.
   */
  swappedFrom?: { name: string; onUndo(): void } | null
  /**
   * V6 (V5-02): this Exercise stands in for the planned one `name` while the swap lasts. A quiet
   * line under the set counter says "for Deadlift", with "Undo swap" while `onUndo` is given
   * (nothing of this Exercise logged yet). It stays as long as the swap does, unlike the snackbar.
   */
  swapFor?: { name: string; onUndo?(): void } | null
  /**
   * V6 (V5-02): a swapped-in Exercise on other equipment with no history: until a Set is logged
   * or the weight is changed, the screen asks "Set a starting weight" where the Plate line goes.
   */
  askStartWeight?: boolean
  /**
   * V6-16: this is the Session's first barbell lift and no Warm-up is logged yet. Before the first
   * working Set, one line above the cells offers the ramp, "Warm-up: 30×5 · 40×3 · 50×2 [Add]";
   * it goes after Add or the first working Set.
   */
  warmupLine?: boolean
  /**
   * V6-01: the load the lift's status offers when it is not the Preset (`liftAdvice`), the value
   * Train, the Program tab and Progress show. The screen offers it in one line under the Dials,
   * "Ready for 15 kg · Use 15 kg", for this Set: last time's at its place, shifted as the top Set
   * is. V6-05: an `eased` one (a Break, opened with `deload`) names the deload line instead.
   */
  advice?: LiftAdvice | null
}

/** The Exercise just finished, as the next one's screen shows it during its rest (V3-01). */
export type Handover = {
  name: string
  /** V4-01: its Sets and one comparison, "60×10 · 70×8 PR · 70×7 · 1 rep more than Mon 12 Oct". */
  line?: string | null
  /** The Records it set today: the block's heading reads "Deadlift done · 1 PR". */
  prs?: number
  /** "Add set": one more Set of the finished Exercise, back on its screen. */
  onAddSet(): void
  /** Its last working Set's "Set 3 reps left?" chips, with Track effort on. */
  effort?: { ordinal: number; value: 0 | 1 | 2 | 3 | null; onPick(rir: 0 | 1 | 2 | 3): void } | null
  /** Its log-confirmation message, announced. */
  message?: string
}

/**
 * The set counter's text (E6-T1): "Set 2 of 3" | "Set 4 · extra" | "All 3 sets logged" |
 * "4 sets logged · 3 planned". `setIndex` is the open Set's working position and `loggedCount`
 * this Session's working Sets for the Exercise: warm-ups don't use up the Plan (E14-T8).
 */
export function setCounterText(
  setIndex: number,
  plannedSets: number,
  loggedCount: number,
  done: boolean,
  amrapFloor?: number,
): string {
  if (done) {
    return loggedCount > plannedSets
      ? `${loggedCount} sets logged · ${plannedSets} planned`
      : `All ${plannedSets} sets logged`
  }
  const text =
    setIndex > plannedSets ? `Set ${setIndex} · extra` : `Set ${setIndex} of ${plannedSets}`
  return amrapFloor === undefined ? text : `${text} · ${amrapFloor}+ reps`
}

/** The day a Set was lifted, as the Just done block names it: "Mon 12 Oct" (V4-01). */
function dayOf(set: SetEntry): string {
  return formatDay(new Date(set.loggedAt), new Date())
}

/** How long the logged PR cell flashes the accent tint (V4-04). */
const PR_FLASH_MS = 1200

/** Last time's working Set at working `position` (its last one past it), or null with none. */
function lastTimeSet(exerciseId: string, entries: SetEntry[], position: number): SetEntry | null {
  const sets = workingSets(entries.filter((entry) => entry.exerciseId === exerciseId)).sort(
    (a, b) => a.setIndex - b.setIndex,
  )
  if (sets.length === 0) return null
  return sets[Math.min(Math.max(position, 1), sets.length) - 1]
}

/** How often the rest timer re-reads the clock; it derives everything from timestamps. */
const TICK_MS = 500

/** How long Undo stays offered after a Set is deleted (E12-T3). */
const UNDO_MS = 5000

/** How long the new cell shows the Set as just logged (E13-T10). */
const CONFIRMED_MS = 1500

/** The one-letter marker a Set of another kind carries in the logged list (E14-T9). */
const KIND_MARKERS: Record<SetKind, string> = { warmup: 'W', drop: 'D', failure: 'F', amrap: 'A' }

/** The kind as the Log button names it (V1-13): "Log set 3 · 70 × 8+ · AMRAP", "… · drop". */
const KIND_WORDS: Record<SetKind, string> = { warmup: 'warm-up', drop: 'drop', failure: 'failure', amrap: 'AMRAP' }

/**
 * The set on the dials: which one it is and the values it will be logged with. `loadKg` is a
 * Bodyweight Set's signed Load (E14-T14), 0 for plain bodyweight and on a loaded Exercise.
 */
type OpenSet = {
  setIndex: number
  weightKg: number | null
  reps: number
  kind: SetKind | null
  loadKg: number
  /** A deload Preset's weight and the last-time weight it came from (E21). */
  deloaded?: { kg: number; from: number }
  /**
   * A Preset moved off last time's weight by an earlier Set today (V1-05): the weight it opened
   * at, and the line saying why, "+20 kg: carried from set 1 (last 70)".
   */
  carried?: { kg: number; text: string }
}

/** The `loadKg` a Set on the dials is logged with: none at plain bodyweight (E14-T14). */
function loadOf(open: Pick<OpenSet, 'loadKg'>): { loadKg: number } | Record<string, never> {
  return open.loadKg === 0 ? {} : { loadKg: open.loadKg }
}

/** A Set not yet logged, as if logged with `values`: what the cells after it preset from. */
function assumedEntry(
  exerciseId: string,
  setIndex: number,
  values: Pick<OpenSet, 'weightKg' | 'reps' | 'loadKg' | 'kind'>,
): SetEntry {
  return {
    exerciseId,
    setIndex,
    weightKg: values.weightKg,
    reps: values.reps,
    ...loadOf(values),
    loggedAt: 0,
    ...(values.kind === null ? {} : { kind: values.kind }),
  }
}

/**
 * A Warm-up ramp under way (E15-T7): its steps, the one on the Dials, and the working weight and
 * reps the Dials return to when it ends. Screen state only; nothing of it is stored.
 */
type Ramp = { steps: WarmupStep[]; index: number; workingKg: number; workingReps: number }

/** A logged Set's values in the edit sheet (S2b), its RIR among them. */
type Draft = OpenSet & { rir: 0 | 1 | 2 | 3 | null }

/** The exercise tools sheet's segments (S3b). */
type ToolsSegment = 'warmup' | 'notes'

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

/**
 * The Set at `setIndex` on the dials, preset from `lastEntries`; `logged`, this Session's Sets
 * for the Exercise when the caller supplies them, places it among the working Sets (E14-T8).
 */
function openSetFor(
  exercise: Exercise,
  plan: ExercisePlan,
  setIndex: number,
  lastEntries: SetEntry[],
  logged?: SetEntry[],
  deload?: boolean,
): OpenSet {
  // The Plan's last Set opens on AMRAP when the Plan marks it (E14-T13).
  const position =
    logged === undefined
      ? setIndex
      : 1 + workingSets(logged).filter((entry) => entry.setIndex < setIndex).length
  const kind = plan.amrapLast === true && position === plan.sets ? 'amrap' : null
  const { loadKg, deloadFromKg, ...preset } = presetForSet({
    exercise,
    plan,
    setIndex,
    lastEntries,
    today: logged,
    deload,
  })
  const deloaded =
    deloadFromKg === undefined || preset.weightKg === null ? {} : { deloaded: { kg: preset.weightKg, from: deloadFromKg } }
  const carried = deload === true ? undefined : carriedReason(exercise, setIndex, preset.weightKg, lastEntries, logged)
  return {
    setIndex,
    ...preset,
    kind,
    loadKg: exercise.bodyweight ? (loadKg ?? 0) : 0,
    ...deloaded,
    ...(carried === undefined ? {} : { carried }),
  }
}

/**
 * Why a loaded Set's Preset `weightKg` is not last time's weight at its position (V1-05): an
 * earlier working Set today moved it. Undefined when it is last time's weight, or nothing today
 * anchors it. Reads the Preset; the rule itself is `presetForSet`'s.
 */
function carriedReason(
  exercise: Exercise,
  setIndex: number,
  weightKg: number | null,
  lastEntries: SetEntry[],
  logged: SetEntry[] | undefined,
): { kg: number; text: string } | undefined {
  if (logged === undefined || weightKg === null || exercise.bodyweight) return undefined
  const before = workingSets(logged)
    .filter((entry) => entry.setIndex < setIndex)
    .sort((a, b) => a.setIndex - b.setIndex)
  const anchorAt = before.map((entry) => entry.kind !== 'drop').lastIndexOf(true)
  if (anchorAt < 0) return undefined
  const last = workingSets(lastEntries).sort((a, b) => a.setIndex - b.setIndex)
  const lastSet = last[before.length] ?? last[last.length - 1]
  if (lastSet === undefined || lastSet.weightKg === null) return undefined
  const delta = Math.round((weightKg - lastSet.weightKg) * 1000) / 1000
  if (delta === 0) return undefined
  const sign = delta > 0 ? '+' : '−'
  return {
    kg: weightKg,
    text: `${sign}${Math.abs(delta)} kg: carried from set ${anchorAt + 1} (last ${lastSet.weightKg})`,
  }
}

/** The Plate line for `weightKg` on `plates` (E15-T6). */
function plateLineFor(weightKg: number, plates: PlateInventory): string {
  return formatPlates(platesFor(weightKg, plates), plates)
}

/**
 * The "Use m:ss for <Exercise>" line after the rest Dial's Set rest (E13-T9): offered, being
 * saved, saved, or refused with the Program service's message.
 */
type UseRestOffer = {
  seconds: number
  status: 'offered' | 'saving' | 'saved' | { error: string }
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
  return `${entry.exerciseId}#${entry.setIndex}@${entry.loggedAt}/${restLengthOf(entry, planRestSeconds)}`
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
    exercise: givenExercise,
    plan,
    sessionId,
    onLog,
    onLogged,
    onAddSet,
    onOpenInfo,
    onOpenAlternatives,
    onOpenHistory,
    onFinishExercise,
    upNext,
    family,
  } = props

  // The Bodyweight setting (E16-T13) and the weight step (E8-T8) as the caller resolved them from
  // what Program › Exercises stores (V1-16); the in-workout sheet no longer changes either.
  const exercise: Exercise = givenExercise
  const [weightStep] = useState<number>(props.weightStep ?? exercise.weightStep)
  const effectiveExercise: Exercise = { ...exercise, weightStep }

  // What the next Set presets from as last time. Without `logged`, the Sets this screen logs or
  // edits are laid over it by `setIndex`; with it, it stays last time's alone and today's Sets
  // go to the Preset apart (E16-T6), so a Set logged today never comes back as last time.
  const [history, setHistory] = useState<SetEntry[]>(props.lastEntries)
  const [open, setOpen] = useState<OpenSet>(() =>
    openSetFor(
      exercise,
      plan,
      props.setIndex,
      props.lastEntries,
      props.logged?.filter((entry) => entry.exerciseId === exercise.id),
      props.deload,
    ),
  )
  // An extra set opened by "Add set" stays open until it is logged; past the plan, anything
  // else is the done state, which offers only "Add set".
  const [extraOpen, setExtraOpen] = useState<boolean>(props.extra ?? false)
  // Sets are opened in order, so the ones before the opened set are this session's so far;
  // every log then recounts from the session it was written to.
  const [loggedCountState, setLoggedCount] = useState<number>(props.setIndex - 1)
  // Sets already done before this screen opened that are not among `logged`: an Exercise swapped
  // in mid-way is opened at the Set the planned one reached (E16-T12). Zero when opened in order.
  const [carried] = useState<number>(() =>
    props.logged === undefined
      ? 0
      : Math.max(
          0,
          props.setIndex -
            1 -
            props.logged.filter(
              (entry) => entry.exerciseId === exercise.id && entry.setIndex < props.setIndex,
            ).length,
        ),
  )
  // Given `logged`, the caller's Sets are the count: it follows edits, deletes and restores.
  const loggedSets = (props.logged ?? [])
    .filter((entry) => entry.exerciseId === exercise.id)
    .sort((a, b) => a.setIndex - b.setIndex)
  const loggedCount =
    props.logged === undefined ? loggedCountState : carried + workingSets(loggedSets).length
  // The open Set's place among the working Sets (E14-T8): warm-ups take a `setIndex` but don't use
  // up the Plan. Without `logged`, every Set before it was working.
  const position =
    props.logged === undefined
      ? open.setIndex
      : 1 + carried + workingSets(loggedSets).filter((entry) => entry.setIndex < open.setIndex).length

  const lastTimeEntry = lastTimeSet(exercise.id, props.lastTime ?? [], position)
  // While rest runs the steppers fold into one "Next: set 4 · 62.5 × 8" row (S4); a tap on it
  // brings them back to change the next Set. Every log folds them again.
  const [nextExpanded, setNextExpanded] = useState(false)

  /** Today's Sets to preset from once they are `entries`: none when the caller gives no `logged`. */
  function today(entries: SetEntry[]): SetEntry[] | undefined {
    return props.logged === undefined ? undefined : entries
  }
  // The logged Set open in the edit sheet, if any (E12-T3, S2b), with the values being edited;
  // the Set on the steppers stays as it was behind the sheet.
  const [editing, setEditing] = useState<number | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  // The Warm-up ramp under way, if any (E15-T7); it starts only on a tap of Add warm-ups.
  const [ramp, setRamp] = useState<Ramp | null>(null)
  const [undo, setUndo] = useState<SetEntry | null>(null)
  // V5-04: what the Delete snackbar names, "Set 2 deleted · 80 × 7", fixed as it is deleted.
  const [undoMessage, setUndoMessage] = useState('')
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // The exercise tools sheet (S3b), its segment and whether its Set type row is open.
  const [toolsOpen, setToolsOpen] = useState(false)
  const [toolsSegment, setToolsSegment] = useState<ToolsSegment>(props.plates ? 'warmup' : 'notes')
  const [kindsOpen, setKindsOpen] = useState(false)

  // V1-17: the swap's Undo, shown from the screen's opening until it times out or a Set is logged.
  // Read once, on open: the caller may drop it at once, and a later screen must not show it again.
  const [swappedFrom] = useState(props.swappedFrom ?? null)
  // V5-02: a swap onto other equipment asks for its starting weight until the Dial is moved or
  // a Set is logged.
  const [startWeightSet, setStartWeightSet] = useState(false)
  const askingStartWeight =
    props.askStartWeight === true && !startWeightSet && workingSets(loggedSets).length === 0
  const [swapUndoShown, setSwapUndoShown] = useState<boolean>(swappedFrom !== null)
  useEffect(() => {
    if (!swapUndoShown) return undefined
    const timer = setTimeout(() => setSwapUndoShown(false), UNDO_MS)
    return () => clearTimeout(timer)
  }, [swapUndoShown])

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
  // The Set logged in the last CONFIRMED_MS: its cell shows it as just logged.
  const [justLogged, setJustLogged] = useState<number | null>(null)
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(
    () => () => {
      if (confirmTimer.current !== null) clearTimeout(confirmTimer.current)
    },
    [],
  )
  // V4-04: the Set whose cell flashes the accent tint for PR_FLASH_MS, having just set a Record.
  // No toast: the Just done block carries the Record for the whole rest (V4-01).
  const [prFlash, setPrFlash] = useState<number | null>(null)
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(
    () => () => {
      if (flashTimer.current !== null) clearTimeout(flashTimer.current)
    },
    [],
  )
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
  const [loggedMessage, setLoggedMessage] = useState<string>(props.handover?.message ?? '')
  // The RIR chips belong to the Set last logged here and its pick (E14-T10); local, not stored.
  const [effort, setEffort] = useState<{ setIndex: number; rir: 0 | 1 | 2 | 3 | null } | null>(
    null,
  )
  const [now, setNow] = useState<number>(() => Date.now())
  // The rest that ran out on this screen, by its key: "Over rest +0:12" shows quietly over Log
  // set until the next rest. A rest skipped, or one already over when the screen opened, never.
  const [overKey, setOverKey] = useState<string | null>(null)

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
    earlier.length > 0 && prMoment(exercise, plan, earlier, thisSession, entry) !== null

  const rest: RestState | null =
    restFrom === null ? null : restAfter(restFrom.entry, restFrom.planRestSeconds, now)
  // The handed-over Exercise (V3-01) belongs to the rest after its last Set: a Set logged here
  // starts another rest, and the line goes.
  const handover =
    props.handover && restFrom !== null && restFrom.entry.exerciseId !== exercise.id ? props.handover : null
  const done = position > plan.sets && !extraOpen
  const resting = rest !== null && !rest.isOver
  // An extra Set past the plan keeps its steppers: there is no planned next Set to name.
  const collapsed = resting && !done && position <= plan.sets && !nextExpanded
  const overShown = rest !== null && rest.isOver && overKey !== null && overKey === currentRestKey

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
      setOverKey(current.key)
    }
  }, [currentRestKey, lastLoggedAt, restIsOver])

  // The rest Dial (E13-T9), opened from the countdown or the tools sheet's Rest time row, and the
  // Use offer its Set rest leaves.
  const [restDialOpen, setRestDialOpen] = useState(false)
  // The Exercise note editor (E14-T11).
  const [editingNote, setEditingNote] = useState(false)
  const [noteDraft, setNoteDraft] = useState('')
  const [useOffer, setUseOffer] = useState<UseRestOffer | null>(null)

  // How long the trainee usually rests after this Exercise (S4), from the earlier Sessions.
  const usualRest = usualRestSeconds(exercise.id, earlier)

  /** The rest Dial's Set rest: the Set's rest is `seconds`, and it may become the Plan's. */
  function setRestFromDial(seconds: number): void {
    setRestDialOpen(false)
    if (restFrom === null) {
      // No rest to change yet: the Dial sets the Exercise's own rest straight away.
      void saveRestForExercise(seconds)
      return
    }
    applyRest({ kind: 'set', seconds })
    // A Warm-up's short rest says nothing about the Exercise's Plan rest: no offer (E15-T2).
    const afterWarmup = restFrom.entry.kind === 'warmup'
    if (props.onUseRestForExercise !== undefined && !afterWarmup) {
      setUseOffer({ seconds, status: 'offered' })
    }
  }

  async function saveRestForExercise(seconds: number): Promise<void> {
    if (props.onUseRestForExercise === undefined) return
    setUseOffer({ seconds, status: 'saving' })
    try {
      await props.onUseRestForExercise(seconds)
      setUseOffer({ seconds, status: 'saved' })
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause)
      setUseOffer({ seconds, status: { error: message } })
    }
  }

  // The usual rest's Use in ⋯ › Rest time (V3-03): being saved, saved, or refused.
  const [usualSave, setUsualSave] = useState<UseRestOffer['status'] | null>(null)

  async function saveUsualRest(seconds: number): Promise<void> {
    if (props.onUseRestForExercise === undefined) return
    setUsualSave('saving')
    try {
      await props.onUseRestForExercise(seconds)
      setUsualSave('saved')
    } catch (cause) {
      setUsualSave({ error: cause instanceof Error ? cause.message : String(cause) })
    }
  }

  /** −15 s, +15 s or Skip: never offered as the Plan's rest, so they withdraw the Use offer. */
  function adjust(adjustment: RestAdjustment): void {
    setUseOffer(null)
    applyRest(adjustment)
  }

  /** The Set's new rest, shown now and stored through `onSetRest`. */
  function applyRest(adjustment: RestAdjustment): void {
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
    setSwapUndoShown(false)
    unlockRestSound()
    const validation = validateEntry(open.weightKg, open.reps, open.loadKg)
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
      ...loadOf(open),
      loggedAt,
      ...(open.kind === null ? {} : { kind: open.kind }),
    }

    try {
      const session = await onLog(sessionId, entry)
      const todayAfter = mergeEntry(loggedSets, entry)
      const merged =
        props.logged === undefined ? mergeEntry(history, entry) : history
      const nextSetIndex = open.setIndex + 1
      setError(null)
      clearUndo()
      setHistory(merged)
      setRestFrom({ entry, planRestSeconds: plan.restSeconds })
      setOverKey(null)
      if (confirmTimer.current !== null) clearTimeout(confirmTimer.current)
      setJustLogged(open.setIndex)
      confirmTimer.current = setTimeout(() => {
        confirmTimer.current = null
        setJustLogged(null)
      }, CONFIRMED_MS)
      setUseOffer(null)
      const warmup = open.kind === 'warmup'
      setLoggedMessage(
        warmup
          ? loggedText(open.setIndex, open.weightKg, open.reps).replace(/^Set \d+/, `Warm-up ${warmupsLogged + 1}`)
          : loggedText(open.setIndex, open.weightKg, open.reps),
      )
      // A Warm-up asks no effort (V3-05): its reps left say nothing about the working Sets.
      setEffort(warmup ? null : { setIndex: open.setIndex, rir: null })
      setNextExpanded(false)
      const next = openSetFor(exercise, plan, nextSetIndex, merged, today(todayAfter), props.deload)
      const nextStep = ramp === null ? undefined : ramp.steps[ramp.index + 1]
      if (ramp === null) {
        setOpen(next)
      } else if (nextStep === undefined) {
        // The last Warm-up: back to the working weight the ramp was started from.
        setRamp(null)
        setOpen({ ...next, weightKg: ramp.workingKg, reps: ramp.workingReps })
      } else {
        setRamp({ ...ramp, index: ramp.index + 1 })
        setOpen({ ...next, weightKg: nextStep.weightKg, reps: nextStep.reps, kind: 'warmup' })
      }
      setExtraOpen(false)
      setLoggedCount(
        session.entries.filter(
          (logged) => logged.exerciseId === exercise.id && countsTowardStats(logged),
        ).length,
      )
      // V4-04: a Record is felt as it is logged: two rising tones, and the cell's 1.2 s tint
      // (CSS drops the tint under reduced motion; the PR tag and the Just done block remain).
      if ((props.earlierSessions ?? []).length > 0 && prMoment(exercise, plan, props.earlierSessions ?? [], session, entry) !== null) {
        playPrSound()
        if (flashTimer.current !== null) clearTimeout(flashTimer.current)
        setPrFlash(open.setIndex)
        flashTimer.current = setTimeout(() => {
          flashTimer.current = null
          setPrFlash(null)
        }, PR_FLASH_MS)
      }
      onLogged(session, nextSetIndex)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    }
  }

  /** A chip tap for Set `setIndex`: shows the pick at once and stores it without holding anything up. */
  function pickEffort(setIndex: number, rir: 0 | 1 | 2 | 3): void {
    setEffort({ setIndex, rir })
    props.onSetEffort?.(setIndex, rir).catch((cause: unknown) => {
      setError(cause instanceof Error ? cause.message : String(cause))
    })
  }

  /** Set `entry`'s reps left as the screen shows it: a pick made here, else the stored one. */
  function effortOf(entry: SetEntry): 0 | 1 | 2 | 3 | null {
    if (effort !== null && effort.setIndex === entry.setIndex) return effort.rir ?? entry.rir ?? null
    return entry.rir ?? null
  }

  // The ramp Add warm-ups would start (E15-T7): for the weight on the Dial, from the step after
  // the Warm-ups already logged. Offered only before the first working Set of a barbell Exercise.
  const warmupsLogged = loggedSets.length - workingSets(loggedSets).length
  const rampOffer: WarmupStep[] | null =
    props.plates && ramp === null && !done && loggedCount === 0 && open.weightKg !== null
      ? warmupRamp(open.weightKg, props.plates)
      : null

  function startRamp(steps: WarmupStep[]): void {
    const step = steps[warmupsLogged]
    if (step === undefined || open.weightKg === null) return
    setError(null)
    setToolsOpen(false)
    setRamp({ steps, index: warmupsLogged, workingKg: open.weightKg, workingReps: open.reps })
    setOpen({ ...open, weightKg: step.weightKg, reps: step.reps, kind: 'warmup' })
  }

  /** The kind row: choosing another kind than Warm-up ends a ramp at its working weight. */
  function chooseKind(kind: SetKind | null): void {
    setKindsOpen(false)
    // An AMRAP Set starts at the Plan's rep floor, its "8+" (V1-13).
    const floor = (reps: number): number => (kind === 'amrap' ? Math.max(reps, plan.repRange[0]) : reps)
    if (ramp === null || kind === 'warmup') {
      setOpen({ ...open, kind, reps: floor(open.reps) })
      return
    }
    setRamp(null)
    setOpen({ ...open, weightKg: ramp.workingKg, reps: floor(ramp.workingReps), kind })
  }

  function openLogged(entry: SetEntry): void {
    setError(null)
    setToolsOpen(false)
    setEditing(entry.setIndex)
    setDraft({
      setIndex: entry.setIndex,
      weightKg: entry.weightKg,
      reps: entry.reps,
      kind: entry.kind ?? null,
      loadKg: entry.loadKg ?? 0,
      rir: entry.rir ?? null,
    })
  }

  // A done cell tapped in "All" opens the screen on that Set, ready to edit.
  useEffect(() => {
    if (props.editSetIndex === undefined) return
    const entry = loggedSets.find((candidate) => candidate.setIndex === props.editSetIndex)
    if (entry !== undefined) openLogged(entry)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, as the screen opens
  }, [])

  /** Closes the edit sheet with nothing changed. */
  function cancelEdit(): void {
    setError(null)
    setEditing(null)
    setDraft(null)
  }

  /** Back to the next Set to log, `next` being its index and `sets` today's Sets by then. */
  function returnToLogging(next: number, sets: SetEntry[], from: SetEntry[] = history): void {
    setError(null)
    setEditing(null)
    setDraft(null)
    setExtraOpen(false)
    setRamp(null)
    setOpen(openSetFor(exercise, plan, next, from, today(sets), props.deload))
  }

  async function saveSet(): Promise<void> {
    if (editing === null || draft === null || props.onEditSet === undefined) return
    const validation = validateEntry(draft.weightKg, draft.reps, draft.loadKg)
    if (!validation.ok) {
      setError(validation.error)
      return
    }
    const before = loggedSets.find((entry) => entry.setIndex === editing)
    // The kind goes along only when it was changed; omitted, the service keeps the Set's own.
    const kindChanged = draft.kind !== (before?.kind ?? null)
    const values = {
      weightKg: draft.weightKg,
      reps: draft.reps,
      ...(kindChanged ? { kind: draft.kind } : {}),
      // A Bodyweight Set always sends its Load, null at plain bodyweight to remove one (E14-T14).
      ...(exercise.bodyweight ? { loadKg: draft.loadKg === 0 ? null : draft.loadKg } : {}),
    }
    try {
      await props.onEditSet(editing, values)
      const rirBefore = before?.rir ?? null
      if (draft.rir !== rirBefore) {
        props.onSetEffort?.(editing, draft.rir).catch((cause: unknown) => {
          setError(cause instanceof Error ? cause.message : String(cause))
        })
      }
      const edited = loggedSets.map((entry) => {
        if (entry.setIndex !== editing) return entry
        const { kind: _was, loadKg: _wasLoad, ...unkinded } = entry
        void _was
        void _wasLoad
        return {
          ...unkinded,
          weightKg: values.weightKg,
          reps: values.reps,
          ...loadOf(draft),
          ...(draft.kind === null ? {} : { kind: draft.kind }),
        }
      })
      const merged =
        props.logged !== undefined
          ? history
          : before === undefined
            ? history
            : mergeEntry(history, edited.find((entry) => entry.setIndex === editing) ?? before)
      setHistory(merged)
      returnToLogging(loggedSets.length + 1, edited, merged)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    }
  }

  async function deleteSet(): Promise<void> {
    if (editing === null || props.onDeleteSet === undefined) return
    try {
      const name = ordinals.has(editing) ? `Set ${ordinals.get(editing)}` : 'Warm-up'
      const removed = await props.onDeleteSet(editing)
      setUndoMessage(`${name} deleted · ${formatSet(removed)}`)
      const deletedAt = editing
      returnToLogging(
        loggedSets.length,
        loggedSets
          .filter((entry) => entry.setIndex !== deletedAt)
          .map((entry) =>
            entry.setIndex > deletedAt ? { ...entry, setIndex: entry.setIndex - 1 } : entry,
          ),
      )
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
      returnToLogging(loggedSets.length + 2, [
        ...loggedSets.map((entry) =>
          entry.setIndex >= undo.setIndex ? { ...entry, setIndex: entry.setIndex + 1 } : entry,
        ),
        undo,
      ])
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    }
  }

  /** Opens one extra set here, and tells the caller, which may reopen it as an extra set. */
  function addSet(add: NonNullable<SetScreenProps['onAddSet']>): void {
    setExtraOpen(true)
    add(exercise.id, open.setIndex)
  }

  /** A tools sheet row that hands off elsewhere: the sheet closes first. */
  function handOff(action: () => void): void {
    setToolsOpen(false)
    action()
  }

  // Each logged working Set's place among the working Sets, for its cell; a warm-up has none.
  const ordinals = new Map<number, number>()
  {
    let n = carried
    for (const entry of loggedSets) {
      if (entry.kind === 'warmup') continue
      n += 1
      ordinals.set(entry.setIndex, n)
    }
  }

  // V3-05: every Warm-up shares one `W n/N` cell, ticking to `W ✓` once the ramp is done, so the
  // working cells keep their numbers 1..N.
  const onWarmup = open.kind === 'warmup' && !done
  const workingLogged = loggedSets.filter((entry) => entry.kind !== 'warmup')
  const warmupTotal = ramp !== null ? ramp.steps.length : warmupsLogged + (onWarmup ? 1 : 0)
  const warmupCell =
    warmupTotal === 0 ? null : { done: warmupsLogged, total: warmupTotal, current: onWarmup, complete: !onWarmup }
  // The Warm-up on the Dials as the bar and the Get ready card name it: "warm-up 2", "warm-up 2 of 3".
  const warmupNumber = warmupsLogged + 1
  const warmupName = `${warmupNumber}${ramp === null ? '' : ` of ${ramp.steps.length}`}`

  // The cells after the logged ones: the Set on the steppers, then every planned Set still to
  // come at its own Preset (V1-02): the one it opens with once the Sets before it are logged as
  // they stand -- the open one as on the Dials (a Warm-up ramp's at its working weight), the later
  // ones at their Presets.
  const cells: { position: number; current: boolean; weightKg: number | null; reps: number; loadKg: number }[] = []
  {
    const last = Math.max(plan.sets, extraOpen ? position : 0)
    const working =
      ramp !== null && open.kind === 'warmup'
        ? { weightKg: ramp.workingKg, reps: ramp.workingReps, loadKg: open.loadKg, kind: null }
        : { ...open, kind: open.kind === 'warmup' ? null : open.kind }
    const assumed: SetEntry[] = [...loggedSets, assumedEntry(exercise.id, open.setIndex, working)]
    for (let at = position; at <= last && !done; at += 1) {
      if (at === position) {
        // A Warm-up on the Dials sits in the W cell (V3-05): working Set 1 keeps its own values.
        cells.push(
          onWarmup
            ? { position: at, current: false, weightKg: working.weightKg, reps: working.reps, loadKg: working.loadKg }
            : { position: at, current: true, weightKg: open.weightKg, reps: open.reps, loadKg: open.loadKg },
        )
        continue
      }
      const setIndex = open.setIndex + (at - position)
      const preset = presetForSet({
        exercise,
        plan,
        setIndex,
        lastEntries: history,
        today: today(assumed),
        deload: props.deload,
      })
      const loadKg = preset.loadKg ?? 0
      assumed.push(assumedEntry(exercise.id, setIndex, { weightKg: preset.weightKg, reps: preset.reps, loadKg, kind: null }))
      cells.push({ position: at, current: false, weightKg: preset.weightKg, reps: preset.reps, loadKg })
    }
  }

  // What the Set on the steppers would mean if logged: its e1RM, the record, PR if logged.
  const projection = !done
    ? projectSet({
        exercise,
        plan,
        earlier,
        session: thisSession,
        set: {
          weightKg: open.weightKg,
          reps: open.reps,
          ...(open.loadKg === 0 ? {} : { loadKg: open.loadKg }),
          ...(open.kind === null ? {} : { kind: open.kind }),
        },
      })
    : null

  // What the Sets so far are, as a key: the PR target and the verdict follow edits and deletes.
  const loggedKey = loggedSets
    .map((entry) => `${entry.setIndex}:${entry.weightKg}x${entry.reps}+${entry.loadKg ?? 0}/${entry.kind ?? ''}`)
    .join(',')
  // The PR target (V2-04): the fewest reps at the Dials' weight that would set a Record. Its rule
  // is `projectSet`'s; recomputed only when the weight, the kind or today's Sets change.
  const prTarget = useMemo(
    () =>
      done
        ? null
        : prTargetReps({
            exercise,
            plan,
            earlier,
            session: thisSession,
            set: {
              weightKg: open.weightKg,
              ...(open.loadKg === 0 ? {} : { loadKg: open.loadKg }),
              ...(open.kind === null ? {} : { kind: open.kind }),
            },
          }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on what the Record rule reads
    [done, open.weightKg, open.loadKg, open.kind, loggedKey, earlier.length, exercise.id, exercise.bodyweight],
  )
  const prNote: ReactNode =
    projection !== null && projection.isPr ? (
      <span className="tag tag-pr">PR if logged</span>
    ) : projection !== null && projection.repBest ? (
      'rep best if logged'
    ) : prTarget === null ? null : (
      prTargetText(prTarget)
    )
  // Last time's working Set at working `place` and its day, for a comparison (V4-01, V4-02).
  const lastAt = (place: number): SetEntry | null => lastTimeSet(exercise.id, props.lastTime ?? [], place)

  // V4-02: the live line under the reps Dial, rebuilt on every Dial change: "Last time 70 × 7 ·
  // +1 rep · PR if logged". On a Warm-up, where the ramp ends: "Then set 1 · 60 × 10" (V4-05).
  const workingFirst = cells[0]
  const thenText =
    onWarmup && workingFirst !== undefined
      ? `Then set ${position} · ${formatSet({ weightKg: workingFirst.weightKg, reps: workingFirst.reps, loadKg: workingFirst.loadKg })}`
      : null
  const liveDelta =
    lastTimeEntry === null || onWarmup
      ? null
      : setDelta({ weightKg: open.weightKg, reps: open.reps, loadKg: open.loadKg }, lastTimeEntry)
  // V6-17: a lift never logged before says so, and to start light, until its first Set today.
  const firstTime =
    !onWarmup &&
    !done &&
    loggedCount === 0 &&
    (props.lastTime ?? []).every((entry) => entry.exerciseId !== exercise.id) &&
    earlier.every((session) => session.entries.every((entry) => entry.exerciseId !== exercise.id))
  const vsLine: ReactNode =
    thenText !== null ? (
      thenText
    ) : firstTime && prNote === null ? (
      'First time · start light'
    ) : lastTimeEntry === null && prNote === null ? null : (
      <>
        {lastTimeEntry === null ? null : `Last time ${formatSet(lastTimeEntry)}`}
        {/* V6-18: the same as last time names its day ("· Mon 12 Oct"), never "same". */}
        {liveDelta === null || lastTimeEntry === null ? null : (
          <span className="vs-delta" data-kind={liveDelta.kind}>
            {` · ${liveDelta.kind === 'same' ? dayOf(lastTimeEntry) : liveDelta.text}`}
          </span>
        )}
        {lastTimeEntry === null || prNote === null ? null : ' · '}
        {prNote}
      </>
    )

  // V6-01: the load the lift's status offers, for this Set: last time's at its place, shifted by
  // the step the advice makes on the top Set (a ramp keeps its shape). Gone once the Dials hold it,
  // on a Warm-up, in the done state and while a logged Set is being edited.
  const adviceOffer: { target: number; text: string; use: string } | null = (() => {
    const advice = props.advice
    if (!advice || advice.use === null || onWarmup || done || editing !== null) return null
    const leverOf = (set: SetEntry): number => (exercise.bodyweight ? (set.loadKg ?? 0) : (set.weightKg ?? 0))
    const last = workingSets(props.lastEntries.filter((entry) => entry.exerciseId === exercise.id)).sort(
      (a, b) => a.setIndex - b.setIndex,
    )
    if (last.length === 0) return null
    const top = Math.max(...last.map(leverOf))
    const at = last[Math.min(Math.max(position, 1), last.length) - 1]
    const target = Math.round((leverOf(at) + advice.lever - top) * 1000) / 1000
    const current = exercise.bodyweight ? open.loadKg : open.weightKg
    if (current === target || (!exercise.bodyweight && target <= 0)) return null
    return { target, text: advice.text, use: `Use ${leverText(target, exercise.bodyweight)}` }
  })()

  // V4-01: the Record a logged Set of this Exercise set, by its name ("Heaviest weight"), or null.
  // V6 (V5-06): a rep best is named too ("Rep best"), but carries no PR tag (`recordIsPr`).
  const recordOf = (entry: SetEntry): { name: string; pr: boolean } | null => {
    if (earlier.length === 0 || entry.kind === 'warmup') return null
    const session: Session = { ...thisSession, entries: mergeEntry(thisSession.entries, entry) }
    const moment = prMoment(exercise, plan, earlier, session, entry)
    if (moment !== null) return { name: moment.title.replace(/^New PR · /, ''), pr: true }
    const best = repBestMoment(exercise, plan, earlier, session, entry)
    return best === null ? null : { name: best.title, pr: false }
  }
  const recordName = (entry: SetEntry): string | null => recordOf(entry)?.name ?? null

  // V4-01: the Set the Just done block is about: this Exercise's latest Set, the one the rest
  // follows (so a reopened screen mid-rest still shows it); null after another Exercise's Set.
  const justDone: SetEntry | null =
    restFrom === null || restFrom.entry.exerciseId !== exercise.id
      ? null
      : (loggedSets.find((entry) => entry.setIndex === restFrom.entry.setIndex) ??
        (props.logged === undefined ? restFrom.entry : null))
  const justDoneOrdinal =
    justDone === null ? 0 : props.logged === undefined ? justDone.setIndex : (ordinals.get(justDone.setIndex) ?? 0)
  const justDoneWarmup = justDone !== null && justDone.kind === 'warmup'
  const justDoneComparison =
    justDone === null || justDoneWarmup
      ? null
      : (() => {
          const last = lastAt(justDoneOrdinal)
          return setComparison(justDone, last, last === null ? '' : dayOf(last), recordName(justDone))
        })()

  // V4-07, V4-01: the Exercise once done, "Deadlift done · 1 PR" over its Sets and one comparison.
  const doneRecords = done ? workingSets(loggedSets).filter((entry) => isRecordSet(entry)).length : 0
  const doneLine = useMemo(
    () =>
      done
        ? exerciseDoneLine({
            today: loggedSets,
            last: (props.lastTime ?? []).filter((entry) => entry.exerciseId === exercise.id),
            lastDay: (() => {
              const first = lastAt(1)
              return first === null ? '' : dayOf(first)
            })(),
            plannedSets: plan.sets,
            isRecord: isRecordSet,
          })
        : '',
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on what the line reads
    [done, loggedKey, earlier.length, exercise.id, props.lastTime],
  )
  // The next Set as the Get ready card shows it (V2-02): "70 kg × 7", "BW+10 × 8", "60 kg × 8+".
  const nextSetText = `${
    open.weightKg !== null && !exercise.bodyweight
      ? `${open.weightKg} kg × ${open.reps}`
      : formatSet({ weightKg: open.weightKg, reps: open.reps, loadKg: open.loadKg })
  }${open.kind === 'amrap' ? '+' : ''}`

  const sheetOpen = toolsOpen || draft !== null || restDialOpen
  // Behind a sheet the screen is out of reach of the keyboard and a screen reader (S3b, S2b).
  const hiddenBehindSheet = sheetOpen ? { 'aria-hidden': true as const, inert: '' } : {}

  // The row over the rest dock (S4): the rest Dial's "Use 2:30 for …" and its outcome. The
  // trainee's usual rest, when it differs from the Plan's, is offered in ⋯ › Rest time instead
  // (V3-03): "3:00 · usually 3:50 · Use", a decision for later, not for the middle of a rest.
  const usualOffered =
    props.onUseRestForExercise !== undefined &&
    usualRest !== null &&
    Math.abs(usualRest - plan.restSeconds) >= 15
  const offer: JSX.Element | null =
    useOffer !== null ? (
      <p className="rest-use">
        {useOffer.status === 'saved' ? (
          <span className="rest-use-saved">
            <Icon name="Check" size={18} />
            {props.programName === undefined ? 'Saved' : `Saved to ${props.programName}`}
          </span>
        ) : (
          <button
            type="button"
            className="rest-use-offer btn-quiet"
            disabled={useOffer.status === 'saving'}
            aria-label={`Use ${formatRest(useOffer.seconds)} for ${exercise.name}`}
            onClick={() => void saveRestForExercise(useOffer.seconds)}
          >
            <Icon name="Clock" size={18} />
            Use {formatRest(useOffer.seconds)}
          </button>
        )}
        {typeof useOffer.status === 'object' ? (
          <span className="rest-use-error" role="alert">
            {useOffer.status.error}
          </span>
        ) : null}
      </p>
    ) : null

  const restPanel =
    rest === null || restFrom === null || !resting ? null : (
      <RestPanel
        remainingSeconds={rest.remainingSeconds}
        totalSeconds={restLengthOf(restFrom.entry, restFrom.planRestSeconds)}
        offer={offer}
        onOpenDial={() => setRestDialOpen(true)}
        onLess={() => adjust({ kind: 'add', seconds: -15 })}
        onMore={() => adjust({ kind: 'add', seconds: 15 })}
        onSkip={() => adjust({ kind: 'skip' })}
      />
    )

  // The bottom edge: "Log set 3 · 62.5 × 8" (F3), under the rest panel while rest runs (S4,
  // V1-03) -- logging ends that rest -- and else under a quiet over-rest line once a rest ran
  // out here. Past the plan the screen is done: "Log set" is withheld and only an extra set is
  // offered -- and only to a caller that knows what to do with it.
  const actions = !done ? (
    <div className="log-dock">
      {restPanel}
      {resting || useOffer === null ? null : offer}
      {/* V4-06: quiet, never red: "Rested 3:00 · +0:12". */}
      {overShown && rest !== null && restFrom !== null ? (
        <p className="rest-over" data-over="true">
          Rested {formatRest(restLengthOf(restFrom.entry, restFrom.planRestSeconds))} ·{' '}
          <span role="timer" aria-label="Rest remaining">
            {formatOver(rest.overSeconds)}
          </span>
        </p>
      ) : null}
      {/* The label follows the steppers, and is its name (V1-04): "Log set 3 · 62.5 × 8". */}
      {/* The chosen kind shows on the bar (V1-13): "Log set 3 · 70 × 8+ · AMRAP". */}
      {/* A Warm-up names itself (V3-05): "Log warm-up 2 · 40 × 3". */}
      <button type="button" className="log-set btn-primary" onClick={() => void log()}>
        Log {onWarmup ? `warm-up ${warmupNumber}` : `set ${position}`} ·{' '}
        {formatSet({ weightKg: open.weightKg, reps: open.reps, loadKg: open.loadKg })}
        {open.kind === 'amrap' ? '+' : ''}
        {open.kind === null || open.kind === 'warmup' ? '' : ` · ${KIND_WORDS[open.kind]}`}
      </button>
    </div>
  ) : (
    // Done (V3-01): the Just done block in the body carries Add set. The Session moves on to the
    // next Exercise by itself; this state stays only once none is left ("Finish workout"), or
    // for an Exercise reopened from All ("Back to <Exercise> · set 3", V4-07). The rest keeps
    // running.
    <div className="log-dock">
      {restPanel}
      {upNext && onFinishExercise !== undefined ? (
        <button type="button" className="log-set next-exercise btn-primary" onClick={onFinishExercise}>
          {`Back to ${upNext}${props.upNextSet === undefined ? '' : ` · set ${props.upNextSet}`}`}
        </button>
      ) : props.onFinishWorkout !== undefined ? (
        <button type="button" className="log-set next-exercise btn-primary" onClick={props.onFinishWorkout}>
          Finish workout
        </button>
      ) : onFinishExercise === undefined ? null : (
        <button type="button" className="log-set next-exercise btn-primary" onClick={onFinishExercise}>
          All exercises
        </button>
      )}
    </div>
  )
  const dock = (
    <div className="set-dock" {...hiddenBehindSheet}>
      {actions}
    </div>
  )

  // The tools sheet's segments: Warm-up for a barbell, Notes wherever notes are kept. The Plate
  // line shows under the weight Dial, so the sheet has no Plates segment (V1-07).
  // The Warm-up segment also lists the Warm-ups logged, for any Exercise (V3-05).
  const warmupSteps = ramp?.steps ?? rampOffer ?? []
  const segments: { value: ToolsSegment; label: string }[] = [
    ...(props.plates || warmupsLogged > 0 ? [{ value: 'warmup' as const, label: 'Warm-up' }] : []),
    ...(props.onSaveExerciseNote === undefined ? [] : [{ value: 'notes' as const, label: 'Notes' }]),
  ]
  const segment = segments.some((option) => option.value === toolsSegment)
    ? toolsSegment
    : segments[0]?.value
  const plates = props.plates ?? null
  // The Plate line for the Set on the Dials (V1-07): under the weight Dial and in the Next row.
  const plateLine =
    plates === null || open.weightKg === null || exercise.bodyweight ? null : plateLineFor(open.weightKg, plates)
  // The Get ready card's plates (V2-02): the change from the bar as this Exercise's last Set left
  // it, "Add 5 per side → 20 + 5"; the Plate line when there is no such Set.
  const loadedKg =
    restFrom !== null && restFrom.entry.exerciseId === exercise.id && restFrom.entry.weightKg !== null
      ? restFrom.entry.weightKg
      : null
  const plateText =
    plateLine === null || plates === null || open.weightKg === null
      ? null
      : ((loadedKg === null ? null : plateChange(loadedKg, open.weightKg, plates)) ?? plateLine)

  const noteTools =
    props.onSaveExerciseNote === undefined ? null : editingNote ? (
      <div className="set-note-editor">
        <label className="set-note-label">
          <span>Note</span>
          <textarea
            className="set-note-input"
            maxLength={EXERCISE_NOTE_MAX}
            value={noteDraft}
            onChange={(event) => setNoteDraft(event.target.value)}
          />
        </label>
        <div className="set-note-actions">
          <button
            type="button"
            className="set-note-save btn-primary"
            onClick={() => {
              const save = props.onSaveExerciseNote
              if (save === undefined) return
              void save(noteDraft.slice(0, EXERCISE_NOTE_MAX)).then(() => setEditingNote(false))
            }}
          >
            Save note
          </button>
          <button type="button" className="set-note-cancel btn-quiet" onClick={() => setEditingNote(false)}>
            Cancel
          </button>
        </div>
      </div>
    ) : (
      <div className="set-note">
        <p className="sheet-caption">Exercise note</p>
        {props.exerciseNote === undefined || props.exerciseNote === null || props.exerciseNote === '' ? (
          <button
            type="button"
            className="set-note-add btn-quiet"
            onClick={() => {
              setNoteDraft('')
              setEditingNote(true)
            }}
          >
            Add note
          </button>
        ) : (
          <button
            type="button"
            className="set-note-text cell"
            onClick={() => {
              setNoteDraft(props.exerciseNote ?? '')
              setEditingNote(true)
            }}
          >
            {props.exerciseNote}
          </button>
        )}
      </div>
    )

  const toolsSheet = !toolsOpen ? null : (
    <Sheet label={`${exercise.name} tools`} onClose={() => setToolsOpen(false)}>
      <div className="sheet-head">
        <h2 className="sheet-title">{exercise.name}</h2>
        <button
          type="button"
          className="sheet-close icon-btn"
          aria-label="Close"
          onClick={() => setToolsOpen(false)}
        >
          <Icon name="X" size={24} />
        </button>
      </div>
      {segments.length > 1 && segment !== undefined ? (
        <Segmented
          name="exercise-tools"
          label="Exercise tools"
          value={segment}
          options={segments}
          onChange={setToolsSegment}
        />
      ) : null}
      <div className="tools-body">
        {segment === 'warmup' ? (
          <div className="tools-warmups">
            {/* The Warm-ups logged (V3-05): they share one W cell, so they are edited from here. */}
            {loggedSets
              .filter((entry) => entry.kind === 'warmup')
              .map((entry, index) => (
                <button
                  key={entry.setIndex}
                  type="button"
                  className="tools-warmup-row tools-warmup-logged cell"
                  data-done="true"
                  aria-label={formatSet(entry)}
                  onClick={() => openLogged(entry)}
                >
                  <span className="tools-warmup-index">
                    Warm-up {index + 1}
                    {warmupSteps.length > 0 ? ` of ${Math.max(warmupSteps.length, warmupsLogged)}` : ''}
                  </span>
                  <span className="tools-warmup-set">
                    {entry.weightKg === null ? formatSet(entry) : `${entry.weightKg} kg × ${entry.reps}`}
                  </span>
                  <span className="tools-warmup-plates">
                    <Icon name="Check" size={18} />
                  </span>
                </button>
              ))}
            {plates === null
              ? null
              : warmupSteps.slice(warmupsLogged).map((step, at) => (
                  <p key={warmupsLogged + at} className="tools-warmup-row">
                    <span className="tools-warmup-index">
                      Warm-up {warmupsLogged + at + 1} of {warmupSteps.length}
                    </span>
                    <span className="tools-warmup-set">
                      {step.weightKg} kg × {step.reps}
                    </span>
                    <span className="tools-warmup-plates">
                      {formatPlates(platesFor(step.weightKg, plates), plates).replace('Per side: ', 'Per side ')}
                    </span>
                  </p>
                ))}
            {plates === null || ramp !== null ? null : rampOffer !== null && rampOffer.length > warmupsLogged ? (
              <button type="button" className="add-warmups btn-secondary" onClick={() => startRamp(rampOffer)}>
                Add warm-ups
              </button>
            ) : (
              <p className="sheet-caption">Warm-ups are offered before the first working set.</p>
            )}
          </div>
        ) : null}
        {segment === 'notes' ? noteTools : null}
      </div>
      <div className="tools-rows">
        <button type="button" className="sheet-row cell" aria-expanded={kindsOpen} onClick={() => setKindsOpen(!kindsOpen)}>
          <span className="sheet-row-icon"><Icon name="Tag" /></span>
          <span className="sheet-row-label">Set type</span>
          <span className="sheet-row-value">{setKindLabel(open.kind)}</span>
          <span className="sheet-row-chevron"><Icon name={kindsOpen ? 'ChevronDown' : 'ChevronRight'} size={18} /></span>
        </button>
        {kindsOpen ? (
          <div className="tools-kinds">
            <SetKindRow value={open.kind} onChange={chooseKind} />
          </div>
        ) : null}
        <button type="button" className="sheet-row cell" onClick={() => handOff(() => setRestDialOpen(true))}>
          <span className="sheet-row-icon"><Icon name="Clock" /></span>
          <span className="sheet-row-label">Rest time</span>
          <span className="sheet-row-value">
            {formatRest(restFrom === null ? plan.restSeconds : restLengthOf(restFrom.entry, restFrom.planRestSeconds))}
            {usualOffered && usualRest !== null ? ` · usually ${formatRest(usualRest)}` : ''}
          </span>
          <span className="sheet-row-chevron"><Icon name="ChevronRight" size={18} /></span>
        </button>
        {/* V1-16: Step and Bodyweight live in Program › Exercises, not here mid-workout. */}
        <button type="button" className="sheet-row cell" onClick={() => handOff(() => onOpenAlternatives?.(exercise.id))}>
          <span className="sheet-row-icon"><Icon name="Swap" /></span>
          <span className="sheet-row-label">Swap exercise</span>
          <span className="sheet-row-chevron"><Icon name="ChevronRight" size={18} /></span>
        </button>
        <button type="button" className="sheet-row cell" onClick={() => handOff(() => onOpenInfo?.(exercise.id))}>
          <span className="sheet-row-icon"><Icon name="Info" /></span>
          <span className="sheet-row-label">Exercise info</span>
          <span className="sheet-row-chevron"><Icon name="ChevronRight" size={18} /></span>
        </button>
        <button type="button" className="sheet-row cell" onClick={() => handOff(() => onOpenHistory?.(exercise.id))}>
          <span className="sheet-row-icon"><Icon name="ChartLine" /></span>
          <span className="sheet-row-label">Lift history</span>
          <span className="sheet-row-chevron"><Icon name="ChevronRight" size={18} /></span>
        </button>
      </div>
    </Sheet>
  )

  const editedEntry = editing === null ? undefined : loggedSets.find((entry) => entry.setIndex === editing)
  const editTitle =
    editing === null
      ? ''
      : `Edit ${ordinals.has(editing) ? `set ${ordinals.get(editing)}` : 'warm-up'} · ${exercise.name}`
  const editSheet =
    draft === null || editing === null ? null : (
      <Sheet label={editTitle} onClose={cancelEdit}>
        <div className="sheet-head">
          <h2 className="sheet-title">{editTitle}</h2>
          <button type="button" className="delete-set btn-danger" onClick={() => void deleteSet()}>
            Delete set
          </button>
        </div>
        <div className="set-dials">
          {exercise.bodyweight ? (
            <WeightDial
              variant="scrub"
              exercise={effectiveExercise}
              value={draft.loadKg}
              onChange={(loadKg) => setDraft({ ...draft, loadKg: loadKg ?? 0 })}
            />
          ) : (
            <WeightDial
              variant="scrub"
              exercise={effectiveExercise}
              value={draft.weightKg}
              onChange={(weightKg) => setDraft({ ...draft, weightKg })}
            />
          )}
          <RepsDial variant="scrub" value={draft.reps} onChange={(reps) => setDraft({ ...draft, reps })} />
        </div>
        {plates !== null && draft.weightKg !== null ? (
          <p className="plate-line">{plateLineFor(draft.weightKg, plates)}</p>
        ) : null}
        <p className="sheet-caption">Set kind</p>
        <SetKindRow value={draft.kind} onChange={(kind) => setDraft({ ...draft, kind })} />
        {props.trackEffort === true || editedEntry?.rir !== undefined ? (
          <div className="effort-row">
            <span className="effort-label">Effort</span>
            <EffortChips value={draft.rir} onPick={(rir) => setDraft({ ...draft, rir })} />
          </div>
        ) : null}
        {error === null ? null : (
          <p className="set-error" role="alert">
            {error}
          </p>
        )}
        <button type="button" className="save-set btn-primary" onClick={() => void saveSet()}>
          Save set
        </button>
      </Sheet>
    )

  const restDialSheet = !restDialOpen ? null : (
    <Sheet label="Rest" onClose={() => setRestDialOpen(false)}>
      <RestDial
        seconds={restFrom === null ? plan.restSeconds : restLengthOf(restFrom.entry, restFrom.planRestSeconds)}
        onSet={setRestFromDial}
        onCancel={() => setRestDialOpen(false)}
      />
      {/* V1-16: the usual rest's Use is folded into ⋯ › Rest time's own sheet, under the Dial,
          rather than a row of its own in the tools sheet (V3-03 kept it out of the rest). */}
      {usualOffered && usualRest !== null ? (
        <p className="rest-use tools-usual-rest rest-dial-usual">
          {usualSave === 'saved' ? (
            <span className="rest-use-saved">
              <Icon name="Check" size={18} />
              {props.programName === undefined ? 'Saved' : `Saved to ${props.programName}`}
            </span>
          ) : (
            <button
              type="button"
              className="rest-use-offer btn-quiet"
              disabled={usualSave === 'saving'}
              aria-label={`Use ${formatRest(usualRest)} for ${exercise.name}`}
              onClick={() => void saveUsualRest(usualRest)}
            >
              <Icon name="Clock" size={18} />
              Use {formatRest(usualRest)}
            </button>
          )}
          {usualSave !== null && typeof usualSave === 'object' ? (
            <span className="rest-use-error" role="alert">
              {usualSave.error}
            </span>
          ) : null}
        </p>
      ) : null}
    </Sheet>
  )

  return (
    <>
      <div className="set-screen" {...hiddenBehindSheet}>
        {/* The exercise's name is the screen's one heading: the Live header names the workout as
            plain text on the set view (`LiveHeader`'s `heading={false}`), so only one heading
            ever names the Exercise (E5-T12's S7 matches a screen by it). */}
        <div className="set-head">
          <div className="set-head-text">
            <h1 className="set-exercise-name">{exercise.name}</h1>
            {/* Done, the Just done block replaces "All 3 sets logged" (V2-11, V4-07). */}
            {done && props.logged !== undefined && doneLine !== '' ? null : (
            <p className="set-counter">
              <span>
                {/* A Warm-up is not a working Set (V3-05): "Warm-up 2 of 3", never "Set 1 of 3". */}
                {onWarmup
                  ? `Warm-up ${warmupName}`
                  : setCounterText(
                      position,
                      plan.sets,
                      loggedCount,
                      done,
                      open.kind === 'amrap' ? plan.repRange[0] : undefined,
                    )}
              </span>
              {done || onWarmup || open.kind === 'amrap' ? null : (
                <span className="set-counter-target">
                  {` · target ${plan.repRange[0]}–${plan.repRange[1]}`}
                </span>
              )}
            </p>
            )}
            {/* The Exercise note, one line where it is read at the bar (V1-15); a tap edits it. */}
            {done || !props.exerciseNote || props.onSaveExerciseNote === undefined ? null : (
              <button
                type="button"
                className="set-note-line btn-quiet"
                aria-label={`Exercise note: ${props.exerciseNote}`}
                onClick={() => {
                  setKindsOpen(false)
                  setToolsSegment('notes')
                  setNoteDraft(props.exerciseNote ?? '')
                  setEditingNote(true)
                  setToolsOpen(true)
                }}
              >
                <Icon name="Pencil" size={14} />
                <span className="set-note-line-text">{props.exerciseNote}</span>
              </button>
            )}
            {open.deloaded === undefined || open.deloaded.kg !== open.weightKg ? null : (
              <p className="set-deload">
                {props.advice?.kind === 'eased'
                  ? `${props.advice.text}: ${open.deloaded.kg} (from ${open.deloaded.from})`
                  : deloadText(open.deloaded.kg, open.deloaded.from)}
              </p>
            )}
            {open.carried === undefined || open.carried.kg !== open.weightKg ? null : (
              <p className="set-carried">{open.carried.text}</p>
            )}
            {/* V5-02: the swap stays said on Now for as long as it stands, as on All. */}
            {props.swapFor ? (
              <p className="set-swapped">
                <span>{`for ${props.swapFor.name}`}</span>
                {props.swapFor.onUndo === undefined ? null : (
                  <>
                    <span aria-hidden="true">·</span>
                    <button
                      type="button"
                      className="set-swapped-undo btn-quiet"
                      onClick={() => {
                        setSwapUndoShown(false)
                        props.swapFor?.onUndo?.()
                      }}
                    >
                      Undo swap
                    </button>
                  </>
                )}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            className="set-tools-open icon-btn"
            aria-label="Exercise tools"
            onClick={() => {
              setKindsOpen(false)
              setToolsOpen(true)
            }}
          >
            <Icon name="Ellipsis" size={24} />
          </button>
        </div>

        {/* V6-16: the first barbell lift offers its warm-up ramp in one line, above the cells,
            until Add or the first working Set. */}
        {props.warmupLine && rampOffer !== null && rampOffer.length > 0 && warmupsLogged === 0 && editing === null ? (
          <p className="set-warmup-line">
            <span className="set-warmup-line-text">
              {`Warm-up: ${rampOffer.map((step) => `${step.weightKg}×${step.reps}`).join(' · ')}`}
            </span>
            <button
              type="button"
              className="set-warmup-line-add btn-quiet"
              aria-label="Add these warm-ups"
              onClick={() => startRamp(rampOffer)}
            >
              Add
            </button>
          </p>
        ) : null}

        {/* The set cells: today's logged Sets (tap one to edit it), the Set on the steppers
            outlined, and the planned Sets still to come, dashed. */}
        <div
          className="set-cells"
          data-dense={(warmupCell === null ? 0 : 1) + workingLogged.length + cells.length >= 5 ? 'true' : undefined}
        >
          {warmupCell === null ? null : (
            <SetCell
              state={warmupCell.current ? 'current' : 'done'}
              className="warmup-cell logged-set cell"
              headClassName="set-cell-index"
              index="W"
              mark={null}
              data-current={warmupCell.current ? 'true' : undefined}
              data-kind="warmup"
              aria-label={
                warmupCell.complete
                  ? 'Warm-ups done'
                  : `Warm-ups ${warmupCell.done} of ${warmupCell.total} done`
              }
              onClick={() => {
                setKindsOpen(false)
                setToolsSegment('warmup')
                setToolsOpen(true)
              }}
            >
              <span className="set-cell-value">
                {warmupCell.complete ? '✓' : `${warmupCell.done}/${warmupCell.total}`}
              </span>
            </SetCell>
          )}
          {workingLogged.length === 0 ? null : (
            <ul className="logged-sets" aria-label="Sets logged">
              {workingLogged.map((entry) => (
                <li
                  key={entry.setIndex}
                  className={
                    [justLogged === entry.setIndex ? 'just-logged' : '', prFlash === entry.setIndex ? 'pr-flash' : '']
                      .filter((name) => name !== '')
                      .join(' ') || undefined
                  }
                >
                  <SetCell
                    state={editing === entry.setIndex ? 'current' : isRecordSet(entry) ? 'pr' : 'done'}
                    className="logged-set cell"
                    headClassName="set-cell-index"
                    aria-label={formatSet(entry)}
                    data-editing={editing === entry.setIndex ? 'true' : undefined}
                    data-kind={entry.kind}
                    onClick={() => openLogged(entry)}
                    index={
                      <>
                        {ordinals.get(entry.setIndex) ?? ''}
                        {entry.kind === undefined ? null : (
                          <span className="set-kind-marker">{KIND_MARKERS[entry.kind]}</span>
                        )}
                      </>
                    }
                    mark={
                      isRecordSet(entry) ? (
                        <PrTag />
                      ) : effortOf(entry) === null ? (
                        <Icon name="Check" size={12} />
                      ) : null
                    }
                  >
                    <SetFigure set={entry} className="set-cell-value" />
                  </SetCell>
                  {/* A record's PR tag has the corner; its reps left show in the edit sheet. Reps
                      left, not "RIR" (V3-03, V1-14). */}
                  {effortOf(entry) === null || isRecordSet(entry) ? null : (
                    <span className="logged-set-rir">
                      {effortOf(entry) === 3 ? '3+' : effortOf(entry)} left
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
          {cells.map((cell) => (
            <SetCell
              key={cell.position}
              state={cell.current ? 'current' : 'planned'}
              className={cell.current ? 'set-cell set-cell--current' : 'set-cell set-cell--future'}
              headClassName="set-cell-index"
              index={cell.position}
              aria-hidden="true"
            >
              <SetFigure set={cell} className="set-cell-value" />
            </SetCell>
          ))}
        </div>

        {collapsed ? (
          // While rest runs (S4, V2-02) the steppers fold into the Get ready card, read high,
          // right under the cells (V4-01): the next Set big enough to read from the bench, the
          // plates to change, last time and the PR target -- on a Warm-up, where the ramp ends
          // (V4-05). "Change" unfolds the Dials in place.
          <section className="get-ready" aria-label="Get ready">
            <p className="get-ready-caption">
              Get ready · {onWarmup ? `Warm-up ${warmupName}` : `Set ${position}`}
            </p>
            <p className="get-ready-set">{nextSetText}</p>
            {plateText === null ? null : <p className="get-ready-plates">{plateText}</p>}
            {thenText !== null ? (
              <p className="get-ready-last">{thenText}</p>
            ) : lastTimeEntry === null && prNote === null ? null : (
              <p className="get-ready-last">
                {lastTimeEntry === null ? null : `Last time ${formatSet(lastTimeEntry)}`}
                {lastTimeEntry === null || prNote === null ? null : ' · '}
                {prNote}
              </p>
            )}
            <button
              type="button"
              className="get-ready-change btn-quiet"
              aria-label="Change next set"
              aria-expanded={false}
              onClick={() => setNextExpanded(true)}
            >
              Change
              <Icon name="ChevronRight" size={18} />
            </button>
          </section>
        ) : null}

        {/* V4-06: a working Set's reps left still unanswered once its rest ran out stays on Now,
            labelled with the Set it asks about, until it is answered or the next Set is logged. */}
        {props.trackEffort !== true || collapsed || done ? null : justDone !== null ? (
          justDoneWarmup || effortOf(justDone) !== null ? null : (
            <EffortRow
              label={`Set ${justDoneOrdinal} reps left?`}
              value={null}
              onPick={(rir) => pickEffort(justDone.setIndex, rir)}
            />
          )
        ) : handover?.effort && handover.effort.value === null ? (
          <EffortRow
            label={`${handover.name} set ${handover.effort.ordinal} reps left?`}
            value={null}
            onPick={handover.effort.onPick}
          />
        ) : null}

        {/* The flexible space: the Dials sit low, in the thumb's reach over the bar (V2-03); while
            rest runs it sits between the Get ready card and the Just done block (V4-01). */}
        <div className="set-spacer" aria-hidden="true" />

        {/* V5-04: the snackbars ride here, over the space above the Dials (or the Just done block
            while rest runs), never over the reps Dial or the rest timer under them. */}
        <div className="set-snackbar-anchor">
          {undo === null ? null : (
            <Snackbar inline message={undoMessage} actionLabel="Undo" onAction={() => void restoreSet()} />
          )}
          {undo !== null || !swapUndoShown || swappedFrom === null ? null : (
            // V6: no Undo here; the swap line's "Undo swap" is the one Undo on the screen.
            <Snackbar inline message={`Swapped from ${swappedFrom.name}`} />
          )}
        </div>

        {/* V4-01: the Just done block on the dock, for the whole rest: the Set just logged, its
            one comparison (its Record, if any) and its reps left. */}
        {collapsed && justDone !== null ? (
          <section className="just-done" aria-label="Just done">
            <p className="just-done-head">
              <span className="just-done-name">
                {justDoneWarmup
                  ? `Warm-up ${loggedSets.filter((entry) => entry.kind === 'warmup').findIndex((entry) => entry.setIndex === justDone.setIndex) + 1}`
                  : `Set ${justDoneOrdinal}`}
              </span>
              {` · ${setText(justDone, exercise.bodyweight)}`}
            </p>
            {justDoneComparison === null ? null : (
              <p className="just-done-line" data-kind={justDoneComparison.kind}>
                {justDoneComparison.record === null || recordOf(justDone)?.pr !== true ? null : (
                  <PrTag label={null} />
                )}
                <span>{justDoneComparison.text}</span>
              </p>
            )}
            {props.trackEffort !== true || justDoneWarmup ? null : (
              <EffortRow
                label="Reps left?"
                value={effortOf(justDone)}
                onPick={(rir) => pickEffort(justDone.setIndex, rir)}
              />
            )}
          </section>
        ) : null}

        {/* V3-01, V4-01: the Exercise just finished, on the next one's screen while its rest runs:
            "Deadlift done · 1 PR" with Add set, its Sets and one comparison, its last Set's reps
            left. */}
        {handover && collapsed ? (
          <section className="just-done exercise-verdict" aria-label="Exercise done">
            <div className="just-done-top">
              <p className="just-done-head exercise-verdict-text">
                <span className="just-done-name">{`${handover.name} done`}</span>
                {handover.prs !== undefined && handover.prs > 0 ? ` · ${handover.prs} PR` : ''}
              </p>
              <button type="button" className="add-set btn-quiet" onClick={handover.onAddSet}>
                Add set
              </button>
            </div>
            {handover.line ? <p className="just-done-line">{handover.line}</p> : null}
            {props.trackEffort !== true || !handover.effort ? null : (
              <EffortRow
                label={`Set ${handover.effort.ordinal} reps left?`}
                value={handover.effort.value}
                onPick={handover.effort.onPick}
              />
            )}
          </section>
        ) : null}

        {done ? (
          // V4-07: the Exercise once its Sets are in, as the hand-over shows it: "Deadlift done ·
          // 1 PR" with Add set, its Sets and one comparison; the cells above stay tappable to edit.
          <section className="just-done exercise-verdict" aria-label="Exercise done">
            <div className="just-done-top">
              <p className="just-done-head exercise-verdict-text">
                <span className="just-done-name">{`${exercise.name} done`}</span>
                {doneRecords > 0 ? ` · ${doneRecords} PR` : ''}
              </p>
              {onAddSet === undefined ? null : (
                <button type="button" className="add-set btn-quiet" onClick={() => addSet(onAddSet)}>
                  Add set
                </button>
              )}
            </div>
            {doneLine === '' ? null : <p className="just-done-line">{doneLine}</p>}
            {props.trackEffort !== true || !resting || justDone === null || justDoneWarmup ? null : (
              <EffortRow
                label={`Set ${justDoneOrdinal} reps left?`}
                value={effortOf(justDone)}
                onPick={(rir) => pickEffort(justDone.setIndex, rir)}
              />
            )}
          </section>
        ) : collapsed ? null : (
          <>
          <div className="set-dials" onFocusCapture={revealDial} onPointerUpCapture={revealDial}>
            {exercise.bodyweight ? (
              // E16-T4: on a Bodyweight Exercise the Weight Dial carries the signed Load.
              <WeightDial
                variant="scrub"
                exercise={effectiveExercise}
                value={open.loadKg}
                onChange={(loadKg) => setOpen({ ...open, loadKg: loadKg ?? 0 })}
              />
            ) : (
              <WeightDial
                variant="scrub"
                exercise={effectiveExercise}
                value={open.weightKg}
                onChange={(weightKg) => {
                  setStartWeightSet(true)
                  setOpen({ ...open, weightKg })
                }}
              />
            )}
            {askingStartWeight ? (
              <p className="plate-line set-start-weight">Set a starting weight</p>
            ) : plateLine === null ? null : (
              <p className="plate-line">{plateLine}</p>
            )}
            <RepsDial variant="scrub" value={open.reps} onChange={(reps) => setOpen({ ...open, reps })} />
          </div>

          {/* V4-02: one live line under the reps Dial, "Last time 70 × 7 · +1 rep · PR if logged";
              on a Warm-up, "Then set 1 · 60 × 10" (V4-05). */}
          {vsLine === null ? null : <p className="set-projection">{vsLine}</p>}
          {/* V6-01: the advice at the bar, "Ready for 15 kg · Use 15 kg"; one tap dials it in. */}
          {adviceOffer === null ? null : (
            <p className="set-advice">
              <span className="set-advice-text">{adviceOffer.text}</span>
              <button
                type="button"
                className="set-advice-use btn-quiet"
                onClick={() =>
                  setOpen(
                    exercise.bodyweight
                      ? { ...open, loadKg: adviceOffer.target }
                      : { ...open, weightKg: adviceOffer.target },
                  )
                }
              >
                {adviceOffer.use}
              </button>
            </p>
          )}
          </>
        )}

        {error === null || draft !== null ? null : (
          <p className="set-error" role="alert">
            {error}
          </p>
        )}

        {props.upcoming === undefined || resting ? null : (
          <div className="set-upcoming">{props.upcoming}</div>
        )}

        <p role="status" className="set-logged" data-family={family}>
          {loggedMessage}
        </p>
      </div>

      {actionBar === null ? dock : createPortal(dock, actionBar)}

      {toolsSheet}
      {editSheet}
      {restDialSheet}


    </>
  )
}

/**
 * V1-20: the Dial being worked is never left under the dock. On a short screen (195 x 422, or
 * large text) the reps Dial starts below the Log set bar; a focus or a tap on the part still in
 * sight scrolls the page just enough to lift that Dial clear of the dock.
 */
function revealDial(event: { target: EventTarget | null }): void {
  const target = event.target instanceof Element ? event.target : null
  const dial = target?.closest('.dial')
  const dock = document.querySelector('.set-dock')?.closest('.action-bar') ?? document.querySelector('.set-dock')
  if (!dial || !dock) return
  const dialBox = dial.getBoundingClientRect()
  const dockBox = dock.getBoundingClientRect()
  if (dialBox.height === 0 || dockBox.height === 0) return
  const over = dialBox.bottom + 8 - dockBox.top
  if (over > 0) window.scrollBy({ top: over })
}

/** A logged Set as the Just done block heads it: "60 kg × 10", "BW−19 × 6" (V4-01). */
function setText(set: SetEntry, bodyweight: boolean): string {
  return set.weightKg !== null && !bodyweight ? `${set.weightKg} kg × ${set.reps}` : formatSet(set)
}

/** The reps-left question with its chips: "Reps left?", "Set 3 reps left?" (V4-01, V4-06). */
function EffortRow(props: {
  label: string
  value: 0 | 1 | 2 | 3 | null
  onPick(rir: 0 | 1 | 2 | 3): void
}): JSX.Element {
  return (
    <div className="effort-row">
      <span className="effort-label">{props.label}</span>
      <EffortChips value={props.value} onPick={props.onPick} />
    </div>
  )
}

/**
 * The effort chips "0 · 1 · 2 · 3+" (E14-T10), the reps left in reserve, for the Set just logged
 * or the one edited. No "RIR" on them (V3-03, V1-14): the row's label says "Reps left".
 */
function EffortChips(props: { value: 0 | 1 | 2 | 3 | null; onPick(rir: 0 | 1 | 2 | 3): void }): JSX.Element {
  return (
    <div className="effort-chips" role="group" aria-label="Reps in reserve">
      {([0, 1, 2, 3] as const).map((rir) => (
        <button
          key={rir}
          type="button"
          className="effort-chip chip"
          aria-pressed={props.value === rir}
          onClick={() => props.onPick(rir)}
        >
          {rir === 3 ? '3+' : rir}
        </button>
      ))}
    </div>
  )
}
