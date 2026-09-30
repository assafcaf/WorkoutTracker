import { useState } from 'react'
import { formatSet } from '../domain/setText'
import { END_BEFORE_START, NO_SETS_LEFT, insertSet, removeSet } from '../domain/setEdits'
import type { Exercise, Session, SetEntry } from '../types'
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
    invertProgress: false,
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
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [draft, setDraft] = useState<Session>(session)
  const [open, setOpen] = useState<OpenSet | null>(() => firstSetOf(session, focusExerciseId))
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

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

  function changeSet(target: OpenSet, values: Partial<Pick<SetEntry, 'weightKg' | 'reps'>>): void {
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
      <h2 className="session-editor-heading">{workoutName}</h2>

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

      {groupByExercise(draft.entries).map(({ exerciseId, entries }) => {
        const exercise = resolve(exerciseId)
        const name = exercise?.name ?? exerciseId
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
                    <span className="session-editor-set-values">{setText(entry)}</span>
                    <button
                      type="button"
                      className="session-editor-set-action"
                      aria-label={`Edit set ${entry.setIndex}`}
                      aria-pressed={isOpen}
                      onClick={() =>
                        setOpen(isOpen ? null : { exerciseId, setIndex: entry.setIndex })
                      }
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="session-editor-set-action"
                      aria-label={`Delete set ${entry.setIndex}`}
                      onClick={() => deleteSet(exerciseId, entry.setIndex)}
                    >
                      Delete
                    </button>
                    {isOpen ? (
                      <div className="session-editor-dials">
                        <WeightDial
                          exercise={exercise ?? fallbackExercise(exerciseId, entries)}
                          value={entry.weightKg}
                          onChange={(weightKg) =>
                            changeSet({ exerciseId, setIndex: entry.setIndex }, { weightKg })
                          }
                        />
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
              className="session-editor-add"
              onClick={() => addSet(exerciseId, entries)}
            >
              Add set
            </button>
          </section>
        )
      })}

      <label className="session-editor-note">
        <span>Note</span>
        <textarea
          className="session-editor-note-input"
          maxLength={500}
          value={draft.note ?? ''}
          onChange={(event) => changeNote(event.target.value)}
        />
      </label>

      {noSets ? <p className="session-editor-invalid">{NO_SETS_LEFT}</p> : null}

      {error === null ? null : (
        <p className="session-editor-error" role="alert">
          {error}
        </p>
      )}

      <div className="session-editor-actions">
        {onDelete === undefined ? null : confirmingDelete ? (
          <>
            <button type="button" className="session-editor-cancel" onClick={() => setConfirmingDelete(false)}>
              Keep
            </button>
            <button type="button" className="session-editor-delete" onClick={onDelete}>
              Confirm
            </button>
          </>
        ) : (
          <button
            type="button"
            className="session-editor-delete"
            onClick={() => setConfirmingDelete(true)}
          >
            Delete workout
          </button>
        )}
        <button type="button" className="session-editor-cancel" onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className="session-editor-save"
          disabled={!canSave}
          onClick={() => void save()}
        >
          Save
        </button>
      </div>
    </div>
  )
}
