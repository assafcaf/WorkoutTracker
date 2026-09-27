import { familyOf } from '../domain/muscles'
import type { Muscle } from '../types'
import './MuscleChip.css'

export type MuscleChipProps = {
  muscle: Muscle
}

/**
 * A muscle's name, tinted by its family (E10-T3): `<span className="muscle-chip"
 * data-family={familyOf(muscle)}>{muscle}</span>`. Used by `LibraryList` for a row's primary
 * muscle; the body map and any other consumer are out of scope for this task.
 */
export function MuscleChip({ muscle }: MuscleChipProps): JSX.Element {
  return (
    <span className="muscle-chip" data-family={familyOf(muscle)}>
      {muscle}
    </span>
  )
}
