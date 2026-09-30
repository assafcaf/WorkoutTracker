import { describe, expect, test } from 'vitest'
import type { SetEntry } from '../types'
import { insertSet, removeSet } from './setEdits'

function entry(
  exerciseId: string,
  setIndex: number,
  weightKg: number | null,
  reps: number,
  loggedAt: number,
): SetEntry {
  return { exerciseId, setIndex, weightKg, reps, loggedAt }
}

const bench = [entry('bench', 1, 60, 8, 1000), entry('bench', 2, 62.5, 6, 2000), entry('bench', 3, null, 5, 3000)]
const row = [entry('row', 1, 40, 10, 1500), entry('row', 2, 40, 9, 2500)]

describe('E12-T2 removeSet and insertSet (pure)', () => {
  test('O2 removeSet drops the Set, renumbers the later Sets down and returns the removed entry', () => {
    const all = [bench[0], row[0], bench[1], row[1], bench[2]]

    const result = removeSet(all, 'bench', 2)

    expect(result.removed).toEqual(entry('bench', 2, 62.5, 6, 2000))
    expect(result.entries).toEqual([
      entry('bench', 1, 60, 8, 1000),
      entry('row', 1, 40, 10, 1500),
      entry('row', 2, 40, 9, 2500),
      entry('bench', 2, null, 5, 3000),
    ])
  })

  test('O2 removeSet leaves the input entries untouched', () => {
    const all = [...bench, ...row]
    const snapshot = JSON.parse(JSON.stringify(all))

    removeSet(all, 'bench', 1)

    expect(all).toEqual(snapshot)
  })

  test('O2 removeSet of the last Set renumbers nothing', () => {
    const result = removeSet([...bench], 'bench', 3)

    expect(result.removed).toEqual(entry('bench', 3, null, 5, 3000))
    expect(result.entries).toEqual([bench[0], bench[1]])
  })

  test('O2 removeSet of a Set that is not logged throws and names it', () => {
    expect(() => removeSet([...bench], 'bench', 9)).toThrow(/no set/i)
    expect(() => removeSet([...bench], 'row', 1)).toThrow(/no set/i)
  })

  test('O3 insertSet moves the Exercise\'s Sets at or past the entry up by one and restores it', () => {
    const afterRemove = [
      entry('bench', 1, 60, 8, 1000),
      entry('row', 1, 40, 10, 1500),
      entry('bench', 2, null, 5, 3000),
    ]

    const restored = insertSet(afterRemove, entry('bench', 2, 62.5, 6, 2000))

    expect(restored).toHaveLength(4)
    expect(
      restored
        .filter((one) => one.exerciseId === 'bench')
        .sort((a, b) => a.setIndex - b.setIndex),
    ).toEqual(bench)
    expect(restored.filter((one) => one.exerciseId === 'row')).toEqual([entry('row', 1, 40, 10, 1500)])
  })

  test('O3 insertSet at the end appends without renumbering', () => {
    const restored = insertSet([bench[0], bench[1]], bench[2])

    expect(restored.sort((a, b) => a.setIndex - b.setIndex)).toEqual(bench)
  })
})
