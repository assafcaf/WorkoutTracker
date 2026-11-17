import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import type { NewPhoto, Photo, PhotoAngle, PhotoCamera, PhotoCaptureInfo, PhotoMode } from '../../../../storage/photoStore'
import { modeOf } from '../flip'
import { AlignView } from './AlignView'
import { openDeviceCamera } from './camera'
import type { LiveFeed, OpenCamera } from './camera'
import { saveFacing, saveMode, saveView, savedFacing, savedMode, savedView } from './cameraPrefs'
import { LiveView } from './LiveView'
import type { CameraState } from './LiveView'
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

type Step = 'live' | 'align' | 'saved'

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

/** The setup advice for the mode and camera, as the camera view's tips card says it. */
function setupCopy(mode: PhotoMode, facing: PhotoCamera, hand: string): { title: string; text: string } {
  if (mode === 'mirror') {
    return {
      title: 'In the mirror.',
      text: `Back camera at a full-length mirror, phone in your ${hand} hand at face height, held straight up. Stand where your feet show, about 1.3 m from the mirror, and mark the spot. Same light, same time of day; not right after a shower.`,
    }
  }
  return facing === 'environment'
    ? {
        title: 'On a stand.',
        text: 'Phone on a shelf or stand at chest height, back camera facing you. 10 s timer. Mark where your toes go. Ticks speed up as you near the right distance, and one high tone means it matches.',
      }
    : {
        title: 'On a stand.',
        text: 'Phone on a shelf or stand at chest height, screen facing you. Tape on the floor where your toes go. Same light, same time of day, arms relaxed 15 cm from your body.',
      }
}

/**
 * Takes progress photos and lines each up (E26-T7, decision 0026, photos v2, mirror mode). Capture
 * opens straight onto the live camera with the last-used view and each view's remembered mode
 * (Mirror for front and side, Stand for back the first time); every choice sits on the camera view
 * and changing one reconfigures it in place. When the live camera fails, the camera view says so
 * and "Use camera app" opens the iPhone camera; "Choose from library" is always there. Each new
 * photo is aligned over the last one of its view, mode and camera by a stored transform; its pixels
 * never change. After a save the flow offers the next view of the day's check-in, or Done.
 */
export function PhotoCapture({
  photos,
  day,
  onSave,
  onClose,
  openCamera = openDeviceCamera,
  loadPose = loadPoseModel,
}: PhotoCaptureProps): JSX.Element {
  const [step, setStep] = useState<Step>('live')
  const [angle, setAngle] = useState<PhotoAngle>(() => savedView())
  const [mode, setMode] = useState<PhotoMode>(() => savedMode(savedView()))
  const [standFacing, setStandFacing] = useState<PhotoCamera>(() => savedFacing(savedView()))
  const [feed, setFeed] = useState<LiveFeed | null>(null)
  const [camera, setCamera] = useState<CameraState>('opening')
  const [image, setImage] = useState<Blob | null>(null)
  const [info, setInfo] = useState<PhotoCaptureInfo>({})
  const [savedHere, setSavedHere] = useState<PhotoAngle[]>([])
  const [keepMirror, setKeepMirror] = useState(false)
  const [tipsHidden, setTipsHidden] = useState(false)
  const cameraInput = useRef<HTMLInputElement>(null)
  const libraryInput = useRef<HTMLInputElement>(null)
  const lastGood = useRef<PhotoCamera | null>(null)
  const askedMotion = useRef(false)
  const facing: PhotoCamera = mode === 'mirror' ? 'environment' : standFacing
  const latest = useRef({ mode, angle })
  latest.current = { mode, angle }

  // Newest first: the reference is the last photo of this view taken in this mode with this camera.
  const reference = useMemo(
    () => photos.find((p) => p.angle === angle && modeOf(p) === mode && cameraOf(p) === facing),
    [photos, angle, mode, facing],
  )
  const referenceBlob = useMemo(() => photoBlob(reference), [reference])
  const referenceUrl = useObjectUrl(referenceBlob)
  const takenToday = useMemo(
    () => new Set<PhotoAngle>([...photos.filter((p) => p.day === day).map((p) => p.angle), ...savedHere]),
    [photos, day, savedHere],
  )

  // The control that opened this screen is gone; leave no stray focus ring on the new one.
  useEffect(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
  }, [])

  // The live camera, opened for the current camera while the camera view shows. The cleanup stops
  // every old track before the other camera is asked for (WebKit 179363); a failed switch in Stand
  // mode reopens the camera that worked.
  useEffect(() => {
    if (step !== 'live') return
    let cancelled = false
    let opened: LiveFeed | null = null
    setCamera('opening')
    openCamera(facing).then(
      (f) => {
        if (cancelled) {
          f.stop()
          return
        }
        opened = f
        lastGood.current = facing
        setFeed(f)
        setCamera('open')
      },
      () => {
        if (cancelled) return
        const back = lastGood.current
        if (latest.current.mode === 'stand' && back && back !== facing) {
          setStandFacing(back)
          saveFacing(latest.current.angle, back)
          return
        }
        setCamera('failed')
      },
    )
    return () => {
      cancelled = true
      opened?.stop()
      setFeed(null)
    }
  }, [step, facing, openCamera])

  const touch = (): void => {
    unlockCaptureSound()
    if (askedMotion.current) return
    askedMotion.current = true
    const motion = (window as unknown as { DeviceMotionEvent?: { requestPermission?: () => Promise<string> } }).DeviceMotionEvent
    if (typeof motion?.requestPermission === 'function') void motion.requestPermission().catch(() => undefined)
  }

  // Opening is the tap that brought the trainee here: ask for motion now, while it still counts.
  useEffect(() => {
    touch()
  }, [])

  const chooseView = (next: PhotoAngle): void => {
    setAngle(next)
    saveView(next)
    setMode(savedMode(next))
    setStandFacing(savedFacing(next))
    setKeepMirror(false)
  }
  const chooseMode = (next: PhotoMode): void => {
    setMode(next)
    saveMode(angle, next)
  }
  const switchCamera = (next: PhotoCamera): void => {
    setStandFacing(next)
    saveFacing(angle, next)
  }

  const took = (blob: Blob, captured: PhotoCaptureInfo): void => {
    setImage(blob)
    setInfo(captured)
    setStep('align')
  }

  const chosen =
    (source: 'native' | 'library') =>
    (event: ChangeEvent<HTMLInputElement>): void => {
      const file = event.target.files?.[0]
      event.target.value = ''
      if (file) took(file, source === 'native' ? { camera: facing, source, mode } : { source })
    }

  const view = ANGLES.find((a) => a.value === angle) ?? ANGLES[0]
  const inputs = (
    <>
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
    </>
  )

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
          setStep('live')
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
                setStep('live')
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

  const hand = reference?.phoneHand ?? 'right'
  const copy = setupCopy(mode, facing, hand)
  const otherModePhotos = photos.some((p) => p.angle === angle && modeOf(p) !== mode)
  const showTips = !tipsHidden && !reference
  const notes = (
    <>
      {angle === 'back' && mode === 'mirror' && !keepMirror ? (
        <div className="photo-live-card" role="group" aria-label="Back in a mirror">
          <p>A back photo needs the phone on a stand, or a second mirror. Use Stand?</p>
          <div className="photo-live-card-actions">
            <button type="button" className="chip photo-chip" onClick={() => chooseMode('stand')}>
              Use Stand
            </button>
            <button type="button" className="chip photo-chip" onClick={() => setKeepMirror(true)}>
              Keep Mirror
            </button>
          </div>
        </div>
      ) : null}
      {mode === 'mirror' && !reference && otherModePhotos ? (
        <p className="photo-live-note">No mirror photo yet. This one becomes the reference.</p>
      ) : null}
      {showTips ? (
        <section className="photo-live-card" aria-label="Setup">
          <p>
            <strong>{copy.title}</strong> {copy.text}
          </p>
          <div className="photo-live-card-actions">
            <button type="button" className="chip photo-chip" onClick={() => setTipsHidden(true)}>
              Hide tips
            </button>
          </div>
        </section>
      ) : null}
    </>
  )

  return (
    <>
      <LiveView
        key={`${angle}-${mode}-${facing}`}
        feed={feed}
        facing={facing}
        camera={camera}
        view={view}
        mode={mode}
        reference={reference}
        referenceBlob={referenceBlob}
        referenceUrl={referenceUrl}
        referenceDay={reference ? shortDate(reference.day) : null}
        loadPose={loadPose ?? undefined}
        notes={notes}
        onView={chooseView}
        onMode={chooseMode}
        onClose={() => {
          feed?.stop()
          onClose()
        }}
        onSwitch={switchCamera}
        onFrame={(blob, captured) => took(blob, captured)}
        onCameraApp={() => cameraInput.current?.click()}
        onLibrary={() => libraryInput.current?.click()}
        onTouch={touch}
      />
      {inputs}
    </>
  )
}
