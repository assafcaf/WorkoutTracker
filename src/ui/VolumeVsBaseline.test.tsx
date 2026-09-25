import { expect, test } from 'vitest'
import { baselineLabel } from './VolumeVsBaseline'
import type { VolumeBaseline } from '../types'

// O1/O2 (spec O16/O17): the exact wording after "Volume vs ", one case per baseline shape the
// ticket's Interfaces table names. A wrong branch or a mis-spelled label here is what a row's
// "Volume vs <this>: <n>%" would show verbatim, so each case is a literal, hand-checked string.

test.each<[string, VolumeBaseline, string]>([
  ['{ period: "last" } reads as last workout', { period: 'last' }, 'last workout'],
  ['{ period: "1w", aggregate: "avg" } reads as week average', { period: '1w', aggregate: 'avg' }, 'week average'],
  ['{ period: "1w", aggregate: "max" } reads as best this week', { period: '1w', aggregate: 'max' }, 'best this week'],
  ['{ period: "1m", aggregate: "avg" } reads as month average', { period: '1m', aggregate: 'avg' }, 'month average'],
  ['{ period: "1m", aggregate: "max" } reads as best this month', { period: '1m', aggregate: 'max' }, 'best this month'],
  ['{ period: "3m", aggregate: "avg" } reads as 3-month average', { period: '3m', aggregate: 'avg' }, '3-month average'],
  ['{ period: "3m", aggregate: "max" } reads as 3-month best', { period: '3m', aggregate: 'max' }, '3-month best'],
  ['{ period: "6m", aggregate: "avg" } reads as 6-month average', { period: '6m', aggregate: 'avg' }, '6-month average'],
  ['{ period: "6m", aggregate: "max" } reads as 6-month best', { period: '6m', aggregate: 'max' }, '6-month best'],
])('baselineLabel %s', (_label, baseline, expected) => {
  expect(baselineLabel(baseline)).toBe(expected)
})

test('baselineLabel of a "since" average names the day and short month of since', () => {
  // 2026-03-01 UTC, so a UTC-based formatter and a local-time one agree.
  const since = Date.UTC(2026, 2, 1)

  expect(baselineLabel({ period: 'since', since, aggregate: 'avg' })).toBe('average since 1 Mar')
})

test('baselineLabel of a "since" best names the day and short month of since', () => {
  const since = Date.UTC(2026, 2, 1)

  expect(baselineLabel({ period: 'since', since, aggregate: 'max' })).toBe('best since 1 Mar')
})
