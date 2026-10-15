import type { LiftHistory } from '../../domain/stats/liftHistory'
import type { DueWorkoutCard } from '../../domain/stats/train'
import type { NextStep } from '../../domain/stats/verdict'

/** One lift of the due workout: reps of the target at its current weight, and the step after. */
export type TrainLiftRow = {
  exerciseId: string
  name: string
  /** `null` while the lift has no sets yet. */
  step: { reps: number; target: number; at: string; suggest: string | null } | null
}

/** Train's card: the due workout, its duration estimate and each lift's next step. */
export type TrainCard = {
  name: string
  minutes: number
  estimate: 'logged' | 'plan'
  /** Workouts still planned this week after this one; unset or 0 reads as none. */
  more?: number
  lifts: TrainLiftRow[]
}

const kg = (value: number): string => String(Math.round(value * 100) / 100)

/** A lever as the lift is loaded: `70 kg`, or `BW`, `BW+10`, `BW−20` on a Bodyweight lift. */
function leverText(lever: number, bodyweight: boolean): string {
  if (!bodyweight) return `${kg(lever)} kg`
  if (lever === 0) return 'BW'
  return lever > 0 ? `BW+${kg(lever)}` : `BW−${kg(Math.abs(lever))}`
}

function stepRow(step: NextStep, bodyweight: boolean): NonNullable<TrainLiftRow['step']> {
  const suggest = !step.suggest
    ? null
    : step.suggest.kind === 'set'
      ? 'add a set'
      : `try ${leverText(step.suggest.lever, bodyweight)}`
  return { reps: step.repsAtTop, target: step.target, at: leverText(step.lever, bodyweight), suggest }
}

/** The card's strings, from the engine's due workout and the lifts' histories. */
export function trainCardOf(
  card: DueWorkoutCard,
  histories: Map<string, LiftHistory>,
  more = 0,
): TrainCard {
  return {
    name: card.workout.name,
    minutes: card.minutes,
    estimate: card.estimate,
    more,
    lifts: card.lifts.map((lift) => ({
      exerciseId: lift.exerciseId,
      name: lift.name,
      step: lift.step ? stepRow(lift.step, histories.get(lift.exerciseId)?.bodyweight ?? false) : null,
    })),
  }
}
