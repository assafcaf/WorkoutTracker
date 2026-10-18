export function parseCsv(_text: string): string[][] {
  throw new Error('NotImplementedError')
}

export function writeCsv(_rows: string[][]): string {
  throw new Error('NotImplementedError')
}

export function withBom(_text: string): string {
  throw new Error('NotImplementedError')
}

/** Column positions by name; keys of the result are the names as passed. A missing required name throws, naming it; a missing optional name is absent. */
export function headerIndex(
  _header: string[],
  _required: string[],
  _optional?: string[],
): Record<string, number> {
  throw new Error('NotImplementedError')
}
