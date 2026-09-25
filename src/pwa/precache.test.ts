// @vitest-environment node
//
// This file runs a real Vite build and then the real generated service worker. Vite runs
// esbuild, which refuses to start under jsdom, so the node environment is required here — see
// src/pwa/manifest.test.ts for the same note. Nothing here touches the DOM.
//
// [O3]: what the service worker puts in its precache when it installs. The assertions go
// through the worker itself — install it, take the network away, ask it for a URL — because
// the precache manifest embedded in sw.js is a claim, and what the worker can actually serve
// with no network is the thing the gym depends on.
import { beforeAll, expect, test } from 'vitest'
import exercises from '../data/exercises.json'
import { buildApp, type BuiltApp } from '../test/buildFixture'
import { appUrl, startServiceWorker, type ServiceWorkerHarness } from '../test/swHarness'

/**
 * Every program the repository ships, by file. Globbed rather than listed so "every program
 * file" in [O3] keeps meaning every program file after a new one is added.
 *
 * `import.meta.glob` is Vite's, and tsconfig's `types` does not pull in `vite/client`, hence
 * the cast.
 */
const programModules = (
  import.meta as unknown as {
    glob(pattern: string, options: { eager: true }): Record<string, { default: unknown }>
  }
).glob('../data/programs/*.json', { eager: true })

const programs = Object.entries(programModules).map(([path, module]) => ({
  path,
  ...(module.default as { id: string; name: string }),
}))

let app: BuiltApp
let sw: ServiceWorkerHarness

// One build and one service worker install for the whole file. The timeout is local to the
// hook: a cold Vite build on Windows runs well past vitest's 10s default for hooks.
beforeAll(async () => {
  app = await buildApp()
  sw = await startServiceWorker(app)
  await sw.install()
  await sw.activate()
  // Everything below this line is answered from the precache or not at all.
  sw.goOffline()
}, 180_000)

/** The build-output path of a URL the worker holds, e.g. `assets/index-Odz3.js`. */
function distPathOfCached(url: string): string {
  return new URL(url).pathname.replace(/^\//, '')
}

/** The bytes the worker serves for a precached URL with the network down. */
async function servedFromCache(url: string): Promise<string> {
  const response = await sw.request(url, 'no-cors')
  expect(response, `the service worker did not answer ${url} with the network down`).toBeDefined()
  expect(response?.status, `the service worker answered ${url} with an error`).toBe(200)
  return response!.text()
}

/** Everything the worker can serve offline that could carry the bundled data, concatenated. */
async function precachedCode(): Promise<string> {
  const parts: string[] = []
  for (const url of sw.cachedUrls()) {
    if (!/\.(js|json|html)$/.test(new URL(url).pathname)) continue
    parts.push(await servedFromCache(url))
  }
  return parts.join('\n')
}

test('O3 installing the service worker precaches the app shell', () => {
  expect(sw.cachedUrls()).toContain(appUrl('index.html'))
})

test('O3 installing the service worker precaches every hashed asset the build emits', () => {
  const hashed = app.files.filter((file) => file.startsWith('assets/'))
  expect(hashed.length, 'the build emitted no hashed assets at all').toBeGreaterThan(0)
  const cached = sw.cachedUrls().map(distPathOfCached)
  expect(cached).toEqual(expect.arrayContaining(hashed))
})

test('O3 installing the service worker precaches every file the build serves', () => {
  // The worker and its Workbox runtime are the two files the browser fetches itself; a worker
  // that precached its own script could never be replaced by a newer one.
  const served = app.files.filter((file) => file !== 'sw.js' && !/^workbox-[^/]+\.js$/.test(file))
  expect(sw.cachedUrls().map(distPathOfCached).sort()).toEqual([...served].sort())
})

test('O3 the service worker does not precache itself', () => {
  expect(sw.cachedUrls()).not.toContain(appUrl('sw.js'))
})

test('O3 the precache carries every exercise in the catalog', async () => {
  const code = await precachedCode()
  const missing = exercises
    .map((exercise) => exercise.id)
    .filter((id) => !code.includes(JSON.stringify(id)))
  expect(missing, 'these exercise ids are in no file the worker can serve offline').toEqual([])
})

test('O3 the precache carries every program file the app ships', async () => {
  const code = await precachedCode()
  expect(programs.length, 'no program files were found to check').toBeGreaterThan(0)
  const missing = programs
    .filter((program) => !code.includes(JSON.stringify(program.id)))
    .map((program) => program.path)
  expect(missing, 'these programs are in no file the worker can serve offline').toEqual([])
})

test('O3 the precache carries the name each program is picked by', async () => {
  const code = await precachedCode()
  const missing = programs
    .filter((program) => !code.includes(JSON.stringify(program.name)))
    .map((program) => program.name)
  expect(missing, 'these program names are in no file the worker can serve offline').toEqual([])
})
