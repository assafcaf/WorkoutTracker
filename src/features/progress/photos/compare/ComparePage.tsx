import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { shortDay } from '../../../../domain/lifts'
import type { BodyLog, Exercise, Session } from '../../../../types'
import type { Photo, PhotoAngle } from '../../../../storage/photoStore'
import { AppShell } from '../../../../ui/AppShell'
import { Segmented, Select } from '../../../../ui/controls'
import { Snackbar } from '../../../../ui/Snackbar'
import { useServices } from '../../../ServicesProvider'
import { useServiceData } from '../../../useServiceData'
import type { Services } from '../../../../services'
import type { ProgressPageProps } from '../../pages'
import { changeParts, daysApart } from './summary'
import './ComparePage.css'

/** How long Undo stays offered after a delete. */
export const UNDO_MS = 8000

const ANGLES: { value: PhotoAngle; label: string }[] = [
  { value: 'front', label: 'Front' },
  { value: 'side', label: 'Side' },
  { value: 'back', label: 'Back' },
]

type Mode = 'wipe' | 'side'

/** A photo's saved transform as CSS: dx and dy are fractions of the frame, rotate is degrees. */
function transformOf(photo: Photo): CSSProperties {
  const a = photo.align
  if (!a) return {}
  return { transform: `translate(${a.dx * 100}%, ${a.dy * 100}%) rotate(${a.rotate}deg) scale(${a.scale})` }
}

function useImageUrl(photo: Photo): string {
  const url = useMemo(() => {
    if (typeof URL.createObjectURL !== 'function') return ''
    return URL.createObjectURL(new Blob([photo.data], { type: photo.type }))
  }, [photo])
  useEffect(
    () => () => {
      if (url && typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(url)
    },
    [url],
  )
  return url
}

function Frame({ photo }: { photo: Photo }): JSX.Element {
  const url = useImageUrl(photo)
  return <img className="compare-img" src={url} alt="" style={transformOf(photo)} />
}

const dayLabel = (day: string): string => shortDay(new Date(`${day}T12:00:00`).getTime(), new Date())

export type CompareViewProps = {
  photos: Photo[]
  log: BodyLog
  sessions: Session[]
  exercises: Exercise[]
  onBack: (() => void) | undefined
  onDelete(photo: Photo): Promise<void>
  onRestore(photo: Photo): Promise<void>
  undoMs?: number
}

/** The Compare page's drawing, over loaded photos. */
export function CompareView({
  photos,
  log,
  sessions,
  exercises,
  onBack,
  onDelete,
  onRestore,
  undoMs = UNDO_MS,
}: CompareViewProps): JSX.Element {
  const [angle, setAngle] = useState<PhotoAngle>('front')
  const [mode, setMode] = useState<Mode>('wipe')
  const [pos, setPos] = useState(50)
  const [beforeId, setBeforeId] = useState<string | null>(null)
  const [afterId, setAfterId] = useState<string | null>(null)
  const [removed, setRemoved] = useState<Photo | null>(null)

  useEffect(() => {
    if (!removed) return
    const timer = setTimeout(() => setRemoved(null), undoMs)
    return () => clearTimeout(timer)
  }, [removed, undoMs])

  const ofAngle = photos.filter((p) => p.angle === angle).sort((a, b) => a.day.localeCompare(b.day))
  const before = ofAngle.find((p) => p.id === beforeId) ?? ofAngle[0]
  const after = ofAngle.find((p) => p.id === afterId) ?? ofAngle[ofAngle.length - 1]

  const remove = (photo: Photo): void => {
    setRemoved(photo)
    void onDelete(photo)
  }
  const undo = (): void => {
    if (!removed) return
    const photo = removed
    setRemoved(null)
    void onRestore(photo)
  }

  const card = (which: 'before' | 'after', photo: Photo): JSX.Element => {
    const label = which === 'before' ? 'Before' : 'After'
    return (
      <div className="compare-card">
        <label className="compare-card-pick">
          <span className="compare-card-label">{label}</span>
          <Select
            aria-label={`${label} date`}
            value={photo.id}
            onChange={(event) => (which === 'before' ? setBeforeId : setAfterId)(event.target.value)}
          >
            {ofAngle.map((p) => (
              <option key={p.id} value={p.id}>
                {dayLabel(p.day)}
              </option>
            ))}
          </Select>
        </label>
        <button
          type="button"
          className="compare-delete btn-quiet"
          aria-label={`Delete ${which} photo`}
          onClick={() => remove(photo)}
        >
          Delete
        </button>
      </div>
    )
  }

  let body: JSX.Element
  if (ofAngle.length < 2 || !before || !after) {
    body = <p className="compare-note">Take two photos of the same view to compare them.</p>
  } else {
    const parts = changeParts({ before: before.day, after: after.day, log, sessions, exercises })
    body = (
      <>
        <div className="compare-cards">
          {card('before', before)}
          {card('after', after)}
        </div>
        {mode === 'wipe' ? (
          <div className="compare-frame" data-testid="compare-wipe">
            <Frame photo={before} />
            <div className="compare-after" style={{ clipPath: `inset(0 0 0 ${pos}%)` }}>
              <Frame photo={after} />
            </div>
            <span className="compare-handle" style={{ left: `${pos}%` }} aria-hidden="true" />
            <input
              className="compare-wipe-input"
              type="range"
              min={0}
              max={100}
              value={pos}
              aria-label="Wipe position"
              onChange={(event) => setPos(Number(event.target.value))}
            />
            <span className="compare-date compare-date--before">{dayLabel(before.day)}</span>
            <span className="compare-date compare-date--after">{dayLabel(after.day)}</span>
          </div>
        ) : (
          <div className="compare-pair" data-testid="compare-side">
            {[before, after].map((p) => (
              <div className="compare-frame" key={p.id}>
                <Frame photo={p} />
                <span className="compare-date compare-date--before">{dayLabel(p.day)}</span>
              </div>
            ))}
          </div>
        )}
        <Segmented
          name="compare-mode"
          label="Compare mode"
          value={mode}
          options={[
            { value: 'wipe', label: 'Wipe' },
            { value: 'side', label: 'Side by side' },
          ]}
          onChange={setMode}
        />
        <div className="compare-summary">
          <span className="compare-apart">{daysApart(before.day, after.day)} days apart</span>
          {parts.length > 0 ? <span className="compare-change">{parts.join(' · ')}</span> : null}
        </div>
      </>
    )
  }

  return (
    <AppShell title="Compare" onBack={onBack}>
      <div className="compare-page">
        <Segmented name="compare-angle" label="Angle" value={angle} options={ANGLES} onChange={setAngle} />
        {body}
      </div>
      {removed ? (
        <Snackbar message={`Photo deleted · ${dayLabel(removed.day)}`} actionLabel="Undo" onAction={undo} />
      ) : null}
    </AppShell>
  )
}

type Loaded = { photos: Photo[]; log: BodyLog; sessions: Session[]; exercises: Exercise[] }

async function load(s: Services): Promise<Loaded> {
  const photos = await s.photos.list()
  const log = await s.preferences.bodyLog().catch((): BodyLog => [])
  const sessions = await s.sessions.list().catch((): Session[] => [])
  const exercises = await s.catalog
    .load()
    .then((data) => [...data.catalog.values()])
    .catch((): Exercise[] => [])
  return { photos, log, sessions, exercises }
}

export type ComparePageProps = ProgressPageProps<'compare'> & { undoMs?: number }

/** The Progress tab's Compare page: two dates of one angle, aligned by their saved transforms. */
export function ComparePage({ onBack, undoMs }: ComparePageProps): JSX.Element {
  const services = useServices()
  const loaded = useServiceData(load, ['preferences'])
  if (loaded.status !== 'ready') return <AppShell title="Compare" onBack={onBack}>{null}</AppShell>
  return (
    <CompareView
      {...loaded.data}
      onBack={onBack}
      onDelete={(photo) => services.photos.remove(photo.id)}
      onRestore={(photo) => services.photos.restore(photo)}
      undoMs={undoMs}
    />
  )
}
