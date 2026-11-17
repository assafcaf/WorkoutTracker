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
export function fitWithin(_size: ImageSize): ImageSize {
  throw new Error('NotImplementedError')
}

/** Re-encodes `file` without metadata and within MAX_PHOTO_SIDE. */
export async function encodePhoto(_file: Blob, _io?: ImageIo): Promise<EncodedPhoto> {
  throw new Error('NotImplementedError')
}
