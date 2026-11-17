import { useEffect, useMemo } from 'react'

/** An object URL for `source` while it is mounted; none where the browser has no such thing. */
export function useObjectUrl(source: Blob | null): string | null {
  const url = useMemo(
    () => (source && typeof URL.createObjectURL === 'function' ? URL.createObjectURL(source) : null),
    [source],
  )
  useEffect(
    () => () => {
      if (url && typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(url)
    },
    [url],
  )
  return url
}
