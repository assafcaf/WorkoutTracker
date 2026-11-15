import { describe, expect, it, vi } from 'vitest'

vi.mock('virtual:pwa-register', () => ({ registerSW: () => async () => {} }))

import { UPDATE_CHECK_INTERVAL_MS, watchForUpdates } from './registerSW'

function fakeDoc() {
  const listeners: Array<() => void> = []
  return {
    visibilityState: 'hidden' as DocumentVisibilityState,
    addEventListener: (_type: string, fn: () => void) => listeners.push(fn),
    removeEventListener: (_type: string, fn: () => void) => {
      listeners.splice(listeners.indexOf(fn), 1)
    },
    fire() {
      listeners.forEach((fn) => fn())
    },
    listeners,
  }
}

describe('watchForUpdates', () => {
  it('checks for a new version when the app comes back to the foreground', () => {
    const update = vi.fn().mockResolvedValue(undefined)
    const doc = fakeDoc()
    watchForUpdates({ update }, { doc: doc as never, setInterval: () => 1, clearInterval: () => {} })

    doc.fire() // went to the background
    expect(update).not.toHaveBeenCalled()
    doc.visibilityState = 'visible'
    doc.fire()
    expect(update).toHaveBeenCalledTimes(1)
  })

  it('checks hourly while the app stays open, and stops when told', () => {
    const update = vi.fn().mockResolvedValue(undefined)
    const doc = fakeDoc()
    let tick: () => void = () => {}
    let interval = 0
    const clear = vi.fn()
    const stop = watchForUpdates(
      { update },
      {
        doc: doc as never,
        setInterval: (fn, ms) => {
          tick = fn
          interval = ms
          return 7
        },
        clearInterval: clear,
      },
    )
    expect(interval).toBe(UPDATE_CHECK_INTERVAL_MS)
    tick()
    expect(update).toHaveBeenCalledTimes(1)

    stop()
    expect(clear).toHaveBeenCalledWith(7)
    expect(doc.listeners).toHaveLength(0)
  })

  it('swallows a failed check (offline) so nothing surfaces', async () => {
    const update = vi.fn().mockRejectedValue(new Error('offline'))
    const doc = fakeDoc()
    doc.visibilityState = 'visible'
    watchForUpdates({ update }, { doc: doc as never, setInterval: () => 1, clearInterval: () => {} })
    doc.fire()
    await Promise.resolve()
    expect(update).toHaveBeenCalledTimes(1)
  })
})
