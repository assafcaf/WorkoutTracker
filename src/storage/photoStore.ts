import { db } from './db'
import { encodePhoto, type ImageIo } from './photoImage'
import { requestPersistence } from './persist'

export type PhotoAngle = 'front' | 'side' | 'back'
export type PhotoAlign = { scale: number; rotate: number; dx: number; dy: number }
/** Which camera took a photo: the front (selfie) one or the back one. */
export type PhotoCamera = 'user' | 'environment'
/** How a photo arrived: a live-preview frame, the iPhone camera app, or the photo library. */
export type PhotoSource = 'live' | 'native' | 'library'
/**
 * The body's size in the frame, as a fraction of the frame's height (photos v2): shoulder-mid to
 * ankle-mid (`full`, null when the ankles were hidden) and shoulder-mid to hip-mid (`torso`).
 * A later photo's distance cue is its own size over this one.
 */
export type PhotoBodyScale = { full: number | null; torso: number }
/** The top of the head and the soles, as fractions of the photo's height from its top. */
export type PhotoBodyLines = { head: number; feet: number }

/**
 * What the capture knew when the photo was taken (photos v2). Every field is optional: photos
 * from before v2, and ones from the library, have none of them.
 */
export type PhotoCaptureInfo = {
  camera?: PhotoCamera
  /** The phone's sideways tilt at the shutter, degrees (median of the last 0.5 s). */
  roll?: number
  /** The phone's lean toward or away at the shutter, degrees (median of the last 0.5 s). */
  pitch?: number
  bodyScale?: PhotoBodyScale
  bodyLines?: PhotoBodyLines
  source?: PhotoSource
  /** The live stream's size when the frame was taken. */
  streamWidth?: number
  streamHeight?: number
}

export type Photo = {
  id: string
  /** Local calendar day, YYYY-MM-DD. */
  day: string
  angle: PhotoAngle
  /** The re-encoded image bytes. */
  data: ArrayBuffer
  /** Mime type of the data, e.g. image/jpeg. */
  type: string
  width: number
  height: number
  align: PhotoAlign | null
  createdAt: number
} & PhotoCaptureInfo

export type NewPhoto = { file: Blob; day: string; angle: PhotoAngle; align: PhotoAlign | null } & PhotoCaptureInfo

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)

/**
 * The capture fields of `source` that are present and well formed, and nothing else: a photo
 * without them keeps exactly its old shape, and a malformed field (from an old or edited backup)
 * is dropped rather than stored.
 */
export function captureInfoOf(source: PhotoCaptureInfo): PhotoCaptureInfo {
  const info: PhotoCaptureInfo = {}
  if (source.camera === 'user' || source.camera === 'environment') info.camera = source.camera
  if (finite(source.roll)) info.roll = source.roll
  if (finite(source.pitch)) info.pitch = source.pitch
  const scale = source.bodyScale
  if (scale && finite(scale.torso) && scale.torso > 0 && (scale.full === null || (finite(scale.full) && scale.full > 0))) {
    info.bodyScale = { full: scale.full, torso: scale.torso }
  }
  const lines = source.bodyLines
  if (lines && finite(lines.head) && finite(lines.feet)) info.bodyLines = { head: lines.head, feet: lines.feet }
  if (source.source === 'live' || source.source === 'native' || source.source === 'library') info.source = source.source
  if (finite(source.streamWidth) && finite(source.streamHeight)) {
    info.streamWidth = source.streamWidth
    info.streamHeight = source.streamHeight
  }
  return info
}

/** The bytes of a Blob. Photos are kept as bytes, not Blobs: WebKit's IndexedDB Blob history is poor. */
function bytesOf(blob: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as ArrayBuffer)
    reader.onerror = () => reject(reader.error)
    reader.readAsArrayBuffer(blob)
  })
}

/** Re-encodes and stores a photo; the first save asks for storage persistence. */
export async function add(input: NewPhoto, io?: ImageIo): Promise<Photo> {
  const encoded = await encodePhoto(input.file, io)
  const photo: Photo = {
    id: crypto.randomUUID(),
    day: input.day,
    angle: input.angle,
    data: await bytesOf(encoded.blob),
    type: encoded.blob.type,
    width: encoded.width,
    height: encoded.height,
    align: input.align,
    createdAt: Date.now(),
    ...captureInfoOf(input),
  }
  await db.photos.put(photo)
  await requestPersistence()
  return photo
}

/** Every photo, newest day first. */
export async function list(): Promise<Photo[]> {
  return db.photos.orderBy('day').reverse().toArray()
}

export async function remove(id: string): Promise<void> {
  await db.photos.delete(id)
}

/** Puts a removed photo back exactly as it was (the Undo of a delete). */
export async function restore(photo: Photo): Promise<void> {
  await db.photos.put(photo)
}
