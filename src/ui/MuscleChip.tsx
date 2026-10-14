import { familyOf } from '../domain/muscles'
import type { Muscle } from '../types'
import './MuscleChip.css'

export type MuscleChipProps = {
  muscle: Muscle
}

/**
 * A muscle's name on a neutral chip (E10-T3): `<span className="muscle-chip"
 * data-family={familyOf(muscle)}>`, holding an empty 8px `.muscle-dot` painted with the
 * family's data colour (E17-T10, O17), then the name.
 */
export function MuscleChip({ muscle }: MuscleChipProps): JSX.Element {
  return (
    <span className="muscle-chip" data-family={familyOf(muscle)}>
      <span className="muscle-dot" aria-hidden="true" />
      {muscle}
    </span>
  )
}
