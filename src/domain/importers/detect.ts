export type SourceFormat = 'strong' | 'hevy'

/** Which app a CSV came from, by its header cells (any order, case and edge spaces ignored). */
export function detectFormat(header: string[]): SourceFormat | null {
  const cells = new Set(header.map((cell) => cell.replace(/^\u{FEFF}/u, '').trim().toLowerCase()))
  if (cells.has('exercise name') && cells.has('set order')) return 'strong'
  if (cells.has('exercise_title') && cells.has('start_time')) return 'hevy'
  return null
}
