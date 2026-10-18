import { useState } from 'react'
import { resolveExercise } from '../../data/resolve'
import { bodyweightOn } from '../../domain/bodyLog'
import { applyBodyweight } from '../../domain/bodyweight'
import type { Resolve } from '../../domain/muscles'
import { visiblePrograms } from '../../domain/programs'
import { buildLadder } from '../../domain/stats/ladder'
import type { Ladder } from '../../domain/stats/ladder'
import { homeCopy, humanDate, numberText, topText, verdictLabel } from '../../domain/stats/copy'
import type { AttentionCard, HomeCopy } from '../../domain/stats/copy'
import { buildLiftHistories } from '../../domain/stats/liftHistory'
import type { LiftHistory } from '../../domain/stats/liftHistory'
import { plannedPerWeek, windowAverage } from '../../domain/stats/muscles'
import { computeRecords } from '../../domain/stats/records'
import { verdicts } from '../../domain/stats/verdict'
import type { Verdict } from '../../domain/stats/verdict'
import { lastWeekCard } from '../../domain/stats/weekCard'
import type { LastWeekCard } from '../../domain/stats/weekCard'
import { weeksOf } from '../../domain/stats/weeks'
import type { Weekday } from '../../domain/stats/weeks'
import type { Services } from '../../services'
import type { BodyLog, Exercise, ExercisePlan, LibraryExercise, Program, Session } from '../../types'
import { AppShell } from '../../ui/AppShell'
import { Ladder as LadderChart } from '../../ui/charts/Ladder'
import type { LadderView } from '../../ui/charts/ladderView'
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
  verdicts: Map<string, Verdict>
  nameOf(id: string): string
}

export function progressModel(data: ProgressData, now: number): ProgressModel {
  const live = data.sessions.filter((s) => s.deletedAt === undefined)
  const plans = new Map<string, ExercisePlan>()
  const planOrder: string[] = []
  for (const w of data.program.workouts) {
    for (const e of w.exercises) {
      if (!plans.has(e.exerciseId)) planOrder.push(e.exerciseId)
      plans.set(e.exerciseId, e)
    }
  }
  const planOf = (id: string) => plans.get(id)
  const histories = buildLiftHistories(live, data.resolve, planOf)
  const records = computeRecords(live, data.resolve, planOf)
  return {
    data,
    now,
    copy: homeCopy(data.program, data.sessions, data.resolve, now, data.weekStart),
    plans,
    order: [...planOrder, ...[...histories.keys()].filter((id) => !plans.has(id))],
    histories,
    verdicts: verdicts(histories, records, now),
    nameOf: (id) => data.resolve(id)?.name ?? id,
  }
}

/** The 48 px mini ladder's view: treads only, from the engine's ladder. */
function miniView(ladder: Ladder): LadderView {
  const at = (id: string) => ladder.points.find((p) => p.sessionId === id)?.startedAt ?? 0
  const from = ladder.points[0]?.startedAt ?? 0
  const to = ladder.points[ladder.points.length - 1]?.startedAt ?? 0
  return {
    from,
    to,
    axisLabel: null,
    ticks: [],
    treads: ladder.treads.map((t, i) => ({
      lever: t.lever,
      from: at(t.sessionIds[0]),
      to: at(t.sessionIds[t.sessionIds.length - 1]),
      current: i === ladder.treads.length - 1,
    })),
    points: ladder.points.map((p) => ({
      id: p.sessionId,
      at: p.startedAt,
      lever: p.lever,
      reps: p.reps,
      target: p.target,
      deload: p.deload,
      record: false,
      readout: { sessionId: p.sessionId, title: '', workingSets: [], record: null, e1rm: null, warmups: null, note: null },
    })),
    gaps: ladder.gaps.map((g) => ({ from: g.weekStart, to: g.weekStart, label: g.label })),
    dates: [],
  }
}

export function MiniLadder({ model, exerciseId }: { model: ProgressModel; exerciseId: string }): JSX.Element | null {
  const history = model.histories.get(exerciseId)
  if (!history) return null
  const ladder = buildLadder(history, { sessions: model.data.sessions, program: model.data.program }, model.data.weekStart)
  return (
    <div className="progress-mini">
      <LadderChart view={miniView(ladder)} title={model.nameOf(exerciseId)} variant="mini" />
    </div>
  )
}

export function latestTop(model: ProgressModel, exerciseId: string): string | null {
  const history = model.histories.get(exerciseId)
  const real = history?.points.filter((p) => !p.deload && p.top !== null) ?? []
  const top = real[real.length - 1]?.top
  return history && top ? topText(top, history.bodyweight) : null
}

function latestDate(model: ProgressModel, exerciseId: string): string {
  const real = model.histories.get(exerciseId)?.points.filter((p) => !p.deload && p.top !== null) ?? []
  const last = real[real.length - 1]
  return last ? humanDate(last.startedAt) : ''
}

const KIND_LABEL: Record<AttentionCard['kind'], string> = {
  stalled: verdictLabel('stalled'),
  slipping: verdictLabel('slipping'),
  ready: '↑ Ready',
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

function Card({ model, card, onOpen }: { model: ProgressModel; card: AttentionCard; onOpen(id: string): void }): JSX.Element {
  const [open, setOpen] = useState(false)
  const top = latestTop(model, card.exerciseId)
  return (
    <section className="card progress-card" aria-label={model.nameOf(card.exerciseId)}>
      <button type="button" className="btn-quiet progress-card-open" onClick={() => onOpen(card.exerciseId)}>
        <span className="progress-card-name">{model.nameOf(card.exerciseId)}</span>
        <span className="progress-card-kind">{KIND_LABEL[card.kind]}</span>
      </button>
      <p className="progress-card-sentence">{card.sentence}</p>
      <div className="progress-card-chart">
        <MiniLadder model={model} exerciseId={card.exerciseId} />
        {top ? (
          <span className="progress-card-value">
            {top}
            <span className="progress-card-date">{latestDate(model, card.exerciseId)}</span>
          </span>
        ) : null}
      </div>
      <div className="progress-card-foot">
        <p className="progress-card-suggestion">{card.suggestion}</p>
        <button
          type="button"
          className="btn-quiet progress-why"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
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

function DayStrip({ model, onOpenSession }: { model: ProgressModel; onOpenSession(id: string): void }): JSX.Element {
  const week = weeksOf(model.data.sessions, model.now, model.data.weekStart).find((w) => w.inProgress)
  const monday = week?.start ?? 0
  const first = model.data.weekStart
  const todayIndex = (new Date(model.now).getDay() - first + 7) % 7
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const days = names.map((_, i) => names[(first + i) % 7])
  const workoutName = (id: string) =>
    model.data.program.workouts.find((w) => w.id === id)?.name.replace(/^Workout\s+/i, '') ?? ''
  return (
    <ol className="progress-days">
      {days.map((day, i) => {
        const start = new Date(monday)
        const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
        const session = week?.sessions.find((s) => {
          const d = new Date(s.startedAt)
          return d.getFullYear() === date.getFullYear() && d.getMonth() === date.getMonth() && d.getDate() === date.getDate()
        })
        return (
          <li key={day} className={i === todayIndex ? 'progress-day progress-day-today' : 'progress-day'}>
            <span className="progress-day-name">{day}</span>
            {session ? (
              <button
                type="button"
                className="btn-quiet progress-day-done"
                aria-label={`${day} ${workoutName(session.workoutId)}`}
                onClick={() => onOpenSession(session.id)}
              >
                {workoutName(session.workoutId)}
              </button>
            ) : (
              <span className="progress-day-rest" aria-hidden="true" />
            )}
            <span className="progress-day-date">{date.getDate()}</span>
          </li>
        )
      })}
    </ol>
  )
}

function musclesFinding(model: ProgressModel): { line: string; fewest: string } | null {
  const { data, now } = model
  const library = data.library
  const avg = windowAverage(data.sessions, now, data.resolve, library, undefined, data.weekStart)
  if (avg.size === 0) return null
  const planned = plannedPerWeek(data.program, data.resolve, library)
  const rows = [...planned.keys()]
    .filter((m) => avg.has(m) || planned.has(m))
    .map((m) => ({ muscle: m, sets: avg.get(m) ?? 0 }))
    .sort((a, b) => a.sets - b.sets)
    .slice(0, 2)
  return {
    line: 'Muscles',
    fewest: rows.map((r) => `${cap(r.muscle)} ${numberText(r.sets)}`).join(' · '),
  }
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

function LastWeek({ card }: { card: LastWeekCard }): JSX.Element {
  const { last, before } = card
  const first = before.sessions === 0
  const rows: { label: string; value: string; change: string }[] = [
    { label: 'Sessions', value: String(last.sessions), change: diffText(last.sessions, before.sessions) },
    { label: 'Sets', value: String(last.sets), change: diffText(last.sets, before.sets) },
    { label: 'Volume', value: `${thousands(last.volumeKg)} kg`, change: percentText(last.volumeKg, before.volumeKg) },
    { label: 'PRs', value: String(last.prs), change: diffText(last.prs, before.prs) },
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

type HomeProps =ProgressPageProps<'home'> & {
  navigate?: (to: AppRoute) => void
  /** The clock; `Date.now` unless a test fixes it. */
  now?: () => number
}

/** The Progress tab's own screen (O20): verdict, counts, attention cards, then the week and lists. */
export function Home({ push, navigate, now = Date.now }: HomeProps): JSX.Element {
  const loaded = useServiceData(loadProgress, ['programs', 'sessions', 'preferences'])
  const [moving, setMoving] = useState(false)
  const at = now()
  const model = loaded.status === 'ready' && loaded.data ? progressModel(loaded.data, at) : null
  const open = (exerciseId: string) => push({ kind: 'lift', exerciseId })
  const start = () => navigate?.({ tab: 'workout' })

  if (!model) return <AppShell title="Progress">{null}</AppShell>
  const { copy, data } = model
  const movingIds = model.order.filter((id) => model.verdicts.get(id)?.kind === 'moving')
  const lastWeek = lastWeekCard(
    data.sessions,
    at,
    data.resolve,
    (id) => model.plans.get(id),
    data.weekStart,
    data.bodyLog,
  )
  const weekCard = lastWeek ? <LastWeek card={lastWeek} /> : null
  const latestWeight = bodyweightOn(data.bodyLog, at)
  const finding = copy.stage === 'full' ? musclesFinding(model) : null

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
            <p className="progress-sentence">{copy.sentence}</p>
            <ul className="progress-counts" aria-label={copy.counts}>
              {copy.counts.split(' · ').map((part) => {
                const [glyph, n, ...label] = part.split(' ')
                return (
                  <li key={part} className="progress-count">
                    <span className="progress-count-n">{`${glyph} ${n}`}</span>
                    <span className="progress-count-label">{label.join(' ')}</span>
                  </li>
                )
              })}
            </ul>
            <p className="progress-climbed">{copy.climbed}</p>
            <div className="progress-cards">
              {copy.cards.map((card) => (
                <Card key={card.exerciseId + card.kind} model={model} card={card} onOpen={open} />
              ))}
            </div>

            {weekCard}

            <section className="card progress-tile" aria-label="This week">
              <p className="progress-tile-title">{copy.adherence}</p>
              <DayStrip
                model={model}
                onOpenSession={(sessionId) => navigate?.({ tab: 'history', sessionId })}
              />
            </section>

            {finding ? (
              <button type="button" className="btn-quiet progress-link" onClick={() => push({ kind: 'muscles' })}>
                <span className="progress-link-main">
                  <span className="progress-link-title">{finding.line}</span>
                  <span className="progress-link-sub">{finding.fewest}</span>
                </span>
                <Icon name="ChevronRight" size={20} />
              </button>
            ) : null}

            <button
              type="button"
              className="btn-quiet progress-link"
              aria-expanded={moving}
              onClick={() => setMoving((v) => !v)}
            >
              <span className="progress-link-main">
                <span className="progress-link-title">{`${movingIds.length} lifts moving`}</span>
              </span>
              <Icon name="ChevronRight" size={20} />
            </button>
            {moving ? (
              <ul className="progress-rows">
                {movingIds.map((id) => (
                  <li key={id}>
                    <button type="button" className="btn-quiet progress-row" onClick={() => open(id)}>
                      <span className="progress-row-main">
                        <span className="progress-row-name">{model.nameOf(id)}</span>
                        <span className="progress-row-note">{verdictLabel('moving')}</span>
                      </span>
                      <span className="progress-row-value">{latestTop(model, id)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            <button type="button" className="btn-quiet progress-link" onClick={() => push({ kind: 'lifts' })}>
              <span className="progress-link-main">
                <span className="progress-link-title">{`All ${model.order.length} lifts`}</span>
              </span>
              <Icon name="ChevronRight" size={20} />
            </button>
          </>
        ) : null}

        {copy.stage === 'empty' ? null : (
          <button type="button" className="btn-quiet progress-link" onClick={() => push({ kind: 'body' })}>
            <span className="progress-link-main">
              <span className="progress-link-title">Body</span>
              <span className="progress-link-sub">
                {latestWeight ? `${latestWeight.kg} kg · ${dayText(latestWeight.day)}` : 'Log your bodyweight'}
              </span>
            </span>
            <Icon name="ChevronRight" size={20} />
          </button>
        )}
      </div>
    </AppShell>
  )
}
