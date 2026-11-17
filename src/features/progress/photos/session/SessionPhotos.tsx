import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Photo, PhotoAngle } from '../../../../storage/photoStore'
import { Sheet } from '../../../../ui/Sheet'
import { Snackbar } from '../../../../ui/Snackbar'
import { useServices } from '../../../ServicesProvider'
import { useServiceData } from '../../../useServiceData'
import { PhotoCaptureFlow } from '../capture/PhotoCaptureFlow'
import { UNDO_MS } from '../compare/ComparePage'
import './SessionPhotos.css'

export type SessionPhotosProps = {
  /** The Session's local calendar day, YYYY-MM-DD: the photos shown and taken are this day's. */
  day: string
  /**
   * Where it sits: `finish`, the summary right after Finish (the day line and "Add progress
   * photos"); `past`, a past workout's summary (the day line only, when there are photos);
   * `editor`, the Session editor's Photos row (thumbnails, Delete with Undo, "Add photos").
   */
  variant: 'finish' | 'past' | 'editor'
  /** How long Undo stays offered after a delete. */
  undoMs?: number
}

const ANGLE_ORDER: PhotoAngle[] = ['front', 'side', 'back']
const ANGLE_LABEL: Record<PhotoAngle, string> = { front: 'Front', side: 'Side', back: 'Back' }

/** The day's photos, front, side, back, each angle oldest first. */
function ofDay(photos: Photo[], day: string): Photo[] {
  return photos
    .filter((photo) => photo.day === day)
    .sort(
      (a, b) => ANGLE_ORDER.indexOf(a.angle) - ANGLE_ORDER.indexOf(b.angle) || a.createdAt - b.createdAt,
    )
}

/** "3 photos · front, side, back": the count and the views, each view once. */
function photosLine(photos: Photo[]): string {
  const angles = ANGLE_ORDER.filter((angle) => photos.some((photo) => photo.angle === angle))
  return `${photos.length} ${photos.length === 1 ? 'photo' : 'photos'} · ${angles.join(', ')}`
}

function Thumb({ photo, alt, className }: { photo: Photo; alt: string; className: string }): JSX.Element {
  // Made and revoked in one effect, so a remount (React's StrictMode runs effects twice) never
  // keeps a revoked URL, as a memoised one would.
  const [url, setUrl] = useState<string | undefined>(undefined)
  useEffect(() => {
    if (typeof URL.createObjectURL !== 'function') return
    const made = URL.createObjectURL(new Blob([photo.data], { type: photo.type }))
    setUrl(made)
    return () => {
      if (typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(made)
    }
  }, [photo])
  return <img className={className} src={url} alt={alt} />
}

/**
 * Progress photos from a Session (decision 0026): the day's photos as one quiet line, the way
 * into the existing capture screen for that day, and on the editor a Photos row whose Delete
 * takes effect at once with Undo. The capture screen is the Progress one, drawn over the summary
 * or editor in a full-screen layer.
 */
export function SessionPhotos({ day, variant, undoMs = UNDO_MS }: SessionPhotosProps): JSX.Element | null {
  const services = useServices()
  const loaded = useServiceData((s) => s.photos.list(), ['preferences'])
  const [capturing, setCapturing] = useState(false)
  const [viewing, setViewing] = useState(false)
  const [removed, setRemoved] = useState<Photo | null>(null)

  useEffect(() => {
    if (!removed) return
    const timer = setTimeout(() => setRemoved(null), undoMs)
    return () => clearTimeout(timer)
  }, [removed, undoMs])

  const photos = ofDay(loaded.status === 'ready' ? loaded.data : [], day).filter(
    (photo) => photo.id !== removed?.id,
  )

  const remove = (photo: Photo): void => {
    setRemoved(photo)
    void services.photos.remove(photo.id).catch(() => setRemoved(null))
  }
  const undo = (): void => {
    if (!removed) return
    const photo = removed
    void services.photos.restore(photo).finally(() => setRemoved(null))
  }

  const capture = capturing
    ? createPortal(
        <div className="session-photos-capture">
          <PhotoCaptureFlow day={day} onClose={() => setCapturing(false)} />
        </div>,
        document.body,
      )
    : null

  if (variant === 'editor') {
    return (
      <section className="session-photos session-photos--editor" role="group" aria-label="Photos">
        <span className="session-photos-label">Photos</span>
        {photos.length > 0 ? (
          <ul className="session-photos-thumbs">
            {photos.map((photo) => (
              <li key={photo.id} className="session-photos-item">
                <Thumb photo={photo} alt={`${ANGLE_LABEL[photo.angle]} photo`} className="session-photos-thumb" />
                <button
                  type="button"
                  className="session-photos-delete btn-quiet"
                  aria-label={`Delete ${photo.angle} photo`}
                  onClick={() => remove(photo)}
                >
                  <span className="session-photos-delete-mark" aria-hidden="true">
                    ×
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <button type="button" className="session-photos-action btn-quiet" onClick={() => setCapturing(true)}>
          Add photos
        </button>
        {removed ? (
          <Snackbar message={`Photo deleted · ${removed.angle}`} actionLabel="Undo" onAction={undo} />
        ) : null}
        {capture}
      </section>
    )
  }

  if (variant === 'past' && photos.length === 0) return null
  if (loaded.status === 'loading') return null

  return (
    <div className="session-photos">
      {photos.length > 0 ? (
        <button type="button" className="session-photos-line btn-quiet" onClick={() => setViewing(true)}>
          <span className="session-photos-strip" aria-hidden="true">
            {photos.map((photo) => (
              <Thumb key={photo.id} photo={photo} alt="" className="session-photos-mini" />
            ))}
          </span>
          <span className="session-photos-count">{photosLine(photos)}</span>
        </button>
      ) : null}
      {variant === 'finish' ? (
        <button
          type="button"
          className="session-photos-action btn-quiet"
          aria-label="Add progress photos"
          onClick={() => setCapturing(true)}
        >
          {photos.length > 0 ? 'Add' : 'Add progress photos'}
        </button>
      ) : null}
      {viewing ? (
        <Sheet label="Progress photos" onClose={() => setViewing(false)}>
          <div className="session-photos-sheet">
            <h3 className="session-photos-sheet-title">{photosLine(photos)}</h3>
            <div className="session-photos-gallery">
              {photos.map((photo) => (
                <figure key={photo.id} className="session-photos-figure">
                  <Thumb photo={photo} alt={`${ANGLE_LABEL[photo.angle]} photo`} className="session-photos-large" />
                  <figcaption className="session-photos-caption">{ANGLE_LABEL[photo.angle]}</figcaption>
                </figure>
              ))}
            </div>
          </div>
        </Sheet>
      ) : null}
      {capture}
    </div>
  )
}
