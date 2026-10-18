// @vitest-environment node
// The Worker's layering, read off the production sources' imports:
// routes -> handlers -> services -> repositories, nothing imports index.ts, only repositories touch D1.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { expect, test } from 'vitest'

const ROOT = resolve(process.cwd(), 'src/worker')

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sourceFiles(path)
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : []
  })
}

const rel = (path: string) => relative(ROOT, path).split('\\').join('/')
const files = sourceFiles(ROOT)
const names = files.map(rel)

function text(name: string): string {
  return readFileSync(join(ROOT, name), 'utf-8')
}

function code(name: string): string {
  return text(name)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !/^\s*\/\//.test(line))
    .join('\n')
}

/** Module paths a file imports or re-exports, relative specifiers resolved to a path under src/worker (or `..`). */
function importsOf(name: string): string[] {
  const source = code(name)
  const specifiers: string[] = []
  const pattern = /(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g
  for (const match of source.matchAll(pattern)) specifiers.push(match[1] ?? match[2] ?? match[3])
  return specifiers
    .filter((specifier) => specifier.startsWith('.'))
    .map((specifier) => {
      const target = resolve(dirname(join(ROOT, name)), specifier)
      const candidates = [`${target}.ts`, join(target, 'index.ts'), target]
      const found = candidates.find((candidate) => names.includes(rel(candidate)))
      return rel(found ?? target)
    })
}

const layerOf = (name: string): string => {
  if (name === 'routes.ts') return 'routes'
  if (name.startsWith('handlers/')) return 'handlers'
  if (name.startsWith('services/')) return 'services'
  if (name.startsWith('repositories/')) return 'repositories'
  return 'other'
}

const isLayer = (target: string, layer: string) => layerOf(target) === layer

test('O7 each layer exists as files under src/worker', () => {
  expect(names).toContain('routes.ts')
  expect(names).toContain('http.ts')
  expect(names.filter((n) => layerOf(n) === 'handlers').length).toBeGreaterThan(0)
  expect(names.filter((n) => layerOf(n) === 'services').length).toBeGreaterThan(0)
  expect(names.filter((n) => layerOf(n) === 'repositories').length).toBeGreaterThan(0)
})

test('O7 no file under src/worker imports src/worker/index.ts', () => {
  const offenders = names.filter((name) => importsOf(name).includes('index.ts'))

  expect(offenders).toEqual([])
})

test('O7 only src/worker/repositories calls prepare or batch', () => {
  const offenders = names.filter((name) => layerOf(name) !== 'repositories' && /\.(prepare|batch)\s*\(/.test(code(name)))

  expect(offenders).toEqual([])
})

test('O7 routes.ts imports handlers and never a service or a repository', () => {
  const imports = importsOf('routes.ts')

  expect(imports.some((target) => isLayer(target, 'handlers'))).toBe(true)
  expect(imports.filter((target) => isLayer(target, 'services') || isLayer(target, 'repositories'))).toEqual([])
})

test('O7 the sync and replace handlers import a service, and no handler imports a repository or routes.ts', () => {
  for (const name of ['handlers/sync.ts', 'handlers/replace.ts']) {
    expect(importsOf(name).some((target) => isLayer(target, 'services')), name).toBe(true)
  }
  for (const name of names.filter((n) => layerOf(n) === 'handlers')) {
    const upOrSkip = importsOf(name).filter((target) => isLayer(target, 'repositories') || target === 'routes.ts')
    expect(upOrSkip, name).toEqual([])
  }
})

test('O7 services import repositories and never a handler or routes.ts', () => {
  const services = names.filter((n) => layerOf(n) === 'services')
  expect(services.some((name) => importsOf(name).some((target) => isLayer(target, 'repositories')))).toBe(true)
  for (const name of services) {
    const upward = importsOf(name).filter((target) => isLayer(target, 'handlers') || target === 'routes.ts')
    expect(upward, name).toEqual([])
  }
})

test('O7 repositories import no handler, no service and not routes.ts', () => {
  const repositories = names.filter((n) => layerOf(n) === 'repositories')
  expect(repositories.length).toBeGreaterThan(0)
  for (const name of repositories) {
    const upward = importsOf(name).filter(
      (target) => isLayer(target, 'handlers') || isLayer(target, 'services') || target === 'routes.ts',
    )
    expect(upward, name).toEqual([])
  }
})

test('O8 no file under src/worker defines HttpError or a request check', () => {
  const offenders = names.filter((name) => /\bclass\s+HttpError\b|\bparseSessions\b|\bparseSettings\b/.test(code(name)))

  expect(offenders).toEqual([])
})
