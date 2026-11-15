import { describe, expect, it, vi } from 'vitest'

vi.mock('virtual:pwa-register', () => ({ registerSW: () => async () => {} }))

import { UPDATE_CHECK_INTERVAL_MS, updateCheckBlocked, watchForUpdates } from './registerSW'

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

const noTimer = { setInterval: () => 1, clearInterval: () => {} }

describe('watchForUpdates', () => {
  it('checks for a new version when the app comes back to the foreground', () => {
    const update = vi.fn().mockResolvedValue(undefined)
    const doc = fakeDoc()
    watchForUpdates({ update }, { doc: doc as never, ...noTimer })

    expect(update).toHaveBeenCalledTimes(1) // on launch
    doc.fire() // went to the background
    expect(update).toHaveBeenCalledTimes(1)
    doc.visibilityState = 'visible'
    doc.fire()
    expect(update).toHaveBeenCalledTimes(2)
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
    expect(update).toHaveBeenCalledTimes(2)

    stop()
    expect(clear).toHaveBeenCalledWith(7)
    expect(doc.listeners).toHaveLength(0)
  })

  it('swallows a failed check (offline) so nothing surfaces', async () => {
    const update = vi.fn().mockRejectedValue(new Error('offline'))
    const doc = fakeDoc()
    doc.visibilityState = 'visible'
    watchForUpdates({ update }, { doc: doc as never, ...noTimer })
    doc.fire()
    await Promise.resolve()
    expect(update).toHaveBeenCalledTimes(2)
  })

  it('says sign in is needed when the login turns the check away, and clears once it passes', async () => {
    const update = vi.fn().mockRejectedValueOnce(new Error('redirect')).mockResolvedValue(undefined)
    const doc = fakeDoc()
    doc.visibilityState = 'visible'
    const seen: boolean[] = []
    watchForUpdates(
      { update },
      {
        doc: doc as never,
        ...noTimer,
        checkBlocked: async () => true,
        onSignInNeeded: (n) => seen.push(n),
      },
    )
    await vi.waitFor(() => expect(seen).toEqual([true]))
    doc.fire()
    await vi.waitFor(() => expect(seen).toEqual([true, false]))
  })

  it('does not ask to sign in when the check failed for another reason (offline)', async () => {
    const update = vi.fn().mockRejectedValue(new Error('offline'))
    const seen: boolean[] = []
    watchForUpdates(
      { update },
      {
        doc: fakeDoc() as never,
        ...noTimer,
        checkBlocked: async () => false,
        onSignInNeeded: (n) => seen.push(n),
      },
    )
    await new Promise((r) => setTimeout(r, 0))
    expect(seen).toEqual([])
  })
})

describe('updateCheckBlocked', () => {
  const answer = (init: Partial<Response>) => (async () => init as Response) as typeof fetch

  it('is true for a redirect to the login page or a 401/403', async () => {
    expect(await updateCheckBlocked('/sw.js', answer({ type: 'opaqueredirect', status: 0 }))).toBe(true)
    expect(await updateCheckBlocked('/sw.js', answer({ type: 'basic', status: 403 }))).toBe(true)
    expect(await updateCheckBlocked('/sw.js', answer({ type: 'basic', status: 401 }))).toBe(true)
  })

  it('is false when the script is served, or the network is down', async () => {
    expect(await updateCheckBlocked('/sw.js', answer({ type: 'basic', status: 200 }))).toBe(false)
    const offline = (async () => {
      throw new TypeError('Failed to fetch')
    }) as typeof fetch
    expect(await updateCheckBlocked('/sw.js', offline)).toBe(false)
  })
})
