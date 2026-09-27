// [O10] the muscle chip's family-tinted rule, read as data -- the same pattern
// src/styles/tabBarPosition.test.ts and src/styles/tokens.test.ts use to read CSS, per
// docs/decisions/0004-one-palette-one-shell-audited-as-data.md. The rule can live in any
// stylesheet under src/ (the ticket names src/ui/MuscleChip.css, but the outcome itself makes
// no assumption about which file), so this scans every one rather than reading one path.
import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from 'vitest'
import { declarationsFor } from '../test/cssAudit'

// src/ui/MuscleChip.test.tsx -> the repository root.
const repoRoot = resolve(fileURLToPath(import.meta.url), '..', '..', '..')
const srcDir = join(repoRoot, 'src')

/** Every `.css` file under `dir`, as absolute paths. */
function cssFilesUnder(dir: string): string[] {
  const found: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) found.push(...cssFilesUnder(full))
    else if (entry.name.endsWith('.css')) found.push(full)
  }
  return found.sort()
}

/**
 * The declarations for `selector`, merged across every stylesheet under `src/` that declares
 * it -- later files (in sorted path order) winning, matching `declarationsFor`'s own
 * later-rule-wins merge within one file.
 */
function declarationsAcrossSrc(selector: string): Map<string, string> {
  const merged = new Map<string, string>()
  for (const path of cssFilesUnder(srcDir).map((p) => p.slice(repoRoot.length + 1).split(sep).join('/'))) {
    const css = readFileSync(join(repoRoot, path), 'utf-8')
    for (const [prop, value] of declarationsFor(css, selector)) merged.set(prop, value)
  }
  return merged
}

const FAMILIES = ['push', 'pull', 'legs', 'core'] as const

for (const family of FAMILIES) {
  test(`O10 .muscle-chip[data-family='${family}'] paints background and color from the ${family} family tokens`, () => {
    const declared = declarationsAcrossSrc(`.muscle-chip[data-family='${family}']`)

    expect(
      declared.get('background'),
      `.muscle-chip[data-family='${family}'] must declare background: var(--family-${family}-tint)`,
    ).toBe(`var(--family-${family}-tint)`)
    expect(
      declared.get('color'),
      `.muscle-chip[data-family='${family}'] must declare color: var(--family-${family}-ink)`,
    ).toBe(`var(--family-${family}-ink)`)
  })
}
