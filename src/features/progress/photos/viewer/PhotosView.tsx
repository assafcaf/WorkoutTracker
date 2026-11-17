import { useEffect, useRef, useState } from 'react'
import type { Photo, PhotoAngle } from '../../../../storage/photoStore'
import type { BodyLog } from '../../../../types'
import { AppShell } from '../../../../ui/AppShell'
import { Segmented } from '../../../../ui/controls'
import { Snackbar } from '../../../../ui/Snackbar'
import { UNDO_MS } from '../compare/ComparePage'
import { dayLabel, transformOf, useImageUrl } from '../photoFrame'
import { PhotoViewer } from './PhotoViewer'
import {
  ANGLE_NAMES,
  photosOfAngle,
  timelineMonths,
  weightChange,
  weightOnDay,
  type CompareRequest,
} from './timeline'
import './PhotosView.css'

const ANGLES: { value: PhotoAngle; label: string }[] = [
  { value: 'front', label: 'Front' },
  { value: 'side', label: 'Side' },
  { value: 'back', label: 'Back' },
]

export type PhotosViewProps = {
  photos: Photo[]
  log: BodyLog
  now: number
  onBack: (() => void) | undefined
  /** Opens the capture screen. */
  onAdd(): void
  onCompare(request: CompareRequest): void
  onDelete(photo: Photo): Promise<void>
  onRestore(photo: Photo): Promise<void>
  undoMs?: number
  playMs?: number
  /** Whether the trainee asked for reduced motion; read from the system by default. */
  reducedMotion?: boolean
}

const prefersReducedMotion = (): boolean =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

type ThumbProps = { photo: Photo; label: string; date: string; kg: number | null; onOpen(): void }

/** One photo of the timeline: the aligned thumbnail over its date and that day's bodyweight. */
function Thumb({ photo, label, date, kg, onOpen }: ThumbProps): JSX.Element {
  const url = useImageUrl(photo)
  return (
    <button type="button" className="btn-quiet photos-tile" aria-label={label} data-photo-id={photo.id} onClick={onOpen}>
      <span className="photos-thumb">
        <img className="photos-thumb-img" src={url} alt="" style={transformOf(photo)} draggable={false} />
      </span>
      <span className="photos-caption">
        <span className="photos-caption-date">{date}</span>
        {kg !== null ? <span className="photos-caption-kg">{`${kg} kg`}</span> : null}
      </span>
    </button>
  )
}

/**
 * The Photos page's drawing: the angle tabs, that angle's photos newest first by month (each
 * captioned with its date and that day's bodyweight), the empty state, and the full-screen
 * viewer a photo opens.
 */
export function PhotosView({
  photos,
  log,
  now,
  onBack,
  onAdd,
  onCompare,
  onDelete,
  onRestore,
  undoMs = UNDO_MS,
  playMs,
  reducedMotion = prefersReducedMotion(),
}: PhotosViewProps): JSX.Element {
  const [angle, setAngle] = useState<PhotoAngle>('front')
  const [openId, setOpenId] = useState<string | null>(null)
  const [removed, setRemoved] = useState<Photo | null>(null)
  const lastOpened = useRef<string | null>(null)
  const today = new Date(now)

  useEffect(() => {
    if (!removed) return
    const timer = setTimeout(() => setRemoved(null), undoMs)
    return () => clearTimeout(timer)
  }, [removed, undoMs])

  const visible = removed ? photos.filter((p) => p.id !== removed.id) : photos
  const ofAngle = photosOfAngle(visible, angle)
  const current = openId === null ? undefined : ofAngle.find((p) => p.id === openId)

  // Back on the timeline, focus returns to the photo the viewer was opened from (or showed last).
  useEffect(() => {
    if (current || lastOpened.current === null) return
    const tile = document.querySelector<HTMLElement>(`[data-photo-id="${lastOpened.current}"]`)
    lastOpened.current = null
    tile?.focus()
  }, [current])

  const open = (id: string): void => {
    lastOpened.current = id
    setOpenId(id)
  }
  const close = (): void => setOpenId(null)

  const remove = (photo: Photo): void => {
    const at = ofAngle.findIndex((p) => p.id === photo.id)
    const neighbour = ofAngle[at + 1] ?? ofAngle[at - 1] ?? null
    setOpenId(neighbour?.id ?? null)
    lastOpened.current = neighbour?.id ?? null
    setRemoved(photo)
    void onDelete(photo)
  }
  const undo = (): void => {
    if (!removed) return
    const photo = removed
    setRemoved(null)
    void onRestore(photo)
  }

  const snackbar = removed ? (
    <Snackbar message={`Photo deleted · ${dayLabel(removed.day, today)}`} actionLabel="Undo" onAction={undo} />
  ) : null

  const name = ANGLE_NAMES[angle]
  let body: JSX.Element
  if (visible.length === 0) {
    body = (
      <section className="photos-empty" aria-labelledby="photos-empty-title">
        <h2 id="photos-empty-title" className="photos-empty-title">
          Your first check-in
        </h2>
        <p className="photos-empty-text">
          Take a front, side and back photo in the same spot and light. Each new one lines up over
          the last, so the change shows from week to week.
        </p>
        <button type="button" className="btn-primary photos-empty-action" onClick={onAdd}>
          Take your first photos
        </button>
      </section>
    )
  } else {
    const first = ofAngle[0]
    const latest = ofAngle[ofAngle.length - 1]
    const change = first && latest ? weightChange(log, first.day, latest.day) : null
    const months = timelineMonths(visible, angle)
    body = (
      <>
        <Segmented name="photos-angle" label="Angle" value={angle} options={ANGLES} onChange={setAngle} />
        {ofAngle.length === 0 ? (
          <div className="photos-none">
            <p className="photos-note">{`No ${name.toLowerCase()} photos yet.`}</p>
            <button type="button" className="btn-secondary" onClick={onAdd}>
              Add photo
            </button>
          </div>
        ) : (
          <section className="photos-timeline" aria-label={`${name} photos`}>
            <p className="photos-summary">
              {`${ofAngle.length} ${ofAngle.length === 1 ? 'photo' : 'photos'} since ${dayLabel(first.day, today)}`}
              {change ? ` · ${change}` : ''}
            </p>
            {months.map((month) => (
              <div className="photos-month" key={month.key}>
                <h2 className="photos-month-title">{month.label}</h2>
                <ul className="photos-grid">
                  {month.photos.map((photo) => {
                    const date = dayLabel(photo.day, today)
                    const kg = weightOnDay(log, photo.day)
                    return (
                      <li className="photos-cell" key={photo.id}>
                        <Thumb
                          photo={photo}
                          label={`${name} photo, ${date}${kg !== null ? `, ${kg} kg` : ''}`}
                          date={date}
                          kg={kg}
                          onOpen={() => open(photo.id)}
                        />
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </section>
        )}
      </>
    )
  }

  return (
    <AppShell
      title="Photos"
      onBack={onBack}
      action={
        visible.length > 0 ? (
          <button type="button" className="btn-primary" onClick={onAdd}>
            New check-in
          </button>
        ) : undefined
      }
    >
      <div className="photos-page">{body}</div>
      {current ? (
        <PhotoViewer
          angle={angle}
          photos={ofAngle}
          currentId={current.id}
          log={log}
          now={now}
          onShow={(id) => {
            lastOpened.current = id
            setOpenId(id)
          }}
          onClose={close}
          onDelete={remove}
          onCompare={onCompare}
          reducedMotion={reducedMotion}
          playMs={playMs}
        />
      ) : null}
      {snackbar}
    </AppShell>
  )
}
