import { resolveExercise } from '../../data/resolve'
import { bodyweightOn } from '../../domain/bodyLog'
import { applyBodyweight } from '../../domain/bodyweight'
import type { Resolve } from '../../domain/muscles'
import { visiblePrograms } from '../../domain/programs'
import { homeCopy, humanDate } from '../../domain/stats/copy'
import type { HomeCopy } from '../../domain/stats/copy'
import { buildLiftHistories } from '../../domain/stats/liftHistory'
import type { LiftHistory } from '../../domain/stats/liftHistory'
import { changeSince, changeTextFor, measureOf, storyPoints } from '../../domain/stats/liftStory'
import type { Measure } from '../../domain/stats/liftStory'
import { liftStatuses } from '../../domain/stats/status'
import type { LiftStatus } from '../../domain/stats/status'
import { dayMonth, leverText, plural } from '../../domain/stats/words'
import { STATS_MUSCLES, plannedPerWeek, windowAverage } from '../../domain/stats/muscles'
import { muscleLabel } from '../../domain/muscleLabels'
import { WEEKLY_SET_RANGE } from '../../domain/setRange'
import { weeksOf } from '../../domain/stats/weeks'
import type { Weekday } from '../../domain/stats/weeks'
import type { Services } from '../../services'
import type { BodyLog, Exercise, ExercisePlan, LibraryExercise, Program, Session } from '../../types'
import { AppShell } from '../../ui/AppShell'
import { Sparkline } from '../../ui/charts/Sparkline'
import { StatusMark, statusTone } from '../../ui/figures'
import { Icon } from '../../ui/icons'
import type { AppRoute } from '../routes'
import { useServiceData } from '../useServiceData'
import type { ProgressPageProps } from './pages'
import './Home.css'

/** What the Progress pages read: the active Program, the finished Sessions, the catalog. */
export type ProgressData = {
  program: Program
  sessions: Session[]
  resolve: Resolve
  library: Map<string, LibraryExercise>
  /** The weekday weeks begin on (E19-T1); 1 (Monday) when unread. */
  weekStart: Weekday
  /** The trainee's body log (E22-T2); empty when unread. */
  bodyLog: BodyLog
}

export async function loadProgress(s: Services): Promise<ProgressData | null> {
  const { catalog, library, bundledPrograms } = await s.catalog.load()
  const libraryMap = new Map(library.map((entry) => [entry.id, entry] as const))
  const overrides = await s.preferences.bodyweightOverrides().catch(() => ({}))
  const resolve = (id: string): Exercise | undefined => {
    const exercise = resolveExercise(id, catalog, libraryMap)
    return exercise && applyBodyweight(exercise, overrides)
  }
  const sessions = await s.sessions.list().catch((): Session[] => [])
  let programs: Program[] = bundledPrograms
  let activeId: string | null = null
  try {
    const loaded = await s.programs.load()
    programs = loaded.programs
    activeId = loaded.activeProgramId
  } catch {
    // Storage unavailable: the bundled Programs stand in.
  }
  const program = programs.find((p) => p.id === activeId) ?? visiblePrograms(programs)[0] ?? programs[0]
  if (!program) return null
  const stored = await s.preferences.weekStart().catch(() => 1)
  const weekStart = (Number.isInteger(stored) && stored >= 0 && stored <= 6 ? stored : 1) as Weekday
  const bodyLog = await s.preferences.bodyLog().catch((): BodyLog => [])
  return { program, sessions, resolve, library: libraryMap, weekStart, bodyLog }
}

/** Everything the Progress pages draw, worked out once from `ProgressData`. */
export type ProgressModel = {
  data: ProgressData
  now: number
  copy: HomeCopy
  plans: Map<string, ExercisePlan>
  /** Lift ids in Plan order, then the rest. */
  order: string[]
  histories: Map<string, LiftHistory>
  /** v6: every lift's one status (status.ts), the same on every Progress page. */
  statuses: Map<string, LiftStatus>
  nameOf(id: string): string
}

export function progressModel(data: ProgressData, now: number): ProgressModel {
  const live = data.sessions.filter((s) => s.deletedAt === undefined && s.finishedAt !== null)
  const plans = new Map<string, ExercisePlan>()
  const planOrder: string[] = []
  for (const w of data.program.workouts) {
    for (const e of w.exercises) {
      if (!plans.has(e.exerciseId)) planOrder.push(e.exerciseId)
      plans.set(e.exerciseId, e)
    }
  }
  const histories = buildLiftHistories(live, data.resolve, (id) => plans.get(id))
  const copy = homeCopy(data.program, data.sessions, data.resolve, now, data.weekStart)
  return {
    data,
    now,
    copy,
    plans,
    order: [...planOrder, ...[...histories.keys()].filter((id) => !plans.has(id))],
    histories,
    statuses: copy.stage === 'full' ? copy.statuses : liftStatuses(data.program, live, data.resolve, now),
    nameOf: (id) => data.resolve(id)?.name ?? id,
  }
}

const DAY = 24 * 3600_000
/** The ledger's window (study §1.7): est. strength and its change over 12 weeks. */
const LEDGER_WEEKS = 12
const LEDGER_SPAN = LEDGER_WEEKS * 7 * DAY
/** The weeks strip's columns. */
const STRIP_WEEKS = 6

/** A lift name that never breaks at its hyphens (`Hyper-/extension`): non-breaking hyphens. */
export const unbroken = (name: string): string => name.replace(/-/g, '‑')

/** `+11.0`, `−1.5`, `same`: a change written with a true minus, one decimal (kg) or whole (reps). */
function signed(delta: number, measure: Measure): string {
  const size = measure === 'reps' ? Math.round(Math.abs(delta)) : Math.round(Math.abs(delta) * 10) / 10
  if (size === 0) return 'same'
  const text = measure === 'reps' ? String(size) : size.toFixed(1)
  return `${delta > 0 ? '+' : '−'}${text}`
}

/** One ledger row's numbers (study §1.7). */
export type LedgerFacts = {
  measure: Measure
  /** The latest value: `79.2` (est. strength), `BW−19` (a Bodyweight lift's Load), `17` (reps). */
  value: string
  /** `kg`, `reps`, or '' when the value carries its own (`BW−19`). */
  unit: string
  /** The 12-week change, compact: `+11.0`, `−2`, `same`; null with one Session in the window. */
  change: string | null
  /** The same change in words, for the row's accessible name: `+11 kg`, `1.5 kg less assistance`. */
  changeWords: string | null
  /** The measure over the window, oldest first, for the sparkline (deloads left out). */
  values: number[]
}

/**
 * One ledger row's numbers (study §1.7, §3 Chart): the lift's story measure (`liftStory.ts` --
 * est. strength on a loaded lift, the signed Load or the most reps on a Bodyweight one), its
 * latest value, its change over 12 weeks, and the window's values for a 72 px sparkline. Deload
 * Sessions are left out.
 */
export function rowFacts(model: ProgressModel, id: string): LedgerFacts | null {
  const history = model.histories.get(id)
  if (!history) return null
  const points = storyPoints(history).filter((p) => !p.deload)
  const latest = points[points.length - 1]
  if (!latest) return null
  const measure = measureOf(history)
  const from = model.now - LEDGER_SPAN
  const change = changeSince(points, from)
  const recent = points.filter((p) => p.at >= from)
  const value =
    measure === 'est'
      ? latest.value.toFixed(1)
      : measure === 'load'
        ? leverText(Math.round(latest.value * 100) / 100, true)
        : String(Math.round(latest.value))
  return {
    measure,
    value,
    unit: measure === 'est' ? 'kg' : measure === 'reps' ? 'reps' : '',
    change: change ? signed(change.delta, measure) : null,
    changeWords: change ? changeTextFor(history, change.delta) : null,
    values: (recent.length > 0 ? recent : [latest]).map((p) => p.value),
  }
}

/**
 * A status as a ledger row says it (study §1.7): `Up to 15 kg` on a Ready lift with a load to go
 * to, `Flat since 7 Aug` on a Stalled one, else the status word (`Moving`, `Lowered`).
 */
export function statusWords(status: LiftStatus, bodyweight: boolean): string {
  if (status.kind === 'ready' && !status.swap && status.next) return `Up to ${leverText(status.next.lever, bodyweight)}`
  if (status.kind === 'stalled' && status.since !== undefined) return `Flat since ${dayMonth(status.since)}`
  return status.label
}

/**
 * The Progress headline (study §1.7): how many lifts are moving -- Moving or Ready, the `up`
 * statuses -- of all the lifts with a status, and one sentence on the exceptions, in Plan order.
 */
export function headlineOf(model: ProgressModel): { title: string; exceptions: string } {
  const ids = model.order.filter((id) => model.statuses.has(id))
  const all = ids.map((id) => model.statuses.get(id) as LiftStatus)
  const up = all.filter((s) => statusTone(s.kind) === 'up').length
  const title =
    up === all.length && all.length > 1
      ? `All ${all.length} lifts are moving`
      : `${up} of ${plural(all.length, 'lift')} ${up === 1 ? 'is' : 'are'} moving`
  const named: string[] = []
  const tooNew: string[] = []
  for (const s of all) {
    const name = model.nameOf(s.exerciseId)
    if (s.kind === 'too new') tooNew.push(name)
    else if (s.kind === 'stalled')
      named.push(s.since !== undefined ? `${name} has been flat since ${dayMonth(s.since)}.` : `${name} has been flat for 4 sessions.`)
    else if (s.kind === 'lowered')
      named.push(`${name} is lower on purpose${s.since !== undefined ? ` since ${dayMonth(s.since)}` : ''}; that is a choice, not a slide.`)
    else if (s.kind === 'slipping') named.push(`${name} has slipped for 2 sessions; one low day is normal.`)
    else if (s.kind === 'hold') named.push(`${name} stays at its weight until a set has a rep to spare.`)
    else if (s.kind === 'break') named.push(`${name} has had ${s.daysOff ?? 21} days off.`)
  }
  const sentences = named.slice(0, 3)
  if (named.length > 3) sentences.push(`${plural(named.length - 3, 'more lift')} below.`)
  if (tooNew.length === 1) sentences.push(`${tooNew[0]} is too new to call.`)
  else if (tooNew.length > 1) sentences.push(`${tooNew.length} lifts are too new to call.`)
  return { title, exceptions: sentences.join(' ') }
}

/**
 * One lift as a ledger row (study §1.7): name and status on the left, a 72 × 26 sparkline of its
 * measure over 12 weeks with the end dot in the status colour, then its latest est. strength and
 * 12-week change. The whole row opens the Lift page; its accessible name reads every value.
 */
export function LiftRow({ model, id, onOpen }: { model: ProgressModel; id: string; onOpen(id: string): void }): JSX.Element {
  const name = model.nameOf(id)
  const status = model.statuses.get(id)
  const facts = rowFacts(model, id)
  const plan = model.plans.get(id)
  const bw = model.histories.get(id)?.bodyweight ?? false
  const words = status ? statusWords(status, bw) : null
  const tone = status ? statusTone(status.kind) : 'flat'
  const prescription = plan ? `${plan.sets} × ${plan.repRange[0]}–${plan.repRange[1]}` : ''
  const what = facts?.measure === 'est' ? 'est. strength' : facts?.measure === 'load' ? 'top load' : 'best set'
  const label = [
    `${name}: ${status ? status.label : 'not logged yet'}${words && words !== status?.label ? `, ${words.toLowerCase()}` : ''}`,
    facts
      ? `${what} ${facts.value}${facts.unit ? ` ${facts.unit}` : ''}${facts.changeWords ? `, ${facts.changeWords} in ${LEDGER_WEEKS} weeks` : ''}`
      : prescription,
  ].join('. ')
  return (
    <button type="button" className="btn-quiet progress-row" aria-label={label} onClick={() => onOpen(id)}>
      <span className="progress-row-main">
        <span className="progress-row-name">{unbroken(name)}</span>
        {status && words ? (
          <StatusMark className="progress-row-note" tone={tone} glyph={status.glyph}>
            {words}
          </StatusMark>
        ) : (
          <span className="progress-row-note">Not logged yet</span>
        )}
      </span>
      <span className="progress-row-end" aria-hidden="true">
        {facts && facts.values.length > 1 ? (
          <span className="progress-row-spark">
            <Sparkline values={facts.values} label="" tone={tone} />
          </span>
        ) : null}
        <span className="progress-row-numbers">
          <span className="progress-row-value">
            {facts ? facts.value : prescription}
            {facts?.unit ? <span className="progress-row-unit">{facts.unit}</span> : null}
          </span>
          {facts?.change ? <span className="progress-row-change">{facts.change}</span> : null}
        </span>
      </span>
    </button>
  )
}

/**
 * Every lift as one ledger row (study §1.7), in Plan order -- a lift in two Workouts once -- then
 * the lifts not in the Program, under a column head (`Est. strength` · `Change`).
 */
export function LiftsList({ model, onOpen }: { model: ProgressModel; onOpen(id: string): void }): JSX.Element {
  const seen = new Set<string>()
  const ids: string[] = []
  for (const w of model.data.program.workouts) {
    if (w.hidden) continue
    for (const e of w.exercises) {
      if (!seen.has(e.exerciseId)) {
        seen.add(e.exerciseId)
        ids.push(e.exerciseId)
      }
    }
  }
  for (const id of model.order) if (!seen.has(id)) ids.push(id)
  return (
    <>
      <p className="progress-ledger-head" aria-hidden="true">
        <span>Est. strength</span>
        <span>Change</span>
      </p>
      <ul className="progress-rows" aria-label="Lifts">
        {ids.map((id) => (
          <li key={id}>
            <LiftRow model={model} id={id} onOpen={onOpen} />
          </li>
        ))}
      </ul>
    </>
  )
}

type StripSlot = 'a' | 'b' | 'other' | 'empty' | 'next-a' | 'next-b' | 'next-other'

/**
 * The weeks strip (study §1.7): the last 6 weeks as columns of Session marks in the Workouts' own
 * colours (the first Workout A, the second B), an empty slot for each planned Session not done,
 * and this week's planned Sessions still to come as hollow marks in the next Workout's colour.
 */
function WeeksStrip({ model }: { model: ProgressModel }): JSX.Element | null {
  const { data, now } = model
  const live = data.sessions.filter((s) => s.deletedAt === undefined && s.finishedAt !== null)
  const weeks = weeksOf(live, now, data.weekStart).slice(-STRIP_WEEKS)
  if (weeks.length === 0) return null
  const workouts = data.program.workouts.filter((w) => !w.hidden)
  const toneOf = (workoutId: string): 'a' | 'b' | 'other' => {
    const at = workouts.findIndex((w) => w.id === workoutId)
    return at === 0 ? 'a' : at === 1 ? 'b' : 'other'
  }
  const latest = [...live].sort((a, b) => b.startedAt - a.startedAt)[0]
  let nextAt = latest ? workouts.findIndex((w) => w.id === latest.workoutId) + 1 : 0
  const nextSlot = (): StripSlot => {
    const at = nextAt % workouts.length
    nextAt += 1
    return at === 0 ? 'next-a' : at === 1 ? 'next-b' : 'next-other'
  }
  const per = Math.max(1, data.program.sessionsPerWeek)
  const total = weeks.reduce((sum, w) => sum + w.sessions.length, 0)
  const columns = weeks.map((week) => {
    const slots: StripSlot[] = week.sessions.map((s) => toneOf(s.workoutId))
    while (slots.length < per) slots.push(week.inProgress && workouts.length > 0 ? nextSlot() : 'empty')
    return { start: week.start, slots, done: week.sessions.length }
  })
  const label = `${plural(total, 'session')} in ${plural(weeks.length, 'week')}. ${columns
    .map((c) => `Week of ${dayMonth(c.start)}: ${c.done}`)
    .join('; ')}.`
  return (
    <section className="progress-weeks" aria-label="Weeks">
      <div className="progress-weeks-strip" role="img" aria-label={label}>
        {columns.map((c) => (
          <span key={c.start} className="progress-week">
            {c.slots.map((slot, i) => (
              <span key={i} className="progress-week-mark" data-slot={slot} />
            ))}
            <span className="progress-week-day">{new Date(c.start).getDate()}</span>
          </span>
        ))}
      </div>
      <p className="progress-weeks-count" aria-hidden="true">
        <span className="progress-weeks-total">{plural(total, 'session')}</span>
        <span className="progress-weeks-span">{`in ${plural(weeks.length, 'week')}`}</span>
      </p>
    </section>
  )
}

/**
 * The Muscles row's subline (§6.2, V6-06), always drawn: the one muscle furthest from the typical
 * weekly range on the Muscles page's 2-week average, with its unit, or that all are within it, or
 * that there were no Sets.
 */
export function musclesLine(model: ProgressModel): string {
  const { data, now } = model
  const avg = windowAverage(data.sessions, now, data.resolve, data.library, undefined, data.weekStart)
  const planned = plannedPerWeek(data.program, data.resolve, data.library)
  const rows = STATS_MUSCLES.map((muscle) => ({
    muscle,
    sets: Math.round(avg.get(muscle) ?? 0),
    plan: Math.round(planned.get(muscle) ?? 0),
  }))
  if (avg.size === 0 || rows.every((r) => r.sets === 0)) return 'No sets in the last 2 weeks'
  // V6-19: a low the plan itself sets, met, is "as planned" on the Muscles page: never the one named.
  const off = ({ sets, plan }: { sets: number; plan: number }) =>
    sets > WEEKLY_SET_RANGE.max
      ? sets - WEEKLY_SET_RANGE.max
      : sets < WEEKLY_SET_RANGE.min && sets !== plan
        ? WEEKLY_SET_RANGE.min - sets
        : 0
  const worst = rows.reduce((a, b) => (off(b) > off(a) ? b : a))
  if (off(worst) === 0) {
    const low = rows.some((r) => r.sets > 0 && r.sets < WEEKLY_SET_RANGE.min)
    return `All within ${WEEKLY_SET_RANGE.min}–${WEEKLY_SET_RANGE.max} sets a week${low ? ', or as planned' : ''}`
  }
  const side = worst.sets > WEEKLY_SET_RANGE.max ? 'above' : 'below'
  return `${muscleLabel(worst.muscle)} ${side} the typical range (${worst.sets} sets/week)`
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** `15 Oct` for a `YYYY-MM-DD` day. */
function dayText(day: string): string {
  const [, m, d] = day.split('-').map(Number)
  return `${d} ${MONTHS[m - 1]}`
}

type HomeProps = ProgressPageProps<'home'> & {
  navigate?: (to: AppRoute) => void
  /** The clock; `Date.now` unless a test fixes it. */
  now?: () => number
}

/**
 * The Progress tab's own screen (study §1.7, v7): a phase for reading, not deciding. The headline
 * count of moving lifts and one sentence on the exceptions, the weeks strip in the Workouts'
 * colours, every lift as one ledger row, then Muscles and Body as quiet rows. Decisions (Swap,
 * add load) live on Program and Train; there are no cards and no Last week table here.
 */
export function Home({ push, navigate, now = Date.now }: HomeProps): JSX.Element {
  const loaded = useServiceData(loadProgress, ['programs', 'sessions', 'preferences'])
  const at = now()
  const model = loaded.status === 'ready' && loaded.data ? progressModel(loaded.data, at) : null
  const open = (exerciseId: string) => push({ kind: 'lift', exerciseId })
  const start = () => navigate?.({ tab: 'workout' })

  if (!model) return <AppShell title="Progress">{null}</AppShell>
  const { copy, data } = model
  const latestWeight = bodyweightOn(data.bodyLog, at)
  const headline = copy.stage === 'full' ? headlineOf(model) : null

  return (
    <AppShell title="Progress" actions={<span className="progress-date">{humanDate(at)}</span>}>
      <div className="progress-home">
        {copy.stage === 'empty' ? (
          <>
            <ul className="progress-expect">
              {copy.expectations.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <button type="button" className="btn-primary progress-start" onClick={start}>
              Start workout
            </button>
          </>
        ) : null}

        {copy.stage === 'starting' || copy.stage === 'early' ? (
          <>
            {copy.sentence ? <p className="progress-sentence">{copy.sentence}</p> : null}
            <ul className="progress-rows">
              {copy.startingPoints.map((p) => (
                <li key={p.exerciseId}>
                  <button type="button" className="btn-quiet progress-row" onClick={() => open(p.exerciseId)}>
                    <span className="progress-row-main">
                      <span className="progress-row-name">{p.name}</span>
                      {p.note ? <span className="progress-row-note">{p.note}</span> : null}
                    </span>
                    <span className="progress-row-value">{p.value}</span>
                  </button>
                </li>
              ))}
            </ul>
            <button type="button" className="btn-primary progress-start" onClick={start}>
              Start workout
            </button>
          </>
        ) : null}

        {headline ? (
          <>
            <header className="progress-headline">
              <p className="progress-eyebrow">{`Since ${dayMonth(at - LEDGER_SPAN)} · ${LEDGER_WEEKS} weeks`}</p>
              <h2 className="progress-title">{headline.title}</h2>
              {headline.exceptions ? <p className="progress-exceptions">{headline.exceptions}</p> : null}
            </header>

            <WeeksStrip model={model} />

            <section className="progress-lifts" aria-label="Lifts">
              <LiftsList model={model} onOpen={open} />
            </section>
          </>
        ) : null}

        {copy.stage === 'empty' ? null : (
          <nav className="progress-links" aria-label="More">
            <button type="button" className="btn-quiet progress-link" onClick={() => push({ kind: 'muscles' })}>
              <span className="progress-link-main">
                <span className="progress-link-title">Muscles</span>
                <span className="progress-link-sub">{musclesLine(model)}</span>
              </span>
              <Icon name="ChevronRight" size={20} />
            </button>
            <button type="button" className="btn-quiet progress-link" onClick={() => push({ kind: 'body' })}>
              <span className="progress-link-main">
                <span className="progress-link-title">Body</span>
                <span className="progress-link-sub">
                  {latestWeight ? `${latestWeight.kg} kg · ${dayText(latestWeight.day)}` : 'Log your bodyweight'}
                </span>
              </span>
              <Icon name="ChevronRight" size={20} />
            </button>
          </nav>
        )}
      </div>
    </AppShell>
  )
}
