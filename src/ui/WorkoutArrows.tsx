import type { ReactNode } from 'react'
import { Icon } from './icons'
import './WorkoutArrows.css'

/** A workout the ‹ › arrows can switch to (2026-11-17). */
export type WorkoutRef = { workoutId: string; name: string }

/** The previous and next workout either side of the one shown, and what a press does. */
export type WorkoutStep = { prev: WorkoutRef; next: WorkoutRef; onStep(workoutId: string): void }

/** ‹ and › either side of a workout's name: each press switches to the previous or next workout. */
export function WorkoutArrows({
  step,
  children,
  className,
}: {
  step: WorkoutStep | null
  children: ReactNode
  className?: string
}): JSX.Element {
  if (!step) return <>{children}</>
  return (
    <div className={className ? `workout-arrows ${className}` : 'workout-arrows'}>
      <button
        type="button"
        className="icon-btn workout-arrow workout-arrow-prev"
        aria-label={`Previous workout: ${step.prev.name}`}
        onClick={() => step.onStep(step.prev.workoutId)}
      >
        <Icon name="ChevronLeft" size={24} />
      </button>
      {children}
      <button
        type="button"
        className="icon-btn workout-arrow workout-arrow-next"
        aria-label={`Next workout: ${step.next.name}`}
        onClick={() => step.onStep(step.next.workoutId)}
      >
        <Icon name="ChevronRight" size={24} />
      </button>
    </div>
  )
}

