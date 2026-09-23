// Test-only helpers that read the project's CSS as data. Never imported by shipped code.
//
// The design system is plain CSS with custom properties, which means the palette, the scales
// and the tap-target floor are text on disk — so a unit test can hold them to the documented
// set instead of trusting that a later task did not drift from it. These helpers are what the
// audits in src/styles/*.test.ts measure with.
//
// Parse with `postcss` (a direct devDependency for exactly this reason), not with hand-rolled
// regular expressions: a regex that "works" on today's file quietly stops seeing declarations
// the moment a rule is nested, a comment lands mid-declaration or a selector list wraps.
//
// STUB — every function below returns a placeholder so the audits import and run. Replacing
// these six bodies is the implementation task; the signatures and the key shapes are fixed by
// the tests and by E3-T8, which extends the audits with the tap-target outcome.

/**
 * The custom properties declared on `:root`, keyed by the full property name as written —
 * `--color-bg`, not `color-bg` — so callers name a token the way the CSS does. Values are
 * returned verbatim (trimmed), including ones that are not plain hex: `--font-sans`,
 * `--shadow-card` and `--safe-bottom`.
 */
export function readTokens(_css: string): Map<string, string> {
  return new Map()
}

/** Every custom property name referenced through `var(--…)` anywhere in the stylesheet. */
export function referencedVars(_css: string): Set<string> {
  return new Set()
}

/**
 * Every literal colour in the stylesheet's declaration values — hex, `rgb(`/`rgba(`,
 * `hsl(`/`hsla(` and CSS named colours — each as written. Empty means the file defines no
 * colour of its own and can only be getting them from a token.
 */
export function literalColours(_css: string): string[] {
  return []
}

/**
 * The declarations that apply to one selector, merged across every rule that lists it,
 * later rules winning. Keyed by property name, values verbatim.
 */
export function declarationsFor(_css: string, _selector: string): Map<string, string> {
  return new Map()
}

/** WCAG 2.1 relative luminance of an `#rrggbb` colour, 0 for black and 1 for white. */
export function relativeLuminance(_hex: string): number {
  return 0
}

/** WCAG 2.1 contrast ratio between two `#rrggbb` colours, from 1:1 to 21:1. Order-free. */
export function contrastRatio(_foreground: string, _background: string): number {
  return 0
}
