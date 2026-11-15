import type { Resolve } from '../../domain/muscles'
import { formatDay } from '../../domain/dates'
import { lastEntriesOf } from '../../domain/planLoad'
import { presetForSet } from '../../domain/prefill'
import type { ShortSession } from '../../domain/shortSession'
import type { LiftHistory } from '../../domain/stats/liftHistory'
import type { DueWorkoutCard } from '../../domain/stats/train'
import type { NextStep } from '../../domain/stats/verdict'
import { weeksOf, type Weekday } from '../../domain/stats/weeks'
import type { Exercise, ExercisePlan, Program, Session } from '../../types'
import { workoutLetterOf, workoutToneAt, type WorkoutTone } from '../../ui/workoutMark'

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
  /**
   * V5-07: the heaviest planned Set's load when the Sets ramp (last time's Sets differ), as the
   * row says it, `62.5 kg`; unset when every Set opens on `load`.
   */
  topLoad?: string
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

/**
 * One day of this week's strip: its initial, the workout done on it (`B`) with its tone and name
 * (drawn as the Sessions calendar's cell, V3-09), and whether it is today or still ahead.
 */
export type WeekStripDay = {
  key: string
  initial: string
  name: string
  workout: string | null
  /** The workout's colour key; unset or `null` on a day with none. */
  tone?: WorkoutTone | null
  /** The workout's full name, for the strip's accessible summary. */
  workoutName?: string | null
  today: boolean
  future?: boolean
  /** V5-14: the Session done that day, which its strip day opens. */
  sessionId?: string
  /** V5-14: that day's button name, "Workout B, Mon 12 Oct". */
  label?: string
}

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
      const { load, topLoad } = liftPreset(exercise, plan, sessions, deload)
      return {
        ...row,
        sets: plan.sets,
        load,
        ...(topLoad === undefined ? {} : { topLoad }),
        reps: `${plan.repRange[0]}–${plan.repRange[1]}`,
      }
    }),
  }
}

/**
 * The load a Plan's next Session opens on: the Set 1 Preset (`70 kg`, `BW+5`, `null` with no
 * weight to go on) and, when the Sets ramp, the heaviest planned Set's (`62.5 kg`). Train's rows
 * and the Program tab's kg column (V6-15) read the same.
 */
export function liftPreset(
  exercise: Exercise,
  plan: ExercisePlan,
  sessions: Session[],
  deload = false,
): { load: string | null; topLoad?: string } {
  const lastEntries = lastEntriesOf(sessions, plan.exerciseId)
  const preset = presetForSet({ exercise, plan, setIndex: 1, lastEntries, today: [], deload })
  const load = exercise.bodyweight
    ? leverText(preset.loadKg ?? 0, true)
    : preset.weightKg === null
      ? null
      : leverText(preset.weightKg, false)
  // V5-07: each planned Set as it opens when the ones before it go as last time did; a ramp
  // (47.5 -> 62.5) is said as one, never as "4 x 47.5 kg".
  let top = preset.weightKg
  if (!exercise.bodyweight && top !== null) {
    for (let setIndex = 2; setIndex <= plan.sets; setIndex += 1) {
      const at = presetForSet({ exercise, plan, setIndex, lastEntries, deload }).weightKg
      if (at !== null && at > top) top = at
    }
  }
  const topLoad = top !== null && top !== preset.weightKg ? leverText(top, false) : undefined
  return topLoad === undefined ? { load } : { load, topLoad }
}

/** V6-15: the Program tab's kg cell: `47.5 → 62.5`, `70`, `BW+5`; `–` with no weight. */
export function kgCellText(preset: { load: string | null; topLoad?: string }): string {
  const bare = (text: string): string => text.replace(/ kg$/, '')
  if (preset.load === null) return '–'
  return preset.topLoad ? `${bare(preset.load)} → ${bare(preset.topLoad)}` : bare(preset.load)
}

/**
 * V6-11: Train's second line after a short Session, "Finish Workout B: 6 lifts left from Thu
 * 15 Oct"; with every lift touched, the Sets left.
 */
export function finishText(short: ShortSession, now: number): string {
  const day = formatDay(new Date(short.session.startedAt), new Date(now))
  const left =
    short.liftsLeft > 0
      ? `${short.liftsLeft} ${short.liftsLeft === 1 ? 'lift' : 'lifts'}`
      : `${short.planned - short.logged} sets`
  return `Finish ${short.workout.name}: ${left} left from ${day}`
}

/** V6-08: the Workout's last Session note as Train shows it, "Note from Wed 7 Oct: …". */
export function noteText(note: { at: number; text: string }, now: number): string {
  return `Note from ${formatDay(new Date(note.at), new Date(now))}: ${note.text}`
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** This week's strip: each day from the week start, the workout done on it, and done of planned. */
export function weekStripOf(sessions: Session[], program: Program, now: number, weekStartsOn: Weekday): WeekStrip {
  const week = weeksOf(sessions, now, weekStartsOn).find((w) => w.inProgress)
  const today = new Date(now)
  const since = (today.getDay() - weekStartsOn + 7) % 7
  const workoutName = (id: string): string => program.workouts.find((w) => w.id === id)?.name ?? id
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
      workout: session ? workoutLetterOf(workoutName(session.workoutId)) : null,
      tone: session ? workoutToneAt(program.workouts.findIndex((w) => w.id === session.workoutId)) : null,
      workoutName: session ? workoutName(session.workoutId) : null,
      today: i === since,
      future: i > since,
      ...(session ? { sessionId: session.id, label: `${workoutName(session.workoutId)}, ${formatDay(date, today)}` } : {}),
    })
  }
  return { done: week?.sessions.length ?? 0, planned: program.sessionsPerWeek, days }
}
