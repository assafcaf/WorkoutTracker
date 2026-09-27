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
    .filter(
      (message) =>
        message.ruleId === 'no-restricted-imports' ||
        message.ruleId === '@typescript-eslint/no-restricted-imports',
    )
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

// --- E11-T16: ui/features reach only services (O1), only storage touches Dexie (O3) --------

/** src/main.tsx is the composition root; it is not scanned by O1 or O3. */
const UI_AND_FEATURE_FILES = (): string[] => [
  ...productionFiles('src/ui/**'),
  ...productionFiles('src/features/**'),
  'src/App.tsx',
]

const O3_SCANNED_FILES = (): string[] => [
  ...productionFiles('src/domain/**'),
  ...productionFiles('src/services/**'),
  ...productionFiles('src/sync/**'),
  ...productionFiles('src/worker/**'),
  ...UI_AND_FEATURE_FILES(),
]

describe('ui and features reach only services (O1)', () => {
  test('src/ui/**, src/features/** and src/App.tsx import nothing from storage, sync (except import type), dexie or the worker', () => {
    const files = UI_AND_FEATURE_FILES()
    expect(files.length).toBeGreaterThan(0)
    const forbiddenDirs = ['src/storage', 'src/sync', 'src/worker']

    const offenders = files.flatMap((file) =>
      importsOf(file)
        .filter((imp) => !imp.typeOnly)
        .filter(
          (imp) => imp.source === 'dexie' || pointsInto(resolveImport(file, imp.source), forbiddenDirs),
        )
        .map((imp) => `${file} -> ${imp.source}`),
    )

    expect(offenders).toEqual([])
  })
})

describe('only storage touches Dexie (O3)', () => {
  test('every reader of db.sessions lives in src/storage: no file outside src/storage imports src/storage/db or dexie except as a type', () => {
    const files = O3_SCANNED_FILES().filter((file) => !file.startsWith('src/storage/'))
    expect(files.length).toBeGreaterThan(0)

    const offenders = files.flatMap((file) =>
      importsOf(file)
        .filter((imp) => !imp.typeOnly)
        .filter((imp) => imp.source === 'dexie' || resolveImport(file, imp.source) === 'src/storage/db')
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

  test('ui importing storage is refused as "[layers] ui reaches services only"', async () => {
    const messages = await lintFixture(
      'src/ui/fixture.ts',
      "import { db } from '../storage/db'\nexport const usesDb = db\n",
    )
    expect(messages.some((message) => message.includes('[layers] ui reaches services only'))).toBe(
      true,
    )
  })

  test('a feature nested two levels deep importing storage is refused as "[layers] ui reaches services only"', async () => {
    const messages = await lintFixture(
      'src/features/program/fixture.ts',
      "import { db } from '../../storage/db'\nexport const usesDb = db\n",
    )
    expect(messages.some((message) => message.includes('[layers] ui reaches services only'))).toBe(
      true,
    )
  })

  test('ui importing the worker is refused as "[layers] ui reaches services only"', async () => {
    const messages = await lintFixture(
      'src/ui/fixture.ts',
      "import { sync } from '../worker/sync'\nexport const usesSync = sync\n",
    )
    expect(messages.some((message) => message.includes('[layers] ui reaches services only'))).toBe(
      true,
    )
  })

  test('ui importing dexie is refused as "[layers] ui reaches services only"', async () => {
    const messages = await lintFixture(
      'src/ui/fixture.ts',
      "import Dexie from 'dexie'\nexport const usesDexie = Dexie\n",
    )
    expect(messages.some((message) => message.includes('[layers] ui reaches services only'))).toBe(
      true,
    )
  })

  test('ui importing a sync type only is allowed', async () => {
    const messages = await lintFixture(
      'src/ui/fixture.ts',
      "import type { SyncedSession } from '../sync/protocol'\nexport type Reused = SyncedSession\n",
    )
    expect(messages.some((message) => message.includes('[layers] ui reaches services only'))).toBe(
      false,
    )
  })

  test('services importing storage/db is refused as "[layers] only storage touches Dexie"', async () => {
    const messages = await lintFixture(
      'src/services/fixture.ts',
      "import { db } from '../storage/db'\nexport const usesDb = db\n",
    )
    expect(
      messages.some((message) => message.includes('[layers] only storage touches Dexie')),
    ).toBe(true)
  })

  test('services importing dexie directly is refused as "[layers] only storage touches Dexie"', async () => {
    const messages = await lintFixture(
      'src/services/fixture.ts',
      "import Dexie from 'dexie'\nexport const usesDexie = Dexie\n",
    )
    expect(
      messages.some((message) => message.includes('[layers] only storage touches Dexie')),
    ).toBe(true)
  })

  test('services importing storage/db as a type only is allowed, mirroring src/services/backup.ts', async () => {
    const messages = await lintFixture(
      'src/services/fixture.ts',
      "import type { SettingRow } from '../storage/db'\nexport type Reused = SettingRow\n",
    )
    expect(
      messages.some((message) => message.includes('[layers] only storage touches Dexie')),
    ).toBe(false)
  })

  test('npx eslint . is clean on the real tree: no [layers] message anywhere', async () => {
    const eslint = new ESLint({ cwd: root })
    const results = await eslint.lintFiles(['src/**/*.{ts,tsx}'])
    const layerMessages = results
      .flatMap((result) => result.messages)
      .filter((message) => message.message.includes('[layers]'))
      .map((message) => `${message.message}`)

    expect(layerMessages).toEqual([])
  })
})

// --- E11-T15: App.tsx is a thin shell (O14) and the moved code is gone (O15) -----------------

/** The domain types whose values belong to the services and screen groups, never App's state. */
const DOMAIN_TYPES = [
  'Session',
  'SetEntry',
  'Program',
  'UserProgram',
  'Exercise',
  'LibraryExercise',
  'Video',
  'VolumeBaseline',
  'ImportPlan',
  'PendingImport',
  'BackupFile',
  'Services',
]

/**
 * Each `useState(...)`/`useReducer(...)` call in `code`, from the hook name through its closing
 * parenthesis, generic type argument included.
 */
export function stateHookCalls(code: string): string[] {
  const calls: string[] = []
  const start = /\buse(State|Reducer)\b/g
  let match: RegExpExecArray | null
  while ((match = start.exec(code))) {
    let index = match.index + match[0].length
    // Skip a generic type argument, which may itself nest `<...>`.
    if (code[index] === '<') {
      let depth = 0
      for (; index < code.length; index += 1) {
        if (code[index] === '<') depth += 1
        else if (code[index] === '>' && code[index - 1] !== '=') depth -= 1
        if (depth === 0) break
      }
      index += 1
    }
    if (code[index] !== '(') continue
    let depth = 0
    let end = index
    for (; end < code.length; end += 1) {
      if (code[end] === '(') depth += 1
      else if (code[end] === ')') depth -= 1
      if (depth === 0) break
    }
    calls.push(code.slice(match.index, end + 1))
  }
  return calls
}

/** Why `call` holds domain data, or null when it holds only UI state. */
function domainStateReason(call: string): string | null {
  const named = DOMAIN_TYPES.find((name) => new RegExp(`\\b${name}\\b`).test(call))
  if (named) return `names ${named}`
  if (/\(\s*\[/.test(call) || /\(\s*\(\)\s*=>\s*\[/.test(call)) return 'starts from a list'
  if (/\bnew (Map|Set)\b/.test(call)) return 'starts from a Map or Set'
  return null
}

describe('App.tsx is a thin shell (O14)', () => {
  const appCode = (): string => readFileSync(resolve(root, 'src/App.tsx'), 'utf-8')

  test('O14 src/App.tsx has at most 300 lines', () => {
    const lines = appCode().replace(/\r?\n$/, '').split(/\r?\n/).length

    expect(lines).toBeLessThanOrEqual(300)
  })

  test('O14 src/App.tsx holds no domain data in state, only which tab and route are shown', () => {
    const offenders = stateHookCalls(appCode())
      .map((call) => ({ call, reason: domainStateReason(call) }))
      .filter(({ reason }) => reason !== null)
      .map(({ call, reason }) => `${reason}: ${call.split('\n')[0]}`)

    expect(offenders).toEqual([])
  })

  test('O14 src/App.tsx reads no data itself: no runtime import from storage, data, domain, services or sync', () => {
    const dataDirs = ['src/storage', 'src/data', 'src/domain', 'src/services', 'src/sync']

    const offenders = importsOf('src/App.tsx')
      .filter((imp) => !imp.typeOnly)
      .filter((imp) => pointsInto(resolveImport('src/App.tsx', imp.source), dataDirs))
      .map((imp) => imp.source)

    expect(offenders).toEqual([])
  })

  test('O14 src/App.tsx builds no services and starts no sync of its own', () => {
    const code = appCode()

    expect(
      ['createServices(', 'createSyncService(', 'useSync('].filter((call) => code.includes(call)),
    ).toEqual([])
  })

  test('O14 src/App.tsx renders the ServicesProvider around its screen groups', () => {
    const provider = importsOf('src/App.tsx').find(
      (imp) => resolveImport('src/App.tsx', imp.source) === 'src/features/ServicesProvider',
    )

    expect(provider?.typeOnly).toBe(false)
    expect(appCode()).toMatch(/<ServicesProvider\b[^>]*\bservices=\{/)
  })

  test('O14 src/main.tsx builds the real services exactly once', () => {
    const code = readFileSync(resolve(root, 'src/main.tsx'), 'utf-8')
    const fromServices = importsOf('src/main.tsx').some(
      (imp) =>
        !imp.typeOnly &&
        ['src/services', 'src/services/index'].includes(
          resolveImport('src/main.tsx', imp.source) ?? '',
        ),
    )

    expect(fromServices).toBe(true)
    expect(code.match(/\bcreateServices\(/g) ?? []).toHaveLength(1)
    expect(code).toMatch(/<App\b[^>]*\bservices=\{/)
  })
})

describe('code moved out of App.tsx is deleted (O15)', () => {
  test('O15 src/storage/backup.ts no longer exports the export and replace flow the BackupService owns', async () => {
    const backup: Record<string, unknown> = await import('./storage/backup')

    expect(
      ['exportBackup', 'downloadOrShare', 'importBackup', 'replaceAll'].filter(
        (name) => name in backup,
      ),
    ).toEqual([])
  })

  test('O15 src/storage/backup.ts keeps the file format: readBackup, BACKUP_SCHEMA_VERSION, backupFileName and importPlan', async () => {
    const backup: Record<string, unknown> = await import('./storage/backup')

    expect(typeof backup.readBackup).toBe('function')
    expect(backup.BACKUP_SCHEMA_VERSION).toBe(1)
    expect(typeof backup.backupFileName).toBe('function')
    expect(typeof backup.importPlan).toBe('function')
  })

  test('O15 getActiveProgramId no longer adopts the latest Session\'s Program when nothing is stored', async () => {
    const { db } = await import('./storage/db')
    const { getActiveProgramId } = await import('./storage/settingsStore')
    await db.open()
    await db.settings.clear()
    await db.sessions.clear()
    await db.sessions.put({
      id: 's-latest',
      programId: 'full-body-starter',
      workoutId: 'full-body',
      startedAt: 1_700_000_000_000,
      finishedAt: 1_700_003_600_000,
      entries: [],
    })
    const programs = [
      { id: 'assaf-ab-2026', name: 'A/B', units: 'kg' as const, workouts: [], sessionsPerWeek: 3 },
      { id: 'full-body-starter', name: 'Full body', units: 'kg' as const, workouts: [], sessionsPerWeek: 3 },
    ]

    expect(await getActiveProgramId(programs)).toBeNull()
    expect(await db.settings.get('activeProgramId')).toBeUndefined()
  })
})
