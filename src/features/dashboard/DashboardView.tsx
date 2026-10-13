import { band } from '../../domain/band'
import type { LiftTrend, MuscleWeekRow, WeekTotals } from '../../domain/dashboard'
import type { Muscle } from '../../types'
import { Sparkline } from '../../ui/charts/Sparkline'
import { Icon } from '../../ui/icons'
import './DashboardScreen.css'

/** How the header's second line reads the phone's cloud copy. */
export type DashboardSync =
  | { kind: 'offline' }
  | { kind: 'syncing' }
  | { kind: 'synced'; ago: string }
  | { kind: 'local' }
  | { kind: 'failed' }

/** One Program the new trainee can pick, with each of its workouts' size. */
export type ProgramOption = {
  id: string
  name: string
  summary: string
  workouts: { name: string; summary: string }[]
}

export type DashboardData =
  | { kind: 'loading' }
  | {
      kind: 'no-program'
      options: ProgramOption[]
      selectedId: string | null
      canUse: boolean
      onSelect(id: string): void
      onUse(id: string): void
    }
  | {
      kind: 'ready'
      sessionsPerWeek: number
      thisWeek: WeekTotals
      lastWeek: WeekTotals
      muscles: MuscleWeekRow[]
      gaps: Muscle[]
      lifts: LiftTrend[]
      hint: { name: string; nextWeightKg: number } | null
      due: { workoutId: string; name: string; last: string | null; summary: string } | null
    }

export type DashboardViewProps = {
  /** Today, as `formatDay` reads it: `Tue 13 Oct`. */
  today: string
  sync: DashboardSync
  data: DashboardData
  onSync(): void
  onOpenSettings(): void
  onStartWorkout(workoutId: string): void
}

const MUSCLE_LABELS: Partial<Record<Muscle, string>> = {
  quadriceps: 'Quads',
  abdominals: 'Abs',
  'middle back': 'Mid back',
}

function muscleLabel(muscle: Muscle): string {
  return MUSCLE_LABELS[muscle] ?? muscle.charAt(0).toUpperCase() + muscle.slice(1)
}

/** A set count at a glance: the half sets a secondary muscle earns round to whole ones. */
function count(value: number): string {
  return String(Math.round(value))
}

const kg = (value: number): string => Math.round(value).toLocaleString('en-US')

function delta(value: number | null): string {
  if (value === null) return '—'
  const rounded = Math.round(value * 10) / 10
  if (rounded === 0) return '0.0'
  return `${rounded > 0 ? '+' : '−'}${Math.abs(rounded).toFixed(1)}`
}

function weight(value: number): string {
  return String(Math.round(value * 100) / 100)
}

function SyncLine({ today, sync }: { today: string; sync: DashboardSync }): JSX.Element {
  if (sync.kind === 'offline') {
    return (
      <p className="dashboard-status dashboard-status-offline">
        <Icon name="CloudOff" size={16} />
        Offline · saved on this phone
      </p>
    )
  }
  const tail = {
    syncing: 'Syncing…',
    synced: sync.kind === 'synced' ? `Synced ${sync.ago}` : '',
    local: 'Saved on this phone',
    failed: 'Not synced · saved on this phone',
  }[sync.kind]
  return <p className="dashboard-status">{`${today} · ${tail}`}</p>
}

function Kpi({ label, value, was }: { label: string; value: string; was: string }): JSX.Element {
  return (
    <div className="dashboard-kpi">
      <span className="dashboard-kpi-label">{label}</span>
      <span className="dashboard-kpi-value">{value}</span>
      <span className="dashboard-kpi-was">{`vs ${was}`}</span>
    </div>
  )
}

function MuscleRow({ row }: { row: MuscleWeekRow }): JSX.Element {
  return (
    <div className="dashboard-muscle-row" data-muscle={row.muscle}>
      <span className="dashboard-muscle-name">{muscleLabel(row.muscle)}</span>
      <span className="dashboard-heat" data-band={band(row.done, 'week')}>
        {count(row.done)}
      </span>
      <span className="dashboard-muscle-of">{`of ${count(row.planned)}`}</span>
    </div>
  )
}

const LEGEND = ['0', '1–9', '10–20', '21+']

function MuscleWeek({ rows, gaps }: { rows: MuscleWeekRow[]; gaps: Muscle[] }): JSX.Element {
  const half = Math.ceil(rows.length / 2)
  return (
    <section className="card dashboard-card" aria-labelledby="dashboard-muscle-week">
      <div className="dashboard-card-head">
        <h2 className="dashboard-card-title" id="dashboard-muscle-week">
          Muscle week
        </h2>
        <span className="dashboard-card-note">sets done · of planned</span>
      </div>
      <div className="dashboard-muscles">
        <div className="dashboard-muscle-col">
          {rows.slice(0, half).map((row) => (
            <MuscleRow key={row.muscle} row={row} />
          ))}
        </div>
        <div className="dashboard-muscle-col">
          {rows.slice(half).map((row) => (
            <MuscleRow key={row.muscle} row={row} />
          ))}
        </div>
      </div>
      <div className="dashboard-legend">
        {LEGEND.map((label, index) => (
          <span key={label} className="dashboard-legend-item">
            <i className="dashboard-legend-swatch" data-band={index} />
            {label}
          </span>
        ))}
        <span className="dashboard-legend-unit">sets / week</span>
      </div>
      {gaps.length > 0 ? (
        <div className="dashboard-gaps">
          {/* Two notes fit one line; more read as one list rather than a wall of notes. */}
          {gaps.length <= 2 ? (
            gaps.map((muscle) => <span key={muscle}>{`No direct ${muscle} work`}</span>)
          ) : (
            <span>{`No direct work: ${gaps.map((muscle) => muscleLabel(muscle).toLowerCase()).join(', ')}`}</span>
          )}
        </div>
      ) : null}
    </section>
  )
}

function Lifts({
  lifts,
  hint,
}: {
  lifts: LiftTrend[]
  hint: { name: string; nextWeightKg: number } | null
}): JSX.Element {
  return (
    <section className="card dashboard-card dashboard-lifts" aria-labelledby="dashboard-lifts">
      <div className="dashboard-card-head dashboard-lifts-head">
        <h2 className="dashboard-card-title" id="dashboard-lifts">
          Lifts
        </h2>
        <span className="dashboard-card-note">e1RM, kg · 3 weeks</span>
      </div>
      {hint ? (
        <p className="dashboard-hint">
          <Icon name="ArrowUp" size={16} />
          {`${hint.name} — try ${weight(hint.nextWeightKg)} kg`}
        </p>
      ) : null}
      {lifts.length === 0 ? (
        <p className="dashboard-empty">Your lifts show here after your first workout.</p>
      ) : (
        lifts.map((lift) => (
          <div key={lift.exerciseId} className="dashboard-lift">
            <span className="dashboard-lift-name">{lift.name}</span>
            <Sparkline values={lift.values} label={`${lift.name} e1RM`} />
            <span className="dashboard-lift-value">{lift.latest.toFixed(1)}</span>
            <span className="dashboard-lift-delta">{delta(lift.delta)}</span>
          </div>
        ))
      )}
    </section>
  )
}

function Header({
  today,
  sync,
  onSync,
  onOpenSettings,
}: Pick<DashboardViewProps, 'today' | 'sync' | 'onSync' | 'onOpenSettings'>): JSX.Element {
  return (
    <header className="dashboard-header">
      <div className="dashboard-heading">
        <h1 className="dashboard-title">Dashboard</h1>
        <SyncLine today={today} sync={sync} />
      </div>
      <div className="dashboard-header-actions">
        {sync.kind === 'offline' ? null : (
          <button type="button" className="icon-btn dashboard-icon-btn" aria-label="Sync now" onClick={onSync}>
            <Icon name={sync.kind === 'synced' ? 'CloudCheck' : 'Cloud'} size={22} />
          </button>
        )}
        <button type="button" className="icon-btn dashboard-icon-btn" aria-label="Settings" onClick={onOpenSettings}>
          <Icon name="Settings" size={22} />
        </button>
      </div>
    </header>
  )
}

/**
 * The Dashboard home screen (Progress Dashboard S1, S8): this week against last, the muscle week
 * against the plan, the lifts' e1RM over three weeks, and the workout due with its start button
 * docked at the bottom. With no Program yet it offers the Programs to pick from instead.
 */
export function DashboardView(props: DashboardViewProps): JSX.Element {
  const { data } = props
  const header = <Header {...props} />

  if (data.kind === 'loading') {
    return <div className="dashboard">{header}</div>
  }

  if (data.kind === 'no-program') {
    const selected = data.options.find((option) => option.id === data.selectedId) ?? null
    return (
      <div className="dashboard">
        {header}
        <section className="card dashboard-pick" aria-labelledby="dashboard-pick-title">
          <h2 className="dashboard-pick-title" id="dashboard-pick-title">
            No program yet
          </h2>
          <p className="dashboard-pick-lead">Pick a program to get a plan for every session.</p>
          {data.options.map((option) => (
            <button
              key={option.id}
              type="button"
              className="btn-secondary dashboard-program"
              aria-pressed={option.id === data.selectedId}
              onClick={() => data.onSelect(option.id)}
            >
              <span className="dashboard-program-head">
                <span className="dashboard-program-text">
                  <span className="dashboard-program-name">{option.name}</span>
                  <span className="dashboard-program-summary">{option.summary}</span>
                </span>
                {option.id === data.selectedId ? (
                  <span className="dashboard-program-check">
                    <Icon name="Check" size={14} />
                  </span>
                ) : null}
              </span>
              {option.workouts.map((workout) => (
                <span key={workout.name} className="dashboard-program-workout">
                  <span className="dashboard-program-workout-name">{workout.name}</span>
                  <span className="dashboard-program-workout-size">{workout.summary}</span>
                </span>
              ))}
            </button>
          ))}
        </section>
        <p className="dashboard-new-note">
          Sessions, lifts and muscle balance fill this page after your first workout.
        </p>
        <div className="dashboard-dock">
          <button
            type="button"
            className="btn-primary dashboard-start"
            disabled={!selected || !data.canUse}
            onClick={() => selected && data.onUse(selected.id)}
          >
            {selected ? `Use ${selected.name}` : 'Pick a program'}
          </button>
        </div>
      </div>
    )
  }

  const { thisWeek, lastWeek, due } = data
  return (
    <div className="dashboard">
      {header}
      <div className="dashboard-week-head">
        <h2 className="dashboard-caption">This week</h2>
        <span className="dashboard-card-note">vs last week</span>
      </div>
      <div className="dashboard-kpis">
        <Kpi
          label="Sessions"
          value={`${thisWeek.sessions}/${data.sessionsPerWeek}`}
          was={String(lastWeek.sessions)}
        />
        <Kpi label="Sets" value={String(thisWeek.sets)} was={String(lastWeek.sets)} />
        <Kpi label="Volume, kg" value={kg(thisWeek.volumeKg)} was={kg(lastWeek.volumeKg)} />
      </div>
      <MuscleWeek rows={data.muscles} gaps={data.gaps} />
      <Lifts lifts={data.lifts} hint={data.hint} />
      {due ? (
        <div className="dashboard-dock">
          <p className="dashboard-due">
            <span className="dashboard-due-name">{`${due.name} due`}</span>
            {due.last ? <span className="dashboard-due-last">{` · last ${due.last}`}</span> : null}
          </p>
          <p className="dashboard-due-size">{due.summary}</p>
          <button type="button" className="btn-primary dashboard-start" onClick={() => props.onStartWorkout(due.workoutId)}>
            {`Start ${due.name}`}
          </button>
        </div>
      ) : null}
    </div>
  )
}
