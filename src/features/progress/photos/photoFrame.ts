import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { shortDay } from '../../../domain/lifts'
import type { Photo } from '../../../storage/photoStore'

/** A photo's saved transform as CSS: dx and dy are fractions of the frame, rotate is degrees. */
export function transformOf(photo: Photo): CSSProperties {
  const a = photo.align
  if (!a) return {}
  return { transform: `translate(${a.dx * 100}%, ${a.dy * 100}%) rotate(${a.rotate}deg) scale(${a.scale})` }
}

/**
 * An object URL for a photo's bytes (undefined until it exists), revoked when the photo changes
 * or the caller unmounts. Made in the effect that revokes it, so a remount (StrictMode runs every
 * effect twice in development) never leaves an image pointing at a revoked URL.
 */
export function useImageUrl(photo: Photo): string | undefined {
  const [url, setUrl] = useState<string | undefined>(undefined)
  useEffect(() => {
    if (typeof URL.createObjectURL !== 'function') return
    const made = URL.createObjectURL(new Blob([photo.data], { type: photo.type }))
    setUrl(made)
    return () => {
      if (typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(made)
    }
  }, [photo])
  return url
}

/** A photo day as the app writes dates: "12 Oct", with the year when it is not this year. */
export const dayLabel = (day: string, now: Date = new Date()): string =>
  shortDay(new Date(`${day}T12:00:00`).getTime(), now)
