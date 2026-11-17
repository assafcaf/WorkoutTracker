import { renderHook } from '@testing-library/react'
import { StrictMode } from 'react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { useObjectUrl } from './useObjectUrl'

// The reference ghost and the "Next to match" thumbnail read their bytes through this URL.

let made = 0
let revoked: Set<string>

beforeEach(() => {
  made = 0
  revoked = new Set()
  URL.createObjectURL = vi.fn(() => `blob:test-${++made}`)
  URL.revokeObjectURL = vi.fn((url: string) => void revoked.add(url))
})
afterEach(() => {
  vi.restoreAllMocks()
})

const strict = ({ children }: { children: ReactNode }): JSX.Element => <StrictMode>{children}</StrictMode>

test('the URL a StrictMode mount ends with is still live (development runs effects twice)', () => {
  const blob = new Blob(['x'], { type: 'image/jpeg' })
  const { result } = renderHook(() => useObjectUrl(blob), { wrapper: strict })
  expect(result.current).not.toBeNull()
  expect(revoked.has(result.current as string)).toBe(false)
})

test('the URL is revoked when the source changes and when the caller unmounts', () => {
  const first = new Blob(['a'])
  const second = new Blob(['b'])
  const { result, rerender, unmount } = renderHook(({ source }) => useObjectUrl(source), {
    initialProps: { source: first as Blob | null },
  })
  const one = result.current as string
  rerender({ source: second })
  const two = result.current as string
  expect(two).not.toBe(one)
  expect(revoked.has(one)).toBe(true)
  expect(revoked.has(two)).toBe(false)
  unmount()
  expect(revoked.has(two)).toBe(true)
})

test('no source, no URL', () => {
  const { result } = renderHook(() => useObjectUrl(null))
  expect(result.current).toBeNull()
  expect(URL.createObjectURL).not.toHaveBeenCalled()
})
