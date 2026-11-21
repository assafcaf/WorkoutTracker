// DX-20: no eyebrow labels in capitals. Section headers are sentence case, 14 px semibold ink, so
// no stylesheet under src upper-cases text (`text-transform: uppercase`).
import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from 'vitest'

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

test('DX-20: no stylesheet upper-cases text', () => {
  const offenders = stylesheets(srcDir)
    .filter((path) => /text-transform\s*:\s*uppercase/.test(readFileSync(path, 'utf8')))
    .map((path) => path.slice(repoRoot.length + 1).split(sep).join('/'))
  expect(offenders).toEqual([])
})
