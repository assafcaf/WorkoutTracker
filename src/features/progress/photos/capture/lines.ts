import type { PhotoBodyLines } from '../../../../storage/photoStore'

/** A box as fractions of its container: left, top, width, height. */
export type Box = { left: number; top: number; width: number; height: number }

/**
 * Where an image of aspect `image` (width / height) sits inside a container of aspect `container`
 * under `object-fit: contain`, as fractions of the container. The ghost, the video and the lines
 * are all drawn this way, so they coincide.
 */
export function containedBox(image: number, container: number): Box {
  if (!(image > 0) || !(container > 0)) return { left: 0, top: 0, width: 1, height: 1 }
  if (image > container) {
    const height = container / image
    return { left: 0, top: (1 - height) / 2, width: 1, height }
  }
  const width = image / container
  return { left: (1 - width) / 2, top: 0, width, height: 1 }
}

/** The smallest gap kept between the head and feet lines, as a fraction of the photo height. */
export const MIN_LINE_GAP = 0.2

/** Moves one line by `dy` (fraction of the photo height), kept on the photo and apart from the other. */
export function movedLines(lines: PhotoBodyLines, which: keyof PhotoBodyLines, dy: number): PhotoBodyLines {
  const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v))
  if (which === 'head') return { ...lines, head: clamp(lines.head + dy, 0, lines.feet - MIN_LINE_GAP) }
  return { ...lines, feet: clamp(lines.feet + dy, lines.head + MIN_LINE_GAP, 1) }
}
