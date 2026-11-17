import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, PointerEvent as ReactPointerEvent } from 'react'
import type { NewPhoto, Photo, PhotoAlign, PhotoAngle } from '../../../../storage/photoStore'
import { Segmented } from '../../../../ui/controls'
import { IDENTITY_ALIGN, cssTransform, dragged, pinched, tiltDegrees } from './align'
import type { Point } from './align'
import { openDeviceCamera } from './camera'
import type { LiveFeed, OpenCamera } from './camera'
import './PhotoCapture.css'

export type PhotoCaptureProps = {
  /** Photos already taken (the last of the chosen view is the ghost). */
  photos: Photo[]
  /** Local calendar day the new photo is for, YYYY-MM-DD. */
  day: string
  onSave(input: NewPhoto): Promise<void>
  onClose(): void
  /** The live camera; defaults to the device's. */
  openCamera?: OpenCamera
}

const ANGLES: { value: PhotoAngle; label: string }[] = [
  { value: 'front', label: 'Front' },
  { value: 'side', label: 'Side' },
  { value: 'back', label: 'Back' },
]
const GHOSTS = [35, 60, 0] as const
const TIMER_SECONDS = 10
const LEVEL_WITHIN_DEGREES = 1.5

type Step = 'pick' | 'live' | 'align'
type Timer = '10' | 'off'

/** An object URL for `source` while it is mounted; none where the browser has no such thing. */
function useObjectUrl(source: Blob | null): string | null {
  const url = useMemo(
    () => (source && typeof URL.createObjectURL === 'function' ? URL.createObjectURL(source) : null),
    [source],
  )
  useEffect(
    () => () => {
      if (url && typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(url)
    },
    [url],
  )
  return url
}

const photoBlob = (photo: Photo | undefined): Blob | null =>
  photo ? new Blob([photo.data], { type: photo.type }) : null

function shortDate(day: string): string {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

/**
 * Takes a progress photo and lines it up (E26-T7, decision 0026). The file input always works;
 * the live camera with a ghost, level and timer is tried first and any failure falls back to
 * the file input in the same tap. The new photo is aligned over the last one of its view by a
 * stored transform; its pixels never change.
 */
export function PhotoCapture({ photos, day, onSave, onClose, openCamera = openDeviceCamera }: PhotoCaptureProps): JSX.Element {
  const [step, setStep] = useState<Step>('pick')
  const [angle, setAngle] = useState<PhotoAngle>('front')
  const [note, setNote] = useState('')
  const [feed, setFeed] = useState<LiveFeed | null>(null)
  const [image, setImage] = useState<Blob | null>(null)
  const cameraInput = useRef<HTMLInputElement>(null)
  const libraryInput = useRef<HTMLInputElement>(null)

  const reference = useMemo(() => photos.find((p) => p.angle === angle), [photos, angle]) // newest first
  const referenceBlob = useMemo(() => photoBlob(reference), [reference])
  const referenceUrl = useObjectUrl(referenceBlob)

  const stopFeed = (): void => {
    feed?.stop()
    setFeed(null)
  }
  useEffect(() => () => feed?.stop(), [feed])
  // The control that opened this screen is gone; leave no stray focus ring on the new one.
  useEffect(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
  }, [])

  const took = (blob: Blob): void => {
    setImage(blob)
    setStep('align')
  }

  const takePhoto = async (): Promise<void> => {
    setNote('')
    const motion = (window as unknown as { DeviceMotionEvent?: { requestPermission?: () => Promise<string> } }).DeviceMotionEvent
    if (typeof motion?.requestPermission === 'function') void motion.requestPermission().catch(() => undefined)
    try {
      setFeed(await openCamera())
      setStep('live')
    } catch {
      setNote('Camera preview unavailable on this phone, so Take photo opens the iPhone camera.')
      cameraInput.current?.click()
    }
  }

  const chosen = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) took(file)
  }

  if (step === 'live' && feed) {
    return (
      <LiveView
        feed={feed}
        angle={angle}
        referenceUrl={referenceUrl}
        referenceAlign={reference?.align ?? null}
        onClose={() => {
          stopFeed()
          setStep('pick')
        }}
        onFrame={(blob) => {
          stopFeed()
          took(blob)
        }}
      />
    )
  }

  if (step === 'align' && image) {
    return (
      <AlignView
        image={image}
        angle={angle}
        referenceUrl={referenceUrl}
        referenceAlign={reference?.align ?? null}
        onRetake={() => {
          setImage(null)
          setStep('pick')
        }}
        onSave={async (align) => {
          await onSave({ file: image, day, angle, align })
          onClose()
        }}
      />
    )
  }

  return (
    <div className="photo-capture">
      <header className="photo-header">
        <button type="button" className="btn-quiet" onClick={onClose}>
          Close
        </button>
        <h1 className="photo-title">New photo</h1>
        <span className="photo-header-end" />
      </header>
      <div className="photo-body">
        <Segmented name="photo-angle" label="View" value={angle} options={ANGLES} onChange={setAngle} />
        <section className="photo-card" aria-label="Setup">
          <p className="photo-card-label">Same setup every time</p>
          <p>
            Phone at chest height on a shelf, 2.5 m away. Tape on the floor where your toes go. Same light, same time of
            day, arms relaxed 15 cm from your body.
          </p>
        </section>
        {reference ? (
          <section className="photo-card photo-next" aria-label="Next to match">
            {referenceUrl ? <img className="photo-thumb" src={referenceUrl} alt="" /> : null}
            <div>
              <p className="photo-card-label">Next to match</p>
              <p>
                Your {shortDate(reference.day)} {angle} photo is the reference. You will line the new one up with it.
              </p>
            </div>
          </section>
        ) : null}
      </div>
      <footer className="photo-actions">
        {note ? <p className="photo-note">{note}</p> : null}
        <button type="button" className="btn-primary" onClick={() => void takePhoto()}>
          Take photo
        </button>
        <button type="button" className="btn-secondary" onClick={() => libraryInput.current?.click()}>
          Choose from library
        </button>
      </footer>
      <input ref={cameraInput} className="photo-file" hidden type="file" accept="image/*" capture="user" aria-label="Camera photo" onChange={chosen} />
      <input ref={libraryInput} className="photo-file" hidden type="file" accept="image/*" aria-label="Library photo" onChange={chosen} />
    </div>
  )
}

function LiveView({
  feed,
  angle,
  referenceUrl,
  referenceAlign,
  onClose,
  onFrame,
}: {
  feed: LiveFeed
  angle: PhotoAngle
  referenceUrl: string | null
  referenceAlign: PhotoAlign | null
  onClose(): void
  onFrame(blob: Blob): void
}): JSX.Element {
  const video = useRef<HTMLVideoElement>(null)
  const [ghostIndex, setGhostIndex] = useState(0)
  const [timer, setTimer] = useState<Timer>('off')
  const [count, setCount] = useState<number | null>(null)
  const [tilt, setTilt] = useState<number | null>(null)
  const ghost = GHOSTS[ghostIndex]
  const onFrameRef = useRef(onFrame)
  onFrameRef.current = onFrame

  useEffect(() => {
    if (video.current) feed.attach(video.current)
  }, [feed])

  useEffect(() => {
    const onMotion = (event: Event): void => {
      const g = (event as Event & { accelerationIncludingGravity?: { x: number | null; y: number | null } })
        .accelerationIncludingGravity
      if (g && g.x !== null && g.y !== null) setTilt(tiltDegrees(g.x, g.y))
    }
    window.addEventListener('devicemotion', onMotion)
    return () => window.removeEventListener('devicemotion', onMotion)
  }, [])

  useEffect(() => {
    if (count === null) return
    if (count > 0) {
      const id = setTimeout(() => setCount(count - 1), 1000)
      return () => clearTimeout(id)
    }
    setCount(null)
    void feed.grab().then((blob) => onFrameRef.current(blob))
  }, [count, feed])

  const shutter = (): void => {
    if (count !== null) {
      setCount(null)
      return
    }
    if (timer === 'off') void feed.grab().then(onFrame)
    else setCount(TIMER_SECONDS)
  }

  return (
    <div className="photo-live">
      <video ref={video} className="photo-video" playsInline muted />
      {referenceUrl && ghost > 0 ? (
        <img
          className="photo-ghost"
          src={referenceUrl}
          alt={`Last ${angle} photo`}
          style={{ opacity: ghost / 100, transform: cssTransform(referenceAlign) }}
        />
      ) : null}
      {referenceUrl && ghost === 0 ? <span className="photo-visually-hidden">{`Last ${angle} photo hidden`}</span> : null}
      <header className="photo-header photo-header-live">
        <button type="button" className="btn-quiet" onClick={onClose}>
          Close
        </button>
        <h1 className="photo-title">{ANGLES.find((a) => a.value === angle)?.label}</h1>
        <button type="button" className="chip photo-chip" onClick={() => setGhostIndex((ghostIndex + 1) % GHOSTS.length)}>
          {`Ghost ${ghost}%`}
        </button>
      </header>
      {tilt !== null ? (
        <p className="photo-level" data-level={Math.abs(tilt) <= LEVEL_WITHIN_DEGREES}>
          {Math.abs(tilt) <= LEVEL_WITHIN_DEGREES ? 'Level' : `Tilt ${Math.round(Math.abs(tilt))}°`}
        </p>
      ) : null}
      {count !== null ? <p className="photo-countdown">{count}</p> : null}
      <div className="photo-live-controls">
        <Segmented
          name="photo-timer"
          label="Timer"
          value={timer}
          options={[
            { value: '10', label: '10 s' },
            { value: 'off', label: 'Off' },
          ]}
          onChange={setTimer}
        />
        <button type="button" className="icon-btn photo-shutter" aria-label="Shutter" onClick={shutter} />
      </div>
    </div>
  )
}

function AlignView({
  image,
  angle,
  referenceUrl,
  referenceAlign,
  onRetake,
  onSave,
}: {
  image: Blob
  angle: PhotoAngle
  referenceUrl: string | null
  referenceAlign: PhotoAlign | null
  onRetake(): void
  onSave(align: PhotoAlign): Promise<void>
}): JSX.Element {
  const url = useObjectUrl(image)
  const [align, setAlign] = useState<PhotoAlign>(IDENTITY_ALIGN)
  const [ghost, setGhost] = useState(50)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const pointers = useRef(new Map<number, Point>())

  const pos = (event: ReactPointerEvent): Point => ({ x: event.clientX, y: event.clientY })
  const down = (event: ReactPointerEvent<HTMLDivElement>): void => {
    pointers.current.set(event.pointerId, pos(event))
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }
  const move = (event: ReactPointerEvent<HTMLDivElement>): void => {
    const before = pointers.current.get(event.pointerId)
    if (!before) return
    const now = pos(event)
    const others = [...pointers.current.entries()].filter(([id]) => id !== event.pointerId).map(([, p]) => p)
    pointers.current.set(event.pointerId, now)
    const rect = event.currentTarget.getBoundingClientRect()
    if (others.length === 0) {
      setAlign((a) => dragged(a, now.x - before.x, now.y - before.y, { w: rect.width, h: rect.height }))
    } else {
      setAlign((a) => pinched(a, [before, others[0]], [now, others[0]]))
    }
  }
  const up = (event: ReactPointerEvent): void => {
    pointers.current.delete(event.pointerId)
  }

  const save = async (): Promise<void> => {
    setSaving(true)
    setError('')
    try {
      await onSave(align)
    } catch {
      setError('Could not save the photo')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="photo-capture">
      <header className="photo-header">
        <button type="button" className="btn-quiet" onClick={onRetake}>
          Retake
        </button>
        <h1 className="photo-title">Line up</h1>
        <button type="button" className="btn-quiet" disabled={saving} onClick={() => void save()}>
          Save
        </button>
      </header>
      <div className="photo-body">
        <div
          className="photo-stage"
          role="group"
          aria-label="Alignment"
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
        >
          {url ? <img className="photo-new" src={url} alt="New photo" style={{ transform: cssTransform(align) }} /> : null}
          {referenceUrl && ghost > 0 ? (
            <img
              className="photo-ghost"
              src={referenceUrl}
              alt={`Last ${angle} photo`}
              style={{ opacity: ghost / 100, transform: cssTransform(referenceAlign) }}
            />
          ) : null}
        </div>
        {error ? (
          <p className="photo-note" role="alert">
            {error}
          </p>
        ) : null}
        <p className="photo-note">Drag to move, pinch to resize and turn. The original photo is never changed.</p>
        <div className="photo-align-actions">
          <button type="button" className="btn-secondary" onClick={() => setAlign(IDENTITY_ALIGN)}>
            Reset
          </button>
          {referenceUrl ? (
            <button type="button" className="btn-secondary" onClick={() => setGhost(ghost === 50 ? 0 : 50)}>
              Ghost
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
