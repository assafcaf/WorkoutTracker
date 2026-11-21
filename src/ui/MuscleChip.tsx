import type { Muscle } from '../types'
import './MuscleChip.css'

export type MuscleChipProps = {
  muscle: Muscle
}

/**
 * A muscle's name as quiet grey text (DX-15): no pill, no Muscle-family dot or tint, since a
 * coloured dot next to an Exercise read as a Workout or as "up". Colour carries meaning only.
 */
export function MuscleChip({ muscle }: MuscleChipProps): JSX.Element {
  return <span className="muscle-chip">{muscle}</span>
}
