import type { ImageIo } from './photoImage'

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

/** Re-encodes and stores a photo; the first save asks for storage persistence. */
export async function add(_input: NewPhoto, _io?: ImageIo): Promise<Photo> {
  throw new Error('NotImplementedError')
}

/** Every photo, newest day first. */
export async function list(): Promise<Photo[]> {
  throw new Error('NotImplementedError')
}

export async function remove(_id: string): Promise<void> {
  throw new Error('NotImplementedError')
}

/** Puts a removed photo back exactly as it was (the Undo of a delete). */
export async function restore(_photo: Photo): Promise<void> {
  throw new Error('NotImplementedError')
}
