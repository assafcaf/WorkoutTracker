import { useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { Photo, PhotoAngle } from '../../../../storage/photoStore'
import type { BodyLog } from '../../../../types'
import { Icon } from '../../../../ui/icons'
import { flipNextTo } from '../flip'
import { dayLabel, transformOf } from '../photoFrame'
import { ANGLE_NAMES, PLAY_MS, sinceFirst, weightOnDay, type CompareRequest } from './timeline'

/** The fade between dates (--motion-fast). */
const FADE_MS = 150
/** How far a finger has to travel sideways before it is a swipe, not a tap. */
const SWIPE_PX = 40


export type PhotoViewerProps = {
  angle: PhotoAngle
  /** The angle's photos, oldest first; `currentId` is one of them. */
  photos: Photo[]
  currentId: string
  log: BodyLog
  now: number
  onShow(id: string): void
  onClose(): void
  onDelete(photo: Photo): void
  onCompare(request: CompareRequest): void
  /** Steps without the fade (prefers-reduced-motion). */
  reducedMotion: boolean
  playMs?: number
}

/**
 * The viewer's photo. The bytes' URL and the alignment change together, once the new URL exists,
 * so a step never draws the old photo at the new photo's transform; each new photo fades in over
 * --motion-fast unless the trainee asked for reduced motion (then it simply changes).
 */
function ViewerImage({ photo, label, still, flip }: { photo: Photo; label: string; still: boolean; flip: boolean }): JSX.Element {
  const [shown, setShown] = useState<{ photo: Photo; url?: string }>({ photo })
  useEffect(() => {
    if (typeof URL.createObjectURL !== 'function') {
      setShown({ photo })
      return
    }
    const url = URL.createObjectURL(new Blob([photo.data], { type: photo.type }))
    setShown({ photo, url })
    return () => {
      if (typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(url)
    }
  }, [photo])
  return (
    <img
      className="photo-viewer-img"
      src={shown.url}
      alt={label}
      style={transformOf(shown.photo, flip && shown.photo === photo)}
      draggable={false}
      onLoad={(event) => {
        if (!still) event.currentTarget.animate?.([{ opacity: 0.4 }, { opacity: 1 }], { duration: FADE_MS, easing: 'ease-out' })
      }}
    />
  )
}

/**
 * The full-screen photo viewer: one angle across its dates, each photo drawn with its saved
 * alignment so the body stays put while the date changes. Swipe, the arrow buttons or the arrow
 * keys step; Play runs the dates as a timelapse; Compare opens the wipe on the first photo and
 * this one; Delete takes the photo away with Undo offered by the page.
 */
export function PhotoViewer({
  angle,
  photos,
  currentId,
  log,
  now,
  onShow,
  onClose,
  onDelete,
  onCompare,
  reducedMotion,
  playMs = PLAY_MS,
}: PhotoViewerProps): JSX.Element | null {
  const [playing, setPlaying] = useState(false)
  const closeRef = useRef<HTMLButtonElement>(null)
  const swipe = useRef<{ id: number; x: number } | null>(null)
  const today = new Date(now)
  const index = photos.findIndex((p) => p.id === currentId)
  const last = photos.length - 1
  const showRef = useRef(onShow)
  showRef.current = onShow

  useEffect(() => {
    closeRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!playing) return
    const timer = setTimeout(() => {
      if (index >= last) setPlaying(false)
      else showRef.current(photos[index + 1].id)
    }, playMs)
    return () => clearTimeout(timer)
  }, [playing, index, last, photos, playMs])

  if (index < 0) return null
  const current = photos[index]
  const first = photos[0]
  const prev = index > 0 ? photos[index - 1] : null
  const next = index < last ? photos[index + 1] : null
  const label = (p: Photo): string => dayLabel(p.day, today)
  const kg = weightOnDay(log, current.day)
  const name = ANGLE_NAMES[angle]

  const step = (to: Photo | null): void => {
    if (!to) return
    setPlaying(false)
    onShow(to.id)
  }
  const togglePlay = (): void => {
    if (playing) {
      setPlaying(false)
      return
    }
    if (index >= last) onShow(first.id)
    setPlaying(true)
  }
  const pair = index === 0 ? photos[last] : current
  const compare = (): void => onCompare({ angle, before: first.id, after: pair.id })

  const onKeyDown = (event: React.KeyboardEvent): void => {
    if (event.key === 'ArrowLeft') step(prev)
    else if (event.key === 'ArrowRight') step(next)
    else if (event.key === 'Escape') onClose()
    else return
    event.preventDefault()
  }
  const onPointerDown = (event: ReactPointerEvent): void => {
    swipe.current = { id: event.pointerId, x: event.clientX }
  }
  const onPointerUp = (event: ReactPointerEvent): void => {
    const start = swipe.current
    swipe.current = null
    if (!start || start.id !== event.pointerId) return
    const dx = event.clientX - start.x
    if (dx <= -SWIPE_PX) step(next)
    else if (dx >= SWIPE_PX) step(prev)
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${name} photos`}
      className={reducedMotion ? 'overlay-panel photo-viewer photo-viewer--still' : 'overlay-panel photo-viewer'}
      onKeyDown={onKeyDown}
    >
      <header className="photo-viewer-bar">
        <button ref={closeRef} type="button" className="btn-quiet photo-viewer-icon" aria-label="Close" onClick={onClose}>
          <Icon name="X" size={24} />
        </button>
        <span className="photo-viewer-count">{`${index + 1} of ${photos.length}`}</span>
        <button
          type="button"
          className="btn-quiet photo-viewer-icon"
          aria-label={`Delete photo, ${label(current)}`}
          onClick={() => {
            setPlaying(false)
            onDelete(current)
          }}
        >
          <Icon name="Trash" size={22} />
        </button>
      </header>

      <div
        className="photo-viewer-frame"
        data-testid="photo-viewer-frame"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => (swipe.current = null)}
      >
        {/* A mirror photo among stand ones is drawn flipped, so the body keeps its sides as the dates change. */}
        <ViewerImage photo={current} label={`${name} photo, ${label(current)}`} still={reducedMotion} flip={flipNextTo(current, photos)} />
      </div>

      <section className="photo-viewer-info" aria-live={playing ? 'off' : 'polite'}>
        <h2 className="photo-viewer-date">{label(current)}</h2>
        {current.mode === 'mirror' ? <span className="photo-mirror-chip">Mirror</span> : null}
        {kg !== null ? <p className="photo-viewer-weight">{`${kg} kg`}</p> : null}
        <p className="photo-viewer-since">{sinceFirst(first, current, log)}</p>
      </section>

      <div className="photo-viewer-controls">
        <button
          type="button"
          className="btn-quiet photo-viewer-icon photo-viewer-step"
          aria-label={prev ? `Previous photo, ${label(prev)}` : 'Previous photo'}
          disabled={!prev}
          onClick={() => step(prev)}
        >
          <Icon name="ChevronLeft" size={28} />
        </button>
        <button
          type="button"
          className="btn-secondary photo-viewer-play"
          aria-label={playing ? 'Pause timelapse' : 'Play timelapse'}
          disabled={photos.length < 2}
          onClick={togglePlay}
        >
          {playing ? 'Pause' : 'Play'}
        </button>
        <button
          type="button"
          className="btn-quiet photo-viewer-icon photo-viewer-step"
          aria-label={next ? `Next photo, ${label(next)}` : 'Next photo'}
          disabled={!next}
          onClick={() => step(next)}
        >
          <Icon name="ChevronRight" size={28} />
        </button>
      </div>

      {photos.length > 1 ? (
        <button
          type="button"
          className="btn-secondary photo-viewer-compare"
          aria-label={`Compare ${label(first)} with ${label(pair)}`}
          onClick={compare}
        >
          Compare
        </button>
      ) : null}
    </div>
  )
}
