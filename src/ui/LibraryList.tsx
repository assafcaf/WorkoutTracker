import { shortDay } from '../domain/lifts'
import type { MyLift } from '../domain/myLifts'
import { formatSet } from '../domain/setText'
import type { LibraryExercise, Muscle } from '../types'
import { ExercisePickerList, pickerRow, type PickerRow, type PickerSection } from './ExercisePicker'
import './LibraryList.css'

/** A lift of "My lifts" as a picker row: its name, and its latest top Set and when. */
export function myLiftRow(lift: MyLift, now: Date, entry?: LibraryExercise): PickerRow {
  return {
    key: lift.exerciseId,
    name: lift.name,
    muscle: entry?.primaryMuscles[0] ?? null,
    last:
      lift.top !== null && lift.lastAt !== null ? `${formatSet(lift.top)} · ${shortDay(lift.lastAt, now)}` : 'Not logged yet',
    aliases: entry ? [entry.name, ...(entry.aliases ?? [])] : undefined,
    equipment: entry?.equipment,
    primaryMuscles: entry?.primaryMuscles,
  }
}

export type MyLiftsListProps = {
  /** The lifter's own lifts, in the order to show them (`myLifts`). */
  lifts: MyLift[]
  now: Date
  /** Opens that lift's history: the one action of every row (V6-03). */
  onOpenLift(exerciseId: string): void
}

/**
 * The lifter's own lifts (V6-03 step 3) as rows of the one Exercise list (DX-08): a name over its
 * latest top Set and when (`62.5 × 8 · 13 Oct`), or "Not logged yet".
 */
export function MyLiftsList({ lifts, now, onOpenLift }: MyLiftsListProps): JSX.Element {
  return (
    <ul className="picker-rows my-lifts-list" aria-label="My lifts">
      {lifts.map((lift) => {
        const row = myLiftRow(lift, now)
        return (
          <li key={row.key} className="picker-row">
            <button type="button" className="picker-row-button cell" onClick={() => onOpenLift(lift.exerciseId)}>
              <span className="picker-row-name">{row.name}</span>
              <span className="picker-row-meta">{row.last}</span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

export type LibraryListProps = {
  library: LibraryExercise[]
  /** Opens an exercise's detail screen: what a row tap does when no `onPick` is given. */
  onOpen(id: string): void
  /**
   * The gym's saved equipment, or `null` when nothing has been saved -- filters the list to it
   * while the "My gym only" chip is on (E5-T16).
   */
  gymEquipment: string[] | null
  /**
   * The muscles a region panel's "Browse exercises" opened the tab on (E5-T20, M9): when given
   * and non-empty, only exercises with at least one of them among `primaryMuscles` are listed.
   */
  initialMuscles?: Muscle[]
  /** When given, a row tap picks the row (DX-08: the whole row, no "Pick" button). */
  onPick?(id: string): void
  /** When given, a `New exercise` button calls it (E19-T11). */
  onNew?(): void
  /** A section before "All" (the library's "My lifts"); a tap on one of its rows goes to `onOpenLead`. */
  lead?: PickerSection
  onOpenLead?(key: string): void
  /** Each Exercise's last Set as a row shows it, by library id (`lastSetTexts`). */
  lastSets?: Map<string, string>
  /** The search text, when the caller keeps it. */
  query?: string
  onQueryChange?(query: string): void
}

/**
 * The Exercise library as the one Exercise list (DX-08): search, "My gym only", an optional lead
 * section, then every exercise by name in one continuous scroll (no pager), each row its name
 * over its muscle in grey and its last Set. The whole row is the target.
 */
export function LibraryList({
  library,
  onOpen,
  gymEquipment,
  initialMuscles,
  onPick,
  onNew,
  lead,
  onOpenLead,
  lastSets,
  query,
  onQueryChange,
}: LibraryListProps): JSX.Element {
  const rows = [...library]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((entry) => pickerRow(entry, { last: lastSets?.get(entry.id) ?? null }))
  const leadKeys = new Set(lead?.rows.map((row) => row.key) ?? [])
  const open = onPick ?? onOpen
  return (
    <div className="library-list-container">
      <ExercisePickerList
        rows={rows}
        lead={lead}
        allTitle={`All exercises (${library.length})`}
        gymEquipment={gymEquipment}
        muscles={initialMuscles}
        query={query}
        onQueryChange={onQueryChange}
        onPick={(key) => {
          if (leadKeys.has(key) && onOpenLead) onOpenLead(key)
          else open(key)
        }}
        tools={
          onNew === undefined ? undefined : (
            <button type="button" className="library-new btn-quiet" onClick={onNew}>
              New exercise
            </button>
          )
        }
      />
    </div>
  )
}
