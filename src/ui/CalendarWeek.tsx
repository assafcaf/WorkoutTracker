import './CalendarWeek.css'
import type { WorkoutTone } from './workoutMark'

/** One day of a calendar week: the Workout trained on it (letter and tone), today, or ahead. */
export type CalendarCell = {
  key: string | number
  /** The Workout's letter; `null` on a day with no Session. */
  letter: string | null
  tone: WorkoutTone | null
  today: boolean
  future: boolean
  /**
   * V5: opens the day's Session (or a chooser of them). Given only on a day with a Session; such
   * a day is a button named by `label` ("Workout B, Mon 12 Oct"). Every other day stays a picture.
   */
  onOpen?(): void
  /** The tappable day's accessible name; read only with `onOpen`. */
  label?: string
}

/**
 * One calendar day (V3-09): a Session day filled in its Workout's tone with its letter, an empty
 * day a dot, today outlined. Drawn alike on Sessions' six-week calendar and Train's week strip.
 * A day with `onOpen` is a button into its Session (V5); otherwise it is a picture and the row
 * around it carries the accessible summary.
 */
export function CalendarDay({ cell }: { cell: CalendarCell }): JSX.Element {
  const shared = {
    'data-workout': cell.letter ? (cell.tone ?? 'gone') : undefined,
    'data-today': cell.today || undefined,
    'data-future': cell.future || undefined,
  }
  if (cell.onOpen && cell.letter) {
    return (
      <button type="button" className="calendar-day cell" {...shared} aria-label={cell.label} onClick={cell.onOpen}>
        <span aria-hidden="true">{cell.letter}</span>
      </button>
    )
  }
  return (
    <span className="calendar-day" {...shared} aria-hidden="true">
      {cell.letter ? cell.letter : <span className="calendar-day-dot" />}
    </span>
  )
}

/**
 * Seven `CalendarDay`s in a row: one week of the calendar, or Train's whole strip. Hidden from a
 * screen reader unless a day in it is a button.
 */
export function CalendarWeekCells({ cells }: { cells: CalendarCell[] }): JSX.Element {
  const interactive = cells.some((cell) => cell.onOpen && cell.letter)
  return (
    <span className="calendar-week" aria-hidden={interactive ? undefined : 'true'}>
      {cells.map((cell) => (
        <CalendarDay key={cell.key} cell={cell} />
      ))}
    </span>
  )
}
