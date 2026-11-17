// v7 Home (docs/design/competitors-2026-11/home/home.md §2, §4, §6): the landing dashboard as data.
// Pure: it reads the Program, the Sessions and the clock, and says which of the five moments
// (training day, rest day, back after a break, just finished, new user) -- or a live Session --
// the trainee opens the app on, and what each of the four blocks and the dock show.
//
//   usualDays(sessions, now, weekStartsOn) -> the weekdays (0 = Sunday) trained on in at least 2
//                                             of the last 4 complete weeks
//   homeModelOf(input)                     -> HomeModel
import { visiblePrograms } from '../../domain/programs'
import type { Resolve } from '../../domain/muscles'
import { formatDay } from '../../domain/dates'
import { nextWorkout } from '../../domain/shortSession'
import { calendarWeeks, startOfDay, workingSetCount } from '../../domain/sessionsView'
import { buildLiftHistories } from '../../domain/stats/liftHistory'
import { storyPoints } from '../../domain/stats/liftStory'
import { computeRecords, sessionPrs } from '../../domain/stats/records'
import { BREAK_DAYS, daysOff as daysOffOf, liftStatuses, type LiftStatus } from '../../domain/stats/status'
import { workoutMinutes } from '../../domain/stats/train'
import { leverText } from '../../domain/stats/words'
import { liftsBeat, sessionLifts } from '../../domain/summaryLines'
import { weekStart, type Weekday } from '../../domain/stats/weeks'
import type { ExercisePlan, Program, Session, Workout } from '../../types'
import { workoutLetterOf, workoutToneAt, type WorkoutTone } from '../../ui/workoutMark'
import { liftPlan } from '../dashboard/trainCard'

export type HomeState = 'training' | 'rest' | 'break' | 'done' | 'new' | 'live'

/** One arc of the week ring: a Session done (in its workout's tone), today's due one, or open. */
export type RingArc = { kind: 'done'; tone: WorkoutTone } | { kind: 'due' } | { kind: 'open' }

export type WeekRing = { done: number; planned: number; arcs: RingArc[] }

/** The Today panel: a label, a title and its lines, the ring, and where a tap goes. */
export type HomeToday = {
  /** `Today`, `Rest day`, `Welcome back`, `Done today`, `Pick a plan` (drawn upper case). */
  label: string
  title: string | null
  lines: string[]
  /** The one green line: `Curls up to 15 kg`, `5 of 7 lifts`. */
  up: string | null
  /** Real PRs set (the gold tag), 0 for none. */
  prs: number
  ring: WeekRing | null
  /** `workout`: the workout page; `session`: that Session's summary. */
  target: { kind: 'workout' } | { kind: 'session'; sessionId: string } | null
}

export type LiftLineTone = 'up' | 'flat' | 'down' | 'grey' | 'new'

export type LiftLine = {
  exerciseId: string
  name: string
  /** The measure as a 3-session moving average, over the last 12 weeks, oldest first. */
  values: number[]
  tone: LiftLineTone
  /** The lift set a PR in the Session just finished: a gold ring ends its line. */
  pr: boolean
}

export type LiftRow = { workoutId: string; name: string; letter: string; tone: WorkoutTone; lines: LiftLine[] }

export type HomeLifts = {
  rows: LiftRow[]
  /** `12 of 14 moving` (up) or `As you left them` (flat); null with no verdict yet. */
  verdict: { text: string; tone: 'up' | 'flat' } | null
  moving: number
  of: number
}

export type GridDay = {
  at: number
  tone: WorkoutTone | null
  sessionId?: string
  /** `Workout B, Mon 12 Oct`. */
  label?: string
  today: boolean
  future: boolean
}

export type HomeCalendar = {
  weeks: { start: number; days: GridDay[] }[]
  /** One label per week column, `Aug` where a month starts, else empty. */
  months: string[]
  count: number
}

export type HomeLast =
  | {
      kind: 'session'
      sessionId: string
      letter: string
      tone: WorkoutTone
      workoutName: string
      day: string
      detail: string
      up: { count: number; of: number } | null
      prs: number
    }
  | { kind: 'next'; letter: string; tone: WorkoutTone; workoutName: string; day: string | null }

export type HomeDock =
  | { kind: 'start'; workoutId: string; label: string; style: 'ink' | 'outline' }
  | { kind: 'resume' }
  | { kind: 'pick' }

export type PlanOption = { id: string; name: string; summary: string; firstWorkout: { id: string; name: string } | null }

export type HomeModel = {
  state: HomeState
  /** `FRI 16 OCT` before upper-casing: `Fri 16 Oct`. */
  date: string
  today: HomeToday
  lifts: HomeLifts
  calendar: HomeCalendar
  last: HomeLast | null
  dock: HomeDock | null
  /** The Programs a new trainee picks from (state `new`). */
  plans: PlanOption[]
  /**
   * Every workout of the active Program the Today panel's ‹ › arrows step through, in Program
   * order, with the due one's id; empty unless the panel offers a workout and there are several.
   */
  workouts?: HomeWorkout[]
  dueWorkoutId?: string | null
}

/** A workout Home's arrows can switch the Today panel and the Start bar to. */
export type HomeWorkout = { workoutId: string; name: string; lines: string[] }

export type HomeInput = {
  /** The active Program; null for a new trainee. */
  program: Program | null
  /** Every Program, for a past Session's workout name and colour and the new trainee's pick. */
  programs: Program[]
  sessions: Session[]
  resolve: Resolve
  now: number
  weekStartsOn: Weekday
  /** The Reminders' weekdays (0 = Sunday), null or empty when none are set. */
  reminders: number[] | null
  /** A Session is in progress. */
  live: boolean
  /** This is the deload week: no heavier load is offered. */
  deload?: boolean
}

const WEEKS = 12
const LONG_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function addDays(at: number, days: number): number {
  const d = new Date(at)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days).getTime()
}

function finished(sessions: Session[]): Session[] {
  return sessions.filter((s) => s.deletedAt === undefined && s.finishedAt != null)
}

/**
 * §4 rule 2: the weekdays (0 = Sunday) the trainee trained on in at least 2 of the last 4
 * complete weeks, ascending. A new or irregular trainee has none.
 */
export function usualDays(sessions: Session[], now: number, weekStartsOn: Weekday = 1): number[] {
  const current = weekStart(now, weekStartsOn)
  const from = addDays(current, -28)
  const weeksByDay = new Map<number, Set<number>>()
  for (const s of finished(sessions)) {
    if (s.startedAt < from || s.startedAt >= current) continue
    const day = new Date(s.startedAt).getDay()
    const weeks = weeksByDay.get(day) ?? new Set<number>()
    weeks.add(weekStart(s.startedAt, weekStartsOn))
    weeksByDay.set(day, weeks)
  }
  return [...weeksByDay.entries()].filter(([, weeks]) => weeks.size >= 2).map(([day]) => day).sort((a, b) => a - b)
}

/** The first 3+ word name's last word (`Seated biceps curls` -> `Curls`); a shorter name as is. */
export function shortLiftName(name: string): string {
  const words = name.trim().split(/\s+/)
  if (words.length < 3) return name
  const last = words[words.length - 1]
  return last.charAt(0).toUpperCase() + last.slice(1)
}

function workoutOf(programs: Program[], session: Session): { workout: Workout | null; index: number } {
  const program = programs.find((p) => p.id === session.programId)
  const index = program?.workouts.findIndex((w) => w.id === session.workoutId) ?? -1
  return { workout: index >= 0 && program ? program.workouts[index] : null, index }
}

function toneOfWorkout(program: Program, workoutId: string): WorkoutTone {
  return workoutToneAt(program.workouts.findIndex((w) => w.id === workoutId))
}

function planSummary(program: Program): string {
  const workouts = program.workouts
  if (workouts.length === 1) {
    const lifts = workouts[0].exercises.length
    return `${program.sessionsPerWeek} a week · ${lifts} lift${lifts === 1 ? '' : 's'}`
  }
  return `${program.sessionsPerWeek} a week · ${workouts.length} workouts`
}

/** How a finished Session moved its lifts: lifts that went up, of lifts compared, and real PRs. */
function sessionVerdict(
  session: Session,
  sessions: Session[],
  program: Program,
  resolve: Resolve,
): { up: number; of: number; prs: number; prLifts: Set<string> } {
  const plans = new Map<string, ExercisePlan>()
  for (const w of program.workouts) for (const e of w.exercises) plans.set(e.exerciseId, e)
  const planOf = (id: string): ExercisePlan | undefined => plans.get(id)
  const upTo = sessions.filter((s) => s.startedAt <= session.startedAt)
  const prs = sessionPrs(computeRecords(upTo, resolve, planOf), session.id)
  // V7R-02: the summary's own lift-by-lift reading, so "5 of 7" here is the summary's "5 of 7".
  const { up, of } = liftsBeat(sessionLifts(session, upTo, resolve, program, planOf, prs).map((lift) => lift.line))
  return { up, of, prs: prs.length, prLifts: new Set(prs.map((r) => r.exerciseId)) }
}

/** V7R-04: the Session's Sets as Sessions and the summary count them (`workingSetCount`). */
function setCount(session: Session): number {
  return workingSetCount(session)
}

/** A trailing 3-session moving average, so one off day does not zig-zag the line. */
function smooth(values: number[]): number[] {
  return values.map((_, i) => {
    const window = values.slice(Math.max(0, i - 2), i + 1)
    return window.reduce((sum, v) => sum + v, 0) / window.length
  })
}

function lineTone(status: LiftStatus | undefined): LiftLineTone {
  if (!status || status.kind === 'too new') return 'new'
  if (status.kind === 'moving' || status.kind === 'ready') return 'up'
  if (status.kind === 'lowered' || status.kind === 'slipping') return 'down'
  return 'flat'
}

/** The next training day strictly after `now`'s day, within 7 days; null with none known. */
function nextTrainingDay(days: number[], now: number): number | null {
  if (days.length === 0) return null
  for (let i = 1; i <= 7; i += 1) {
    const at = addDays(startOfDay(now), i)
    if (days.includes(new Date(at).getDay())) return at
  }
  return null
}

export function homeModelOf(input: HomeInput): HomeModel {
  const { program, programs, resolve, now, weekStartsOn } = input
  const sessions = finished(input.sessions)
  const date = formatDay(new Date(now), new Date(now))
  const today0 = startOfDay(now)
  const windowStart = addDays(weekStart(now, weekStartsOn), -7 * (WEEKS - 1))

  // Sessions block: twelve weeks of the A/B calendar.
  const grid = calendarWeeks(sessions, now, WEEKS, weekStartsOn)
  const byDay = new Map<number, Session>()
  for (const s of [...sessions].sort((a, b) => a.startedAt - b.startedAt)) {
    const day = startOfDay(s.startedAt)
    if (!byDay.has(day)) byDay.set(day, s)
  }
  const calendar: HomeCalendar = {
    weeks: grid.map((week) => ({
      start: week.start,
      days: week.days.map((day) => {
        const session = byDay.get(day.at)
        if (!session) return { at: day.at, tone: null, today: day.today, future: day.future }
        const { workout, index } = workoutOf(programs, session)
        return {
          at: day.at,
          tone: workoutToneAt(index),
          sessionId: session.id,
          label: `${workout?.name ?? session.workoutId}, ${formatDay(new Date(day.at), new Date(now))}`,
          today: day.today,
          future: day.future,
        }
      }),
    })),
    months: grid.map((week, i) => {
      const month = new Date(week.start).getMonth()
      return i > 0 && month !== new Date(grid[i - 1].start).getMonth() ? MONTHS[month] : ''
    }),
    count: sessions.filter((s) => s.startedAt >= windowStart && s.startedAt <= now).length,
  }

  const emptyLifts: HomeLifts = { rows: [], verdict: null, moving: 0, of: 0 }

  if (program === null) {
    const plans: PlanOption[] = visiblePrograms(programs).map((p) => ({
      id: p.id,
      name: p.name,
      summary: planSummary(p),
      firstWorkout: p.workouts[0] ? { id: p.workouts[0].id, name: p.workouts[0].name } : null,
    }))
    return {
      state: input.live ? 'live' : 'new',
      date,
      today: { label: 'Pick a plan', title: null, lines: [], up: null, prs: 0, ring: null, target: null },
      lifts: emptyLifts,
      calendar,
      last: null,
      dock: input.live ? { kind: 'resume' } : { kind: 'pick' },
      plans,
    }
  }

  const shown = visiblePrograms([program])[0] ?? program
  const due = nextWorkout(shown, sessions)
  const latest = [...sessions].sort((a, b) => (b.finishedAt ?? 0) - (a.finishedAt ?? 0))[0] ?? null
  const latestStart = sessions.length > 0 ? Math.max(...sessions.map((s) => s.startedAt)) : null
  // V7R-03: the one days-off number (`daysOff`), as the workout page and the Set screen say it.
  const daysOff = daysOffOf(sessions, now) ?? 0
  const weekSessions = sessions
    .filter((s) => s.startedAt >= weekStart(now, weekStartsOn) && s.startedAt <= now)
    .sort((a, b) => a.startedAt - b.startedAt)
  const planned = shown.sessionsPerWeek
  const reminderDays = input.reminders ?? []
  const trainingDays = reminderDays.length > 0 ? [...reminderDays].sort((a, b) => a - b) : usualDays(sessions, now, weekStartsOn)

  let state: HomeState
  if (input.live) state = 'live'
  else if (latest !== null && latest.finishedAt != null && startOfDay(latest.finishedAt) === today0) state = 'done'
  else if (latestStart !== null && daysOff >= BREAK_DAYS) state = 'break'
  else if (weekSessions.length >= planned) state = 'rest'
  else if (trainingDays.length === 0 || trainingDays.includes(new Date(now).getDay())) state = 'training'
  else state = 'rest'

  // The week ring: done arcs in their workout's colour, today's due one dashed, the rest open.
  const arcs: RingArc[] = weekSessions.map((s) => ({ kind: 'done', tone: workoutToneAt(workoutOf(programs, s).index) }))
  const ringSize = Math.max(planned, arcs.length)
  if ((state === 'training' || state === 'break') && arcs.length < ringSize) arcs.push({ kind: 'due' })
  while (arcs.length < ringSize) arcs.push({ kind: 'open' })
  const ring: WeekRing = { done: weekSessions.length, planned, arcs }

  // The Lifts block: one sparkline per lift, a row per workout.
  const statuses = liftStatuses(shown, sessions, resolve, now)
  const plans = new Map<string, ExercisePlan>()
  for (const w of shown.workouts) for (const e of w.exercises) plans.set(e.exerciseId, e)
  const histories = buildLiftHistories(sessions, resolve, (id) => plans.get(id))
  const justDone = state === 'done' && latest ? sessionVerdict(latest, sessions, programOf(latest), resolve) : null
  const rows: LiftRow[] = shown.workouts.map((workout) => ({
    workoutId: workout.id,
    name: workout.name,
    letter: workoutLetterOf(workout.name),
    tone: toneOfWorkout(program, workout.id),
    lines: workout.exercises.flatMap((plan): LiftLine[] => {
      const exercise = resolve(plan.exerciseId)
      if (!exercise) return []
      const history = histories.get(plan.exerciseId)
      const points = history ? storyPoints(history) : []
      const all = smooth(points.map((p) => p.value))
      const values = all.filter((_, i) => points[i].at >= windowStart)
      const status = statuses.get(plan.exerciseId)
      let tone = lineTone(status)
      if (values.length < 2) tone = 'new'
      else if (state === 'break' && tone !== 'new') tone = 'grey'
      return [{ exerciseId: plan.exerciseId, name: exercise.name, values, tone, pr: justDone?.prLifts.has(plan.exerciseId) ?? false }]
    }),
  }))
  const judged = rows.flatMap((r) => r.lines).filter((l) => l.tone !== 'new')
  const moving = judged.filter((l) => statuses.get(l.exerciseId)?.kind === 'moving' || statuses.get(l.exerciseId)?.kind === 'ready').length
  const lifts: HomeLifts = {
    rows,
    moving,
    of: judged.length,
    verdict:
      judged.length === 0
        ? null
        : state === 'break'
          ? { text: 'As you left them', tone: 'flat' }
          : { text: `${moving} of ${judged.length} moving`, tone: moving > 0 ? 'up' : 'flat' },
  }

  function programOf(session: Session): Program {
    return programs.find((p) => p.id === session.programId) ?? shown
  }

  // The Today panel.
  const dueName = due?.workout.name ?? null
  let today: HomeToday
  if (state === 'done' && latest) {
    const { workout } = workoutOf(programs, latest)
    const minutes = Math.max(0, Math.round(((latest.finishedAt ?? latest.startedAt) - latest.startedAt) / 60_000))
    const verdict = justDone!
    today = {
      label: 'Done today',
      title: workout?.name ?? latest.workoutId,
      lines: [`${minutes} min · ${setCount(latest)} sets`],
      up: verdict.of > 0 && verdict.up > 0 ? `${verdict.up} of ${verdict.of} lifts` : null,
      prs: verdict.prs,
      ring,
      target: { kind: 'session', sessionId: latest.id },
    }
  } else if (state === 'break') {
    today = {
      label: 'Welcome back',
      title: dueName,
      lines: [`${daysOff} days off · loads eased 10 % for today`],
      up: null,
      prs: 0,
      ring,
      target: due ? { kind: 'workout' } : null,
    }
  } else if (state === 'rest') {
    const after = nextTrainingDay(trainingDays, now)
    const remaining = trainingDays.filter((day) => {
      const since = (day - weekStartsOn + 7) % 7
      const at = addDays(weekStart(now, weekStartsOn), since)
      return at > today0
    }).length
    const onTrack = weekSessions.length >= planned || weekSessions.length + remaining >= planned
    const dayName = after === null ? null : LONG_DAYS[new Date(after).getDay()]
    today = onTrack
      ? {
          label: 'Rest day',
          title: 'On track',
          lines: dueName ? [dayName ? `Next: ${dueName}, ${dayName}` : `Next: ${dueName}`] : [],
          up: null,
          prs: 0,
          ring,
          target: due ? { kind: 'workout' } : null,
        }
      : {
          label: 'Rest day',
          title: dueName,
          lines: dayName ? [`Next: ${dayName}`] : [],
          up: null,
          prs: 0,
          ring,
          target: due ? { kind: 'workout' } : null,
        }
  } else {
    let up: string | null = null
    let liftCount = 0
    if (due) {
      for (const plan of due.workout.exercises) {
        const exercise = resolve(plan.exerciseId)
        if (!exercise) continue
        liftCount += 1
        if (up !== null) continue
        const advice = liftPlan(exercise, plan, sessions, now, input.deload ?? false).advice
        if (advice?.kind === 'up') up = `${shortLiftName(exercise.name)} up to ${leverText(advice.lever, exercise.bodyweight)}`
      }
    }
    const minutes = due ? workoutMinutes(shown, due.workout, sessions).minutes : null
    today = {
      label: 'Today',
      title: dueName,
      lines: due ? [`${liftCount} lift${liftCount === 1 ? '' : 's'} · about ${minutes} min`] : [],
      up,
      prs: 0,
      ring,
      target: due ? { kind: 'workout' } : null,
    }
  }

  // Last time: the newest finished Session, or after one today, what is next.
  let last: HomeLast | null = null
  if (state === 'done' && due) {
    const after = nextTrainingDay(trainingDays, now)
    last = {
      kind: 'next',
      letter: workoutLetterOf(due.workout.name),
      tone: toneOfWorkout(program, due.workout.id),
      workoutName: due.workout.name,
      day: after === null ? null : LONG_DAYS[new Date(after).getDay()],
    }
  } else if (latest && state !== 'done') {
    const { workout, index } = workoutOf(programs, latest)
    const name = workout?.name ?? latest.workoutId
    const minutes = Math.max(0, Math.round(((latest.finishedAt ?? latest.startedAt) - latest.startedAt) / 60_000))
    const verdict = state === 'break' ? null : sessionVerdict(latest, sessions, programOf(latest), resolve)
    last = {
      kind: 'session',
      sessionId: latest.id,
      letter: workoutLetterOf(name),
      tone: workoutToneAt(index),
      workoutName: name,
      day: formatDay(new Date(latest.startedAt), new Date(now)),
      detail: state === 'break' ? `${daysOff} days ago` : `${minutes} min`,
      up: verdict && verdict.of > 0 ? { count: verdict.up, of: verdict.of } : null,
      prs: verdict?.prs ?? 0,
    }
  }

  const dock: HomeDock | null =
    state === 'live'
      ? { kind: 'resume' }
      : state === 'done' || !due
        ? null
        : { kind: 'start', workoutId: due.workout.id, label: `Start ${due.workout.name}`, style: state === 'rest' ? 'outline' : 'ink' }

  // The Today panel's ‹ › arrows: every visible workout with its own size line, while the panel
  // offers a workout (not done today, not live) and the Program has more than one.
  const workouts: HomeWorkout[] =
    today.target?.kind === 'workout' && shown.workouts.filter((w) => !w.hidden).length > 1
      ? shown.workouts
          .filter((w) => !w.hidden)
          .map((w) => {
            const lifts = w.exercises.filter((plan) => resolve(plan.exerciseId) !== undefined).length
            const minutes = workoutMinutes(shown, w, sessions).minutes
            return { workoutId: w.id, name: w.name, lines: [`${lifts} lift${lifts === 1 ? '' : 's'} · about ${minutes} min`] }
          })
      : []

  return { state, date, today, lifts, calendar, last, dock, plans: [], workouts, dueWorkoutId: due?.workout.id ?? null }
}
