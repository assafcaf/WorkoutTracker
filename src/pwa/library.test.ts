// @vitest-environment node
//
// This file runs a real Vite build and then the real generated service worker, exactly like
// src/pwa/precache.test.ts — see that file for why: the precache manifest embedded in sw.js is
// a claim, and what the worker can actually serve is the thing the gym depends on.
//
// [L15]: with the network removed, the worker still has to serve the library data (the 876
// free-exercise-db entries E5-T1 bundles) and every one of the 14 catalog exercises' bundled
// photos (E5-T4's public/library-photos/), not just the app shell precache.test.ts already
// covers.
//
// [L16]: a *non-catalog* library exercise's photo is never bundled — src/data/photos.ts sends
// it to raw.githubusercontent.com instead (see src/data/photos.test.ts). Once it has been
// fetched successfully while online, it has to keep answering with the network gone, out of a
// runtime cache rather than the precache.
import { readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeAll, expect, test } from 'vitest'
import { LIBRARY_COMMIT } from '../data/library'
import libraryExercises from '../data/library/exercises.json'
import { buildApp, type BuiltApp } from '../test/buildFixture'
import { appUrl, startServiceWorker, type ServiceWorkerHarness } from '../test/swHarness'

// src/pwa/library.test.ts -> the repository root.
const repoRoot = resolve(fileURLToPath(import.meta.url), '..', '..', '..')

/** Every bundled catalog photo under public/library-photos, as app-relative paths. */
function bundledPhotoPaths(): string[] {
  const root = join(repoRoot, 'public', 'library-photos')
  const paths: string[] = []
  for (const libraryId of readdirSync(root)) {
    const dir = join(root, libraryId)
    if (!statSync(dir).isDirectory()) continue
    for (const file of readdirSync(dir)) paths.push(`library-photos/${libraryId}/${file}`)
  }
  return paths.sort()
}

/** A remote photo URL for a library exercise no catalog entry uses, at the pinned commit. */
const REMOTE_PHOTO_URL = `https://raw.githubusercontent.com/yuhonas/free-exercise-db/${LIBRARY_COMMIT}/exercises/Zottman_Curl/0.jpg`

let app: BuiltApp
let sw: ServiceWorkerHarness
/** The response the worker gave for REMOTE_PHOTO_URL while the harness was still online. */
let remotePhotoOnline: { status: number | undefined; body: string | undefined }

// One build and one service worker install for the whole file, exactly like precache.test.ts.
// [L16]'s "fetched once online" has to happen here, before goOffline() below takes the network
// away for every test in this file — precache.test.ts's own beforeAll goes offline the same
// way, right after the one thing that needs the network is done.
beforeAll(async () => {
  app = await buildApp()
  sw = await startServiceWorker(app)
  await sw.install()
  await sw.activate()

  const online = await sw.request(REMOTE_PHOTO_URL, 'no-cors')
  remotePhotoOnline = { status: online?.status, body: online ? await online.text() : undefined }

  // Everything below this line is answered from a cache or not at all.
  sw.goOffline()
}, 180_000)

test('L15 with the network removed the worker serves every bundled catalog photo', async () => {
  const photos = bundledPhotoPaths()
  expect(
    photos.length,
    'no bundled catalog photos were found under public/library-photos',
  ).toBeGreaterThan(0)

  const unanswered: string[] = []
  for (const relPath of photos) {
    const response = await sw.request(appUrl(relPath), 'no-cors')
    if (!response || response.status !== 200) unanswered.push(relPath)
  }
  expect(unanswered, 'the worker does not serve these bundled catalog photos offline').toEqual([])
})

test('L15 with the network removed the worker serves the library data for every catalog exercise', async () => {
  const parts: string[] = []
  for (const url of sw.cachedUrls()) {
    if (!/\.js$/.test(new URL(url).pathname)) continue
    const response = await sw.request(url, 'no-cors')
    if (response?.status === 200) parts.push(await response.text())
  }
  const code = parts.join('\n')
  const missing = (libraryExercises as { id: string }[])
    .map((exercise) => exercise.id)
    .filter((id) => !code.includes(JSON.stringify(id)))
  expect(
    missing,
    'these library exercise ids are in no file the worker can serve offline',
  ).toEqual([])
})

test('L16 a remote library photo fetched once online is then served offline from the runtime cache', async () => {
  expect(remotePhotoOnline.status, 'fetching the remote photo online did not succeed').toBe(200)
  expect(
    sw.networkLog,
    'the remote photo was answered without the worker ever asking the network for it',
  ).toContain(REMOTE_PHOTO_URL)

  const offline = await sw.request(REMOTE_PHOTO_URL, 'no-cors')
  expect(
    offline,
    'with the network down the worker did not answer the previously-fetched remote photo at all',
  ).toBeDefined()
  expect(offline?.status, 'the runtime cache did not answer the remote photo with a 200').toBe(200)
  expect(
    await offline!.text(),
    'the cached remote photo does not match what was fetched online',
  ).toBe(remotePhotoOnline.body)
})
