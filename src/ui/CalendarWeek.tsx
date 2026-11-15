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
}

/**
 * One calendar day (V3-09): a Session day filled in its Workout's tone with its letter, an empty
 * day a dot, today outlined. Drawn alike on Sessions' six-week calendar and Train's week strip.
 * It is a picture: the row around it carries the accessible summary.
 */
export function CalendarDay({ cell }: { cell: CalendarCell }): JSX.Element {
  return (
    <span
      className="calendar-day"
      data-workout={cell.letter ? (cell.tone ?? 'gone') : undefined}
      data-today={cell.today || undefined}
      data-future={cell.future || undefined}
      aria-hidden="true"
    >
      {cell.letter ? cell.letter : <span className="calendar-day-dot" />}
    </span>
  )
}

/** Seven `CalendarDay`s in a row: one week of the calendar, or Train's whole strip. */
export function CalendarWeekCells({ cells }: { cells: CalendarCell[] }): JSX.Element {
  return (
    <span className="calendar-week" aria-hidden="true">
      {cells.map((cell) => (
        <CalendarDay key={cell.key} cell={cell} />
      ))}
    </span>
  )
}
