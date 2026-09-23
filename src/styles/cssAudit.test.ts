// The stylesheet audits that hold the whole of `src/**/*.css` to the design system's rules.
//
// [O3] only tokens.css holds a literal colour, so the palette has exactly one definition site.
// [O6] every stylesheet under src is reachable from a module import — one a module never
// reaches ships in no bundle, and neither jsdom nor the type checker would notice.
//
// E3-T8 extends this file with [O4], the tap-target audit.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import postcss from 'postcss'
import { expect, test } from 'vitest'
import { declarationsFor, literalColours } from '../test/cssAudit'

// src/styles/cssAudit.test.ts -> the repository root.
const repoRoot = resolve(fileURLToPath(import.meta.url), '..', '..', '..')
const srcDir = join(repoRoot, 'src')

/** An absolute path as a repo-relative, '/'-separated one, which is how failures read. */
function rel(absolute: string): string {
  return absolute.slice(repoRoot.length + 1).split(sep).join('/')
}

/** Every file under `dir` whose name matches, absolute and sorted. */
function filesUnder(dir: string, matches: RegExp): string[] {
  const found: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) found.push(...filesUnder(full, matches))
    else if (matches.test(entry.name)) found.push(full)
  }
  return found.sort()
}

const stylesheets = (): string[] => filesUnder(srcDir, /\.css$/)
const modules = (): string[] => filesUnder(srcDir, /\.tsx?$/)

/** The stylesheets a `.ts`/`.tsx` source imports, as absolute paths under src. */
function stylesheetsImportedBy(modulePath: string): string[] {
  const source = readFileSync(modulePath, 'utf-8')
  const specifiers = [...source.matchAll(/import\s+(?:[^'"]*?from\s*)?['"]([^'"]+\.css)['"]/g)]
  return specifiers
    .map((match) => resolve(dirname(modulePath), match[1]))
    .filter((path) => path.startsWith(srcDir))
}

/** The stylesheets a stylesheet pulls in with `@import`, as absolute paths under src. */
function stylesheetsImportedByCss(cssPath: string): string[] {
  const imported: string[] = []
  postcss.parse(readFileSync(cssPath, 'utf-8')).walkAtRules('import', (rule) => {
    const match = /^\s*(?:url\(\s*)?["']([^"']+)["']/.exec(rule.params)
    if (match) imported.push(resolve(dirname(cssPath), match[1]))
  })
  return imported.filter((path) => path.startsWith(srcDir))
}

/**
 * Every stylesheet a module import reaches, following `@import` edges transitively. Nothing
 * imports tokens.css directly — base.css does, with `@import` — so one hop is not enough.
 */
function reachableStylesheets(): Set<string> {
  const reached = new Set<string>()
  const queue = modules().flatMap(stylesheetsImportedBy)
  while (queue.length > 0) {
    const next = queue.shift() as string
    if (reached.has(next) || !existsSync(next)) continue
    reached.add(next)
    queue.push(...stylesheetsImportedByCss(next))
  }
  return reached
}

test('O3 no stylesheet other than tokens.css contains a literal colour', () => {
  const others = stylesheets().filter((path) => !path.endsWith(`styles${sep}tokens.css`))

  expect(
    others.map(rel),
    'there is no stylesheet besides tokens.css, so this audit would pass vacuously',
  ).not.toEqual([])
  const offenders = others
    .flatMap((path) => literalColours(readFileSync(path, 'utf-8')).map((c) => `${rel(path)}: ${c}`))
  expect(offenders, 'these literal colours belong in tokens.css as a token').toEqual([])
})

test('O3 literalColours reports hex, rgb(), hsl() and named colours, and nothing else', () => {
  const css = [
    '.a { color: #fff; }',
    '.b { background: rgb(11, 11, 15); }',
    '.c { border-color: hsl(210 10% 20%); }',
    '.d { border: 1px solid red; }',
    '.e { box-shadow: inset 0 0 0 1px #2A2A33; }',
    // A token reference, and the two keywords that carry no palette value of their own.
    '.f { color: var(--color-text); background: transparent; fill: currentColor; }',
  ].join('\n')

  expect([...literalColours(css)].sort()).toEqual([
    '#2A2A33',
    '#fff',
    'hsl(210 10% 20%)',
    'red',
    'rgb(11, 11, 15)',
  ])
})

test('O6 every stylesheet under src is reachable from a module import', () => {
  const all = stylesheets()
  expect(all.map(rel), 'there is no stylesheet under src at all').not.toEqual([])

  const reached = reachableStylesheets()
  const orphans = all.filter((path) => !reached.has(path)).map(rel)
  expect(orphans, 'no module reaches these stylesheets, so they ship in no bundle').toEqual([])
})

test('O6 main.tsx imports the base stylesheet, which is where the token graph starts', () => {
  const imported = stylesheetsImportedBy(join(srcDir, 'main.tsx')).map(rel)

  expect(imported).toContain('src/styles/base.css')
})

// The helper E3-T8's tap-target audit measures with. Without this a `declarationsFor` that
// always returned an empty map would report no missing `min-height` on any selector.

test('O4 declarationsFor returns a selector rule declarations, merged across rules', () => {
  const css = [
    '.tab-bar-tab { min-height: var(--tap-min); color: var(--color-muted); }',
    '.tab-bar-tab, .app-header-back { padding: var(--space-2); }',
    '.tab-bar-tab { color: var(--color-accent); }',
  ].join('\n')

  expect([...declarationsFor(css, '.tab-bar-tab').entries()].sort()).toEqual([
    ['color', 'var(--color-accent)'],
    ['min-height', 'var(--tap-min)'],
    ['padding', 'var(--space-2)'],
  ])
  expect(
    [...declarationsFor(css, '.dial-step').keys()],
    'a selector no rule declares has no declarations',
  ).toEqual([])
})
