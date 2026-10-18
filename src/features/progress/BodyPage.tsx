import { useEffect, useState } from 'react'
import { bodySeries, dayOf } from '../../domain/bodyLog'
import { shortDay } from '../../domain/lifts'
import type { BodyEntry, BodyLog, BodyMetric } from '../../types'
import { AppShell } from '../../ui/AppShell'
import { LineChart } from '../../ui/charts/LineChart'
import { Segmented } from '../../ui/controls'
import { Snackbar } from '../../ui/Snackbar'
import type { Services } from '../../services'
import { useServiceData } from '../useServiceData'
import { useServices } from '../ServicesProvider'
import type { ProgressPageProps } from './pages'
import './BodyPage.css'

type MetricInfo = { metric: BodyMetric; label: string; unit: 'kg' | 'cm'; field: string }

const METRICS: MetricInfo[] = [
  { metric: 'weightKg', label: 'Bodyweight', unit: 'kg', field: 'Bodyweight (kg)' },
  { metric: 'waistCm', label: 'Waist', unit: 'cm', field: 'Waist (cm)' },
  { metric: 'chestCm', label: 'Chest', unit: 'cm', field: 'Chest (cm)' },
  { metric: 'armsCm', label: 'Arms', unit: 'cm', field: 'Arms (cm)' },
  { metric: 'thighsCm', label: 'Thighs', unit: 'cm', field: 'Thighs (cm)' },
]
const MEASUREMENTS = METRICS.filter((m) => m.metric !== 'weightKg')

/** The accepted range of each kind of value, as `validateBodyEntry` holds it. */
const rangeOf = (info: MetricInfo): [number, number] => (info.metric === 'weightKg' ? [20, 400] : [10, 300])

const UNDO_MS = 6000

const midnightOf = (day: string): number => {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d).getTime()
}

type Fields = Partial<Record<BodyMetric, string>>

export type BodyViewProps = {
  log: BodyLog
  now: number
  onBack: (() => void) | undefined
  onSave(entry: BodyEntry): Promise<void>
  onDelete(day: string): Promise<void>
}

/** The Body page's drawing: the form, the chart by metric and the entries, over a loaded log. */
export function BodyView({ log, now, onBack, onSave, onDelete }: BodyViewProps): JSX.Element {
  const today = dayOf(now)
  const [day, setDay] = useState(today)
  const [fields, setFields] = useState<Fields>({})
  const [more, setMore] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<BodyMetric | 'day', string>>>({})
  const [chosen, setChosen] = useState<BodyMetric>('weightKg')
  const [removed, setRemoved] = useState<BodyEntry | null>(null)

  useEffect(() => {
    if (!removed) return
    const timer = setTimeout(() => setRemoved(null), UNDO_MS)
    return () => clearTimeout(timer)
  }, [removed])

  const available = METRICS.filter((m) => log.some((e) => e[m.metric] !== undefined))
  const current = available.find((m) => m.metric === chosen) ?? available[0]
  const nowDate = new Date(now)

  const filled = METRICS.filter((m) => (fields[m.metric] ?? '').trim() !== '')

  const save = (): void => {
    const next: typeof errors = {}
    const entry: BodyEntry = { day }
    if (day === '' || day > today) next.day = 'Pick today or an earlier day'
    for (const info of filled) {
      const value = Number(fields[info.metric])
      const [lo, hi] = rangeOf(info)
      if (!Number.isFinite(value) || value < lo || value > hi) {
        next[info.metric] = `Enter ${lo}–${hi} ${info.unit}`
      } else {
        entry[info.metric] = value
      }
    }
    setErrors(next)
    if (Object.keys(next).length > 0) return
    onSave(entry).then(
      () => setFields({}),
      () => setErrors({ day: 'Could not save the entry' }),
    )
  }

  const remove = (entry: BodyEntry): void => {
    setRemoved(entry)
    void onDelete(entry.day)
  }
  const undo = (): void => {
    if (!removed) return
    const entry = removed
    setRemoved(null)
    void onSave(entry)
  }

  const input = (info: MetricInfo): JSX.Element => (
    <label className="body-field" key={info.metric}>
      <span className="body-field-label">{info.field}</span>
      <input
        className="body-input"
        type="number"
        inputMode="decimal"
        step="0.1"
        value={fields[info.metric] ?? ''}
        onChange={(event) => setFields({ ...fields, [info.metric]: event.target.value })}
      />
      {errors[info.metric] ? (
        <span className="body-error" role="alert">
          {errors[info.metric]}
        </span>
      ) : null}
    </label>
  )

  const describe = (entry: BodyEntry): string =>
    METRICS.filter((m) => entry[m.metric] !== undefined)
      .map((m) => (m.metric === 'weightKg' ? `${entry.weightKg} kg` : `${m.label.toLowerCase()} ${entry[m.metric]} cm`))
      .join(' · ')

  return (
    <AppShell
      title="Body"
      onBack={onBack}
      action={
        <button type="button" className="btn-primary" disabled={filled.length === 0} onClick={save}>
          Save
        </button>
      }
    >
      <div className="body-page">
        <section className="body-form" aria-label="Log">
          <label className="body-field">
            <span className="body-field-label">Date</span>
            <input
              className="body-input"
              type="date"
              value={day}
              max={today}
              onChange={(event) => setDay(event.target.value)}
            />
            {errors.day ? (
              <span className="body-error" role="alert">
                {errors.day}
              </span>
            ) : null}
          </label>
          {input(METRICS[0])}
          <button
            type="button"
            className="btn-quiet body-more"
            aria-expanded={more}
            onClick={() => setMore(!more)}
          >
            Add measurements
          </button>
          {more ? <div className="body-measurements">{MEASUREMENTS.map(input)}</div> : null}
        </section>

        {current ? (
          <section className="body-chart" aria-label="Chart">
            <Segmented
              name="body-metric"
              label="Metric"
              value={current.metric}
              options={available.map((m) => ({ value: m.metric, label: m.label }))}
              onChange={setChosen}
            />
            <LineChart
              series={{ kind: 'load', points: bodySeries(log, current.metric) }}
              title={`${current.label} chart`}
              unit={current.unit}
              compactDates
              selectable
            />
          </section>
        ) : (
          <p className="body-note">Log your first bodyweight to start the chart.</p>
        )}

        {log.length > 0 ? (
          <ul className="body-entries" aria-label="Entries">
            {[...log].reverse().map((entry) => {
              const label = shortDay(midnightOf(entry.day), nowDate)
              return (
                <li className="body-entry" key={entry.day}>
                  <span className="body-entry-day">{label}</span>
                  <span className="body-entry-values">{describe(entry)}</span>
                  <button
                    type="button"
                    className="btn-quiet body-delete"
                    aria-label={`Delete ${label}`}
                    onClick={() => remove(entry)}
                  >
                    Delete
                  </button>
                </li>
              )
            })}
          </ul>
        ) : null}
      </div>
      {removed ? <Snackbar message="Entry deleted" actionLabel="Undo" onAction={undo} /> : null}
    </AppShell>
  )
}

async function load(s: Services): Promise<BodyLog> {
  return s.preferences.bodyLog().catch((): BodyLog => [])
}

export type BodyPageProps = ProgressPageProps<'body'> & { now?: () => number }

/** The Progress tab's Body page: reads the body log, saves and deletes entries through it. */
export function BodyPage({ onBack, now = Date.now }: BodyPageProps): JSX.Element {
  const loaded = useServiceData(load, ['preferences'])
  const services = useServices()
  if (loaded.status !== 'ready') return <AppShell title="Body" onBack={onBack}>{null}</AppShell>
  return (
    <BodyView
      log={loaded.data}
      now={now()}
      onBack={onBack}
      onSave={(entry) => services.preferences.saveBodyEntry(entry)}
      onDelete={(day) => services.preferences.removeBodyEntry(day)}
    />
  )
}
