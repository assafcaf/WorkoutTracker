// @vitest-environment node
//
// A real Vite build runs here, and esbuild will not start under jsdom (see
// src/pwa/manifest.test.ts), so this file runs in the node environment and makes its own window
// with `new JSDOM(...)` when it needs one.
//
// [O4]: the app with the network gone. The generated service worker is installed for real from
// the build output, the network is then cut, and everything after that has to come out of the
// cache — including the JavaScript that is run to see whether the program picker really
// renders. Nothing is read out of the build directory past the install.
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { JSDOM } from 'jsdom'
import { build } from 'vite'
import { beforeAll, expect, test } from 'vitest'
import { buildApp, type BuiltApp } from '../test/buildFixture'
import { appUrl, startServiceWorker, type ServiceWorkerHarness } from '../test/swHarness'
import { registerServiceWorker } from './registerSW'

let app: BuiltApp
let sw: ServiceWorkerHarness
/** How many network requests the worker had made by the time the network went away. */
let networkCallsBeforeOffline = 0

beforeAll(async () => {
  app = await buildApp()
  sw = await startServiceWorker(app)
  await sw.install()
  await sw.activate()
  networkCallsBeforeOffline = sw.networkLog.length
  sw.goOffline()
}, 180_000)

/** Every `src`/`href` in a document that points at something this app serves. */
function localReferences(html: string): string[] {
  return [...html.matchAll(/\b(?:src|href)="([^"]*)"/g)]
    .map((match) => match[1])
    .filter((ref) => ref.length > 0 && !/^[a-z]+:/i.test(ref) && !ref.startsWith('#'))
}

/** The `src` of every script the document loads, in order. */
function scriptSources(html: string): string[] {
  return [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*>/g)].map((match) => match[1])
}

/** What the worker answers with, with the network down, or an error naming what it refused. */
async function servedOffline(url: string, mode: RequestMode = 'no-cors'): Promise<Response> {
  const response = await sw.request(url, mode)
  if (!response) {
    throw new Error(`with the network down the service worker did not answer ${url} at all`)
  }
  return response
}

type OfflineLaunch = {
  /** The window the cached app was started in. */
  window: Window & typeof globalThis
  /** The shell the worker served for the navigation request. */
  html: string
  /** The script URL of every service worker the running app registered. */
  registeredWorkers: string[]
}

let launch: Promise<OfflineLaunch> | undefined

/**
 * The time limit for a test that calls `launchFromCache`. Whichever such test runs first pays
 * for the whole launch — a rollup relink plus up to 10s waiting for the first render — which
 * vitest's default 5s cannot hold on a loaded machine.
 */
const LAUNCH_TIMEOUT = 60_000

/**
 * Starts the app the way a cold launch with no network does, and hands back the window it is
 * running in.
 *
 * Memoised, and deliberately not done in `beforeAll` — when the cached app cannot start at all
 * that should fail the tests which depend on it, not sink the whole file before one assertion
 * has run.
 */
function launchFromCache(): Promise<OfflineLaunch> {
  if (!launch) launch = runLaunch()
  return launch
}

/**
 * Writes out every script the worker can serve offline, links them into one classic script,
 * and runs it in a window built from the cached shell.
 *
 * The relinking step is why this is not simply `window.eval` of the entry chunk: the build is
 * ES modules that `import()` each other, and jsdom has no module loader. Rollup is handed only
 * the bytes the cache gave up, and an `iife` build inlines the dynamic imports, so what runs is
 * the cached code and nothing else — but a chunk left out of the precache is a missing file
 * here, exactly as it would be a failed request in the browser.
 */
async function runLaunch(): Promise<OfflineLaunch> {
  const html = await (await servedOffline(appUrl(''), 'navigate')).text()

  const cachedDir = mkdtempSync(join(tmpdir(), 'workout-offline-'))
  for (const url of sw.cachedUrls()) {
    const relPath = new URL(url).pathname.replace(/^\//, '')
    if (!relPath.endsWith('.js')) continue
    const target = join(cachedDir, ...relPath.split('/'))
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, await (await servedOffline(url)).text())
  }

  const sources = scriptSources(html)
  if (sources.length !== 1) {
    throw new Error(
      `the cached shell loads ${sources.length} scripts; this harness links exactly one entry`,
    )
  }
  const entryPath = new URL(sources[0], appUrl('')).pathname.replace(/^\//, '')
  const linkedDir = join(cachedDir, '__linked')
  await build({
    root: cachedDir,
    configFile: false,
    logLevel: 'silent',
    build: {
      outDir: linkedDir,
      emptyOutDir: true,
      minify: false,
      target: 'es2020',
      lib: {
        entry: join(cachedDir, ...entryPath.split('/')),
        formats: ['iife'],
        name: 'CachedWorkoutTracker',
        fileName: () => 'cached-app.js',
      },
    },
  })
  const code = readFileSync(join(linkedDir, 'cached-app.js'), 'utf-8')

  const dom = new JSDOM(html, {
    url: appUrl(''),
    runScripts: 'outside-only',
    pretendToBeVisual: true,
  })
  const windowGlobals = dom.window as unknown as Record<string, unknown>
  // Dexie reads the global IndexedDB factory. The suite's fake-indexeddb is installed on the
  // node global by src/test/setup.ts, and the app is about to run in jsdom's realm instead.
  windowGlobals.indexedDB = globalThis.indexedDB
  windowGlobals.IDBKeyRange = globalThis.IDBKeyRange

  const registeredWorkers: string[] = []
  Object.defineProperty(dom.window.navigator, 'serviceWorker', {
    configurable: true,
    value: {
      controller: null,
      ready: Promise.resolve({ active: { state: 'activated' }, scope: appUrl('') }),
      addEventListener() {},
      removeEventListener() {},
      async getRegistration() {
        return undefined
      },
      async getRegistrations() {
        return []
      },
      async register(scriptUrl: string) {
        registeredWorkers.push(new URL(scriptUrl, appUrl('')).pathname)
        return {
          scope: appUrl(''),
          installing: null,
          waiting: null,
          active: { state: 'activated' },
          addEventListener() {},
          removeEventListener() {},
          async update() {},
          async unregister() {
            return true
          },
        }
      },
    },
  })

  dom.window.eval(code)
  // Registering once the page has finished loading is as valid as registering straight away,
  // so the harness fires the event either way.
  dom.window.dispatchEvent(new dom.window.Event('load'))

  const deadline = Date.now() + 10_000
  while (Date.now() < deadline && (dom.window.document.body.textContent ?? '') === '') {
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
  await new Promise((resolve) => setTimeout(resolve, 200))

  return { window: dom.window, html, registeredWorkers }
}

/** What the app launched from the cache is showing. */
async function screenText(): Promise<string> {
  const { window } = await launchFromCache()
  return window.document.body.textContent ?? ''
}

test('O4 with the network down the app shell is served from the cache', async () => {
  const response = await servedOffline(appUrl(''), 'navigate')
  expect(response.status).toBe(200)
  const html = await response.text()
  expect(html).toContain('<div id="root">')
  expect(scriptSources(html).length, 'the served shell loads no script').toBeGreaterThan(0)
})

test('O4 with the network down every asset the shell references is served from the cache', async () => {
  const html = await (await servedOffline(appUrl(''), 'navigate')).text()
  const references = localReferences(html)
  expect(references.length, 'the shell references nothing this app serves').toBeGreaterThan(0)

  const unanswered: string[] = []
  for (const reference of references) {
    const response = await sw.request(new URL(reference, appUrl('')).href, 'no-cors')
    if (!response || response.status !== 200) unanswered.push(reference)
  }
  expect(unanswered, 'the cache cannot serve these references from the shell').toEqual([])
})

test('O4 with the network down the program picker renders the active program', async () => {
  expect(await screenText()).toContain('Assaf A/B 2026')
}, LAUNCH_TIMEOUT)

test('O4 with the network down the program picker offers the workouts to start', async () => {
  expect(await screenText()).toContain('Start Workout A')
}, LAUNCH_TIMEOUT)

// E5-T18 (M13) moves this exercise-plan text off the Workout tab and onto the Program tab
// (M12 leaves only the start buttons on the Workout tab), so reaching it now means clicking
// the Program tab's button in the cached window and waiting for its re-render -- there is no
// testing-library wired up in this file (raw JSDOM), so the click and the wait are done with
// native DOM calls, the same polling pattern `runLaunch` already uses.
test('O4 with the network down the Program tab names exercises out of the cached catalog', async () => {
  const { window } = await launchFromCache()

  const programTab = window.document.querySelector('[aria-label="Program"]')
  if (!programTab) throw new Error('no Program tab button in the cached app')
  programTab.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))

  const expected = 'Back squat 8-10 x 4, rest 180s'
  const deadline = Date.now() + 5_000
  while (Date.now() < deadline && !(window.document.body.textContent ?? '').includes(expected)) {
    await new Promise((resolve) => setTimeout(resolve, 25))
  }

  expect(window.document.body.textContent ?? '').toContain(expected)
}, LAUNCH_TIMEOUT)

test('O4 launching the cached app asks the network for nothing', async () => {
  await launchFromCache()
  expect(
    sw.networkLog.slice(networkCallsBeforeOffline),
    'the app asked the network for these while it was offline',
  ).toEqual([])
}, LAUNCH_TIMEOUT)

test('O4 a request for an asset the build never emitted is not answered with the app shell', async () => {
  // The navigation fallback must answer navigations only. If it answers a subresource too, a
  // script request gets index.html back and the app breaks in a way no reload clears.
  const response = await sw.request(appUrl('assets/never-built-00000000.js'), 'no-cors')
  const body = response ? await response.text() : ''
  expect(body).not.toContain('<div id="root">')
})

test('O4 the app registers the built service worker under the base path when it starts', async () => {
  const { registeredWorkers } = await launchFromCache()
  expect(registeredWorkers).toContain('/sw.js')
}, LAUNCH_TIMEOUT)

// [O15] The Worker answers /api/ itself (E7-T1) and Access owns /cdn-cgi/; if the generated
// service worker's navigation fallback caught either, a cold Access redirect or an API request
// made as a navigation would get the cached SPA shell back instead of reaching the Worker.

test('O15 a navigation to /api/ is not answered from the cached app shell', async () => {
  const response = await sw.request(appUrl('api/workouts'), 'navigate')
  const body = response ? await response.text() : ''
  expect(body).not.toContain('<div id="root">')
})

test('O15 a navigation to /cdn-cgi/ is not answered from the cached app shell', async () => {
  const response = await sw.request(appUrl('cdn-cgi/access/login'), 'navigate')
  const body = response ? await response.text() : ''
  expect(body).not.toContain('<div id="root">')
})

test('O4 registerServiceWorker does nothing in a browser with no service worker', () => {
  // An insecure origin, a locked-down Safari and this very test suite all land here. Throwing
  // would take the whole app down on startup for the sake of a cache it cannot have anyway.
  const original = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { userAgent: 'a browser with no service worker' },
  })
  const called: string[] = []
  try {
    expect(() =>
      registerServiceWorker({
        onNeedRefresh: () => called.push('onNeedRefresh'),
        onOfflineReady: () => called.push('onOfflineReady'),
      }),
    ).not.toThrow()
  } finally {
    if (original) Object.defineProperty(globalThis, 'navigator', original)
    else delete (globalThis as Record<string, unknown>).navigator
  }
  expect(called).toEqual([])
})
