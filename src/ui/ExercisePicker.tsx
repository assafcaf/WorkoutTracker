import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { shortDay } from '../domain/lifts'
import { myLifts } from '../domain/myLifts'
import { matchesExercise } from '../domain/search'
import { formatSet } from '../domain/setText'
import type { Exercise, LibraryExercise, Muscle, Session } from '../types'
import { Icon } from './icons'
import './ExercisePicker.css'

/**
 * One row of the Exercise picker (DX-08): a name, the muscle in grey, the last Set when there is
 * one. `key` is what a tap hands back.
 */
export type PickerRow = {
  key: string
  name: string
  muscle?: string | null
  /** "62.5 × 8 · 14 Oct": the last time's top Set, shown inline (H6). */
  last?: string | null
  /** Other names the search finds it by. */
  aliases?: string[]
  /** For "My gym only": a row whose equipment is not the gym's is hidden while the chip is on. */
  equipment?: string | null
  primaryMuscles?: Muscle[]
}

/** A section above "All": "Similar" when swapping, "My lifts" in the library. */
export type PickerSection = { title: string; rows: PickerRow[] }

/** A library entry as a picker row, under the lifter's own name and with its last Set. */
export function pickerRow(
  entry: LibraryExercise,
  extra: { key?: string; name?: string; last?: string | null } = {},
): PickerRow {
  return {
    key: extra.key ?? entry.id,
    name: extra.name ?? entry.name,
    muscle: entry.primaryMuscles[0] ?? null,
    last: extra.last ?? null,
    aliases: extra.name !== undefined && extra.name !== entry.name ? [entry.name, ...(entry.aliases ?? [])] : entry.aliases,
    equipment: entry.equipment,
    primaryMuscles: entry.primaryMuscles,
  }
}

/**
 * Each logged Exercise's last top Set as a row shows it ("62.5 × 8 · 14 Oct"), keyed by its
 * Exercise id and by its library id, so a library row finds it too.
 */
export function lastSetTexts(
  sessions: Session[],
  resolve: (id: string) => Exercise | undefined,
  now: Date,
): Map<string, string> {
  const texts = new Map<string, string>()
  for (const lift of myLifts([], sessions, resolve)) {
    if (lift.top === null || lift.lastAt === null) continue
    const text = `${formatSet(lift.top)} · ${shortDay(lift.lastAt, now)}`
    texts.set(lift.exerciseId, text)
    const libraryId = resolve(lift.exerciseId)?.libraryId
    if (libraryId !== undefined && !texts.has(libraryId)) texts.set(libraryId, text)
  }
  return texts
}

/** Rows drawn at first, and added each time the list's end scrolls near (no pagination). */
const CHUNK = 60

function passesEquipment(row: PickerRow, gymEquipment: string[] | null): boolean {
  if (gymEquipment === null || row.equipment === undefined || row.equipment === null) return true
  return row.equipment === 'body only' || gymEquipment.includes(row.equipment)
}

export type ExercisePickerListProps = {
  /** Every row of "All". */
  rows: PickerRow[]
  /** A section before "All" ("Similar", "My lifts"); its rows are not repeated under "All". */
  lead?: PickerSection
  /** The heading over `rows` when a lead section shows; "All" by default. */
  allTitle?: string
  /** The gym's equipment: given (even `null`), a "My gym only" chip shows, on by default. */
  gymEquipment?: string[] | null
  /** Keeps only rows primary in one of these muscles (a Region's "Browse exercises"). */
  muscles?: Muscle[]
  onPick(key: string): void
  /** The search text, when the caller keeps it; omitted, the list keeps its own. */
  query?: string
  onQueryChange?(query: string): void
  /** Controls drawn between the chip and the list (the library's New exercise). */
  tools?: ReactNode
  /** Caps the rows shown while nothing is searched (Exercise info's five similar lifts). */
  limit?: number
  /** `false` drops the search field (a short, fixed list such as Exercise info's). */
  searchable?: boolean
}

/**
 * The one Exercise list (DX-08): a search field, the "My gym only" chip, then a lead section and
 * "All" in one continuous scroll. No pagination: rows render in chunks as the end nears. The whole
 * row is the target; no per-row buttons.
 */
export function ExercisePickerList({
  rows,
  lead,
  allTitle = 'All',
  gymEquipment,
  muscles,
  onPick,
  query: heldQuery,
  onQueryChange,
  tools,
  limit: cap,
  searchable = true,
}: ExercisePickerListProps): JSX.Element {
  const [ownQuery, setOwnQuery] = useState('')
  const query = heldQuery ?? ownQuery
  const [gymOnly, setGymOnly] = useState(true)
  const [limit, setLimit] = useState(CHUNK)
  const sentinel = useRef<HTMLLIElement>(null)
  const observing = typeof IntersectionObserver !== 'undefined'

  const keep = (row: PickerRow): boolean =>
    matchesExercise({ name: row.name, aliases: row.aliases }, query) &&
    (gymEquipment === undefined || !gymOnly || passesEquipment(row, gymEquipment)) &&
    (muscles === undefined ||
      muscles.length === 0 ||
      (row.primaryMuscles ?? []).some((muscle) => muscles.includes(muscle)))

  const leadRows = lead ? lead.rows.filter(keep) : []
  const leadKeys = new Set(lead?.rows.map((row) => row.key) ?? [])
  const matching = rows.filter((row) => !leadKeys.has(row.key) && keep(row))
  const allRows = cap !== undefined && query.trim() === '' ? matching.slice(0, cap) : matching
  const shownAll = observing ? allRows.slice(0, limit) : allRows

  // A new search or chip starts the list over at its first chunk.
  useEffect(() => {
    setLimit(CHUNK)
  }, [query, gymOnly])

  useEffect(() => {
    const end = sentinel.current
    if (!observing || end === null) return
    const watcher = new IntersectionObserver(
      (seen) => {
        if (seen.some((one) => one.isIntersecting)) setLimit((current) => current + CHUNK)
      },
      { rootMargin: '600px 0px' },
    )
    watcher.observe(end)
    return () => watcher.disconnect()
  }, [observing, shownAll.length, allRows.length])

  const setQuery = (next: string): void => {
    setOwnQuery(next)
    onQueryChange?.(next)
  }

  // The row is named by the Exercise alone ("Dips"); its muscle and last Set describe it.
  const row = (one: PickerRow): JSX.Element => {
    const meta = [one.muscle, one.last].filter((part) => part).join(' · ')
    const metaId = `picker-meta-${one.key.replace(/[^A-Za-z0-9_-]/g, '_')}`
    return (
      <li key={one.key} className="picker-row">
        <button
          type="button"
          className="picker-row-button cell"
          aria-label={one.name}
          aria-describedby={meta === '' ? undefined : metaId}
          onClick={() => onPick(one.key)}
        >
          <span className="picker-row-name">{one.name}</span>
          {meta === '' ? null : (
            <span id={metaId} className="picker-row-meta">
              {meta}
            </span>
          )}
        </button>
      </li>
    )
  }

  const showHeadings = leadRows.length > 0

  return (
    <div className="picker-list">
      {searchable ? (
      <label className="picker-search-field">
        <Icon name="Search" size={18} />
        <input
          type="search"
          aria-label="Search exercises"
          placeholder="Search exercises"
          className="picker-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      ) : null}
      {gymEquipment === undefined ? null : (
        <div className="picker-chips">
          <button
            type="button"
            className="picker-gym-chip chip"
            aria-pressed={gymOnly}
            onClick={() => setGymOnly((current) => !current)}
          >
            My gym only
          </button>
        </div>
      )}
      {tools}
      {leadRows.length === 0 && allRows.length === 0 ? (
        <p className="picker-empty">No exercises match</p>
      ) : null}
      {showHeadings ? (
        <section className="picker-section" aria-label={lead?.title}>
          <h3 className="picker-section-heading">{lead?.title}</h3>
          <ul className="picker-rows">{leadRows.map(row)}</ul>
        </section>
      ) : null}
      {allRows.length === 0 ? null : (
        <section className="picker-section" aria-label={showHeadings ? allTitle : undefined}>
          {showHeadings ? <h3 className="picker-section-heading">{allTitle}</h3> : null}
          <ul className="picker-rows">
            {shownAll.map(row)}
            {shownAll.length < allRows.length ? (
              <li ref={sentinel} className="picker-more" aria-hidden="true" />
            ) : null}
          </ul>
        </section>
      )}
    </div>
  )
}

export type ExercisePickerProps = {
  library: LibraryExercise[]
  /** Ids already in the Session or Workout: not offered again. */
  taken: string[]
  onPick(id: string): void
  onClose(): void
  /** The sheet's title: "Add to Workout A", "Swap Deadlift". "Add exercise" by default. */
  title?: string
  /** The ranked stand-ins when swapping, shown first under "Similar". */
  similar?: LibraryExercise[]
  /** Given (even `null`), the "My gym only" chip shows. */
  gymEquipment?: string[] | null
  /** The name a row shows: the lifter's own for a lift they logged. */
  nameOf?(entry: LibraryExercise): string
  /** The id a tap hands back for a row (the lifter's own Exercise id for a logged lift). */
  pickIdOf?(entry: LibraryExercise): string
  /** Each Exercise's last Set as a row shows it, by library or Exercise id (`lastSetTexts`). */
  lastSets?: Map<string, string>
  /** The sheet's id for its heading, so a wrapper can point at it. */
  headingId?: string
}

/**
 * The Exercise picker (DX-08): the one sheet that live Swap, Program Replace, Add exercise (Program
 * editor, Session editor, live) and Import use. Title and X in the header, then
 * `ExercisePickerList`. Tapping a row does the action; the caller closes it.
 */
export function ExercisePicker({
  library,
  taken,
  onPick,
  onClose,
  title = 'Add exercise',
  similar,
  gymEquipment,
  nameOf,
  pickIdOf,
  lastSets,
  headingId = 'exercise-picker-heading',
}: ExercisePickerProps): JSX.Element {
  const takenIds = new Set(taken)
  const toRow = (entry: LibraryExercise): PickerRow =>
    pickerRow(entry, {
      key: entry.id,
      name: nameOf?.(entry),
      last: lastSets?.get(pickIdOf?.(entry) ?? entry.id) ?? lastSets?.get(entry.id) ?? null,
    })
  const offered = (entry: LibraryExercise): boolean => !takenIds.has(entry.id)
  const rows = [...library]
    .filter(offered)
    .sort((one, other) => one.name.localeCompare(other.name))
    .map(toRow)
  const lead = similar === undefined ? undefined : { title: 'Similar', rows: similar.filter(offered).map(toRow) }
  const byId = new Map(library.map((entry) => [entry.id, entry] as const))
  for (const entry of similar ?? []) byId.set(entry.id, entry)

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div role="dialog" aria-modal="true" aria-labelledby={headingId} className="overlay-panel exercise-picker">
      <div className="exercise-picker-header">
        <h2 id={headingId} className="exercise-picker-heading">
          {title}
        </h2>
        <button type="button" className="exercise-picker-close icon-btn" aria-label="Close" onClick={onClose}>
          <Icon name="X" size={22} />
        </button>
      </div>
      <ExercisePickerList
        rows={rows}
        lead={lead}
        gymEquipment={gymEquipment}
        onPick={(key) => {
          const entry = byId.get(key)
          onPick(entry && pickIdOf ? pickIdOf(entry) : key)
        }}
      />
    </div>
  )
}
