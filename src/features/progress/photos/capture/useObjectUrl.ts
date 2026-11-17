import { useEffect, useState } from 'react'

/**
 * An object URL for `source` while it is mounted (null until it exists, and where the browser has
 * no such thing), revoked when the source changes or the caller unmounts. Made in the effect that
 * revokes it, as `useImageUrl` in `photoFrame.ts` does, so a remount (StrictMode runs every effect
 * twice in development) never leaves an image pointing at a revoked URL.
 */
export function useObjectUrl(source: Blob | null): string | null {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!source || typeof URL.createObjectURL !== 'function') {
      setUrl(null)
      return
    }
    const made = URL.createObjectURL(source)
    setUrl(made)
    return () => {
      if (typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(made)
    }
  }, [source])
  return url
}
