// Test-only helper: the declarations that reach one rendered element, read as data. Never
// imported by shipped code.
//
// jsdom applies no stylesheet, so `getComputedStyle` cannot say what a component paints. This
// walks every `.css` file under src/ (sorted by path, the order the audits in src/styles read
// them), keeps the rules whose selector the element `matches()`, and merges their declarations
// in source order, later winning, then lays the element's inline `style` over them. Specificity
// is ignored: an outcome that asks "what does this element paint" is held to whichever rule
// reaches it, wherever the implementer chose to put it.
import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import postcss from 'postcss'

// src/test/cssMatch.ts -> src/
const srcDir = resolve(fileURLToPath(import.meta.url), '..', '..')

function cssFilesUnder(dir: string): string[] {
  const found: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) found.push(...cssFilesUnder(full))
    else if (entry.name.endsWith('.css')) found.push(full)
  }
  return found.sort()
}

function safeMatches(element: Element, selector: string): boolean {
  try {
    return element.matches(selector)
  } catch {
    // `from`, `50%` (keyframes) and pseudo-elements are not element selectors.
    return false
  }
}

/** Every declaration reaching `element` from src/ stylesheets and its inline style. */
export function declarationsMatching(element: Element): Map<string, string> {
  const merged = new Map<string, string>()
  for (const path of cssFilesUnder(srcDir)) {
    postcss.parse(readFileSync(path, 'utf-8')).walkRules((rule) => {
      const parent = rule.parent
      if (parent && parent.type === 'atrule' && /keyframes$/i.test((parent as postcss.AtRule).name)) return
      const hit = rule.selector
        .split(',')
        .map((selector) => selector.trim())
        .some((selector) => safeMatches(element, selector))
      if (!hit) return
      rule.each((node) => {
        if (node.type === 'decl') merged.set(node.prop.trim(), node.value.trim())
      })
    })
  }
  const inline = element.getAttribute('style')
  if (inline) {
    postcss.parse(`x{${inline}}`).walkDecls((decl) => {
      merged.set(decl.prop.trim(), decl.value.trim())
    })
  }
  return merged
}

/** The fill or background an element paints: `background-color`, else `background`, else `fill`. */
export function paintOf(declared: Map<string, string>): string | undefined {
  return declared.get('background-color') ?? declared.get('background') ?? declared.get('fill')
}
