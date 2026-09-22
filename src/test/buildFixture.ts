// A test utility: runs one real Vite production build and lets a test read what landed in the
// output directory. Never imported by shipped code.
//
// Deployment bugs — a missing manifest, an asset rooted at the domain instead of the Pages base
// path — exist only in the built artefact, so the only honest way to test for them is to build
// and look. Vite's JS `build()` API is called directly rather than spawning `npm run build`:
// spawning would pay for a second `tsc --noEmit` pass and lose the error messages.
//
// The build is cached per process, so a file with several tests pays for it once. It is slow
// (tens of seconds cold), so the hook or test that awaits `buildApp()` must set its own
// generous timeout — vitest's default hook timeout is 10s.
import { mkdtempSync, readFileSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'

export type BuiltApp = {
  /** Absolute path to the temp directory the build was written to. */
  outDir: string
  /** Every file in the build output, relative to `outDir`, '/' separated and sorted. */
  files: string[]
  /** utf-8 contents of a built file; throws an Error naming `relPath` when it is absent. */
  read(relPath: string): string
  /** `read`, parsed as JSON. */
  readJson<T>(relPath: string): T
}

// src/test/buildFixture.ts -> the repository root.
const repoRoot = resolve(fileURLToPath(import.meta.url), '..', '..', '..')

let cached: Promise<BuiltApp> | undefined

export function buildApp(): Promise<BuiltApp> {
  if (!cached) cached = runBuild()
  return cached
}

async function runBuild(): Promise<BuiltApp> {
  const outDir = mkdtempSync(join(tmpdir(), 'workout-build-'))
  await build({
    root: repoRoot,
    logLevel: 'silent',
    build: { outDir, emptyOutDir: true },
  })

  const files = listFiles(outDir).sort()
  const present = new Set(files)

  const read = (relPath: string): string => {
    const key = normalize(relPath)
    if (!present.has(key)) {
      throw new Error(
        `the production build has no ${relPath}; it emitted ${files.length} files: ${files.join(', ')}`,
      )
    }
    return readFileSync(join(outDir, ...key.split('/')), 'utf-8')
  }

  return {
    outDir,
    files,
    read,
    readJson<T>(relPath: string): T {
      return JSON.parse(read(relPath)) as T
    },
  }
}

function normalize(relPath: string): string {
  return relPath.replace(/\\/g, '/').replace(/^\.?\//, '')
}

function listFiles(dir: string, prefix = ''): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.isDirectory()) out.push(...listFiles(join(dir, entry.name), rel))
    else out.push(rel)
  }
  return out
}
