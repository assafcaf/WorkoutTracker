// @vitest-environment node
//
// The display font, proven by reading the CSS as data (O15, O16) and, for the offline
// precache, a real production build (O17) — see src/pwa/manifest.test.ts for why a real build
// needs the node environment: esbuild refuses to start under jsdom.
//
// [O15] src/styles/fonts.css declares one @font-face for 'Barlow Semi-Condensed' at weight 600
// with font-display: swap, pointing at a .woff2 under src/assets/fonts/ with the OFL licence
// text beside it, and is imported from src/styles/base.css.
// [O16] the four big-number rules read var(--font-display) with tabular-nums.
// [O17] the production build precaches the vendored .woff2, so the numbers still render
// offline.
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import postcss from 'postcss'
import { beforeAll, expect, test } from 'vitest'
import { declarationsFor } from '../test/cssAudit'
import { buildApp, type BuiltApp } from '../test/buildFixture'
import { startServiceWorker, type ServiceWorkerHarness } from '../test/swHarness'

// src/styles/fonts.test.ts -> the repository root.
const repoRoot = resolve(fileURLToPath(import.meta.url), '..', '..', '..')
const fontsCssPath = join(repoRoot, 'src', 'styles', 'fonts.css')

function read(relPath: string): string {
  return readFileSync(join(repoRoot, relPath), 'utf-8')
}

/** The declarations inside the stylesheet's `@font-face` blocks, merged across every one. */
function fontFaceCount(css: string): number {
  let count = 0
  postcss.parse(css).walkAtRules('font-face', () => {
    count += 1
  })
  return count
}

function fontFaceDecls(css: string): Map<string, string> {
  const decls = new Map<string, string>()
  postcss.parse(css).walkAtRules('font-face', (atRule) => {
    atRule.walkDecls((decl) => {
      decls.set(decl.prop.trim(), decl.value.trim())
    })
  })
  return decls
}

test('O15 fonts.css declares one @font-face for Barlow Semi-Condensed at weight 600 with font-display swap', () => {
  const css = read('src/styles/fonts.css')
  expect(fontFaceCount(css), 'expected exactly one @font-face rule').toBe(1)
  const decls = fontFaceDecls(css)
  expect(decls.get('font-family')).toBe("'Barlow Semi-Condensed'")
  expect(decls.get('font-weight')).toBe('600')
  expect(decls.get('font-display')).toBe('swap')
})

test('O15 the @font-face url points at a .woff2 file under src/assets/fonts/', () => {
  const css = read('src/styles/fonts.css')
  const decls = fontFaceDecls(css)
  const src = decls.get('src') ?? ''
  const match = src.match(/url\(\s*['"]?([^'")]+)['"]?\s*\)/)
  expect(match, `expected a url(...) in the @font-face src, got ${JSON.stringify(src)}`).not.toBeNull()
  const urlPath = match?.[1] ?? ''
  expect(urlPath.endsWith('.woff2'), `expected a .woff2 file, got ${urlPath}`).toBe(true)
  const resolved = resolve(dirname(fontsCssPath), urlPath)
  const expectedDir = join(repoRoot, 'src', 'assets', 'fonts')
  expect(resolved.startsWith(expectedDir), `expected ${urlPath} to resolve under src/assets/fonts/`).toBe(true)
})

test('O15 the vendored font has its OFL licence text beside it', () => {
  const licencePath = join(repoRoot, 'src', 'assets', 'fonts', 'OFL.txt')
  expect(existsSync(licencePath), `expected ${licencePath} to exist`).toBe(true)
  const licence = existsSync(licencePath) ? readFileSync(licencePath, 'utf-8') : ''
  expect(licence.toUpperCase()).toContain('SIL OPEN FONT LICENSE')
})

test('O16 .dial-readout reads the display font with tabular numerals', () => {
  const decls = declarationsFor(read('src/ui/dial.css'), '.dial-readout')
  expect(decls.get('font-family')).toBe('var(--font-display)')
  expect(decls.get('font-variant-numeric')).toBe('tabular-nums')
})

test('O16 .app-header-title reads the display font with tabular numerals', () => {
  const decls = declarationsFor(read('src/ui/AppShell.css'), '.app-header-title')
  expect(decls.get('font-family')).toBe('var(--font-display)')
  expect(decls.get('font-variant-numeric')).toBe('tabular-nums')
})

test('O16 .stats-record-value reads the display font with tabular numerals', () => {
  const decls = declarationsFor(read('src/ui/Stats.css'), '.stats-record-value')
  expect(decls.get('font-family')).toBe('var(--font-display)')
  expect(decls.get('font-variant-numeric')).toBe('tabular-nums')
})

test('O16 .set-counter reads the display font with tabular numerals', () => {
  const decls = declarationsFor(read('src/ui/SetScreen.css'), '.set-counter')
  expect(decls.get('font-family')).toBe('var(--font-display)')
  expect(decls.get('font-variant-numeric')).toBe('tabular-nums')
})

let app: BuiltApp

// One production build for the whole file's O17 test — see src/test/buildFixture.ts. The
// timeout is local to this hook, not a global bump: a cold Vite build on Windows runs well
// past vitest's 10s default.
beforeAll(async () => {
  app = await buildApp()
}, 180_000)

test('O17 the production build emits a .woff2 for the display font', () => {
  const fontFile = app.files.find((file) => file.endsWith('.woff2'))
  expect(fontFile, 'the build emitted no .woff2 file — is fonts.css imported from base.css?').toBeDefined()
})

test('O17 the service worker precaches the display font, so it works with the network down', async () => {
  const fontFile = app.files.find((file) => file.endsWith('.woff2'))
  expect(fontFile, 'the build emitted no .woff2 file — is fonts.css imported from base.css?').toBeDefined()
  const sw: ServiceWorkerHarness = await startServiceWorker(app)
  await sw.install()
  const cached = sw.cachedUrls().map((url) => new URL(url).pathname.replace(/^\//, ''))
  expect(cached, `globPatterns must precache ${fontFile}`).toContain(fontFile)
})
