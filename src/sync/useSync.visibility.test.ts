import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { db } from '../storage/db'
import { FakeSyncServer } from '../test/fakeSyncServer'
import { useSync } from './useSync'

// An installed iPhone app coming back from the background is not a new mount: the page only
// fires `visibilitychange`. Without a sync there, work logged on another device never reaches
// the phone until the trainee presses "Sync now" in Settings.

const NOW = 1_700_000_000_000 + 5 * 60 * 60 * 1_000
const SETTLE = { timeout: 2000 }

let server: FakeSyncServer
beforeEach(async () => {
  await db.open()
  await db.sessions.clear()
  await db.settings.clear()
  server = new FakeSyncServer()
})

afterEach(() => {
  setVisibility('visible')
})

function setVisibility(state: DocumentVisibilityState): void {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state })
}

/** The page is hidden (another app on top), then shown again. */
function leaveAndReturn(): void {
  setVisibility('hidden')
  document.dispatchEvent(new Event('visibilitychange'))
  setVisibility('visible')
  document.dispatchEvent(new Event('visibilitychange'))
}

function mount() {
  return renderHook(() => useSync({ fetch: server.fetch, now: () => NOW }))
}

async function mountSyncDone(): Promise<ReturnType<typeof mount>> {
  const hook = mount()
  await waitFor(() => {
    expect(server.requestsTo('/api/sync')).toHaveLength(1)
    expect(server.pending).toBe(0)
  }, SETTLE)
  return hook
}

test('returning to the app (the page becomes visible again) runs another sync by itself', async () => {
  await mountSyncDone()

  leaveAndReturn()

  await waitFor(() => {
    expect(server.requestsTo('/api/sync')).toHaveLength(2)
  }, SETTLE)
})

test('the page going hidden runs no sync', async () => {
  await mountSyncDone()

  setVisibility('hidden')
  document.dispatchEvent(new Event('visibilitychange'))

  await new Promise((resolve) => setTimeout(resolve, 100))
  expect(server.requestsTo('/api/sync')).toHaveLength(1)
})

test('after unmount, returning to the app runs no sync', async () => {
  const { unmount } = await mountSyncDone()
  unmount()

  leaveAndReturn()

  await new Promise((resolve) => setTimeout(resolve, 100))
  expect(server.requestsTo('/api/sync')).toHaveLength(1)
})
