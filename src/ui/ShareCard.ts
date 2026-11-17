// E26-T4 [O12]: renders a ShareCard to a PNG and shares or downloads it (stub).
import type { ShareCard } from '../domain/shareCard'

/** Draws the card on a canvas and returns it as an `image/png` Blob. */
export function renderShareCardBlob(_card: ShareCard): Promise<Blob> {
  return Promise.reject(new Error('not implemented'))
}

/**
 * Shares the PNG through the share sheet when `navigator.canShare({ files })` accepts it,
 * otherwise downloads it. Resolves 'shared' or 'downloaded'.
 */
export function shareCardImage(_card: ShareCard): Promise<'shared' | 'downloaded'> {
  return Promise.reject(new Error('not implemented'))
}
