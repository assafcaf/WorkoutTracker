/** The longest side a stored progress photo may have, in pixels (E26-T1). */
export const MAX_PHOTO_SIDE = 1600

export type ImageSize = { width: number; height: number }

/**
 * The browser half of re-encoding, injected so the rest is testable without a canvas:
 * `decode` reads the picture's pixel size, `render` draws it at the given size and encodes it
 * as a JPEG (quality 0.85), which carries no EXIF.
 */
export type ImageIo = {
  decode(file: Blob): Promise<ImageSize>
  render(file: Blob, size: ImageSize): Promise<Blob>
}

export type EncodedPhoto = ImageSize & { blob: Blob }

/** `size` scaled down, keeping its ratio, so the longest side is at most MAX_PHOTO_SIDE. */
export function fitWithin(size: ImageSize): ImageSize {
  const longest = Math.max(size.width, size.height)
  if (longest <= MAX_PHOTO_SIDE) return { width: size.width, height: size.height }
  const k = MAX_PHOTO_SIDE / longest
  return {
    width: Math.max(1, Math.round(size.width * k)),
    height: Math.max(1, Math.round(size.height * k)),
  }
}

const JPEG_QUALITY = 0.85

/** The canvas implementation: createImageBitmap applies the EXIF orientation, drawing drops it. */
const canvasIo: ImageIo = {
  async decode(file) {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    const size = { width: bitmap.width, height: bitmap.height }
    bitmap.close()
    return size
  },
  async render(file, size) {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    const canvas = document.createElement('canvas')
    canvas.width = size.width
    canvas.height = size.height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas is not available')
    ctx.drawImage(bitmap, 0, 0, size.width, size.height)
    bitmap.close()
    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Could not encode the photo'))),
        'image/jpeg',
        JPEG_QUALITY,
      )
    })
  },
}

/** Re-encodes `file` without metadata and within MAX_PHOTO_SIDE. */
export async function encodePhoto(file: Blob, io: ImageIo = canvasIo): Promise<EncodedPhoto> {
  const size = fitWithin(await io.decode(file))
  const blob = await io.render(file, size)
  return { blob, width: size.width, height: size.height }
}
