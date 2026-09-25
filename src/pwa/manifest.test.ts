// @vitest-environment node
//
// This file runs a real Vite build, and Vite runs esbuild, which refuses to start under jsdom:
// jsdom's TextEncoder returns a Uint8Array from another realm and esbuild's startup invariant
// rejects it. Nothing here touches the DOM, so the node environment is both correct and enough.
//
// What a production build has to be for the app to install from GitHub Pages: a web app
// manifest the browser will accept, and every URL in the build under the Pages base path.
// These assertions read the real build output — see src/test/buildFixture.ts.
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeAll, expect, test } from 'vitest'
import { buildApp, type BuiltApp } from '../test/buildFixture'
import { readTokens } from '../test/cssAudit'

// src/pwa/manifest.test.ts -> the repository root.
const repoRoot = resolve(fileURLToPath(import.meta.url), '..', '..', '..')
const tokensPath = join(repoRoot, 'src', 'styles', 'tokens.css')

// The path the app is served from at the root of the Cloudflare Worker (decision 0006). Written
// out here rather than read back from the config on purpose: a build that forgets the base path
// works perfectly on localhost and 404s in production, so the expectation has to be independent
// of the thing under test.
const BASE = '/'

type ManifestIcon = {
  src: string
  sizes?: string
  type?: string
  purpose?: string
}

type WebManifest = {
  name?: string
  short_name?: string
  display?: string
  start_url?: string
  scope?: string
  theme_color?: string
  background_color?: string
  icons?: ManifestIcon[]
}

let app: BuiltApp

// One production build for the whole file. The timeout is local to this hook rather than a
// global testTimeout bump: a cold Vite build on Windows runs well past vitest's 10s default,
// but everything else in the suite should still be held to the default.
beforeAll(async () => {
  app = await buildApp()
}, 180_000)

function manifest(): WebManifest {
  expect(
    app.files,
    'the build must emit manifest.webmanifest at the root of dist',
  ).toContain('manifest.webmanifest')
  return app.readJson<WebManifest>('manifest.webmanifest')
}

/** The path a URL found in the build output has inside dist, or null when it is external. */
function distPathOf(url: string): string | null {
  if (/^[a-z]+:/i.test(url) || url.startsWith('//')) return null
  if (url.startsWith(BASE)) return url.slice(BASE.length)
  return url.replace(/^\//, '')
}

/** Every src/href in a built HTML document that points at something this build serves. */
function localReferences(html: string): string[] {
  return [...html.matchAll(/\b(?:src|href)="([^"]*)"/g)]
    .map((m) => m[1])
    .filter((ref) => ref.length > 0)
    .filter((ref) => !/^[a-z]+:/i.test(ref) && !ref.startsWith('//') && !ref.startsWith('#'))
}

test('O1 the production build emits manifest.webmanifest at the root of dist', () => {
  expect(app.files).toContain('manifest.webmanifest')
})

test('O1 the manifest names the app "Workout" on the home screen', () => {
  expect(manifest().short_name).toBe('Workout')
})

test('O1 the manifest carries a full application name', () => {
  expect(manifest().name).toBeTruthy()
})

test('O1 the manifest asks for standalone display, so the installed app has no Safari chrome', () => {
  expect(manifest().display).toBe('standalone')
})

test('O1 the manifest declares a theme colour', () => {
  expect(manifest().theme_color).toMatch(/^#[0-9a-fA-F]{3,8}$/)
})

test('O1 the manifest declares icons at 192 px and 512 px', () => {
  const sizes = (manifest().icons ?? []).map((icon) => icon.sizes)
  expect(sizes).toContain('192x192')
  expect(sizes).toContain('512x512')
})

test('O1 the manifest declares a maskable 512 px icon', () => {
  const maskable = (manifest().icons ?? []).filter((icon) =>
    (icon.purpose ?? '').split(/\s+/).includes('maskable'),
  )
  expect(maskable.map((icon) => icon.sizes)).toContain('512x512')
})

test('O1 the build ships the three icon files at the paths the rest of the PWA work expects', () => {
  expect(app.files).toEqual(
    expect.arrayContaining([
      'icons/icon-192.png',
      'icons/icon-512.png',
      'icons/icon-maskable-512.png',
    ]),
  )
})

test('O1 every icon the manifest declares is a file the build actually serves', () => {
  const icons = manifest().icons ?? []
  expect(icons.length).toBeGreaterThan(0)
  const missing = icons
    .map((icon) => distPathOf(icon.src))
    .filter((path): path is string => path !== null)
    .filter((path) => !app.files.includes(path))
  expect(missing, 'the manifest declares icons that are not in the build output').toEqual([])
})

test('O1 the built index.html links the manifest', () => {
  const html = app.read('index.html')
  const link = [...html.matchAll(/<link\b[^>]*>/g)]
    .map((m) => m[0])
    .find((tag) => /rel="manifest"/.test(tag))
  expect(link, 'index.html has no <link rel="manifest">').toBeDefined()
  expect(link).toMatch(/href="[^"]*manifest\.webmanifest"/)
})

// With BASE now '/', a reference merely starting with '/' proves nothing -- every rooted URL
// does. What has to hold is that the reference actually resolves to a file this build serves at
// its root, so a leftover base segment (e.g. '/WorkoutTracker/assets/…') fails this instead of
// passing it vacuously.
test('O2 every asset reference in the built index.html resolves to a file this build serves at the root', () => {
  const refs = localReferences(app.read('index.html'))
  expect(refs.length, 'index.html references nothing this build serves').toBeGreaterThan(0)
  const missing = refs
    .map((ref) => distPathOf(ref))
    .filter((path): path is string => path !== null)
    .filter((path) => !app.files.includes(path))
  expect(missing, 'these index.html references do not resolve to a file this build serves').toEqual(
    [],
  )
})

test('O2 the manifest start_url is under the configured base path', () => {
  expect(manifest().start_url ?? '').toMatch(/^\//)
})

test('O2 the service worker is emitted at the root of dist, so its scope is the base path', () => {
  expect(app.files).toContain('sw.js')
})

// [O5] The installed app's splash screen and status bar have to match the app's own
// background, or the launch sequence seams: iOS paints the manifest's background_color and
// theme_color before the app's own CSS ever runs. Reading the expected value from
// tokens.css — never a hard-coded hex — is the point: either side drifting alone must fail
// this test.
test('O5 the manifest theme_color matches the --color-bg token, so the status bar does not seam against the app background', () => {
  const colorBg = readTokens(readFileSync(tokensPath, 'utf-8')).get('--color-bg')
  expect(colorBg, 'tokens.css has no --color-bg token').toBeDefined()
  expect((manifest().theme_color ?? '').toLowerCase()).toBe((colorBg ?? '').toLowerCase())
})

test('O5 the manifest background_color matches the --color-bg token, so the iOS splash screen does not seam against the app background', () => {
  const colorBg = readTokens(readFileSync(tokensPath, 'utf-8')).get('--color-bg')
  expect(colorBg, 'tokens.css has no --color-bg token').toBeDefined()
  expect((manifest().background_color ?? '').toLowerCase()).toBe((colorBg ?? '').toLowerCase())
})

// [O15] Served from the root of the Cloudflare Worker behind Access (decision 0006 supersedes
// 0003's GitHub Pages base path): the manifest's own start_url and scope must be exactly '/',
// not merely rooted, and its <link> must ask for credentialed mode or Access's cookie never
// reaches the manifest fetch and the browser refuses to install the app.

test('O15 the manifest start_url is exactly the root path "/"', () => {
  expect(manifest().start_url).toBe('/')
})

test('O15 the manifest scope is exactly the root path "/"', () => {
  expect(manifest().scope).toBe('/')
})

test('O15 the built index.html\'s manifest <link> carries crossorigin="use-credentials", so Access lets the fetch through', () => {
  const html = app.read('index.html')
  const link = [...html.matchAll(/<link\b[^>]*>/g)]
    .map((m) => m[0])
    .find((tag) => /rel="manifest"/.test(tag))
  expect(link, 'index.html has no <link rel="manifest">').toBeDefined()
  expect(link).toMatch(/crossorigin="use-credentials"/)
})
