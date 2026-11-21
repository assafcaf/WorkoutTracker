import { useEffect, useState } from 'react'
import { bodySeries, dayOf, waistToHeight } from '../../domain/bodyLog'
import { shortDay } from '../../domain/lifts'
import type { Photo, PhotoAngle } from '../../storage/photoStore'
import type { BodyEntry, BodyLog, BodyMetric } from '../../types'
import { AppShell } from '../../ui/AppShell'
import { LineChart } from '../../ui/charts/LineChart'
import { Segmented } from '../../ui/controls'
import { Icon } from '../../ui/icons'
import { Sheet } from '../../ui/Sheet'
import { Snackbar } from '../../ui/Snackbar'
import type { Services } from '../../services'
import { useServiceData } from '../useServiceData'
import { useServices } from '../ServicesProvider'
import { PhotoCaptureFlow } from './photos/capture/PhotoCaptureFlow'
import { transformOf, useImageUrl } from './photos/photoFrame'
import { ANGLE_NAMES, photosOfAngle } from './photos/viewer/timeline'
import type { ProgressPageProps } from './pages'
import './BodyPage.css'

type MetricInfo = { metric: BodyMetric; label: string; unit: 'kg' | 'cm'; field: string }

const METRICS: MetricInfo[] = [
  { metric: 'weightKg', label: 'Bodyweight', unit: 'kg', field: 'Bodyweight (kg)' },
  { metric: 'waistCm', label: 'Waist', unit: 'cm', field: 'Waist (cm)' },
  { metric: 'chestCm', label: 'Chest', unit: 'cm', field: 'Chest (cm)' },
  { metric: 'armsCm', label: 'Arms', unit: 'cm', field: 'Arms (cm)' },
  { metric: 'thighsCm', label: 'Thighs', unit: 'cm', field: 'Thighs (cm)' },
  { metric: 'hipsCm', label: 'Hips', unit: 'cm', field: 'Hips (cm)' },
  { metric: 'neckCm', label: 'Neck', unit: 'cm', field: 'Neck (cm)' },
  { metric: 'shouldersCm', label: 'Shoulders', unit: 'cm', field: 'Shoulders (cm)' },
  { metric: 'calvesCm', label: 'Calves', unit: 'cm', field: 'Calves (cm)' },
]
const WEIGHT = METRICS[0]
const WAIST = METRICS[1]
/** The measurements past the waist, behind their own "More measurements" disclosure. */
const OTHERS = METRICS.slice(2)
const ANGLES: PhotoAngle[] = ['front', 'side', 'back']

/** The accepted range of each kind of value, as `validateBodyEntry` holds it. */
const rangeOf = (info: MetricInfo): [number, number] => (info.metric === 'weightKg' ? [20, 400] : [10, 300])

const UNDO_MS = 6000

const midnightOf = (day: string): number => {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d).getTime()
}

type Fields = Partial<Record<BodyMetric, string>>

const fieldsOf = (entry: BodyEntry | undefined): Fields =>
  Object.fromEntries(METRICS.flatMap((m) => (entry?.[m.metric] === undefined ? [] : [[m.metric, String(entry[m.metric])]])))

export type BodyEntrySheetProps = {
  /** The entry being edited; a new entry when absent. */
  entry?: BodyEntry
  today: string
  onCancel(): void
  /** Saves the entry; `replaces` is the day it was stored under when the date changed. */
  onSave(entry: BodyEntry, replaces?: string): Promise<void>
  /** Editing only: deletes the entry (with an Undo on the page). */
  onDelete?(): void
}

/**
 * DX-10: the one sheet for logging and editing a body entry -- Date (today by default),
 * Bodyweight, an "Add waist" disclosure (and past it the other measurements), Cancel and Save in
 * its header, and on an existing entry "Delete entry" in red at its bottom.
 */
export function BodyEntrySheet({ entry, today, onCancel, onSave, onDelete }: BodyEntrySheetProps): JSX.Element {
  const [day, setDay] = useState(entry?.day ?? today)
  const [fields, setFields] = useState<Fields>(() => fieldsOf(entry))
  const [waist, setWaist] = useState(entry !== undefined && METRICS.slice(1).some((m) => entry[m.metric] !== undefined))
  const [more, setMore] = useState(entry !== undefined && OTHERS.some((m) => entry[m.metric] !== undefined))
  const [errors, setErrors] = useState<Partial<Record<BodyMetric | 'day', string>>>({})
  const filled = METRICS.filter((m) => (fields[m.metric] ?? '').trim() !== '')
  const title = entry ? `Edit ${shortDay(midnightOf(entry.day), new Date(midnightOf(today)))}` : 'Log bodyweight'

  const save = (): void => {
    const next: typeof errors = {}
    const out: BodyEntry = { day }
    if (day === '' || day > today) next.day = 'Pick today or an earlier day'
    for (const info of filled) {
      const value = Number(fields[info.metric])
      const [lo, hi] = rangeOf(info)
      if (!Number.isFinite(value) || value < lo || value > hi) next[info.metric] = `Enter ${lo}–${hi} ${info.unit}`
      else out[info.metric] = value
    }
    setErrors(next)
    if (Object.keys(next).length > 0) return
    onSave(out, entry && entry.day !== day ? entry.day : undefined).catch(() => setErrors({ day: 'Could not save the entry' }))
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

  return (
    <Sheet label={title} onClose={onCancel}>
      <div className="sheet-head body-sheet-head">
        <button type="button" className="btn-quiet body-sheet-cancel" onClick={onCancel}>
          Cancel
        </button>
        <h2 className="sheet-title body-sheet-title">{title}</h2>
        <button type="button" className="btn-quiet body-sheet-save" disabled={filled.length === 0} onClick={save}>
          Save
        </button>
      </div>
      <div className="body-form">
        <label className="body-field">
          <span className="body-field-label">Date</span>
          <input className="body-input" type="date" value={day} max={today} onChange={(event) => setDay(event.target.value)} />
          {errors.day ? (
            <span className="body-error" role="alert">
              {errors.day}
            </span>
          ) : null}
        </label>
        {input(WEIGHT)}
        {waist ? (
          <>
            {input(WAIST)}
            {more ? (
              OTHERS.map(input)
            ) : (
              <button type="button" className="btn-quiet body-more" aria-expanded={false} onClick={() => setMore(true)}>
                More measurements
              </button>
            )}
          </>
        ) : (
          <button type="button" className="btn-quiet body-more" aria-expanded={false} onClick={() => setWaist(true)}>
            Add waist
          </button>
        )}
        {onDelete ? (
          <button type="button" className="btn-danger body-delete" onClick={onDelete}>
            Delete entry
          </button>
        ) : null}
      </div>
    </Sheet>
  )
}

/** One angle's latest photo, aligned as it was saved; opens the Photos page. */
function Thumb({ photo, onOpen }: { photo: Photo; onOpen(): void }): JSX.Element {
  const url = useImageUrl(photo)
  return (
    <button type="button" className="btn-quiet body-thumb" aria-label={`${ANGLE_NAMES[photo.angle]} photo`} onClick={onOpen}>
      <img className="body-thumb-img" src={url} alt="" style={transformOf(photo)} draggable={false} />
    </button>
  )
}

export type BodyViewProps = {
  log: BodyLog
  /** Set in Settings (DX-10); here only for the waist-to-height line. */
  heightCm?: number | null
  now: number
  onBack: (() => void) | undefined
  onSave(entry: BodyEntry): Promise<void>
  onDelete(day: string): Promise<void>
  /** The progress photos, newest first; the Photos section shows each angle's latest. */
  photos?: Photo[]
  /** Opens the Photos page (`See all ›`, a thumbnail); the section offers it only when given. */
  onOpenPhotos?(): void
}

/**
 * The Body page (DX-10): is my weight trending? The latest bodyweight and its change as the
 * headline, the Bodyweight/Waist chart first, then Photos (each angle's latest, See all, New
 * check-in) and History (each row opens the entry's sheet). One filled action, "Log bodyweight".
 * Height lives in Settings.
 */
export function BodyView({ log, heightCm = null, now, onBack, onSave, onDelete, photos = [], onOpenPhotos }: BodyViewProps): JSX.Element {
  const today = dayOf(now)
  const nowDate = new Date(now)
  const [chosen, setChosen] = useState<BodyMetric>('weightKg')
  const [sheet, setSheet] = useState<{ entry?: BodyEntry } | null>(null)
  const [removed, setRemoved] = useState<BodyEntry | null>(null)
  const [capturing, setCapturing] = useState(false)

  useEffect(() => {
    if (!removed) return
    const timer = setTimeout(() => setRemoved(null), UNDO_MS)
    return () => clearTimeout(timer)
  }, [removed])

  if (capturing) return <PhotoCaptureFlow day={today} onClose={() => setCapturing(false)} />

  const available = METRICS.filter((m) => log.some((e) => e[m.metric] !== undefined))
  const current = available.find((m) => m.metric === chosen) ?? available[0]
  const weights = log.filter((e) => e.weightKg !== undefined)
  const first = weights[0]
  const latest = weights[weights.length - 1]
  const delta = first && latest ? Math.round(((latest.weightKg ?? 0) - (first.weightKg ?? 0)) * 10) / 10 : 0
  const latestWaist = [...log].reverse().find((e) => e.waistCm !== undefined)?.waistCm
  const ratio = latestWaist === undefined ? null : waistToHeight(latestWaist, heightCm)
  const latestPhotos = ANGLES.flatMap((angle) => photosOfAngle(photos, angle).slice(0, 1))
  const dayText = (day: string): string => shortDay(midnightOf(day), nowDate)

  const save = async (entry: BodyEntry, replaces?: string): Promise<void> => {
    await onSave(entry)
    if (replaces !== undefined) await onDelete(replaces)
    setSheet(null)
  }
  const remove = (entry: BodyEntry): void => {
    setSheet(null)
    setRemoved(entry)
    void onDelete(entry.day)
  }
  const undo = (): void => {
    if (!removed) return
    const entry = removed
    setRemoved(null)
    void onSave(entry)
  }

  const describe = (entry: BodyEntry): string =>
    METRICS.filter((m) => entry[m.metric] !== undefined)
      .map((m) => (m.metric === 'weightKg' ? `${entry.weightKg} kg` : `${m.label.toLowerCase()} ${entry[m.metric]} cm`))
      .join(' · ')

  return (
    <AppShell
      title="Body"
      onBack={onBack}
      action={
        <button type="button" className="btn-primary" onClick={() => setSheet({})}>
          Log bodyweight
        </button>
      }
    >
      <div className="body-page">
        {latest ? (
          <header className="body-headline">
            <p className="body-headline-value">
              {latest.weightKg}
              <span className="body-headline-unit"> kg</span>
            </p>
            {first && first !== latest && delta !== 0 ? (
              <p className="body-headline-change">{`${delta > 0 ? '+' : '−'}${Math.abs(delta).toFixed(1)} kg since ${dayText(first.day)}`}</p>
            ) : null}
          </header>
        ) : log.length === 0 ? (
          <p className="body-note">Log your first bodyweight to start the chart.</p>
        ) : null}

        {current ? (
          <section className="body-chart" aria-label="Chart">
            {available.length > 1 ? (
              <Segmented
                name="body-metric"
                label="Metric"
                value={current.metric}
                options={available.map((m) => ({ value: m.metric, label: m.label }))}
                onChange={setChosen}
              />
            ) : null}
            <LineChart
              series={{ kind: 'load', points: bodySeries(log, current.metric) }}
              title={`${current.label} chart`}
              unit={current.unit}
              compactDates
              selectable
            />
            {ratio !== null ? <p className="body-ratio">{`Waist-to-height ${ratio.toFixed(2)}`}</p> : null}
          </section>
        ) : null}

        <section className="body-section" aria-labelledby="body-photos-title">
          <div className="body-section-head">
            <h3 id="body-photos-title" className="body-section-title">
              Photos
            </h3>
            {onOpenPhotos && latestPhotos.length > 0 ? (
              <button type="button" className="btn-quiet body-see-all" onClick={onOpenPhotos}>
                See all ›
              </button>
            ) : null}
          </div>
          {latestPhotos.length > 0 ? (
            <div className="body-thumbs">
              {latestPhotos.map((photo) => (
                <Thumb key={photo.id} photo={photo} onOpen={() => onOpenPhotos?.()} />
              ))}
            </div>
          ) : (
            <p className="body-note">Front, side and back photos show what the scale misses.</p>
          )}
          <button type="button" className="btn-quiet body-more" onClick={() => setCapturing(true)}>
            New check-in
          </button>
        </section>

        {log.length > 0 ? (
          <section className="body-section" aria-labelledby="body-history-title">
            <h3 id="body-history-title" className="body-section-title">
              History
            </h3>
            <ul className="body-entries" aria-label="Entries">
              {[...log].reverse().map((entry) => (
                <li key={entry.day}>
                  <button type="button" className="btn-quiet body-entry" onClick={() => setSheet({ entry })}>
                    <span className="body-entry-day">{dayText(entry.day)}</span>
                    <span className="body-entry-values">{describe(entry)}</span>
                    <Icon name="ChevronRight" size={20} />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
      {sheet ? (
        <BodyEntrySheet
          entry={sheet.entry}
          today={today}
          onCancel={() => setSheet(null)}
          onSave={save}
          onDelete={sheet.entry ? () => remove(sheet.entry as BodyEntry) : undefined}
        />
      ) : null}
      {removed ? <Snackbar message="Entry deleted" actionLabel="Undo" onAction={undo} /> : null}
    </AppShell>
  )
}

type Loaded = { log: BodyLog; heightCm: number | null; photos: Photo[] }

async function load(s: Services): Promise<Loaded> {
  const log = await s.preferences.bodyLog().catch((): BodyLog => [])
  const heightCm = await s.preferences.heightCm().catch((): null => null)
  const photos = await s.photos.list().catch((): Photo[] => [])
  return { log, heightCm, photos }
}

export type BodyPageProps = ProgressPageProps<'body'> & { now?: () => number }

/** The Progress tab's Body page: reads the body log and photos, saves and deletes entries. */
export function BodyPage({ push, onBack, now = Date.now }: BodyPageProps): JSX.Element {
  const loaded = useServiceData(load, ['preferences'])
  const services = useServices()
  if (loaded.status !== 'ready') return <AppShell title="Body" onBack={onBack}>{null}</AppShell>
  return (
    <BodyView
      log={loaded.data.log}
      heightCm={loaded.data.heightCm}
      photos={loaded.data.photos}
      now={now()}
      onBack={onBack}
      onSave={(entry) => services.preferences.saveBodyEntry(entry)}
      onDelete={(day) => services.preferences.removeBodyEntry(day)}
      onOpenPhotos={() => push({ kind: 'photos' })}
    />
  )
}
