import { useState } from 'react'
import { presetForSet } from '../domain/prefill'
import { isSessionPrSet } from '../domain/prMoment'
import { workingSets } from '../domain/setKind'
import { formatSet } from '../domain/setText'
import './ExerciseList.css'
import { SetCell, SetFigure } from './figures'
import { VolumeVsBaseline } from './VolumeVsBaseline'
import type {
  Exercise,
  ExercisePlan,
  Program,
  Session,
  SetEntry,
  SetKind,
  VolumeBaseline,
  Workout,
} from '../types'

export type ExerciseListProps = {
  /** The Session is a deload (E21): planned Sets show their deloaded Preset. */
  deload?: boolean
  /** V6-05: whether a lift opens eased this Session (its Break); its planned Sets show the eased Preset. */
  easedFor?(exerciseId: string): boolean
  /** V7R-01: the step up a lift's Presets hold this Session (`appliedStep`); 0 or unset for none. */
  stepUpFor?(exerciseId: string): number
  program: Program
  workout: Workout
  /**
   * Resolves a catalog or library id to the `Exercise` it names (E5-T12). Replaces the earlier
   * `catalog: Map<string, Exercise>` prop: a swapped-in library id (`session.swaps`) is not in
   * the catalog, so a plain map lookup can no longer answer every row.
   */
  resolve(id: string): Exercise | undefined
  session: Session
  onOpenSet(exerciseId: string, setIndex: number): void
  /**
   * Finishes the session. The control is the shell's, in its sticky action bar, so the list
   * itself renders none: E3-T4 moved it out from under the rows.
   */
  onFinish(): void
  /**
   * The swap each plan carried in the last finished session of this workout (E5-T14), keyed
   * plannedId -> doneId, as `getLastSwap` answers it. A plan listed here and not swapped today
   * offers "Last time: <done exercise's name>".
   */
  lastSwaps: Record<string, string>
  /** Undoes today's swap of `plannedId` -- offered until the done exercise has a logged set. */
  onUndoSwap(plannedId: string): void
  /** Applies the "Last time" swap of `plannedId` for `doneId` to this session. */
  onApplySwap(plannedId: string, doneId: string): void
  /**
   * The last finished session's entries of each exercise (E4-T6), keyed by the id actually done
   * -- the swapped-in id when a plan is swapped. A missing key is no history: an empty bar.
   */
  lastEntries: Map<string, SetEntry[]>
  /**
   * Every finished Session (E8-T10), from which each row's `VolumeVsBaseline` resolves the
   * chosen baseline's volume.
   */
  sessions: Session[]
  /** The chosen baseline (E8-T10), same for every row until Settings offers a per-Exercise one. */
  volumeBaseline: VolumeBaseline
  /**
   * Throws the Session away (E12-T5), after the list's inline confirm. No control is shown when
   * absent.
   */
  onDiscard?(): void
  /** The Session note (E14-T4); shown under the list, edited through "Add note". */
  note?: string
  /** Saves the note text (500 characters at most); empty removes it. No control when absent. */
  onSaveNote?(text: string): Promise<void>
  /** The Exercise the session is on (`currentExerciseId`): its next cell is outlined. */
  currentId?: string | null
  /** A done cell tapped: opens that logged Set to edit. Absent, it opens the next Set instead. */
  onOpenLogged?(exerciseId: string, setIndex: number): void
  /** Opens the Add exercise picker (E19-T13); no control is shown when absent. */
  onAddExercise?(): void
}

const KIND_LETTERS: Record<SetKind, string> = { warmup: 'W', drop: 'D', failure: 'F', amrap: 'A' }

/**
 * One Exercise's row of set cells in the Live session's All view (Progress Dashboard S2): its
 * warm-ups as one cell, each logged working Set filled (tap to edit), the next one outlined when
 * the session is on this Exercise, and the planned Sets still to come dashed at their Preset.
 */
function SetCells(props: {
  exercise: Exercise
  plan: ExercisePlan
  session: Session
  earlier: Session[]
  lastEntries: SetEntry[]
  current: boolean
  deload?: boolean
  stepUp?: number
  onOpenNext(): void
  onOpenLogged(setIndex: number): void
}): JSX.Element {
  const { exercise, plan, session, earlier, lastEntries, current, onOpenNext, onOpenLogged } = props
  const today = session.entries
    .filter((entry) => entry.exerciseId === exercise.id)
    .sort((a, b) => a.setIndex - b.setIndex)
  const warmups = today.filter((entry) => entry.kind === 'warmup')
  const working = workingSets(today)
  const upcoming: { position: number; weightKg: number | null; reps: number; loadKg?: number }[] = []
  // V6 (V5-02): each Set to come at its Preset once the ones before it go as they are preset --
  // as the Now view's cells draw them -- so a ramp shows here too and the two views agree.
  const assumed: SetEntry[] = [...today]
  for (let position = working.length + 1; position <= plan.sets; position += 1) {
    const setIndex = today.length + 1 + (position - working.length - 1)
    const preset = presetForSet({
      exercise,
      plan,
      setIndex,
      lastEntries,
      today: assumed,
      deload: props.deload,
      stepUp: props.stepUp,
    })
    assumed.push({
      exerciseId: exercise.id,
      setIndex,
      weightKg: preset.weightKg,
      reps: preset.reps,
      ...(preset.loadKg ? { loadKg: preset.loadKg } : {}),
      loggedAt: 0,
    })
    upcoming.push({ position, ...preset })
  }
  const isRecord = (entry: SetEntry): boolean =>
    isSessionPrSet(exercise, plan, earlier, session, entry)

  return (
    <div className="all-cells">
      {warmups.length === 0 ? null : (
        <SetCell
          as="span"
          state="done"
          className="all-cell all-cell--done all-cell--warmup"
          headClassName="all-cell-mark"
          aria-label={`${warmups.length} warm-ups`}
        >
          <span className="all-cell-load">W</span>
          <span className="all-cell-reps">{warmups.length}</span>
        </SetCell>
      )}
      {working.map((entry, at) => (
        <SetCell
          key={entry.setIndex}
          state={isRecord(entry) ? 'pr' : 'done'}
          className="all-cell all-cell--done cell"
          headClassName="all-cell-mark"
          aria-label={`Set ${at + 1} · ${formatSet(entry)}`}
          onClick={() => onOpenLogged(entry.setIndex)}
          index={entry.kind === undefined ? undefined : <b className="all-cell-kind">{KIND_LETTERS[entry.kind]}</b>}
        >
          <SetFigure set={entry} stack className="all-cell-figure" />
        </SetCell>
      ))}
      {upcoming.map((cell, at) =>
        current && at === 0 ? (
          <SetCell
            key={cell.position}
            state="current"
            className="all-cell all-cell--current cell"
            headClassName="all-cell-mark"
            aria-label={`Set ${cell.position} · ${formatSet(cell)} · next`}
            onClick={onOpenNext}
          >
            <SetFigure set={cell} stack className="all-cell-figure" />
          </SetCell>
        ) : (
          <SetCell
            key={cell.position}
            state="planned"
            className="all-cell all-cell--future cell"
            headClassName="all-cell-mark"
            aria-label={`Set ${cell.position} · ${formatSet(cell)}`}
            onClick={onOpenNext}
          >
            <SetFigure set={cell} stack className="all-cell-figure" />
          </SetCell>
        ),
      )}
    </div>
  )
}

/** The longest Session note, in characters (E14-T4). */
const NOTE_MAX = 500

/** How many sets of this exercise the session already holds, warm-ups included. */
function loggedSets(entries: SetEntry[], exerciseId: string): number {
  return entries.filter((entry) => entry.exerciseId === exerciseId).length
}

/** How many of the plan's sets this exercise has used up: its working sets (E14-T8). */
function workingLogged(entries: SetEntry[], exerciseId: string): number {
  return workingSets(entries).filter((entry) => entry.exerciseId === exerciseId).length
}

/**
 * The set a row opens: always the one after the last logged, even past the plan (E6-T10) -- an
 * exercise already at its planned count must not overwrite its last stored Set, so the row opens
 * one past it, landing on the set screen's done state (E6-T1) instead.
 */
export function nextSetIndex(logged: number, _plan: ExercisePlan): number {
  return logged + 1
}

/**
 * The session's exercises, each with how many of its planned sets are logged, and a way into
 * the next set of one.
 *
 * One button per planned exercise, in plan order; its accessible name leads with the
 * exercise's name, so the list is also the way back into a set.
 *
 * A plan swapped mid-session (`session.swaps`, E5-T11/E5-T12) reads instead as the done
 * exercise's name, "instead of" the planned one, with the plan's own sets, rep range and rest
 * -- and opens the *done* exercise's id, not the planned one.
 *
 * Beside a swapped row, "Undo swap" is offered until the done exercise's first set is logged
 * (E5-T14). An unswapped row whose plan was swapped last time (`lastSwaps`) offers
 * "Last time: <done exercise's name>", which applies the same swap.
 *
 * Every row whose done exercise resolves carries its progression bar (E4-T6): the done
 * exercise's last session, measured against the plan's own sets and rep range. A row that does
 * not resolve keeps its fallback name and has no bar.
 */
export function ExerciseList(props: ExerciseListProps): JSX.Element {
  const {
    workout,
    resolve,
    session,
    onOpenSet,
    lastSwaps,
    onUndoSwap,
    onApplySwap,
    sessions,
    volumeBaseline,
    onDiscard,
    note,
    onSaveNote,
  } = props
  const [editingNote, setEditingNote] = useState(false)
  const [noteDraft, setNoteDraft] = useState('')
  const [confirmingDiscard, setConfirmingDiscard] = useState(false)
  const setCount = session.entries.length
  // The baseline a done cell's PR tag is measured against: the finished Sessions before this one.
  const earlier = sessions.filter(
    (other) => other.id !== session.id && other.finishedAt !== null && other.startedAt < session.startedAt,
  )

  return (
    <>
    <ul className="exercise-list">
      {workout.exercises.map((plan) => {
        const doneId = session.swaps?.[plan.exerciseId]
        const effectiveId = doneId ?? plan.exerciseId
        const exercise = resolve(effectiveId)
        const logged = loggedSets(session.entries, effectiveId)
        const working = workingLogged(session.entries, effectiveId)
        const lastDoneId = lastSwaps[plan.exerciseId]

        const label = (
          <>
            <span className="exercise-title">
              <span className="exercise-name">{exercise?.name ?? effectiveId}</span>
              {doneId !== undefined ? (
                <>
                  {' '}
                  <span className="exercise-instead">
                    {`for ${resolve(plan.exerciseId)?.name ?? plan.exerciseId}`}
                  </span>
                </>
              ) : null}
            </span>{' '}
            <span className="exercise-meta">
              <span className="set-progress">{`${working}/${plan.sets}`}</span>
              {` · ${plan.sets} × ${plan.repRange[0]}–${plan.repRange[1]}`}
            </span>
          </>
        )

        // The volume against the baseline stays the row's to say, for a screen reader: the
        // projection line above the list carries it on screen (Progress Dashboard S2). V7R-06:
        // only once the lift has a logged working Set -- "0%" at 0 sets reads as "same as last time".
        const rowBody = (
          <>
            {label}
            {exercise !== undefined && working > 0 ? (
              <span className="exercise-volume">
                <VolumeVsBaseline
                  exercise={exercise}
                  entries={session.entries}
                  sessions={sessions}
                  baseline={volumeBaseline}
                  now={Date.now()}
                />
              </span>
            ) : null}
          </>
        )
        const open = () => onOpenSet(effectiveId, nextSetIndex(logged, plan))

        // Two literal classNames, not a computed one: the control audit reads them statically.
        return (
          <li key={plan.exerciseId} className="exercise-block">
            {doneId !== undefined ? (
              <button type="button" className="exercise-row swapped cell" onClick={open}>
                {rowBody}
              </button>
            ) : (
              <button type="button" className="exercise-row cell" onClick={open}>
                {rowBody}
              </button>
            )}
            {exercise === undefined ? null : (
              <SetCells
                exercise={exercise}
                plan={plan}
                session={session}
                earlier={earlier}
                lastEntries={props.lastEntries.get(effectiveId) ?? []}
                current={props.currentId === effectiveId}
                deload={props.deload === true || props.easedFor?.(effectiveId) === true}
                stepUp={props.stepUpFor?.(effectiveId) ?? 0}
                onOpenNext={open}
                onOpenLogged={(setIndex) =>
                  props.onOpenLogged === undefined ? open() : props.onOpenLogged(effectiveId, setIndex)
                }
              />
            )}
            {doneId !== undefined && logged === 0 ? (
              <button
                type="button"
                className="exercise-undo-swap btn-quiet"
                onClick={() => onUndoSwap(plan.exerciseId)}
              >
                Undo swap
              </button>
            ) : null}
            {doneId === undefined && lastDoneId !== undefined ? (
              <button
                type="button"
                className="exercise-last-time btn-quiet"
                onClick={() => onApplySwap(plan.exerciseId, lastDoneId)}
              >
                {`Last time: ${resolve(lastDoneId)?.name ?? lastDoneId}`}
              </button>
            ) : null}
          </li>
        )
      })}
    </ul>
    {props.onAddExercise === undefined ? null : (
      <button type="button" className="exercise-add btn-quiet" onClick={props.onAddExercise}>
        Add exercise
      </button>
    )}
    {note === undefined || note === '' ? null : <p className="exercise-note">{note}</p>}
    {onSaveNote === undefined ? null : editingNote ? (
      <div className="exercise-note-editor">
        <label className="exercise-note-label">
          <span>Note</span>
          <textarea
            className="exercise-note-input"
            maxLength={NOTE_MAX}
            value={noteDraft}
            onChange={(event) => setNoteDraft(event.target.value)}
          />
        </label>
        <button
          type="button"
          className="exercise-note-save btn-primary"
          onClick={() => {
            void onSaveNote(noteDraft.slice(0, NOTE_MAX)).then(() => setEditingNote(false))
          }}
        >
          Save note
        </button>
      </div>
    ) : (
      <button
        type="button"
        className="exercise-note-add btn-quiet"
        onClick={() => {
          setNoteDraft(note ?? '')
          setEditingNote(true)
        }}
      >
        {note === undefined || note === '' ? 'Add note' : 'Edit note'}
      </button>
    )}
    {onDiscard === undefined ? null : confirmingDiscard ? (
      <div className="exercise-discard-confirm" role="group" aria-label="Discard workout">
        <p>{`Discard this workout? Its ${setCount} ${setCount === 1 ? 'set is' : 'sets are'} deleted.`}</p>
        <button type="button" className="exercise-discard-confirm-yes btn-danger" onClick={onDiscard}>
          Discard
        </button>
        <button
          type="button"
          className="exercise-discard-confirm-cancel btn-quiet"
          onClick={() => setConfirmingDiscard(false)}
        >
          Cancel
        </button>
      </div>
    ) : (
      <button type="button" className="exercise-discard btn-danger" onClick={() => setConfirmingDiscard(true)}>
        Discard workout
      </button>
    )}
    </>
  )
}
