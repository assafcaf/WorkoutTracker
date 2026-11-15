import type { Resolve } from '../../domain/muscles'
import { lastEntriesOf } from '../../domain/planLoad'
import { presetForSet } from '../../domain/prefill'
import type { LiftHistory } from '../../domain/stats/liftHistory'
import type { DueWorkoutCard } from '../../domain/stats/train'
import type { NextStep } from '../../domain/stats/verdict'
import { weeksOf, type Weekday } from '../../domain/stats/weeks'
import type { Program, Session } from '../../types'

/**
 * One lift of the workout as today's Session will open it (V2-05): its planned Sets, the Set 1
 * Preset and the rep range, plus the step-up marker when the lift is ready for the next weight.
 */
export type TrainLiftRow = {
  exerciseId: string
  name: string
  /** Planned working Sets; unset on a card built without the Plan. */
  sets?: number
  /** The Set 1 Preset's load: `70 kg`, `BW`, `BW+5`, `BW−19`; `null` with no weight to go on. */
  load?: string | null
  /** The Plan's rep range: `8–10`. */
  reps?: string
  /** `null` while the lift has no sets yet. */
  step: { reps: number; target: number; at: string; suggest: string | null; hold?: true } | null
}

/** Train's card: the due workout, its duration estimate and each lift as Set 1 opens it. */
export type TrainCard = {
  name: string
  minutes: number
  estimate: 'logged' | 'plan'
  /** Workouts still planned this week after this one; unset or 0 reads as none. */
  more?: number
  /** This week is the deload week: the card says Presets run 10% lighter. */
  deload?: boolean
  lifts: TrainLiftRow[]
}

/** One day of this week's strip: its initial, the workout done on it (`B`), and whether it is today. */
export type WeekStripDay = { key: string; initial: string; name: string; workout: string | null; today: boolean }

/** This week at the top of Train (V2-05): one cell per day, and Sessions done of planned. */
export type WeekStrip = { done: number; planned: number; days: WeekStripDay[] }

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
  const row = { reps: step.repsAtTop, target: step.target, at: leverText(step.lever, bodyweight), suggest }
  return step.hold ? { ...row, hold: true } : row
}

/**
 * The card's strings, from the engine's due workout and the lifts' histories. With `sessions`
 * and `resolve`, each row carries the Set 1 Preset the live Session opens with: `presetForSet`
 * at Set 1 against the same "last time" the Session reads (`lastEntriesOf`), deloaded on a
 * deload week.
 */
export function trainCardOf(
  card: DueWorkoutCard,
  histories: Map<string, LiftHistory>,
  more = 0,
  deload = false,
  sessions?: Session[],
  resolve?: Resolve,
): TrainCard {
  const plans = new Map(card.workout.exercises.map((plan) => [plan.exerciseId, plan] as const))
  return {
    name: card.workout.name,
    minutes: card.minutes,
    estimate: card.estimate,
    more,
    deload,
    lifts: card.lifts.map((lift) => {
      const row: TrainLiftRow = {
        exerciseId: lift.exerciseId,
        name: lift.name,
        step: lift.step ? stepRow(lift.step, histories.get(lift.exerciseId)?.bodyweight ?? false) : null,
      }
      const plan = plans.get(lift.exerciseId)
      const exercise = resolve?.(lift.exerciseId)
      if (!plan || !exercise || !sessions) return row
      const preset = presetForSet({
        exercise,
        plan,
        setIndex: 1,
        lastEntries: lastEntriesOf(sessions, lift.exerciseId),
        today: [],
        deload,
      })
      const load = exercise.bodyweight
        ? leverText(preset.loadKg ?? 0, true)
        : preset.weightKg === null
          ? null
          : leverText(preset.weightKg, false)
      return { ...row, sets: plan.sets, load, reps: `${plan.repRange[0]}–${plan.repRange[1]}` }
    }),
  }
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** This week's strip: each day from the week start, the workout done on it, and done of planned. */
export function weekStripOf(sessions: Session[], program: Program, now: number, weekStartsOn: Weekday): WeekStrip {
  const week = weeksOf(sessions, now, weekStartsOn).find((w) => w.inProgress)
  const today = new Date(now)
  const since = (today.getDay() - weekStartsOn + 7) % 7
  const workoutName = (id: string): string =>
    program.workouts.find((w) => w.id === id)?.name.replace(/^Workout\s+/i, '') ?? '•'
  const days: WeekStripDay[] = []
  for (let i = 0; i < 7; i += 1) {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - since + i)
    const session = week?.sessions.find((s) => {
      const d = new Date(s.startedAt)
      return d.getFullYear() === date.getFullYear() && d.getMonth() === date.getMonth() && d.getDate() === date.getDate()
    })
    const name = DAY_NAMES[date.getDay()]
    days.push({
      key: name,
      initial: name.charAt(0),
      name,
      workout: session ? workoutName(session.workoutId) : null,
      today: i === since,
    })
  }
  return { done: week?.sessions.length ?? 0, planned: program.sessionsPerWeek, days }
}
