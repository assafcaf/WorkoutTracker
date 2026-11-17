import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import type { NewPhoto, Photo, PhotoAngle, PhotoCamera, PhotoCaptureInfo } from '../../../../storage/photoStore'
import { Segmented } from '../../../../ui/controls'
import { AlignView } from './AlignView'
import { openDeviceCamera } from './camera'
import type { LiveFeed, OpenCamera } from './camera'
import { saveFacing, savedFacing } from './cameraPrefs'
import { LiveView } from './LiveView'
import { loadPoseModel } from './pose'
import type { LoadPose } from './pose'
import { unlockCaptureSound } from './sound'
import { useObjectUrl } from './useObjectUrl'
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
  /** The pose model for the distance cue; defaults to MediaPipe, loaded when the live camera opens. Null turns it off. */
  loadPose?: LoadPose | null
}

const ANGLES: { value: PhotoAngle; label: string }[] = [
  { value: 'front', label: 'Front' },
  { value: 'side', label: 'Side' },
  { value: 'back', label: 'Back' },
]
const CAMERAS: { value: PhotoCamera; label: string }[] = [
  { value: 'user', label: 'Front camera' },
  { value: 'environment', label: 'Back camera' },
]
const UNAVAILABLE = 'Camera preview unavailable on this phone, so Take photo opens the iPhone camera.'

type Step = 'pick' | 'live' | 'align' | 'saved'

/** The camera a photo was taken with; photos from before v2 came from the front camera. */
const cameraOf = (photo: Photo): PhotoCamera => photo.camera ?? 'user'

const photoBlob = (photo: Photo | undefined): Blob | null =>
  photo ? new Blob([photo.data], { type: photo.type }) : null

function shortDate(day: string): string {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

/** The next view of a check-in after `current`, in the order front, side, back, skipping views already taken. */
function nextView(current: PhotoAngle, taken: ReadonlySet<PhotoAngle>): PhotoAngle | null {
  const order = ANGLES.map((a) => a.value)
  const after = order.slice(order.indexOf(current) + 1)
  return after.find((a) => !taken.has(a)) ?? null
}

/**
 * Takes progress photos and lines each up (E26-T7, decision 0026, photos v2). The file input always
 * works; the live camera (front or back, chosen per view) with a ghost, level, distance cue and
 * timer is tried first and any failure falls back to the file input in the same tap. Each new photo
 * is aligned over the last one of its view and camera by a stored transform; its pixels never
 * change. After a save the flow offers the next view of the day's check-in, or Done.
 */
export function PhotoCapture({
  photos,
  day,
  onSave,
  onClose,
  openCamera = openDeviceCamera,
  loadPose = loadPoseModel,
}: PhotoCaptureProps): JSX.Element {
  const [step, setStep] = useState<Step>('pick')
  const [angle, setAngle] = useState<PhotoAngle>('front')
  const [facing, setFacing] = useState<PhotoCamera>(() => savedFacing('front'))
  const [note, setNote] = useState('')
  const [feed, setFeed] = useState<LiveFeed | null>(null)
  const [switching, setSwitching] = useState(false)
  const [image, setImage] = useState<Blob | null>(null)
  const [info, setInfo] = useState<PhotoCaptureInfo>({})
  const [savedHere, setSavedHere] = useState<PhotoAngle[]>([])
  const cameraInput = useRef<HTMLInputElement>(null)
  const libraryInput = useRef<HTMLInputElement>(null)
  const mounted = useRef(true)

  // Newest first: the reference is the last photo of this view taken with this camera.
  const reference = useMemo(() => photos.find((p) => p.angle === angle && cameraOf(p) === facing), [photos, angle, facing])
  const referenceBlob = useMemo(() => photoBlob(reference), [reference])
  const referenceUrl = useObjectUrl(referenceBlob)
  const takenToday = useMemo(
    () => new Set<PhotoAngle>([...photos.filter((p) => p.day === day).map((p) => p.angle), ...savedHere]),
    [photos, day, savedHere],
  )

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  useEffect(() => () => feed?.stop(), [feed])
  // The control that opened this screen is gone; leave no stray focus ring on the new one.
  useEffect(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
  }, [])

  const chooseView = (next: PhotoAngle): void => {
    setAngle(next)
    setFacing(savedFacing(next))
  }
  const chooseCamera = (next: PhotoCamera): void => {
    setFacing(next)
    saveFacing(angle, next)
  }

  const stopFeed = (): void => {
    feed?.stop()
    setFeed(null)
  }

  const took = (blob: Blob, captured: PhotoCaptureInfo): void => {
    setImage(blob)
    setInfo(captured)
    setStep('align')
  }

  const takePhoto = async (): Promise<void> => {
    setNote('')
    unlockCaptureSound()
    const motion = (window as unknown as { DeviceMotionEvent?: { requestPermission?: () => Promise<string> } }).DeviceMotionEvent
    if (typeof motion?.requestPermission === 'function') void motion.requestPermission().catch(() => undefined)
    try {
      setFeed(await openCamera(facing))
      setStep('live')
    } catch {
      setNote(UNAVAILABLE)
      cameraInput.current?.click()
    }
  }

  /** Front to back or back: the old tracks stop before the other camera is asked for (WebKit 179363). */
  const switchCamera = async (next: PhotoCamera): Promise<void> => {
    const previous = facing
    feed?.stop()
    setFeed(null)
    setSwitching(true)
    chooseCamera(next)
    try {
      const opened = await openCamera(next)
      if (mounted.current) setFeed(opened)
      else opened.stop()
    } catch {
      chooseCamera(previous)
      try {
        const reopened = await openCamera(previous)
        if (mounted.current) setFeed(reopened)
        else reopened.stop()
      } catch {
        if (mounted.current) {
          setStep('pick')
          setNote(UNAVAILABLE)
        }
      }
    } finally {
      if (mounted.current) setSwitching(false)
    }
  }

  const chosen =
    (source: 'native' | 'library') =>
    (event: ChangeEvent<HTMLInputElement>): void => {
      const file = event.target.files?.[0]
      event.target.value = ''
      if (file) took(file, source === 'native' ? { camera: facing, source } : { source })
    }

  const view = ANGLES.find((a) => a.value === angle) ?? ANGLES[0]

  if (step === 'live') {
    return (
      <LiveView
        feed={feed}
        facing={facing}
        switching={switching}
        view={view}
        reference={reference}
        referenceBlob={referenceBlob}
        referenceUrl={referenceUrl}
        loadPose={loadPose ?? undefined}
        onClose={() => {
          stopFeed()
          setStep('pick')
        }}
        onSwitch={(next) => void switchCamera(next)}
        onFrame={(blob, captured) => {
          stopFeed()
          took(blob, captured)
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
        initialLines={info.bodyLines ?? null}
        onRetake={() => {
          setImage(null)
          setStep('pick')
        }}
        onSave={async (align, lines) => {
          const rest: PhotoCaptureInfo = { ...info }
          delete rest.bodyLines
          await onSave({ file: image, day, angle, align, ...rest, ...(lines ? { bodyLines: lines } : {}) })
          setSavedHere((list) => [...list, angle])
          setImage(null)
          setStep('saved')
        }}
      />
    )
  }

  if (step === 'saved') {
    const next = nextView(angle, takenToday)
    const nextLabel = next ? ANGLES.find((a) => a.value === next)?.label : null
    return (
      <div className="photo-capture">
        <header className="photo-header">
          <span className="photo-header-end" />
          <h1 className="photo-title">Saved</h1>
          <span className="photo-header-end" />
        </header>
        <div className="photo-body">
          <section className="photo-card" aria-label="Check-in" role="status">
            <p className="photo-card-label">{`${shortDate(day)} check-in`}</p>
            <p>
              {next
                ? `${view.label} photo saved. ${nextLabel} next, from the same spot.`
                : `${view.label} photo saved. Every view for today is done.`}
            </p>
          </section>
        </div>
        <footer className="photo-actions">
          {next && nextLabel ? (
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                chooseView(next)
                setNote('')
                setStep('pick')
              }}
            >
              {`Next: ${nextLabel}`}
            </button>
          ) : null}
          {next ? (
            <button type="button" className="btn-secondary" onClick={onClose}>
              Done
            </button>
          ) : (
            <button type="button" className="btn-primary" onClick={onClose}>
              Done
            </button>
          )}
        </footer>
      </div>
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
        <Segmented name="photo-angle" label="View" value={angle} options={ANGLES} onChange={chooseView} />
        <Segmented name="photo-camera" label="Camera" value={facing} options={CAMERAS} onChange={chooseCamera} />
        <section className="photo-card" aria-label="Setup">
          <p className="photo-card-label">Same setup every time</p>
          <p>
            {facing === 'environment'
              ? 'Phone at chest height on a shelf, 2.5 m away; level it before you walk to your spot. Ticks speed up as you near the right distance, and one high tone means it matches. Same light, arms relaxed 15 cm from your body.'
              : 'Phone at chest height on a shelf, 2.5 m away. Tape on the floor where your toes go. Same light, same time of day, arms relaxed 15 cm from your body.'}
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
      <input
        ref={cameraInput}
        className="photo-file"
        hidden
        type="file"
        accept="image/*"
        capture={facing === 'environment' ? 'environment' : 'user'}
        aria-label="Camera photo"
        onChange={chosen('native')}
      />
      <input ref={libraryInput} className="photo-file" hidden type="file" accept="image/*" aria-label="Library photo" onChange={chosen('library')} />
    </div>
  )
}
