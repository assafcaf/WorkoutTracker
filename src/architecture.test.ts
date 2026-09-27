import { readdirSync, readFileSync, type Dirent } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { describe, expect, test } from 'vitest'
import { ESLint } from 'eslint'

const root = resolve(__dirname, '..')

function toPosix(path: string): string {
  return path.split('\\').join('/')
}

/**
 * Every non-test `.ts`/`.tsx` file under a `src/<dir>/**` glob, repo-root-relative with
 * forward slashes. Reused by E11-T16.
 */
export function productionFiles(glob: string): string[] {
  const prefix = glob.replace(/\/\*\*$/, '')
  const dir = resolve(root, prefix)
  const results: string[] = []

  function walk(current: string): void {
    let entries: Dirent[]
    try {
      entries = readdirSync(current, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      const full = join(current, entry.name)
      if (entry.isDirectory()) {
        walk(full)
        continue
      }
      if (!/\.(ts|tsx)$/.test(entry.name)) continue
      if (/\.test\.(ts|tsx)$/.test(entry.name)) continue
      results.push(toPosix(relative(root, full)))
    }
  }

  walk(dir)
  return results
}

const IMPORT_RE = /import\s+(type\s+)?[\s\S]*?from\s+['"]([^'"]+)['"]/g

/** Every `import ... from '...'` in a production file, repo-root-relative. Reused by E11-T16. */
export function importsOf(file: string): { source: string; typeOnly: boolean }[] {
  const code = readFileSync(resolve(root, file), 'utf-8')
  const imports: { source: string; typeOnly: boolean }[] = []
  IMPORT_RE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = IMPORT_RE.exec(code))) {
    imports.push({ source: match[2], typeOnly: Boolean(match[1]) })
  }
  return imports
}

/** Lints `code` as if it were `filePath`, and returns each `no-restricted-imports` message. */
export async function lintFixture(filePath: string, code: string): Promise<string[]> {
  const eslint = new ESLint({ cwd: root })
  const results = await eslint.lintText(code, { filePath: resolve(root, filePath) })
  return results
    .flatMap((result) => result.messages)
    .filter((message) => message.ruleId === 'no-restricted-imports')
    .map((message) => message.message)
}

/** A relative import's target, repo-root-relative and without extension, or `null` for a bare specifier. */
function resolveImport(file: string, source: string): string | null {
  if (!source.startsWith('.')) return null
  const resolved = resolve(dirname(resolve(root, file)), source)
  return toPosix(relative(root, resolved)).replace(/\.(ts|tsx)$/, '')
}

function pointsInto(target: string | null, dirs: string[]): boolean {
  if (target === null) return false
  return dirs.some((dir) => target === dir || target.startsWith(`${dir}/`))
}

describe('layers point downward (O2)', () => {
  test('src/domain/** imports only src/domain/** and src/types.ts', () => {
    const files = productionFiles('src/domain/**')
    expect(files.length).toBeGreaterThan(0)

    const offenders = files.flatMap((file) =>
      importsOf(file)
        .map((imp) => ({ imp, target: resolveImport(file, imp.source) }))
        .filter(({ target }) => target !== null)
        .filter(({ target }) => target !== 'src/types' && !target!.startsWith('src/domain/'))
        .map(({ imp }) => `${file} -> ${imp.source}`),
    )

    expect(offenders).toEqual([])
  })

  test('src/storage/** imports nothing from services, sync, ui, features or react', () => {
    const files = productionFiles('src/storage/**')
    expect(files.length).toBeGreaterThan(0)
    const forbiddenDirs = ['src/services', 'src/sync', 'src/ui', 'src/features']

    const offenders = files.flatMap((file) =>
      importsOf(file)
        .filter(
          (imp) =>
            imp.source === 'react' || pointsInto(resolveImport(file, imp.source), forbiddenDirs),
        )
        .map((imp) => `${file} -> ${imp.source}`),
    )

    expect(offenders).toEqual([])
  })

  test('src/services/** and src/sync/** import nothing from ui or features', () => {
    const files = [...productionFiles('src/services/**'), ...productionFiles('src/sync/**')]
    expect(files.length).toBeGreaterThan(0)
    const forbiddenDirs = ['src/ui', 'src/features']

    const offenders = files.flatMap((file) =>
      importsOf(file)
        .filter((imp) => pointsInto(resolveImport(file, imp.source), forbiddenDirs))
        .map((imp) => `${file} -> ${imp.source}`),
    )

    expect(offenders).toEqual([])
  })
})

describe('lint refuses each layer-breaking import (O4)', () => {
  test('domain importing storage is refused as "[layers] domain is pure"', async () => {
    const messages = await lintFixture(
      'src/domain/fixture.ts',
      "import { db } from '../storage/db'\nexport const usesDb = db\n",
    )
    expect(messages.some((message) => message.includes('[layers] domain is pure'))).toBe(true)
  })

  test('storage importing react is refused as "[layers] storage points down"', async () => {
    const messages = await lintFixture(
      'src/storage/fixture.ts',
      "import { useState } from 'react'\nexport const usesState = useState\n",
    )
    expect(messages.some((message) => message.includes('[layers] storage points down'))).toBe(
      true,
    )
  })

  test('services importing ui is refused as "[layers] services and sync point down"', async () => {
    const messages = await lintFixture(
      'src/services/fixture.ts',
      "import { Thing } from '../ui/Thing'\nexport const usesThing = Thing\n",
    )
    expect(
      messages.some((message) => message.includes('[layers] services and sync point down')),
    ).toBe(true)
  })

  test('sync importing features is refused as "[layers] services and sync point down"', async () => {
    const messages = await lintFixture(
      'src/sync/fixture.ts',
      "import { Thing } from '../features/Thing'\nexport const usesThing = Thing\n",
    )
    expect(
      messages.some((message) => message.includes('[layers] services and sync point down')),
    ).toBe(true)
  })
})
