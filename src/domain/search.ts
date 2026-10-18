export const SHORTHAND: Record<string, string> = {}

export function normalizeWords(_text: string): string[] {
  throw new Error('NotImplementedError')
}

export function editDistance(_a: string, _b: string): number {
  throw new Error('NotImplementedError')
}

export function typoAllowance(_word: string): 0 | 1 | 2 {
  throw new Error('NotImplementedError')
}

export function matchesQuery(_name: string, _query: string): boolean {
  throw new Error('NotImplementedError')
}
