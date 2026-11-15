import { useState } from 'react'
import { resolveExercise } from '../../data/resolve'
import { bodyweightOn } from '../../domain/bodyLog'
import { applyBodyweight } from '../../domain/bodyweight'
import type { Resolve } from '../../domain/muscles'
import { visiblePrograms } from '../../domain/programs'
import { homeCopy, humanDate } from '../../domain/stats/copy'
import type { AttentionCard, HomeCopy } from '../../domain/stats/copy'
import { buildLiftHistories } from '../../domain/stats/liftHistory'
import type { LiftHistory } from '../../domain/stats/liftHistory'
import { liftStatuses } from '../../domain/stats/status'
import type { LiftStatus, LiftStatusKind } from '../../domain/stats/status'
import { topText } from '../../domain/stats/words'
import { STATS_MUSCLES, plannedPerWeek, windowAverage } from '../../domain/stats/muscles'
import { muscleLabel } from '../../domain/muscleLabels'
import { WEEKLY_SET_RANGE } from '../../domain/setRange'
import { lastWeekCard } from '../../domain/stats/weekCard'
import type { LastWeekCard } from '../../domain/stats/weekCard'
import type { Weekday } from '../../domain/stats/weeks'
import type { Services } from '../../services'
import type { BodyLog, Exercise, ExercisePlan, LibraryExercise, Program, Session } from '../../types'
import { AppShell } from '../../ui/AppShell'
import { Sparkline } from '../../ui/charts/Sparkline'
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
const FOUR_WEEKS = 28 * DAY
const THREE_MONTHS = 92 * DAY

/** The colour family a status is drawn in: a decision, moving, or neither. */
export function statusTone(kind: LiftStatusKind): 'decide' | 'up' | 'calm' {
  if (kind === 'moving') return 'up'
  return kind === 'too new' ? 'calm' : 'decide'
}

const kgText = (n: number): string => String(Math.round(n * 100) / 100)

/** A lift name that never breaks at its hyphens (`Hyper-/extension`): non-breaking hyphens. */
export const unbroken = (name: string): string => name.replace(/-/g, '‑')

/**
 * One Lifts row's numbers (§6.2): the latest top set, the 4-week change of the top-set weight
 * (`+5 kg`, `same`, `−1.25 kg`; reps on a plain Bodyweight lift), and the top-set weight over 3
 * months for the sparkline. Deload Sessions are left out.
 */
export function rowFacts(
  model: ProgressModel,
  id: string,
): { value: string; change: string | null; values: number[] } | null {
  const history = model.histories.get(id)
  if (!history) return null
  const real = history.points.filter((p) => !p.deload && p.top !== null) as (LiftHistory['points'][number] & {
    top: { lever: number; reps: number }
  })[]
  const latest = real[real.length - 1]
  if (!latest) return null
  const plain = history.bodyweight && real.every((p) => p.top.lever === 0)
  const measure = (p: (typeof real)[number]) => (plain ? p.top.reps : p.top.lever)
  const first = real.find((p) => p.startedAt >= model.now - FOUR_WEEKS)
  let change: string | null = null
  if (first && first !== latest) {
    const d = Math.round((measure(latest) - measure(first)) * 100) / 100
    if (d === 0) change = 'same'
    else if (plain) change = `${d > 0 ? '+' : '−'}${Math.abs(d)} ${Math.abs(d) === 1 ? 'rep' : 'reps'}`
    else if (history.bodyweight && latest.top.lever < 0) change = `${d > 0 ? '−' : '+'}${kgText(Math.abs(d))} kg assist`
    else change = `${d > 0 ? '+' : '−'}${kgText(Math.abs(d))} kg`
  }
  const recent = real.filter((p) => p.startedAt >= model.now - THREE_MONTHS)
  return {
    value: topText(latest.top, history.bodyweight),
    change,
    values: (recent.length > 0 ? recent : [latest]).map(measure),
  }
}

/**
 * One lift as a row (§6.2): name (wraps) and status on the left, a 96 × 28 sparkline of its
 * top-set weight over 3 months, then the latest top set and its 4-week change. The whole row
 * opens the Lift page; its accessible name reads every value.
 */
export function LiftRow({ model, id, onOpen }: { model: ProgressModel; id: string; onOpen(id: string): void }): JSX.Element {
  const name = model.nameOf(id)
  const status = model.statuses.get(id)
  const facts = rowFacts(model, id)
  const plan = model.plans.get(id)
  const prescription = plan ? `${plan.sets} × ${plan.repRange[0]}–${plan.repRange[1]}` : ''
  const label = [
    `${name}: ${status ? status.label : 'not logged yet'}`,
    facts ? `latest top set ${facts.value}${facts.change ? `, ${facts.change} in 4 weeks` : ''}` : prescription,
  ].join('. ')
  return (
    <button type="button" className="btn-quiet progress-row" aria-label={label} onClick={() => onOpen(id)}>
      <span className="progress-row-main">
        <span className="progress-row-name">{unbroken(name)}</span>
        <span className={`progress-row-note progress-status-${status ? statusTone(status.kind) : 'calm'}`}>
          {status ? `${status.glyph} ${status.label}` : 'Not logged yet'}
        </span>
      </span>
      {facts && facts.values.length > 1 ? (
        <span className="progress-row-spark" aria-hidden="true">
          <Sparkline values={facts.values} label="" width={96} height={28} />
        </span>
      ) : null}
      <span className="progress-row-numbers" aria-hidden="true">
        <span className="progress-row-value">{facts ? facts.value : prescription}</span>
        {facts?.change ? <span className="progress-row-change">{facts.change}</span> : null}
      </span>
    </button>
  )
}

/**
 * Every Program lift as a row, grouped by Workout in Plan order (§6.2); a lift in two Workouts
 * is listed under the first. Lifts not in the Program follow under "Other lifts".
 */
export function LiftsList({ model, onOpen }: { model: ProgressModel; onOpen(id: string): void }): JSX.Element {
  const seen = new Set<string>()
  const groups = model.data.program.workouts
    .filter((w) => !w.hidden)
    .map((w) => ({
      name: w.name,
      ids: w.exercises.map((e) => e.exerciseId).filter((id) => (seen.has(id) ? false : (seen.add(id), true))),
    }))
  const other = model.order.filter((id) => !seen.has(id))
  if (other.length > 0) groups.push({ name: 'Other lifts', ids: other })
  return (
    <>
      {groups
        .filter((g) => g.ids.length > 0)
        .map((g) => (
          <div key={g.name} className="progress-lift-group">
            <h3 className="progress-group-title">{g.name}</h3>
            <ul className="progress-rows" aria-label={g.name}>
              {g.ids.map((id) => (
                <li key={id}>
                  <LiftRow model={model} id={id} onOpen={onOpen} />
                </li>
              ))}
            </ul>
          </div>
        ))}
    </>
  )
}

/**
 * One "Needs a decision" card (§6.2): the lift's name (wraps), its status, the visible evidence
 * line (with the Session note when there is one), the one action, a Swap link when the action is
 * a change of exercise, and Why?. Every word is the lift's `liftStatus`, so the card, the list and
 * the Lift page say the same thing; nothing is hidden from sighted readers (V6-07).
 */
function Card({
  model,
  card,
  onOpen,
  onSwap,
}: {
  model: ProgressModel
  card: AttentionCard
  onOpen(id: string): void
  onSwap?: (id: string) => void
}): JSX.Element {
  const [open, setOpen] = useState(false)
  const name = model.nameOf(card.exerciseId)
  return (
    <section className="card progress-card" aria-label={name}>
      <button type="button" className="btn-quiet progress-card-open" onClick={() => onOpen(card.exerciseId)}>
        <span className="progress-card-head">
          <span className="progress-card-name">{unbroken(name)}</span>
          <span className={`progress-card-kind progress-status-${statusTone(card.kind)}`}>{`${card.glyph} ${card.label}`}</span>
        </span>
        <span className="progress-card-fact">{card.evidence}</span>
      </button>
      <p className="progress-card-suggestion">{card.suggestion}</p>
      <div className="progress-card-foot">
        {card.swap && onSwap ? (
          <button type="button" className="btn-quiet progress-why" onClick={() => onSwap(card.exerciseId)}>
            Swap ›
          </button>
        ) : (
          <span />
        )}
        <button type="button" className="btn-quiet progress-why" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          {open ? 'Hide' : 'Why?'}
        </button>
      </div>
      {open ? (
        <ul className="progress-why-lines">
          {card.why.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      ) : null}
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

/** `10–16 Oct`, or `28 Sep–4 Oct` across a month. */
function rangeText(startMs: number, endExclusive: number): string {
  const a = new Date(startMs)
  const b = new Date(endExclusive)
  b.setDate(b.getDate() - 1)
  const to = `${b.getDate()} ${MONTHS[b.getMonth()]}`
  return a.getMonth() === b.getMonth() ? `${a.getDate()}–${to}` : `${a.getDate()} ${MONTHS[a.getMonth()]}–${to}`
}

const thousands = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')

function diffText(last: number, before: number): string {
  const d = last - before
  return d === 0 ? 'same' : d > 0 ? `+${d}` : `−${-d}`
}

function percentText(last: number, before: number): string {
  if (last === before) return 'same'
  if (before === 0) return ''
  const p = Math.round(((last - before) / before) * 100)
  return p === 0 ? 'same' : p > 0 ? `+${p} %` : `−${-p} %`
}

/** `15 Oct` for a `YYYY-MM-DD` day. */
function dayText(day: string): string {
  const [, m, d] = day.split('-').map(Number)
  return `${d} ${MONTHS[m - 1]}`
}

/** Last week (§6.2): Sessions, Sets and Volume; the PRs row waits for the shared PR rule. */
function LastWeek({ card }: { card: LastWeekCard }): JSX.Element {
  const { last, before } = card
  const first = before.sessions === 0
  const rows: { label: string; value: string; change: string }[] = [
    { label: 'Sessions', value: String(last.sessions), change: diffText(last.sessions, before.sessions) },
    { label: 'Sets', value: String(last.sets), change: diffText(last.sets, before.sets) },
    { label: 'Volume', value: `${thousands(last.volumeKg)} kg`, change: percentText(last.volumeKg, before.volumeKg) },
  ]
  return (
    <section className="card progress-tile progress-lastweek" aria-label="Last week">
      <p className="progress-tile-title">
        <span>Last week</span> <span className="progress-lastweek-dates">{rangeText(card.start, card.end)}</span>
      </p>
      <ul className="progress-lastweek-rows">
        {rows.map((r) => (
          <li key={r.label} className="progress-lastweek-row">
            <span className="progress-lastweek-label">{r.label}</span>
            <span className="progress-lastweek-value">{r.value}</span>
            {first ? null : <span className="progress-lastweek-change">{r.change}</span>}
          </li>
        ))}
      </ul>
      {first ? <p className="progress-lastweek-first">First week on record</p> : null}
    </section>
  )
}

type HomeProps = ProgressPageProps<'home'> & {
  navigate?: (to: AppRoute) => void
  /** The clock; `Date.now` unless a test fixes it. */
  now?: () => number
}

/**
 * The Progress tab's own screen (§6.2): one true headline, at most 4 "Needs a decision" cards, every
 * lift as a row grouped by Workout (this list replaces All lifts), last week, Muscles, Body.
 */
export function Home({ push, navigate, now = Date.now }: HomeProps): JSX.Element {
  const loaded = useServiceData(loadProgress, ['programs', 'sessions', 'preferences'])
  const at = now()
  const model = loaded.status === 'ready' && loaded.data ? progressModel(loaded.data, at) : null
  const open = (exerciseId: string) => push({ kind: 'lift', exerciseId })
  const start = () => navigate?.({ tab: 'workout' })

  if (!model) return <AppShell title="Progress">{null}</AppShell>
  const { copy, data } = model
  const lastWeek = lastWeekCard(data.sessions, at, data.resolve, (id) => model.plans.get(id), data.weekStart, data.bodyLog)
  const weekCard = lastWeek ? <LastWeek card={lastWeek} /> : null
  const latestWeight = bodyweightOn(data.bodyLog, at)
  // Swap: the Exercises tab on the lift's primary muscles, to pick a variation.
  const swap = navigate
    ? (id: string) => {
        const libraryId = data.resolve(id)?.libraryId
        const muscles = (libraryId ? data.library.get(libraryId)?.primaryMuscles : undefined) ?? []
        navigate({ tab: 'exercises', muscles })
      }
    : undefined

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
            {weekCard}
            <button type="button" className="btn-primary progress-start" onClick={start}>
              Start workout
            </button>
          </>
        ) : null}

        {copy.stage === 'full' ? (
          <>
            <p className="progress-sentence progress-lead">{copy.lead}</p>

            {copy.cards.length > 0 ? (
              <section className="progress-section" aria-label="Needs a decision">
                <div className="progress-cards">
                  {copy.cards.map((card) => (
                    <Card key={card.exerciseId} model={model} card={card} onOpen={open} onSwap={swap} />
                  ))}
                </div>
                {copy.moreDecisions > 0 ? <p className="progress-more">{`${copy.moreDecisions} more in Lifts`}</p> : null}
              </section>
            ) : null}

            <section className="card progress-lifts" aria-labelledby="progress-lifts-title">
              <div className="progress-lifts-head">
                <h2 id="progress-lifts-title" className="progress-section-title">
                  Lifts
                </h2>
                <span className="progress-lifts-unit">top set · 4 weeks</span>
              </div>
              <LiftsList model={model} onOpen={open} />
            </section>

            {weekCard}
          </>
        ) : null}

        {copy.stage === 'empty' ? null : (
          <>
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
          </>
        )}
      </div>
    </AppShell>
  )
}
