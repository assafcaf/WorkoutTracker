// The type sweep (E17-T5): every piece of text takes its family, size and weight from the type
// tokens, and no heading paints with the browser's defaults.
//
// [O7] across every stylesheet under src/, `font-family` only ever names `var(--font-sans)`;
// `font-size` only ever names a `--text-*` token (or a `calc()` whose only operands are
// `--text-*` tokens and plain numbers); `font-weight` only ever names a `--weight-*` token; and
// `body` declares `font-variant-numeric: tabular-nums lining-nums`. `@font-face` descriptors
// are not style declarations and are skipped.
// [O8] every `<h1>`, `<h2>` and `<h3>` rendered in a `.tsx` under src/ carries a className, and
// each of its classes has a rule in some stylesheet under src/ (controlAudit.test.ts's style).
import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import postcss, { type AtRule, type Declaration } from 'postcss'
import { expect, test } from 'vitest'
import { declarationsFor, readTokens } from '../test/cssAudit'

// src/styles/typeAudit.test.ts -> the repository root.
const repoRoot = resolve(fileURLToPath(import.meta.url), '..', '..', '..')
const srcDir = join(repoRoot, 'src')

function rel(absolute: string): string {
  return absolute.slice(repoRoot.length + 1).split(sep).join('/')
}

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
const modules = (): string[] => filesUnder(srcDir, /\.tsx$/).filter((path) => !path.endsWith('.test.tsx'))

function insideFontFace(decl: Declaration): boolean {
  for (let node = decl.parent; node; node = (node as { parent?: typeof node }).parent) {
    if (node.type === 'atrule' && (node as AtRule).name === 'font-face') return true
  }
  return false
}

/** Every `prop` declaration in every stylesheet under src, outside `@font-face`. */
function declarationsOf(prop: string): { where: string; value: string }[] {
  const found: { where: string; value: string }[] = []
  for (const path of stylesheets()) {
    postcss.parse(readFileSync(path, 'utf-8')).walkDecls((decl) => {
      if (decl.prop.trim() !== prop || insideFontFace(decl)) return
      const line = decl.source?.start?.line ?? 0
      found.push({ where: `${rel(path)}:${line}`, value: decl.value.trim() })
    })
  }
  return found
}

function tokens(): Map<string, string> {
  return readTokens(readFileSync(join(srcDir, 'styles', 'tokens.css'), 'utf-8'))
}

/** `var(--text-x)`, or a `calc()` whose only operands are such tokens and plain numbers. */
function isTokenSize(value: string, declared: Map<string, string>): boolean {
  const refs = [...value.matchAll(/var\(\s*(--[\w-]+)\s*\)/g)].map((m) => m[1])
  if (refs.length === 0) return false
  if (!refs.every((name) => name.startsWith('--text-') && declared.has(name))) return false
  if (/^var\(\s*--text-[\w-]+\s*\)$/.test(value)) return true
  const calc = /^calc\((.*)\)$/s.exec(value)
  if (!calc) return false
  const rest = calc[1].replace(/var\(\s*--text-[\w-]+\s*\)/g, ' ')
  return /^[\d.\s*/+\-()]*$/.test(rest)
}

test('O7 font-family in every stylesheet under src only names var(--font-sans)', () => {
  const decls = declarationsOf('font-family')
  const offenders = decls.filter((d) => d.value !== 'var(--font-sans)').map((d) => `${d.where}: ${d.value}`)
  expect(offenders, 'font-family must be var(--font-sans)').toEqual([])
})

test('O7 font-size in every stylesheet under src only names a --text-* token', () => {
  const declared = tokens()
  const decls = declarationsOf('font-size')
  expect(decls.length, 'no font-size declarations found, so this audit would pass vacuously').toBeGreaterThan(0)
  const offenders = decls.filter((d) => !isTokenSize(d.value, declared)).map((d) => `${d.where}: ${d.value}`)
  expect(offenders, 'font-size must be a declared --text-* token, or calc() of them and numbers').toEqual([])
})

test('O7 font-weight in every stylesheet under src only names a --weight-* token', () => {
  const declared = tokens()
  const decls = declarationsOf('font-weight')
  expect(decls.length, 'no font-weight declarations found, so this audit would pass vacuously').toBeGreaterThan(0)
  const offenders = decls
    .filter((d) => {
      const match = /^var\(\s*(--weight-[\w-]+)\s*\)$/.exec(d.value)
      return !match || !declared.has(match[1])
    })
    .map((d) => `${d.where}: ${d.value}`)
  expect(offenders, 'font-weight must be a declared --weight-* token').toEqual([])
})

test('O7 body declares tabular lining numerals', () => {
  const decls = declarationsFor(readFileSync(join(srcDir, 'styles', 'base.css'), 'utf-8'), 'body')
  expect(decls.get('font-variant-numeric')).toBe('tabular-nums lining-nums')
})

const HEADING = /<(h[123])(?=[\s/>])/g

/** Every `<h1>`/`<h2>`/`<h3>` opening tag's attribute text, comments stripped first. */
function extractHeadings(source: string): { tag: string; attrs: string }[] {
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  const found: { tag: string; attrs: string }[] = []
  for (const match of code.matchAll(HEADING)) {
    const start = (match.index as number) + match[0].length
    let depth = 0
    let i = start
    for (; i < code.length; i++) {
      const ch = code[i]
      if (ch === '{') depth++
      else if (ch === '}') depth--
      else if (ch === '>' && depth === 0) break
    }
    found.push({ tag: match[1], attrs: code.slice(start, i) })
  }
  return found
}

function classesOf(attrs: string): string[] | null {
  const match =
    /className\s*=\s*(?:"([^"]*)"|'([^']*)'|\{\s*"([^"]*)"\s*\}|\{\s*'([^']*)'\s*\}|\{\s*`([^`]*)`\s*\})/.exec(
      attrs,
    )
  if (!match) return null
  const raw = match.slice(1).find((group) => group !== undefined) ?? ''
  return raw.split(/\s+/).filter(Boolean)
}

function classesWithRules(): Set<string> {
  const classes = new Set<string>()
  for (const path of stylesheets()) {
    for (const match of readFileSync(path, 'utf-8').matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) {
      classes.add(match[1])
    }
  }
  return classes
}

test('O8 every h1, h2 and h3 rendered under src carries a className, and each class has a rule', () => {
  const declared = classesWithRules()
  const offenders: string[] = []
  let seen = 0
  for (const path of modules()) {
    for (const heading of extractHeadings(readFileSync(path, 'utf-8'))) {
      seen++
      const classes = classesOf(heading.attrs)
      if (classes === null || classes.length === 0) {
        offenders.push(`${rel(path)}: <${heading.tag}> has no className`)
        continue
      }
      for (const name of classes) {
        if (!declared.has(name)) offenders.push(`${rel(path)}: <${heading.tag} className="${name}"> has no rule`)
      }
    }
  }
  expect(seen, 'no headings found, so this audit would pass vacuously').toBeGreaterThan(0)
  expect(offenders, 'every heading must carry a className with a rule').toEqual([])
})
