import './ProgressionBar.css'
import type { Progression, Suggestion } from '../domain/progression'

export type ProgressionBarProps = { progression: Progression }

/** What a full bar says to do next, as one line of text. */
function suggestionText(suggestion: Suggestion): string {
  switch (suggestion.kind) {
    case 'add-weight':
      return `Next: ${String(suggestion.nextWeightKg)} kg`
    case 'reduce-assistance':
      return `Next: ${String(suggestion.nextWeightKg)} kg assist`
    case 'add-set':
      return 'Add a set'
  }
}

/**
 * How close the last session of an exercise came to the top of its rep range (E4-T6), drawn
 * from a `Progression` it is handed rather than derived here. A full bar carries the suggested
 * next step beside it; a null suggestion shows nothing.
 */
export function ProgressionBar({ progression }: ProgressionBarProps): JSX.Element {
  const { achievedReps, targetReps, isFull, suggestion } = progression
  const fraction = targetReps > 0 ? Math.min(achievedReps / targetReps, 1) : 0

  return (
    <div className="progression">
      <div
        className="progression-track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={targetReps}
        aria-valuenow={achievedReps}
        aria-valuetext={`${achievedReps} of ${targetReps} reps`}
      >
        <div className="progression-fill" style={{ width: `${fraction * 100}%` }} />
      </div>
      {isFull && suggestion !== null ? (
        <span className="progression-next">{suggestionText(suggestion)}</span>
      ) : null}
    </div>
  )
}
