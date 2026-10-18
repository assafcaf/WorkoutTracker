import { expect, test } from 'vitest'
import { setsCsvFileName, setsCsvRows, setsCsvText } from './setsCsv'
import { parseCsv } from './csv'
import type { Exercise, Program, SetEntry, Session } from '../types'

const HEADER = ['date', 'program', 'workout', 'exercise', 'set index', 'kind', 'weight kg', 'reps', 'rir', 'e1RM', 'session note']

const ex = (id: string, name: string, bodyweight = false): Exercise => ({
  id,
  name,
  weightStep: 2.5,
  startWeight: null,
  bodyweight,
  libraryId: id,
})
const EXERCISES = [ex('bench', 'Bench Press'), ex('row', 'Row'), ex('pullup', 'Pull-up', true), ex('=cmd', '=Evil')]
const PROGRAMS: Program[] = [
  { id: 'p', name: 'Push Pull', units: 'kg', sessionsPerWeek: 3, workouts: [{ id: 'a', name: 'Day A', exercises: [] }] },
]
const t = (month: number, day: number, h = 18, m = 5): number => new Date(2026, month - 1, day, h, m).getTime()

function set(exerciseId: string, setIndex: number, weightKg: number | null, reps: number, extra: Partial<SetEntry> = {}): SetEntry {
  return { exerciseId, setIndex, weightKg, reps, loggedAt: 1, ...extra }
}
function session(id: string, startedAt: number, entries: SetEntry[], extra: Partial<Session> = {}): Session {
  return { id, programId: 'p', workoutId: 'a', startedAt, finishedAt: startedAt + 3_000_000, entries, ...extra }
}

test('O13 the header is the fixed eleven columns, alone when there are no Sessions', () => {
  expect(setsCsvRows([], PROGRAMS, EXERCISES)).toEqual([HEADER])
})

test('O13 one row per Set with local date, names, kind, weight, reps, blank rir, Epley e1RM to 0.1 kg', () => {
  const rows = setsCsvRows([session('s', t(10, 5), [set('bench', 1, 100, 5)])], PROGRAMS, EXERCISES)
  expect(rows).toEqual([HEADER, ['2026-10-05 18:05', 'Push Pull', 'Day A', 'Bench Press', '1', 'working', '100', '5', '', '116.7', '']])
})

test('O13 kinds are named and rir is written when told', () => {
  const entries = [
    set('bench', 1, 40, 10, { kind: 'warmup' }),
    set('bench', 2, 100, 5, { rir: 2 }),
    set('bench', 3, 90, 6, { kind: 'drop', rir: 0 }),
    set('bench', 4, 80, 8, { kind: 'failure' }),
    set('bench', 5, 70, 12, { kind: 'amrap', rir: 3 }),
  ]
  const rows = setsCsvRows([session('s', t(10, 5), entries)], PROGRAMS, EXERCISES).slice(1)
  expect(rows.map((r) => r[5])).toEqual(['warmup', 'working', 'drop', 'failure', 'amrap'])
  expect(rows.map((r) => r[8])).toEqual(['', '2', '0', '', '3'])
})

test('O13 e1RM is blank for a warm-up, a Bodyweight Set and a Set with no weight', () => {
  const entries = [
    set('bench', 1, 40, 10, { kind: 'warmup' }),
    set('pullup', 1, null, 8, { loadKg: 10 }),
    set('row', 1, null, 12),
  ]
  const rows = setsCsvRows([session('s', t(10, 5), entries)], PROGRAMS, EXERCISES).slice(1)
  expect(rows.map((r) => r[9])).toEqual(['', '', ''])
  expect(rows[0][6]).toBe('40')
})

test('O13 a Bodyweight Set writes its Load as the weight, negative for assisted; no weight is blank', () => {
  const entries = [set('pullup', 1, null, 8, { loadKg: 10 }), set('pullup', 2, null, 5, { loadKg: -20 }), set('row', 1, null, 12)]
  const rows = setsCsvRows([session('s', t(10, 5), entries)], PROGRAMS, EXERCISES).slice(1)
  expect(rows.map((r) => r[6])).toEqual(['10', '-20', ''])
})

test('O13 unknown program, workout and exercise fall back to the stored id', () => {
  const s = session('s', t(10, 5), [set('gone', 1, 50, 5)], { programId: 'pX', workoutId: 'wX' })
  const row = setsCsvRows([s], PROGRAMS, EXERCISES)[1]
  expect(row.slice(1, 4)).toEqual(['pX', 'wX', 'gone'])
})

test('O13 Sessions run oldest first; unfinished and deleted Sessions are left out', () => {
  const sessions = [
    session('new', t(10, 12), [set('bench', 1, 60, 5)]),
    session('old', t(10, 1), [set('bench', 1, 50, 5)]),
    session('open', t(10, 8), [set('bench', 1, 70, 5)], { finishedAt: null }),
    session('del', t(10, 9), [set('bench', 1, 80, 5)], { deletedAt: t(10, 10) }),
  ]
  const rows = setsCsvRows(sessions, PROGRAMS, EXERCISES).slice(1)
  expect(rows.map((r) => r[6])).toEqual(['50', '60'])
})

test('O13 Sets group by Exercise in order of first Set, then by set index', () => {
  const entries = [set('bench', 2, 100, 5), set('row', 1, 60, 8), set('bench', 1, 90, 5), set('row', 2, 60, 7)]
  const rows = setsCsvRows([session('s', t(10, 5), entries)], PROGRAMS, EXERCISES).slice(1)
  expect(rows.map((r) => `${r[3]}#${r[4]}`)).toEqual(['Bench Press#1', 'Bench Press#2', 'Row#1', 'Row#2'])
})

test('O13 the Session note is on each of its rows', () => {
  const s = session('s', t(10, 5), [set('bench', 1, 100, 5), set('bench', 2, 100, 4)], { note: 'felt strong' })
  const rows = setsCsvRows([s], PROGRAMS, EXERCISES).slice(1)
  expect(rows.map((r) => r[10])).toEqual(['felt strong', 'felt strong'])
})

test('O13 text fields starting with = + - @ get a leading apostrophe; numbers never do', () => {
  const s = session('s', t(10, 5), [set('=cmd', 1, 100, 5), set('pullup', 1, null, 5, { loadKg: -20 })], { note: '@home' })
  const rows = setsCsvRows([s], PROGRAMS, EXERCISES).slice(1)
  expect(rows[0][3]).toBe("'=Evil")
  expect(rows[0][10]).toBe("'@home")
  expect(rows[1][6]).toBe('-20')
  const plus = setsCsvRows([session('p', t(10, 6), [set('bench', 1, 100, 5)], { note: '+1 rep' })], PROGRAMS, EXERCISES)
  expect(plus[1][10]).toBe("'+1 rep")
  const dash = setsCsvRows([session('d', t(10, 6), [set('bench', 1, 100, 5)], { note: '-ok' })], PROGRAMS, EXERCISES)
  expect(dash[1][10]).toBe("'-ok")
})

test('O14 setsCsvFileName is workout-sets-<local date>.csv', () => {
  expect(setsCsvFileName(new Date(2026, 9, 18, 23, 59))).toBe('workout-sets-2026-10-18.csv')
  expect(setsCsvFileName(new Date(2026, 0, 3, 0, 1))).toBe('workout-sets-2026-01-03.csv')
})

test('O14 setsCsvText starts with the BOM and a Hebrew Session note reads back unchanged', () => {
  const note = 'אימון מצוין, "חזק"'
  const text = setsCsvText([session('s', t(10, 5), [set('bench', 1, 100, 5)], { note })], PROGRAMS, EXERCISES)
  expect(text.startsWith('﻿')).toBe(true)
  const parsed = parseCsv(text)
  expect(parsed[0]).toEqual(HEADER)
  expect(parsed[1][10]).toBe(note)
})
