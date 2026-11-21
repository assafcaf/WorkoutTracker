import { resolveExercise } from '../../data/resolve'
import { bodyweightOn } from '../../domain/bodyLog'
import { applyBodyweight } from '../../domain/bodyweight'
import type { Resolve } from '../../domain/muscles'
import { visiblePrograms } from '../../domain/programs'
import { homeCopy } from '../../domain/stats/copy'
import type { HomeCopy } from '../../domain/stats/copy'
import { buildLiftHistories } from '../../domain/stats/liftHistory'
import type { LiftHistory } from '../../domain/stats/liftHistory'
import { changeSince, changeTextFor, measureOf, storyPoints } from '../../domain/stats/liftStory'
import type { Measure } from '../../domain/stats/liftStory'
import { daysOff, liftStatuses } from '../../domain/stats/status'
import type { LiftStatus } from '../../domain/stats/status'
import { dayMonth, leverText, plural } from '../../domain/stats/words'
import { STATS_MUSCLES, windowAverage } from '../../domain/stats/muscles'
import { muscleLabel } from '../../domain/muscleLabels'
import { WEEKLY_SET_RANGE, weeklyStanding } from '../../domain/setRange'
import type { Weekday } from '../../domain/stats/weeks'
import type { Services } from '../../services'
import type { BodyLog, Exercise, ExercisePlan, LibraryExercise, Muscle, Program, Session } from '../../types'
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
 * A status as a ledger row says it (study §1.7), always leading with the one status word (DX-03):
 * `Ready · 15 kg` on a Ready lift with a load to go to, `Flat since 7 Aug` on a Flat one, else the
 * word (`Moving`, `Lowered`).
 */
export function statusWords(status: LiftStatus, bodyweight: boolean): string {
  if (status.kind === 'ready' && !status.swap && status.next) return `Ready · ${leverText(status.next.lever, bodyweight)}`
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
  // V7R-14: back after a Break every judged lift is on it. One sentence, as Home's "As you left
  // them" says it -- no "0 of 14 moving", and no "<lift> has had 33 days off" per lift.
  const judged = all.filter((s) => s.kind !== 'too new')
  if (judged.length > 0 && judged.every((s) => s.kind === 'break')) {
    // The trainee's days off, as Home and the workout page say them (V7R-03).
    const days = daysOff(model.data.sessions, model.now) ?? Math.min(...judged.map((s) => s.daysOff ?? 21))
    return { title: 'As you left them', exceptions: `Back after ${days} days off.` }
  }
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
    status && words?.startsWith(status.label)
      ? `${name}: ${words}`
      : `${name}: ${status ? status.label : 'not logged yet'}${words && words !== status?.label ? `, ${words.toLowerCase()}` : ''}`,
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

/** The statuses that ask the trainee for a decision on Progress (DX-03): Flat first, then Ready. */
const DECISION_ORDER: LiftStatus['kind'][] = ['stalled', 'ready']

/**
 * Every lift once, in Plan order -- a lift in two Workouts once -- then the lifts not in the
 * Program. With `group`, the lifts whose status calls for a decision (Flat, then Ready) come
 * first under "Needs a decision (N)", and the rest under "Other lifts" (DX-03).
 */
export function LiftsList({
  model,
  onOpen,
  group = false,
}: {
  model: ProgressModel
  onOpen(id: string): void
  group?: boolean
}): JSX.Element {
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
  const rank = (id: string): number => DECISION_ORDER.indexOf(model.statuses.get(id)?.kind ?? 'moving')
  const decide = group ? ids.filter((id) => rank(id) >= 0).sort((a, b) => rank(a) - rank(b)) : []
  const rest = ids.filter((id) => !decide.includes(id))
  const list = (shown: string[], label: string): JSX.Element => (
    <ul className="progress-rows" aria-label={label}>
      {shown.map((id) => (
        <li key={id}>
          <LiftRow model={model} id={id} onOpen={onOpen} />
        </li>
      ))}
    </ul>
  )
  if (decide.length === 0) return list(rest, 'Lifts')
  return (
    <>
      <h3 className="progress-subhead">{`Needs a decision (${decide.length})`}</h3>
      {list(decide, 'Needs a decision')}
      {rest.length > 0 ? (
        <>
          <h3 className="progress-subhead">Other lifts</h3>
          {list(rest, 'Other lifts')}
        </>
      ) : null}
    </>
  )
}

/** `Shoulders`, `Abs and Calves`, `3 muscles`: the muscles one side of the range names. */
function muscleNames(muscles: Muscle[]): string {
  if (muscles.length > 2) return `${muscles.length} muscles`
  return muscles.map(muscleLabel).join(' and ')
}

/**
 * The Muscles row's verdict (DX-03, DX-12): the muscles whose 2-week average sits outside the
 * Weekly set range, judged as the Muscles page judges each row (`weeklyStanding`), so both say
 * the same thing: `Shoulders above range`, `Shoulders above · Abs and Calves below range`, or
 * `All within 10–20 sets a week`. The plan does not excuse a low count: one range, one verdict.
 */
export function musclesLine(model: ProgressModel): string {
  const { data, now } = model
  const avg = windowAverage(data.sessions, now, data.resolve, data.library, undefined, data.weekStart)
  if (avg.size === 0 || STATS_MUSCLES.every((m) => Math.round(avg.get(m) ?? 0) === 0)) return 'No sets in the last 2 weeks'
  const above = STATS_MUSCLES.filter((m) => weeklyStanding(avg.get(m) ?? 0) === 'above')
  const below = STATS_MUSCLES.filter((m) => weeklyStanding(avg.get(m) ?? 0) === 'below')
  if (above.length === 0 && below.length === 0) return `All within ${WEEKLY_SET_RANGE.min}–${WEEKLY_SET_RANGE.max} sets a week`
  const parts = [
    above.length > 0 ? `${muscleNames(above)} above` : null,
    below.length > 0 ? `${muscleNames(below)} below` : null,
  ].filter((p): p is string => p !== null)
  return `${parts.join(' · ')} range`
}

/** `84.1 kg, −2.3 kg`: the latest bodyweight and its change since the first one logged. */
export function bodyLine(log: BodyLog, at: number): string | null {
  const latest = bodyweightOn(log, at)
  if (!latest) return null
  const first = log.find((e) => e.weightKg !== undefined)
  const delta = first?.weightKg === undefined ? 0 : Math.round((latest.kg - first.weightKg) * 10) / 10
  if (!first || first.day === latest.day || delta === 0) return `${latest.kg} kg`
  return `${latest.kg} kg, ${delta > 0 ? '+' : '−'}${Math.abs(delta).toFixed(1)} kg`
}

/** `30 Sessions`, `1 Session`: the Session count in CONTEXT.md's word. */
const sessionsText = (n: number): string => `${n} ${n === 1 ? 'Session' : 'Sessions'}`

type HomeProps = ProgressPageProps<'home'> & {
  navigate?: (to: AppRoute) => void
  /** The clock; `Date.now` unless a test fixes it. */
  now?: () => number
}

/**
 * The Progress tab's own screen (DX-02, DX-03, DX-12): am I getting stronger? The headline count
 * of moving lifts, one sentence on the exceptions and a grey meta line (`Since 23 Jul · 30
 * Sessions`); then Muscles and Body as two rows; then every lift as one ledger row, the ones that
 * need a decision first. No calendar (Sessions owns it), no date, no Photos row (Photos is a
 * section of Body).
 */
export function Home({ push, navigate, now = Date.now }: HomeProps): JSX.Element {
  const loaded = useServiceData(loadProgress, ['programs', 'sessions', 'preferences'])
  const at = now()
  const model = loaded.status === 'ready' && loaded.data ? progressModel(loaded.data, at) : null
  const open = (exerciseId: string) => push({ kind: 'lift', exerciseId })
  const goTrain = () => navigate?.({ tab: 'workout' })

  if (!model) return <AppShell title="Progress">{null}</AppShell>
  const { copy, data } = model

  if (copy.stage === 'empty') {
    // DX-21: one line and one action.
    return (
      <AppShell title="Progress">
        <div className="progress-home progress-empty">
          <p className="progress-empty-line">Your lifts appear here after your first Session.</p>
          <button type="button" className="btn-secondary progress-start" onClick={goTrain}>
            Go to Train
          </button>
        </div>
      </AppShell>
    )
  }

  const headline = copy.stage === 'full' ? headlineOf(model) : null
  const since = at - LEDGER_SPAN
  const inWindow = data.sessions.filter((s) => s.deletedAt === undefined && s.finishedAt !== null && s.startedAt >= since).length
  const body = bodyLine(data.bodyLog, at)
  const links = (
    <nav className="progress-links" aria-label="More">
      <button
        type="button"
        className="btn-quiet progress-link"
        aria-label={`Muscles · ${musclesLine(model)}`}
        onClick={() => push({ kind: 'muscles' })}
      >
        <span className="progress-link-title">Muscles</span>
        <span className="progress-link-sub">{musclesLine(model)}</span>
        <Icon name="ChevronRight" size={20} />
      </button>
      <button
        type="button"
        className="btn-quiet progress-link"
        aria-label={`Body · ${body ?? 'Log your bodyweight'}`}
        onClick={() => push({ kind: 'body' })}
      >
        <span className="progress-link-title">Body</span>
        <span className="progress-link-sub">{body ?? 'Log your bodyweight'}</span>
        <Icon name="ChevronRight" size={20} />
      </button>
    </nav>
  )

  // N6: with a verdict, the headline is the page title ("12 of 14 lifts are moving"), its
  // exceptions and the meta line under it; the tab bar already says "Progress".
  return (
    <AppShell
      title={headline ? headline.title : 'Progress'}
      subtitle={
        headline ? (
          <>
            {headline.exceptions ? <p className="progress-exceptions">{headline.exceptions}</p> : null}
            <p className="progress-meta">{`Since ${dayMonth(since)} · ${sessionsText(inWindow)}`}</p>
          </>
        ) : undefined
      }
    >
      <div className="progress-home">
        {headline ? (
          <>
            {links}
            <section className="progress-lifts" aria-label="Lifts">
              <LiftsList model={model} onOpen={open} group />
            </section>
          </>
        ) : (
          <>
            {copy.sentence ? <p className="progress-sentence">{copy.sentence}</p> : null}
            {links}
            <ul className="progress-rows" aria-label="Lifts">
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
          </>
        )}
      </div>
    </AppShell>
  )
}
