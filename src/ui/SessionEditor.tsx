import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { dayOf } from '../domain/bodyLog'
import { formatDay } from '../domain/dates'
import { newPlan } from '../domain/programs'
import { formatSet } from '../domain/setText'
import { SetFigure } from './figures'
import { END_BEFORE_START, NO_SETS_LEFT, insertSet, removeSet } from '../domain/setEdits'
import type { Exercise, LibraryExercise, Session, SetEntry, SetKind } from '../types'
import { Switch } from './controls'
import { ExercisePicker } from './ExercisePicker'
import { RepsDial } from './RepsDial'
import { WeightDial } from './WeightDial'
import './SessionEditor.css'

export type SessionEditorProps = {
  session: Session
  /** The name of the Workout the Session was performed from, shown as the editor's heading. */
  workoutName: string
  resolve: (id: string) => Exercise | undefined
  /** Opens that Exercise's first Set on the Dials (E12-T9). */
  focusExerciseId?: string
  onSave(draft: Session): Promise<void>
  onCancel(): void
  /** Delete workout, called after an inline confirm; the button is absent without it. */
  onDelete?(): void
  /**
   * `edit` a stored Session (the default), or `log` a missed one (V6-13): the heading reads
   * "Edit · Workout B · Mon 12 Oct" or "Log · Workout B · Tue 13 Oct".
   */
  mode?: 'edit' | 'log'
  /** The clock the heading's day reads against; the device's by default. */
  now?: number
  /**
   * What "Add exercise" offers (V6-13), the same picker as a live Session's; no Add exercise
   * without it.
   */
  addable?: LibraryExercise[]
  /** The Workout's planned Exercise ids: one added that is not among them is saved in `added`. */
  plannedIds?: string[]
  /**
   * Photos2: the Photos row for the draft's day (YYYY-MM-DD), drawn under the note; the caller
   * owns it (the day's thumbnails, Delete with Undo, Add photos). No row without it.
   */
  renderPhotos?(day: string): ReactNode
}

/** The Set whose values the Dials are editing. */
type OpenSet = { exerciseId: string; setIndex: number }

/** Two digits, for the `datetime-local` value's fields. */
function pad(value: number): string {
  return String(value).padStart(2, '0')
}

/** A timestamp as the local `YYYY-MM-DDTHH:mm` a `datetime-local` field holds. */
function toLocalInput(time: number | null): string {
  if (time === null) return ''
  const date = new Date(time)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`
}

/** A `datetime-local` value as a timestamp, read as local time; null when it is not one. */
function fromLocalInput(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) return null
  const time = new Date(value).getTime()
  return Number.isNaN(time) ? null : time
}

/** What a Set row reads: `60 × 8`, or `BW × 10` for a Set carrying no weight. */
function setText(entry: SetEntry): string {
  return formatSet(entry)
}

/** A Set kind's mark before its values (V6-14), as the History overlay marks it. */
const KIND_MARKERS: Record<SetKind, string> = { warmup: 'W', drop: 'D', failure: 'F', amrap: 'A' }
/** A Set kind as a screen reader hears it in the row's control names. */
const KIND_NAMES: Record<SetKind, string> = { warmup: 'warm-up', drop: 'drop', failure: 'failure', amrap: 'AMRAP' }

/** The name a Set's controls end on (V6-14): `Back squat set 1, warm-up 40 × 5`. */
function setName(exerciseName: string, entry: SetEntry): string {
  const kind = entry.kind ? `${KIND_NAMES[entry.kind]} ` : ''
  return `${exerciseName} set ${entry.setIndex}, ${kind}${setText(entry)}`
}

/** The draft's Sets grouped by Exercise, in first-appearance order, each group by `setIndex`. */
function groupByExercise(entries: SetEntry[]): { exerciseId: string; entries: SetEntry[] }[] {
  const groups = new Map<string, SetEntry[]>()
  for (const entry of entries) {
    const group = groups.get(entry.exerciseId)
    if (group) group.push(entry)
    else groups.set(entry.exerciseId, [entry])
  }
  return [...groups].map(([exerciseId, group]) => ({
    exerciseId,
    entries: [...group].sort((one, other) => one.setIndex - other.setIndex),
  }))
}

/** A stand-in for an id the catalog no longer resolves, so its Sets stay editable. */
function fallbackExercise(exerciseId: string, entries: SetEntry[]): Exercise {
  const bodyweight = entries.every((entry) => entry.weightKg === null)
  return {
    id: exerciseId,
    libraryId: exerciseId,
    name: exerciseId,
    weightStep: 2.5,
    startWeight: bodyweight ? null : entries[0]?.weightKg ?? 0,
    bodyweight,
  }
}

/** The first Set of `exerciseId` in `session`, or null when it has none. */
function firstSetOf(session: Session, exerciseId: string | undefined): OpenSet | null {
  if (exerciseId === undefined) return null
  const indexes = session.entries
    .filter((entry) => entry.exerciseId === exerciseId)
    .map((entry) => entry.setIndex)
  return indexes.length === 0 ? null : { exerciseId, setIndex: Math.min(...indexes) }
}

/** The History editor (E12-T6): edits a draft of a finished Session, saved in one write. */
export function SessionEditor(props: SessionEditorProps): JSX.Element {
  const { session, workoutName, resolve, focusExerciseId, onSave, onCancel, onDelete } = props
  const { mode = 'edit', now, addable, plannedIds = [], renderPhotos } = props
  const [picking, setPicking] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [draft, setDraft] = useState<Session>(session)
  const [open, setOpen] = useState<OpenSet | null>(() => firstSetOf(session, focusExerciseId))
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // V1-24: the Sessions list that opened the editor may be scrolled far down; open on the
  // Workout's name and its first Exercise, not mid-page.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  const endBeforeStart = draft.finishedAt !== null && draft.finishedAt < draft.startedAt
  const noSets = draft.entries.length === 0
  const canSave = !endBeforeStart && !noSets && !saving

  function changeTime(field: 'startedAt' | 'finishedAt', value: string): void {
    const time = fromLocalInput(value)
    if (time !== null) setDraft({ ...draft, [field]: time })
  }

  function changeNote(text: string): void {
    const { note: _previous, ...rest } = draft
    void _previous
    setDraft(text === '' ? rest : { ...rest, note: text })
  }

  /** The `Deload session` mark (E18-T2), saved with the draft; moved here from the summary (V2-10). */
  function changeDeload(on: boolean): void {
    const { deload: _previous, ...rest } = draft
    void _previous
    setDraft(on ? { ...rest, deload: true } : rest)
  }

  function changeSet(
    target: OpenSet,
    values: Partial<Pick<SetEntry, 'weightKg' | 'reps' | 'loadKg'>>,
  ): void {
    setDraft({
      ...draft,
      entries: draft.entries.map((entry) =>
        entry.exerciseId === target.exerciseId && entry.setIndex === target.setIndex
          ? { ...entry, ...values }
          : entry,
      ),
    })
  }

  function deleteSet(exerciseId: string, setIndex: number): void {
    setDraft({ ...draft, entries: removeSet(draft.entries, exerciseId, setIndex).entries })
    setOpen(null)
  }

  function addSet(exerciseId: string, group: SetEntry[]): void {
    const last = group[group.length - 1]
    const added: SetEntry = {
      exerciseId,
      setIndex: last.setIndex + 1,
      weightKg: last.weightKg,
      reps: last.reps,
      loggedAt: draft.finishedAt ?? last.loggedAt,
    }
    setDraft({ ...draft, entries: insertSet(draft.entries, added) })
  }

  /**
   * V6-13: one Set of `exerciseId` at its start weight (no weight on a Bodyweight one) and a new
   * Plan's bottom rep count, open on the Dials; an Exercise off the Workout is saved as added.
   */
  function addExercise(exerciseId: string): void {
    setPicking(false)
    const exercise = resolve(exerciseId)
    const plan = newPlan(exerciseId)
    const added: SetEntry = {
      exerciseId,
      setIndex: 1,
      weightKg: exercise?.bodyweight ? null : exercise?.startWeight ?? 0,
      reps: plan.repRange[0],
      loggedAt: draft.finishedAt ?? draft.startedAt,
    }
    const alreadyAdded = (draft.added ?? []).some((candidate) => candidate.exerciseId === exerciseId)
    const addedPlans =
      plannedIds.includes(exerciseId) || alreadyAdded ? draft.added : [...(draft.added ?? []), plan]
    setDraft({
      ...draft,
      entries: insertSet(draft.entries, added),
      ...(addedPlans === undefined ? {} : { added: addedPlans }),
    })
    setOpen({ exerciseId, setIndex: 1 })
  }

  async function save(): Promise<void> {
    if (!canSave) return
    setSaving(true)
    setError(null)
    try {
      await onSave(draft)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="session-editor">
      <h1 className="session-editor-heading">
        {`${mode === 'log' ? 'Log' : 'Edit'} · ${workoutName} · ${formatDay(
          new Date(draft.startedAt),
          new Date(now ?? Date.now()),
        )}`}
      </h1>

      <div className="session-editor-times">
        <label className="session-editor-time">
          <span>Start</span>
          <input
            type="datetime-local"
            className="session-editor-time-input"
            value={toLocalInput(draft.startedAt)}
            onChange={(event) => changeTime('startedAt', event.target.value)}
          />
        </label>
        <label className="session-editor-time">
          <span>End</span>
          <input
            type="datetime-local"
            className="session-editor-time-input"
            value={toLocalInput(draft.finishedAt)}
            onChange={(event) => changeTime('finishedAt', event.target.value)}
          />
        </label>
        {endBeforeStart ? <p className="session-editor-invalid">{END_BEFORE_START}</p> : null}
      </div>

      <div className="session-editor-deload">
        <Switch label="Deload session" checked={draft.deload === true} onChange={changeDeload} />
      </div>

      {groupByExercise(draft.entries).map(({ exerciseId, entries }) => {
        const exercise = resolve(exerciseId)
        const name = exercise?.name ?? exerciseId
        const dialExercise = exercise ?? fallbackExercise(exerciseId, entries)
        const headingId = `session-editor-${exerciseId}`
        return (
          <section
            key={exerciseId}
            className="session-editor-group"
            role="group"
            aria-labelledby={headingId}
          >
            <h3 id={headingId} className="session-editor-group-heading">
              {name}
            </h3>
            <ul className="session-editor-sets">
              {entries.map((entry) => {
                const isOpen =
                  open?.exerciseId === exerciseId && open.setIndex === entry.setIndex
                return (
                  <li key={entry.setIndex} className="session-editor-set">
                    <span className="session-editor-set-values">
                      {entry.kind ? (
                        <span className="session-editor-set-kind" aria-hidden="true">
                          {KIND_MARKERS[entry.kind]}
                        </span>
                      ) : null}
                      <SetFigure set={entry} />
                    </span>
                    <button
                      type="button"
                      className="session-editor-set-action btn-quiet"
                      aria-label={`Edit ${setName(name, entry)}`}
                      aria-pressed={isOpen}
                      onClick={() =>
                        setOpen(isOpen ? null : { exerciseId, setIndex: entry.setIndex })
                      }
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="session-editor-set-action btn-danger"
                      aria-label={`Delete ${setName(name, entry)}`}
                      onClick={() => deleteSet(exerciseId, entry.setIndex)}
                    >
                      Delete
                    </button>
                    {isOpen ? (
                      <div className="session-editor-dials">
                        {dialExercise.bodyweight ? (
                          // E16-T4: a Bodyweight Exercise's Weight Dial carries the signed Load.
                          <WeightDial
                            exercise={dialExercise}
                            value={entry.loadKg ?? 0}
                            onChange={(loadKg) =>
                              changeSet(
                                { exerciseId, setIndex: entry.setIndex },
                                { loadKg: loadKg ? loadKg : undefined },
                              )
                            }
                          />
                        ) : (
                          <WeightDial
                            exercise={dialExercise}
                            value={entry.weightKg}
                            onChange={(weightKg) =>
                              changeSet({ exerciseId, setIndex: entry.setIndex }, { weightKg })
                            }
                          />
                        )}
                        <RepsDial
                          value={entry.reps}
                          onChange={(reps) =>
                            changeSet({ exerciseId, setIndex: entry.setIndex }, { reps })
                          }
                        />
                      </div>
                    ) : null}
                  </li>
                )
              })}
            </ul>
            <button
              type="button"
              className="session-editor-add btn-secondary"
              onClick={() => addSet(exerciseId, entries)}
            >
              Add set
            </button>
          </section>
        )
      })}

      {addable === undefined ? null : (
        <button
          type="button"
          className="session-editor-add-exercise btn-secondary"
          onClick={() => setPicking(true)}
        >
          Add exercise
        </button>
      )}

      <label className="session-editor-note">
        <span>Note</span>
        <textarea
          className="session-editor-note-input"
          maxLength={500}
          value={draft.note ?? ''}
          onChange={(event) => changeNote(event.target.value)}
        />
      </label>

      {renderPhotos ? renderPhotos(dayOf(draft.startedAt)) : null}

      {noSets ?<p className="session-editor-invalid">{NO_SETS_LEFT}</p> : null}

      {error === null ? null : (
        <p className="session-editor-error" role="alert">
          {error}
        </p>
      )}

      <div className="session-editor-actions">
        {onDelete === undefined ? null : confirmingDelete ? (
          <>
            <button type="button" className="session-editor-cancel btn-quiet" onClick={() => setConfirmingDelete(false)}>
              Keep
            </button>
            <button type="button" className="session-editor-delete btn-danger" onClick={onDelete}>
              Confirm
            </button>
          </>
        ) : (
          <button
            type="button"
            className="session-editor-delete btn-danger"
            onClick={() => setConfirmingDelete(true)}
          >
            Delete workout
          </button>
        )}
        <button type="button" className="session-editor-cancel btn-quiet" onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className="session-editor-save btn-primary"
          disabled={!canSave}
          onClick={() => void save()}
        >
          Save
        </button>
      </div>
      {picking && addable !== undefined ? (
        <ExercisePicker
          library={addable}
          taken={[...new Set(draft.entries.map((entry) => entry.exerciseId))]}
          onPick={addExercise}
          onClose={() => setPicking(false)}
        />
      ) : null}
    </div>
  )
}
