import { expect, test } from 'vitest'
import { loadLibrary, loadVideos } from './library'

// The coverage floor: the share of library entries with a video, measured 2026-09-23 by
// running matchVideo + normaliseName (E5-T2) with the E5-T7 interface-correction ruling's
// confirmed override pins (and no pin for the 4 catalog exercises with no certain match) over
// the staged harvest `scripts/data/ms-pages.json` (602 pages) against the bundled library (876
// entries): 81 distinct library ids matched a video, so 81 / 876. This is a floor, not a
// snapshot -- the real build may cover more entries (e.g. by resolving ambiguous matches by
// hand), but per the ruling it must never cover fewer.
const COVERAGE_FLOOR = 81 / 876

test('L6 the share of library entries with a video is at least the measured floor', async () => {
  const library = await loadLibrary()
  const videos = await loadVideos()

  const coverage = videos.size / library.size

  expect(coverage).toBeGreaterThanOrEqual(COVERAGE_FLOOR)
})
