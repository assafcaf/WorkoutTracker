/**
 * Builds `src/data/library/videos.json` (E5-T7): library id -> Muscle & Strength video.
 *
 * Reads the harvest (`scripts/data/ms-pages.json`), the hand pins
 * (`src/data/library/video-overrides.json`) and the bundled library, matches every page that
 * has a video with `matchVideo`, and writes the result with keys sorted for a stable diff.
 *
 * Run: `npx tsx scripts/build-videos.ts`
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { LibraryExercise, Video } from '../src/types'
import { matchVideo, normaliseName, type MsPage } from '../src/data/videoMatch'

const root = fileURLToPath(new URL('..', import.meta.url))

function readJson<T>(relativePath: string): T {
  return JSON.parse(readFileSync(root + relativePath, 'utf8')) as T
}

const pages = readJson<MsPage[]>('scripts/data/ms-pages.json')
const overrides = readJson<Record<string, string | null>>('src/data/library/video-overrides.json')
const entries = readJson<LibraryExercise[]>('src/data/library/exercises.json')
const library = new Map(entries.map((exercise) => [exercise.id, exercise] as const))

const nameCounts = new Map<string, number>()
for (const exercise of entries) {
  const name = normaliseName(exercise.name)
  nameCounts.set(name, (nameCounts.get(name) ?? 0) + 1)
}

const videos: Record<string, Video> = {}
const matchedBy: Record<string, string> = {}
const ambiguous: string[] = []
const conflicts: string[] = []
let matched = 0
let unmatched = 0
let noVideo = 0

for (const page of pages) {
  if (!page.video) {
    noVideo += 1
    continue
  }

  const libraryId = matchVideo(page, library, overrides)
  if (libraryId === null) {
    const pinned = Object.prototype.hasOwnProperty.call(overrides, page.slug)
    if (!pinned && (nameCounts.get(normaliseName(page.title)) ?? 0) >= 2) {
      ambiguous.push(page.slug)
    } else {
      unmatched += 1
    }
    continue
  }

  // Tie-break: the first page (in harvest order) to claim a library id keeps it.
  if (libraryId in videos) {
    conflicts.push(`${page.slug} -> ${libraryId} (kept ${matchedBy[libraryId]})`)
    continue
  }

  videos[libraryId] = {
    provider: page.video.provider,
    id: page.video.id,
    source: `https://www.muscleandstrength.com/exercises/${page.slug}.html`,
  }
  matchedBy[libraryId] = page.slug
  matched += 1
}

const sorted = Object.fromEntries(
  Object.keys(videos)
    .sort()
    .map((id) => [id, videos[id]]),
)
writeFileSync(root + 'src/data/library/videos.json', JSON.stringify(sorted, null, 2) + '\n')

const list = (items: string[]) => (items.length ? ` (${items.join('; ')})` : '')
console.log(`matched:   ${matched}`)
console.log(`ambiguous: ${ambiguous.length}${list(ambiguous)}`)
console.log(`conflicts: ${conflicts.length}${list(conflicts)}`)
console.log(`unmatched: ${unmatched}`)
console.log(`no-video:  ${noVideo}`)
console.log(`coverage:  ${Object.keys(sorted).length}/${library.size}`)
