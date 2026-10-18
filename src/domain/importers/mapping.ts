import { matchesQuery, normalizeWords } from '../search'
import type { Exercise, LibraryExercise } from '../../types'

export type NameProposal = { id: string; match: 'exact' | 'guess' }

type Candidate = { id: string; names: string[]; catalog: boolean }

const compact = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

function candidates(
  catalog: Map<string, Exercise>,
  library: Map<string, LibraryExercise>,
): Candidate[] {
  const backed = new Set<string>()
  const out: Candidate[] = []
  for (const ex of catalog.values()) {
    backed.add(ex.libraryId)
    const lib = library.get(ex.libraryId)
    out.push({ id: ex.id, names: lib && lib.name !== ex.name ? [ex.name, lib.name] : [ex.name], catalog: true })
  }
  for (const lib of library.values()) {
    if (!backed.has(lib.id)) out.push({ id: lib.id, names: [lib.name], catalog: false })
  }
  return out
}

function search(query: string, stripped: string, all: Candidate[]): NameProposal | null {
  const qWords = normalizeWords(query)
  const target = compact(stripped)
  const ranked = all
    .map((c) => {
      const names = c.names.filter((n) => matchesQuery(n, query))
      if (names.length === 0) return null
      const exact = names.some((n) => compact(n) === target)
      const uncovered = Math.min(
        ...names.map((n) => normalizeWords(n).filter((w) => !qWords.some((q) => matchesQuery(w, q))).length),
      )
      return { c, exact, uncovered, name: names.map((n) => n.toLowerCase()).sort()[0] }
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)
  if (ranked.length === 0) return null
  ranked.sort(
    (a, b) =>
      Number(b.exact) - Number(a.exact) ||
      Number(b.c.catalog) - Number(a.c.catalog) ||
      a.uncovered - b.uncovered ||
      (a.name < b.name ? -1 : a.name > b.name ? 1 : 0) ||
      (a.c.id < b.c.id ? -1 : a.c.id > b.c.id ? 1 : 0),
  )
  const first = ranked[0]
  return { id: first.c.id, match: first.exact ? 'exact' : 'guess' }
}

/**
 * Proposes an Exercise for a Strong or Hevy name: a trailing `(Equipment)` is tried as a leading
 * word first, then dropped. Prefers the catalog id over its library id (E23-T4, O9, O10).
 */
export function mapName(
  sourceName: string,
  catalog: Map<string, Exercise>,
  library: Map<string, LibraryExercise>,
): NameProposal | null {
  const all = candidates(catalog, library)
  const m = /^(.*?)\s*\(([^)]*)\)\s*$/.exec(sourceName.trim())
  if (!m) {
    const name = sourceName.trim()
    return name === '' ? null : search(name, name, all)
  }
  const base = m[1].trim()
  const equipment = m[2].trim()
  if (base === '') return null
  return (equipment !== '' ? search(`${equipment} ${base}`, base, all) : null) ?? search(base, base, all)
}
