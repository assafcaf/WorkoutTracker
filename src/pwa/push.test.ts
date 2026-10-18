// @vitest-environment node
//
// [O19] [O20] [O21]: the push half of the service worker. public/sw-push.js is a classic
// script, so it is evaluated in a node:vm context with a fake `self`, as src/test/swHarness.ts
// does for dist/sw.js. The build assertions read the real production output.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createContext, runInContext } from 'node:vm'
import { describe, expect, test } from 'vitest'
import { buildApp } from '../test/buildFixture'

type Listener = (event: unknown) => void

function loadWorker(openClients: unknown[] = []) {
  const listeners = new Map<string, Listener>()
  const shown: { title: string; options: Record<string, unknown> }[] = []
  const opened: string[] = []
  const scope: Record<string, unknown> = {
    addEventListener: (type: string, fn: Listener) => listeners.set(type, fn),
    registration: {
      showNotification: (title: string, options: Record<string, unknown>) => {
        shown.push({ title, options })
        return Promise.resolve()
      },
    },
    clients: {
      matchAll: () => Promise.resolve(openClients),
      openWindow: (url: string) => {
        opened.push(url)
        return Promise.resolve(undefined)
      },
    },
  }
  scope.self = scope
  const context = createContext(scope)
  const source = readFileSync(resolve(__dirname, '../../public/sw-push.js'), 'utf-8')
  runInContext(source, context, { filename: 'sw-push.js' })
  return { listeners, shown, opened }
}

function fire(listeners: Map<string, Listener>, type: string, event: Record<string, unknown>) {
  const waits: Promise<unknown>[] = []
  const full = { ...event, waitUntil: (p: Promise<unknown>) => waits.push(p) }
  const listener = listeners.get(type)
  if (!listener) throw new Error(`no ${type} listener registered`)
  listener(full)
  return Promise.all(waits).then(() => waits.length)
}

const dataOf = (text: string | null) => ({
  data: text === null ? null : { text: () => text, json: () => JSON.parse(text) },
})

describe('push', () => {
  test('[O19] a JSON push shows its title, body, tag and url inside waitUntil', async () => {
    const { listeners, shown } = loadWorker()
    const waits = await fire(
      listeners,
      'push',
      dataOf(JSON.stringify({ title: 'Rest over', body: 'Next set', tag: 'rest', url: '/workout' })),
    )
    expect(waits).toBe(1)
    expect(shown).toHaveLength(1)
    expect(shown[0].title).toBe('Rest over')
    expect(shown[0].options).toMatchObject({
      body: 'Next set',
      tag: 'rest',
      data: { url: '/workout' },
    })
    expect(typeof shown[0].options.icon).toBe('string')
  })

  test('[O19] an empty or unparseable push still shows a Workout Tracker notification', async () => {
    for (const payload of [null, '', 'not json {']) {
      const { listeners, shown } = loadWorker()
      const waits = await fire(listeners, 'push', dataOf(payload))
      expect(waits).toBe(1)
      expect(shown).toHaveLength(1)
      expect(shown[0].title).toBe('Workout Tracker')
    }
  })

  test('[O20] a click closes the notification and focuses an open app window', async () => {
    const focus = { calls: 0 }
    const client = { focus: () => ((focus.calls += 1), Promise.resolve()) }
    const { listeners, opened } = loadWorker([client])
    let closed = 0
    const waits = await fire(listeners, 'notificationclick', {
      notification: { close: () => (closed += 1), data: { url: '/workout' } },
    })
    expect(closed).toBe(1)
    expect(waits).toBe(1)
    expect(focus.calls).toBe(1)
    expect(opened).toEqual([])
  })

  test('[O20] a click with no open window opens data.url, or / without one', async () => {
    const withUrl = loadWorker()
    await fire(withUrl.listeners, 'notificationclick', {
      notification: { close: () => {}, data: { url: '/workout' } },
    })
    expect(withUrl.opened).toEqual(['/workout'])

    const without = loadWorker()
    await fire(without.listeners, 'notificationclick', {
      notification: { close: () => {}, data: undefined },
    })
    expect(without.opened).toEqual(['/'])
  })
})

describe('the production build', () => {
  test('[O21] sw.js imports sw-push.js, which is emitted and precached', async () => {
    const app = await buildApp()
    expect(app.read('sw.js')).toMatch(/importScripts\([^)]*sw-push\.js/)
    expect(app.files).toContain('sw-push.js')
    expect(app.read('sw.js')).toMatch(/["']?url["']?\s*:\s*["']sw-push\.js["']/)
  }, 180_000)
})
