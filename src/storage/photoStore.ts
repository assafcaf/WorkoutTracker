import { db } from './db'
import { encodePhoto, type ImageIo } from './photoImage'
import { requestPersistence } from './persist'

export type PhotoAngle = 'front' | 'side' | 'back'
export type PhotoAlign = { scale: number; rotate: number; dx: number; dy: number }

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
}

export type NewPhoto = { file: Blob; day: string; angle: PhotoAngle; align: PhotoAlign | null }

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
