import type { LibraryExercise } from '../types'

/** One harvested Muscle & Strength exercise page (E5-T2 Interfaces). */
export type MsPage = {
  slug: string
  title: string
  equipment: string | null
  youtubeId: string | null
}

/**
 * Normalises an exercise name for comparison: case, punctuation, plurals, word order and the
 * db/dumbbell, bb/barbell, pushup/push-up synonyms all collapse to the same string.
 *
 * E5-T2 stub -- the behaviour is not written yet.
 */
export function normaliseName(_name: string): string {
  throw new Error('normaliseName is not implemented yet (E5-T2)')
}

/**
 * Matches a harvested M&S page to one library exercise by normalised-name equality.
 *
 * An entry in `overrides` (keyed by `page.slug`) always wins over the computed match, including
 * overriding a match to `null`. Absent an override, returns the one library id whose normalised
 * name equals the page's normalised name, or `null` when there are zero or two-or-more
 * candidates.
 *
 * E5-T2 stub -- the behaviour is not written yet.
 */
export function matchVideo(
  _page: MsPage,
  _library: Map<string, LibraryExercise>,
  _overrides: Record<string, string | null>,
): string | null {
  throw new Error('matchVideo is not implemented yet (E5-T2)')
}
