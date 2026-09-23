import type { LibraryExercise } from '../types'

/** One harvested Muscle & Strength exercise page (E5-T2 Interfaces). */
export type MsPage = {
  slug: string
  title: string
  equipment: string | null
  video: { provider: 'youtube' | 'vimeo'; id: string } | null
}

/** Word-level synonyms that normalise to the same canonical word. */
const WORD_SYNONYMS: Record<string, string> = {
  db: 'dumbbell',
  bb: 'barbell',
}

/**
 * Normalises an exercise name for comparison: case, punctuation, plurals, word order and the
 * db/dumbbell, bb/barbell, pushup/push-up synonyms all collapse to the same string.
 */
export function normaliseName(name: string): string {
  const withoutHyphens = name.replace(/-/g, '')
  const cleaned = withoutHyphens.toLowerCase().replace(/[^a-z0-9\s]/g, ' ')
  const words = cleaned
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      const singular = word.endsWith('s') && !word.endsWith('ss') ? word.slice(0, -1) : word
      return WORD_SYNONYMS[singular] ?? singular
    })
    .sort()

  return words.join(' ')
}

/**
 * Matches a harvested M&S page to one library exercise by normalised-name equality.
 *
 * An entry in `overrides` (keyed by `page.slug`) always wins over the computed match, including
 * overriding a match to `null`. Absent an override, returns the one library id whose normalised
 * name equals the page's normalised name, or `null` when there are zero or two-or-more
 * candidates.
 */
export function matchVideo(
  page: MsPage,
  library: Map<string, LibraryExercise>,
  overrides: Record<string, string | null>,
): string | null {
  if (Object.prototype.hasOwnProperty.call(overrides, page.slug)) {
    return overrides[page.slug]
  }

  const target = normaliseName(page.title)
  const candidates: string[] = []
  for (const [id, exercise] of library) {
    if (normaliseName(exercise.name) === target) {
      candidates.push(id)
    }
  }

  return candidates.length === 1 ? candidates[0] : null
}
