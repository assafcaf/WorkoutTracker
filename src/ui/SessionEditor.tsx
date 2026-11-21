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
import { Icon } from './icons'
import { RepsDial } from './RepsDial'
import { Sheet } from './Sheet'
import { Snackbar } from './Snackbar'
import { WeightDial } from './WeightDial'
import './SessionEditor.css'

export type SessionEditorProps = {
  session: Session
  /** The name of the Workout the Session was performed from, shown as the editor's heading. */
  workoutName: string
  resolve: (id: string) => Exercise | undefined
  /** Opens that Exercise's first Set in the Set sheet (E12-T9). */
  focusExerciseId?: string
  onSave(draft: Session): Promise<void>
  onCancel(): void
  /**
   * Delete Session (DX-11): called at once, no confirm; the caller deletes and offers Undo. The
   * button is absent without it.
   */
  onDelete?(): void
  /**
   * `edit` a stored Session (the default), or `log` a missed one (V6-13): the heading reads
   * "Edit · Workout B · Mon 12 Oct" or "Log · Workout B · Tue 13 Oct".
   */
  mode?: 'edit' | 'log'
  /** The clock the heading's day reads against; the device's by default. */
  now?: number
  /**
   * What "Add exercise" offers (V6-13), in the one Exercise picker (DX-08); no Add exercise
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
  /** DX-08: each Exercise's last Set as the picker's rows show it (`lastSetTexts`). */
  lastSets?: Map<string, string>
}

/** The Set open in the Set sheet, and the values it holds until Save. */
type OpenSet = { exerciseId: string; setIndex: number; values: Pick<SetEntry, 'weightKg' | 'reps' | 'loadKg'> }

/** How long "Set deleted · Undo" stays (DX-11). */
const UNDO_MS = 8000

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

/** A Set kind's mark before its values (V6-14), as the History overlay marks it. */
const KIND_MARKERS: Record<SetKind, string> = { warmup: 'W', drop: 'D', failure: 'F', amrap: 'A' }
/** A Set kind as a screen reader hears it in the row's name. */
const KIND_NAMES: Record<SetKind, string> = { warmup: 'warm-up', drop: 'drop', failure: 'failure', amrap: 'AMRAP' }

/** The name a Set's row ends on (V6-14): `Back squat set 1, warm-up 40 × 5`. */
function setName(exerciseName: string, entry: SetEntry): string {
  const kind = entry.kind ? `${KIND_NAMES[entry.kind]} ` : ''
  return `${exerciseName} set ${entry.setIndex}, ${kind}${formatSet(entry)}`
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

/** `entry` open in the Set sheet with its own values. */
function openOf(entry: SetEntry): OpenSet {
  return {
    exerciseId: entry.exerciseId,
    setIndex: entry.setIndex,
    values: { weightKg: entry.weightKg, reps: entry.reps, loadKg: entry.loadKg },
  }
}

/** The first Set of `exerciseId` in `session`, open, or null when it has none. */
function firstSetOf(session: Session, exerciseId: string | undefined): OpenSet | null {
  if (exerciseId === undefined) return null
  const sets = session.entries
    .filter((entry) => entry.exerciseId === exerciseId)
    .sort((one, other) => one.setIndex - other.setIndex)
  return sets.length === 0 ? null : openOf(sets[0])
}

/**
 * The Session editor (E12-T6, DX-11): edits a draft of a finished Session, saved in one write.
 * Cancel and Save sit in its header. Each Set is one row that opens the Set sheet -- the live Set
 * screen's Dials, Cancel and Save in its header, "Delete set" at its foot. A deleted Set goes at
 * once, with "Set deleted · Undo". "Delete Session" is alone at the very bottom.
 */
export function SessionEditor(props: SessionEditorProps): JSX.Element {
  const { session, workoutName, resolve, focusExerciseId, onSave, onCancel, onDelete } = props
  const { mode = 'edit', now, addable, plannedIds = [], renderPhotos, lastSets } = props
  const [picking, setPicking] = useState(false)
  const [draft, setDraft] = useState<Session>(session)
  const [open, setOpen] = useState<OpenSet | null>(() => firstSetOf(session, focusExerciseId))
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  /** DX-11: the Sets as they were before a delete, while "Set deleted · Undo" shows. */
  const [undo, setUndo] = useState<SetEntry[] | null>(null)

  // V1-24: the Sessions list that opened the editor may be scrolled far down; open on the
  // Workout's name and its first Exercise, not mid-page.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  useEffect(() => {
    if (undo === null) return
    const timer = setTimeout(() => setUndo(null), UNDO_MS)
    return () => clearTimeout(timer)
  }, [undo])

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

  /** The Set sheet's Save: its values into the draft. */
  function saveOpenSet(): void {
    if (open === null) return
    setDraft({
      ...draft,
      entries: draft.entries.map((entry) =>
        entry.exerciseId === open.exerciseId && entry.setIndex === open.setIndex
          ? { ...entry, ...open.values }
          : entry,
      ),
    })
    setOpen(null)
  }

  /** The Set sheet's Delete set: gone at once, with Undo (DX-11). */
  function deleteOpenSet(): void {
    if (open === null) return
    setUndo(draft.entries)
    setDraft({ ...draft, entries: removeSet(draft.entries, open.exerciseId, open.setIndex).entries })
    setOpen(null)
  }

  function undoDelete(): void {
    if (undo === null) return
    setDraft({ ...draft, entries: undo })
    setUndo(null)
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
   * Plan's bottom rep count, open in the Set sheet; an Exercise off the Workout is saved as added.
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
    setOpen(openOf(added))
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

  const heading = `${mode === 'log' ? 'Log' : 'Edit'} · ${workoutName} · ${formatDay(
    new Date(draft.startedAt),
    new Date(now ?? Date.now()),
  )}`

  const openEntries = open === null ? [] : draft.entries.filter((entry) => entry.exerciseId === open.exerciseId)
  const openExercise = open === null ? undefined : resolve(open.exerciseId) ?? fallbackExercise(open.exerciseId, openEntries)
  const openTitle = open === null || openExercise === undefined ? '' : `${openExercise.name} · Set ${open.setIndex}`
  const setOpenValues = (values: Partial<OpenSet['values']>): void => {
    if (open !== null) setOpen({ ...open, values: { ...open.values, ...values } })
  }

  // While the Set sheet is up, the page under it is hidden from a screen reader and the keyboard.
  const covered = open !== null ? { 'aria-hidden': true as const, inert: '' } : {}
  return (
    <div className="session-editor">
      <div className="session-editor-page" {...covered}>
      <div className="session-editor-bar">
        <button type="button" className="session-editor-cancel btn-quiet" onClick={onCancel}>
          Cancel
        </button>
        <h1 className="session-editor-heading">{heading}</h1>
        <button
          type="button"
          className="session-editor-save btn-quiet"
          disabled={!canSave}
          onClick={() => void save()}
        >
          Save
        </button>
      </div>

      {error === null ? null : (
        <p className="session-editor-error" role="alert">
          {error}
        </p>
      )}

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
        const name = resolve(exerciseId)?.name ?? exerciseId
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
              {entries.map((entry) => (
                <li key={entry.setIndex} className="session-editor-set">
                  <button
                    type="button"
                    className="session-editor-set-row cell"
                    aria-label={`Edit ${setName(name, entry)}`}
                    onClick={() => setOpen(openOf(entry))}
                  >
                    <span className="session-editor-set-values">
                      {entry.kind ? (
                        <span className="session-editor-set-kind" aria-hidden="true">
                          {KIND_MARKERS[entry.kind]}
                        </span>
                      ) : null}
                      <SetFigure set={entry} />
                    </span>
                    <Icon name="ChevronRight" size={18} />
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="session-editor-add btn-quiet"
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

      {noSets ? <p className="session-editor-invalid">{NO_SETS_LEFT}</p> : null}

      {onDelete === undefined ? null : (
        <div className="session-editor-delete-row">
          <button type="button" className="session-editor-delete btn-danger" onClick={onDelete}>
            Delete Session
          </button>
        </div>
      )}
      </div>

      {open !== null && openExercise !== undefined ? (
        <Sheet label={openTitle} onClose={() => setOpen(null)}>
          <div className="session-set-sheet-head">
            <button type="button" className="session-set-cancel btn-quiet" onClick={() => setOpen(null)}>
              Cancel
            </button>
            <h2 className="session-set-title">{openTitle}</h2>
            <button type="button" className="session-set-save btn-quiet" onClick={saveOpenSet}>
              Save
            </button>
          </div>
          <div className="session-set-dials">
            {openExercise.bodyweight ? (
              // E16-T4: a Bodyweight Exercise's Weight Dial carries the signed Load.
              <WeightDial
                variant="scrub"
                exercise={openExercise}
                value={open.values.loadKg ?? 0}
                onChange={(loadKg) => setOpenValues({ loadKg: loadKg ? loadKg : undefined })}
              />
            ) : (
              <WeightDial
                variant="scrub"
                exercise={openExercise}
                value={open.values.weightKg}
                onChange={(weightKg) => setOpenValues({ weightKg })}
              />
            )}
            <RepsDial variant="scrub" value={open.values.reps} onChange={(reps) => setOpenValues({ reps })} />
          </div>
          <button type="button" className="session-set-delete btn-danger" onClick={deleteOpenSet}>
            Delete set
          </button>
        </Sheet>
      ) : null}

      {undo === null ? null : <Snackbar message="Set deleted" actionLabel="Undo" onAction={undoDelete} />}

      {picking && addable !== undefined ? (
        <ExercisePicker
          title={`Add to ${workoutName}`}
          library={addable}
          taken={[...new Set(draft.entries.map((entry) => entry.exerciseId))]}
          lastSets={lastSets}
          onPick={addExercise}
          onClose={() => setPicking(false)}
        />
      ) : null}
    </div>
  )
}
