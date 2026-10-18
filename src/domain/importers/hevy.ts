import type { ParseResult } from './types'

export function parseHevy(_text: string): ParseResult {
  return { drafts: [], leftOut: 0, unit: 'unstated' }
}
