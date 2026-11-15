import { expect, test } from 'vitest'
import { loadCatalog } from '../data/catalog'
import { exerciseVerdict, honestMoveText, liveRecordCount, setsInNumbers } from './exerciseVerdict'
import type { Exercise, ExercisePlan, Session } from '../types'

const T = 1_700_000_000_000
const DAY = 86_400_000
const squat = loadCatalog().get('back-squat') as Exercise
const plan: ExercisePlan = { exerciseId: 'back-squat', sets: 2, repRange: [8, 10], restSeconds: 180 }

function session(id: string, daysAgo: number, sets: [number, number][], finished = true): Session {
  const startedAt = T - daysAgo * DAY
  return {
    id,
    programId: 'p',
    workoutId: 'w',
    startedAt,
    finishedAt: finished ? startedAt + 3_600_000 : null,
    entries: sets.map(([weightKg, reps], index) => ({
      exerciseId: 'back-squat',
      setIndex: index + 1,
      weightKg,
      reps,
      loggedAt: startedAt + index * 60_000,
    })),
  }
}

const earlier = [session('a', 7, [[60, 8], [60, 8]])]
const resolve = (id: string) => (id === 'back-squat' ? squat : undefined)
const planOf = (id: string) => (id === 'back-squat' ? plan : undefined)

test('V2-11 a heavier top Set reads <Exercise> done · stepped up to … · 1 PR', () => {
  const today = session('today', 0, [[70, 8], [70, 8]], false)
  expect(exerciseVerdict(squat, plan, earlier, today)).toBe('Back squat done · stepped up to 70 kg · +10 kg · 1 PR')
})

test('V2-11 the same Sets as last time read <Exercise> done · same, with no PR', () => {
  const today = session('today', 0, [[60, 8], [60, 8]], false)
  // V3-02: "same" names its numbers; never a bare "same".
  expect(exerciseVerdict(squat, plan, earlier, today)).toBe('Back squat done · same as last time · 2 × 60 × 8')
})

test('V3-02 no verdict is a bare same, and a partial Exercise shows n of N sets with no vs', () => {
  const four: ExercisePlan = { ...plan, sets: 4 }
  const before = [session('a', 7, [[60, 8], [60, 8], [60, 8], [60, 8]])]
  const today = session('today', 0, [[60, 6]], false)
  const verdict = exerciseVerdict(squat, four, before, today)
  expect(verdict).toBe('Back squat done · 1 of 4 sets')
  expect(verdict).not.toMatch(/vs/)
})

test('V3-02 honestMoveText names the numbers of a Same and leaves other moves alone', () => {
  const entries = session('today', 0, [[70, 7], [70, 7], [70, 7]], false).entries
  expect(honestMoveText('Same', entries, 3)).toBe('Same as last time · 3 × 70 × 7')
  expect(honestMoveText('Fewer reps · 6 vs 23', entries.slice(0, 1), 4)).toBe('1 of 4 sets')
  expect(honestMoveText('Stepped up to 70 kg · +10 kg · record', entries.slice(0, 1), 3)).toBe(
    'Stepped up to 70 kg · +10 kg · 1 of 3 sets · record',
  )
  expect(honestMoveText('More reps · 21 vs 20', entries, 3)).toBe('More reps · 21 vs 20')
  expect(setsInNumbers([...entries.slice(0, 2), { ...entries[2], reps: 6 }])).toBe('70 × 7, 70 × 7, 70 × 6')
})

test('V2-11 the first Session of an Exercise reads done · first session', () => {
  const today = session('today', 0, [[60, 8]], false)
  expect(exerciseVerdict(squat, plan, [], today)).toBe('Back squat done · first session')
})

test('V2-11 an Exercise with no Set in the Session has no verdict', () => {
  expect(exerciseVerdict(squat, plan, earlier, session('today', 0, [], false))).toBeNull()
})

test('V2-11 liveRecordCount counts the Session records so far', () => {
  expect(liveRecordCount(earlier, session('today', 0, [[70, 8]], false), resolve, planOf)).toBe(1)
  expect(liveRecordCount(earlier, session('today', 0, [[60, 8]], false), resolve, planOf)).toBe(0)
})
