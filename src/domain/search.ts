// Forgiving name matcher: typos, word order, hyphens, plurals and gym shorthand.
export const SHORTHAND: Record<string, string> = {
  bb: 'barbell',
  bi: 'biceps',
  bis: 'biceps',
  bw: 'bodyweight',
  db: 'dumbbell',
  delt: 'deltoid',
  delts: 'deltoid',
  ez: 'ez bar',
  ext: 'extension',
  kb: 'kettlebell',
  ohp: 'overhead press',
  rdl: 'romanian deadlift',
  sldl: 'stiff legged deadlift',
  tri: 'triceps',
  tris: 'triceps',
}

export function normalizeWords(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 0)
    .map((w) => (w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w))
}

export function editDistance(a: string, b: string): number {
  const d: number[][] = []
  for (let i = 0; i <= a.length; i++) {
    d[i] = []
    for (let j = 0; j <= b.length; j++) {
      if (i === 0) d[i][j] = j
      else if (j === 0) d[i][j] = i
      else {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1
        let v = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost)
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
          v = Math.min(v, d[i - 2][j - 2] + 1)
        }
        d[i][j] = v
      }
    }
  }
  return d[a.length][b.length]
}

export function typoAllowance(word: string): 0 | 1 | 2 {
  if (word.length <= 3) return 0
  return word.length <= 7 ? 1 : 2
}

function wordMatches(q: string, w: string): boolean {
  const allow = typoAllowance(q)
  if (editDistance(q, w) <= allow) return true
  for (let n = q.length - 1; n <= q.length + 1; n++) {
    if (n >= 1 && n <= w.length && editDistance(q, w.slice(0, n)) <= allow) return true
  }
  return false
}

const compact = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

export function matchesQuery(name: string, query: string): boolean {
  const qWords = normalizeWords(query)
  if (qWords.length === 0) return true
  const nWords = normalizeWords(name)
  const cq = compact(query)
  const cqs = cq.length > 1 && cq.endsWith('s') ? cq.slice(0, -1) : cq
  if (compact(name).includes(cqs)) return true
  const some = (q: string) => nWords.some((w) => wordMatches(q, w))
  return qWords.every((q) => {
    if (some(q)) return true
    const exp = Object.prototype.hasOwnProperty.call(SHORTHAND, q) ? SHORTHAND[q] : undefined
    return exp !== undefined && normalizeWords(exp).every(some)
  })
}
