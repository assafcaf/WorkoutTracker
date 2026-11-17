import type { PhotoCamera } from '../../../../storage/photoStore'
import { forgetDeviceId, saveDeviceId, savedDeviceId } from './cameraPrefs'

/** A live camera preview the capture screen draws and takes a frame from. */
export type LiveFeed = {
  /** Shows the stream in `video`. */
  attach(video: HTMLVideoElement): void
  /** The current frame as an image. */
  grab(): Promise<Blob>
  /** Ends the stream: stops every track and detaches it from every video it was shown in. */
  stop(): void
  /** The camera asked for. */
  facing?: PhotoCamera
  /** The stream's frame size, when the browser reports it. */
  size?: { width: number; height: number } | null
  /** False when the browser says it opened a different camera from the one asked for. */
  facingMatches?: boolean
}

/** Opens a camera (front by default); rejects when it cannot (the screen then falls back to the file input). */
export type OpenCamera = (facing?: PhotoCamera) => Promise<LiveFeed>

/** How long the camera may take to show a first frame before it counts as failed. */
const FIRST_FRAME_MS = 3000

/**
 * One aspect for the live stream and the native camera's photo: 3:4 portrait, full sensor. `ideal`
 * only, never `exact`: WebKit throws OverconstrainedError for an exact 4/3 in portrait (WebKit 214689).
 */
export const STREAM_CONSTRAINTS = {
  width: { ideal: 1440 },
  height: { ideal: 1920 },
  aspectRatio: { ideal: 3 / 4 },
} as const

/**
 * The plain wide back lens among `devices`: labelled "back" and not ultra-wide, dual, triple or
 * telephoto, whose lens switching would break a series (WebKit 253186, 262416). Labels exist only
 * after a permission grant, and iOS localises them, so this may find nothing; then the caller
 * falls back to `facingMode`.
 */
export function pickBackCamera(devices: readonly Pick<MediaDeviceInfo, 'kind' | 'label' | 'deviceId'>[]): string | null {
  const cams = devices.filter((d) => d.kind === 'videoinput' && d.deviceId)
  const plain = cams.find((d) => /back|rear|environment/i.test(d.label) && !/ultra|dual|triple|tele/i.test(d.label))
  return plain?.deviceId ?? null
}

async function backCameraId(devices: MediaDevices): Promise<string | null> {
  if (typeof devices.enumerateDevices !== 'function') return null
  try {
    return pickBackCamera(await devices.enumerateDevices())
  } catch {
    return null
  }
}

const stopStream = (stream: MediaStream): void => stream.getTracks().forEach((track) => track.stop())

async function request(devices: MediaDevices, facing: PhotoCamera, deviceId: string | null): Promise<MediaStream> {
  const video = deviceId
    ? { ...STREAM_CONSTRAINTS, deviceId: { exact: deviceId } }
    : { ...STREAM_CONSTRAINTS, facingMode: { ideal: facing } }
  return devices.getUserMedia({ video, audio: false })
}

/**
 * The browser's camera. Prefers a remembered deviceId for `facing` (and, for the back, the plain
 * wide lens), falls back to `facingMode`. Rejects when there is no camera API, the stream is
 * refused, its track is ended or muted, or no frame arrives within 3 s (WebKit's getUserMedia can
 * freeze). The caller stops any earlier feed first: on iOS a second getUserMedia ends the first
 * stream's track (WebKit 179363).
 */
export const openDeviceCamera: OpenCamera = async (facing = 'user') => {
  const devices = typeof navigator === 'undefined' ? undefined : navigator.mediaDevices
  if (!devices?.getUserMedia) throw new Error('no camera API')
  let id = savedDeviceId(facing)
  if (!id && facing === 'environment') id = await backCameraId(devices)
  let stream: MediaStream
  try {
    stream = await request(devices, facing, id)
  } catch (error) {
    if (!id) throw error
    // A remembered camera that is gone (a new phone, a reset): forget it and ask by facing.
    forgetDeviceId(facing)
    id = null
    stream = await request(devices, facing, null)
  }
  let track = stream.getVideoTracks()[0]
  if (!id && facing === 'environment' && track) {
    // The first grant: labels are only readable now. If the plain back lens is another device
    // than the one `facingMode` chose (often the triple camera), reopen on it.
    const plain = await backCameraId(devices)
    if (plain && plain !== track.getSettings?.().deviceId) {
      stopStream(stream)
      try {
        stream = await request(devices, facing, plain)
      } catch {
        stream = await request(devices, facing, null)
      }
      track = stream.getVideoTracks()[0]
    }
  }
  const stop = (): void => stopStream(stream)
  if (!track || track.readyState === 'ended' || track.muted) {
    stop()
    throw new Error('the camera track is not live')
  }
  const settings = track.getSettings?.() ?? {}
  const facingMatches = settings.facingMode === undefined || settings.facingMode === facing
  if (facingMatches && settings.deviceId) saveDeviceId(facing, settings.deviceId)
  const probe = document.createElement('video')
  probe.muted = true
  probe.playsInline = true
  probe.srcObject = stream
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('no frame in time')), FIRST_FRAME_MS)
      probe.addEventListener(
        'loadeddata',
        () => {
          clearTimeout(timer)
          resolve()
        },
        { once: true },
      )
      void probe.play().catch(reject)
    })
  } catch (error) {
    stop()
    probe.srcObject = null
    throw error
  }
  const shown: HTMLVideoElement[] = [probe]
  const width = probe.videoWidth || settings.width || 0
  const height = probe.videoHeight || settings.height || 0
  return {
    facing,
    facingMatches,
    size: width > 0 && height > 0 ? { width, height } : null,
    attach(video) {
      video.muted = true
      video.playsInline = true
      video.srcObject = stream
      shown.push(video)
      void video.play().catch(() => undefined)
    },
    grab() {
      const canvas = document.createElement('canvas')
      canvas.width = probe.videoWidth
      canvas.height = probe.videoHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) return Promise.reject(new Error('Canvas is not available'))
      // Never mirrored: only the front preview is drawn mirrored, the saved frame is as seen.
      ctx.drawImage(probe, 0, 0)
      return new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('no frame'))), 'image/jpeg', 0.9)
      })
    },
    stop() {
      stop()
      for (const video of shown) video.srcObject = null
    },
  }
}
