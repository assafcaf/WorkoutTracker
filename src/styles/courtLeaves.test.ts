// Court leaves (E17-T12 [O15]), proven by searching src/ as data: none of the Court look's
// names survives in a product file, a stylesheet or a helper. Test files are left out of the
// search, because the guard tests that prove the Court is gone have to name what they look for.
//
// The stripe's own contract and where it was placed (AppShell, SessionSummary) are asserted in
// src/ui/AppShell.test.tsx and src/ui/SessionSummary.test.tsx; this file is the src-wide search.
import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from 'vitest'

// src/styles/courtLeaves.test.ts -> the repository root.
const repoRoot = resolve(fileURLToPath(import.meta.url), '..', '..', '..')
const srcDir = join(repoRoot, 'src')

/** Every .ts, .tsx and .css file under `dir` that is not a test, repo-relative with '/'. */
function productionFiles(dir: string): string[] {
  const found: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) found.push(...productionFiles(full))
    else if (/\.(tsx?|css)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
      found.push(full.slice(repoRoot.length + 1).split(sep).join('/'))
    }
  }
  return found.sort()
}

/** The files whose content matches `pattern`, each with the first matching line. */
function filesMatching(pattern: RegExp): string[] {
  return productionFiles(srcDir).flatMap((file) => {
    const line = readFileSync(join(repoRoot, file), 'utf-8')
      .split('\n')
      .find((text) => pattern.test(text))
    return line === undefined ? [] : [`${file}: ${line.trim()}`]
  })
}

// Each name the spec lists, and the pattern that finds it. `--font-display` is the custom
// property, never the @font-face `font-display` descriptor fonts.css keeps.
const COURT_NAMES: ReadonlyArray<readonly [string, RegExp]> = [
  ['CourtStripe', /CourtStripe/],
  ['.court-stripe', /court-stripe/],
  ['--pr-*', /--pr-[a-z]/],
  ['--family-*', /--family-[a-z]/],
  ['--map-*', /--map-[a-z]/],
  ['--font-display', /--font-display\b/],
  ['data-stripe', /data-stripe/],
]

for (const [name, pattern] of COURT_NAMES) {
  test(`O15 no file under src names ${name}`, () => {
    // Guards the search against passing vacuously over an empty file list.
    expect(productionFiles(srcDir)).toEqual(
      expect.arrayContaining(['src/styles/tokens.css', 'src/ui/AppShell.tsx']),
    )
    expect(filesMatching(pattern), `${name} is still named in`).toEqual([])
  })
}
