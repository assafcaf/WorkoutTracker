// [O9] Every corner and shadow in the app comes from the shape tokens, and cards are flat white
// with a hairline: every `border-radius` under src/**/*.css is made of `--radius-*` tokens
// (a bare `0` component, as in a sheet top's `lg lg 0 0`, is allowed); every `box-shadow` is
// `none` or `var(--shadow-sheet)`; `.card` paints `--color-surface` with a 1px `--color-hairline`
// border. Parsed with postcss, per src/test/cssAudit.ts.
import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import postcss from 'postcss'
import { expect, test } from 'vitest'
import { declarationsFor } from '../test/cssAudit'

const repoRoot = resolve(fileURLToPath(import.meta.url), '..', '..', '..')
const srcDir = join(repoRoot, 'src')

function stylesheets(dir: string): string[] {
  const found: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) found.push(...stylesheets(full))
    else if (entry.name.endsWith('.css')) found.push(full)
  }
  return found.sort()
}

/** Every `<file>: <selector> { prop: value }` for the property, as repo-relative text. */
function declarationsOf(property: string): { where: string; value: string }[] {
  const found: { where: string; value: string }[] = []
  for (const path of stylesheets(srcDir)) {
    const file = path.slice(repoRoot.length + 1).split(sep).join('/')
    postcss.parse(readFileSync(path, 'utf-8')).walkDecls(property, (decl) => {
      const selector = decl.parent && 'selector' in decl.parent ? String(decl.parent.selector) : '?'
      found.push({ where: `${file}: ${selector} { ${property} }`, value: decl.value.trim() })
    })
  }
  return found
}

test('O9 every border-radius under src is made of --radius-* tokens', () => {
  const token = /^var\(--radius-(?:sm|md|lg|pill)\)$/
  const offenders = declarationsOf('border-radius')
    .filter(({ value }) => {
      const parts = value.split(/\s+(?![^()]*\))/).filter(Boolean)
      return !parts.some((part) => token.test(part)) || !parts.every((part) => token.test(part) || part === '0')
    })
    .map(({ where, value }) => `${where} = ${value}`)

  expect(offenders, 'use var(--radius-sm|md|lg|pill)').toEqual([])
})

test('O9 every box-shadow under src is none or var(--shadow-sheet)', () => {
  const offenders = declarationsOf('box-shadow')
    .filter(({ value }) => value !== 'none' && value !== 'var(--shadow-sheet)')
    .map(({ where, value }) => `${where} = ${value}`)

  expect(offenders, 'a shadow is the sheet shadow or nothing').toEqual([])
})

test('O9 .card paints --color-surface with a 1px --color-hairline border', () => {
  const merged = new Map<string, string>()
  for (const path of stylesheets(srcDir)) {
    for (const [prop, value] of declarationsFor(readFileSync(path, 'utf-8'), '.card')) {
      merged.set(prop, value)
    }
  }

  expect(merged.get('background')).toBe('var(--color-surface)')
  expect(merged.get('border')).toBe('1px solid var(--color-hairline)')
  expect(merged.get('border-radius')).toBe('var(--radius-lg)')
})
