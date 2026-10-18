// @vitest-environment node
import { describe, expect, test } from 'vitest'
import * as protocol from '../sync/protocol'
import {
  CONTRACT_VERSION,
  HttpError,
  MAX_BODY_BYTES,
  SUPPORTED_VERSIONS,
  SYNCED_SETTING_KEYS,
  VERSION_HEADER,
  checkReplaceRequest,
  checkReplaceResponse,
  checkSyncRequest,
  checkSyncResponse,
  isSupportedVersion,
  versionOf,
} from './index'

// --- O1: the version, its range and its header ---

test('O1 the contract is version 2, supports 1 through 2, and travels in X-Contract-Version', () => {
  expect(CONTRACT_VERSION).toBe(2)
  expect(SUPPORTED_VERSIONS).toEqual({ min: 1, max: 2 })
  expect(VERSION_HEADER).toBe('X-Contract-Version')
})

test('O1 versionOf a missing header is version 1', () => {
  expect(versionOf(null)).toBe(1)
})

test.each([
  ['1', 1],
  ['2', 2],
  ['0', 0],
  ['17', 17],
])('O1 versionOf the plain decimal integer %j is %d', (header, expected) => {
  expect(versionOf(header)).toBe(expected)
})

test.each(['', 'abc', '2.5', '1e1', '0x2', ' 2', '2 ', '2abc', 'two'])(
  'O1 versionOf the non-integer header %j is null',
  (header) => {
    expect(versionOf(header)).toBeNull()
  },
)

test.each([
  [0, false],
  [1, true],
  [2, true],
  [3, false],
  [1.5, false],
  [-1, false],
])('O1 isSupportedVersion(%d) is %s', (version, expected) => {
  expect(isSupportedVersion(version)).toBe(expected)
})

// --- shared fixtures ---

function session(id = 's1', updatedAt = 1000): Record<string, unknown> {
  return {
    id,
    programId: 'assaf-ab',
    workoutId: 'A',
    startedAt: 1_758_800_000_000,
    finishedAt: 1_758_803_600_000,
    entries: [
      { exerciseId: 'squat', setIndex: 0, weightKg: 100, reps: 8, loggedAt: 1_758_800_300_000 },
      { exerciseId: 'pull-up', setIndex: 0, weightKg: null, reps: 10, loggedAt: 1_758_800_600_000 },
    ],
    swaps: { 'bench-press': 'dumbbell-bench-press' },
    updatedAt,
  }
}

const setting = { key: 'activeProgramId', value: 'assaf-ab', updatedAt: 1000 }

function thrown(run: () => unknown): unknown {
  try {
    run()
  } catch (error) {
    return error
  }
  return undefined
}

function expectRefused(run: () => unknown, mention?: string) {
  const error = thrown(run)
  expect(error).toBeInstanceOf(HttpError)
  expect((error as HttpError).status).toBe(400)
  expect((error as HttpError).message.length).toBeGreaterThan(0)
  if (mention) expect((error as HttpError).message).toContain(mention)
}

// --- O2: the request checks (the parsed bodies of sync.test.ts's O6 table) ---

const { updatedAt: _u, ...sessionWithoutUpdatedAt } = session()
const { id: _i, ...sessionWithoutId } = session()
const valid = { since: 0, sessions: [session()], settings: [setting] }

const badBodies: Array<[string, unknown]> = [
  ['a JSON array', []],
  ['JSON null', null],
  ['a JSON number', 42],
  ['a body without since', { sessions: valid.sessions, settings: valid.settings }],
  ['a string since', { ...valid, since: '0' }],
  ['a null since', { ...valid, since: null }],
  ['a body without sessions', { since: 0, settings: valid.settings }],
  ['sessions that are an object', { ...valid, sessions: { s1: session() } }],
  ['a body without settings', { since: 0, sessions: valid.sessions }],
  ['settings that are an object', { ...valid, settings: { activeProgramId: 'x' } }],
  ['a session without an id', { ...valid, sessions: [sessionWithoutId] }],
  ['a session with a numeric id', { ...valid, sessions: [{ ...session(), id: 7 }] }],
  ['a session without updatedAt', { ...valid, sessions: [sessionWithoutUpdatedAt] }],
  ['a session with a string updatedAt', { ...valid, sessions: [{ ...session(), updatedAt: '1000' }] }],
  ['a session that is null', { ...valid, sessions: [null] }],
  ['a session that is a string', { ...valid, sessions: ['s1'] }],
  ['a setting keyed accountEmail', { ...valid, settings: [{ key: 'accountEmail', value: 'x', updatedAt: 1000 }] }],
  ['a setting keyed syncCursor', { ...valid, settings: [{ key: 'syncCursor', value: 5, updatedAt: 1000 }] }],
  ['a setting without a key', { ...valid, settings: [{ value: 'ppl', updatedAt: 1000 }] }],
  ['a setting that is null', { ...valid, settings: [null] }],
  ['one valid and one malformed session', { ...valid, sessions: [session('s1'), { ...session('s2'), updatedAt: 'late' }] }],
]

describe('O2 checkSyncRequest', () => {
  test('answers a well-formed body whole, unknown Session fields kept', () => {
    const body = { ...valid, sessions: [{ ...session(), futureField: { a: [1, 2] } }] }

    expect(checkSyncRequest(body)).toEqual(body)
  })

  test.each(badBodies)('refuses %s with HttpError(400)', (_name, body) => {
    expectRefused(() => checkSyncRequest(body))
  })
})

describe('O2 checkReplaceRequest', () => {
  const replaceable = badBodies.filter(([name]) => !/since/.test(name))

  test('answers a well-formed body whole, unknown Session fields kept', () => {
    const body = { sessions: [{ ...session(), futureField: 'kept' }], settings: [setting] }

    expect(checkReplaceRequest(body)).toEqual(body)
  })

  test('accepts a body with no rows', () => {
    expect(checkReplaceRequest({ sessions: [], settings: [] })).toEqual({ sessions: [], settings: [] })
  })

  test.each(replaceable)('refuses %s with HttpError(400)', (_name, body) => {
    expectRefused(() => checkReplaceRequest(body))
  })
})

// --- O3: a Session's required fields ---

const sessionFields = ['programId', 'workoutId', 'startedAt', 'finishedAt', 'entries'] as const
const entryFields = ['exerciseId', 'reps', 'loggedAt'] as const

function withEntryField(field: string, value: unknown, present = true): Record<string, unknown> {
  const s = session()
  const entry = { ...(s.entries as Record<string, unknown>[])[0] }
  if (present) entry[field] = value
  else delete entry[field]
  return { ...s, entries: [entry] }
}

describe.each([
  ['checkSyncRequest', (s: unknown) => checkSyncRequest({ since: 0, sessions: [s], settings: [] })],
  ['checkReplaceRequest', (s: unknown) => checkReplaceRequest({ sessions: [s], settings: [] })],
])('O3 %s Session fields', (_name, check) => {
  test.each(sessionFields)('refuses a Session lacking %s, naming it', (field) => {
    const s = session()
    delete s[field]

    expectRefused(() => check(s), field)
  })

  test.each([
    ['programId', 5],
    ['workoutId', null],
    ['startedAt', '1758800000000'],
    ['finishedAt', 'done'],
    ['entries', {}],
  ])('refuses a Session whose %s is mistyped (%j), naming it', (field, value) => {
    expectRefused(() => check({ ...session(), [field]: value }), field)
  })

  test.each(entryFields)('refuses an entry lacking %s, naming it', (field) => {
    expectRefused(() => check(withEntryField(field, undefined, false)), field)
  })

  test.each([
    ['exerciseId', 7],
    ['reps', '8'],
    ['loggedAt', null],
  ])('refuses an entry whose %s is mistyped (%j), naming it', (field, value) => {
    expectRefused(() => check(withEntryField(field, value)), field)
  })

  test('refuses an entry that is not an object', () => {
    expectRefused(() => check({ ...session(), entries: [null] }), 'entries')
  })

  test('accepts an unfinished Session: finishedAt null', () => {
    expect(() => check({ ...session(), finishedAt: null })).not.toThrow()
  })

  test('does not check optional fields', () => {
    const loose = { ...session(), note: 5, deload: false, deletedAt: 'x', swaps: 'none' }

    expect(() => check(loose)).not.toThrow()
  })
})

// --- O4: the answer checks ---

describe('O4 checkSyncResponse', () => {
  const answer = { cursor: 12, sessions: [session('s1', 1000)], settings: [setting] }

  test('answers a well-formed answer whole', () => {
    expect(checkSyncResponse(answer)).toEqual(answer)
  })

  test('answers an empty answer whole', () => {
    expect(checkSyncResponse({ cursor: 0, sessions: [], settings: [] })).toEqual({ cursor: 0, sessions: [], settings: [] })
  })

  test.each([
    ['null', null],
    ['an array', []],
    ['a string', 'ok'],
    ['an answer without a cursor', { sessions: [], settings: [] }],
    ['a string cursor', { ...answer, cursor: '12' }],
    ['an answer without sessions', { cursor: 1, settings: [] }],
    ['sessions that are an object', { ...answer, sessions: {} }],
    ['an answer without settings', { cursor: 1, sessions: [] }],
    ['settings that are an object', { ...answer, settings: {} }],
    ['a session without an id', { ...answer, sessions: [sessionWithoutId] }],
    ['a session that is null', { ...answer, sessions: [null] }],
    ['a setting keyed outside the synced keys', { ...answer, settings: [{ key: 'accountEmail', value: 1, updatedAt: 1 }] }],
  ])('is null for %s', (_name, body) => {
    expect(checkSyncResponse(body)).toBeNull()
  })
})

describe('O4 checkReplaceResponse', () => {
  test('answers a well-formed answer whole', () => {
    expect(checkReplaceResponse({ cursor: 7 })).toEqual({ cursor: 7 })
  })

  test.each([
    ['null', null],
    ['an array', []],
    ['an empty object', {}],
    ['a string cursor', { cursor: '7' }],
    ['a null cursor', { cursor: null }],
  ])('is null for %s', (_name, body) => {
    expect(checkReplaceResponse(body)).toBeNull()
  })
})

// --- O5: the shared constants read through src/sync/protocol.ts are the contract's ---

describe('O5 protocol re-exports the contract', () => {
  test('SYNCED_SETTING_KEYS is the contract list, in order', () => {
    expect(SYNCED_SETTING_KEYS).toEqual([
      'activeProgramId',
      'gymEquipment',
      'weightSteps',
      'volumeBaseline',
      'userPrograms',
      'exerciseNotes',
      'effortTracking',
      'plateInventory',
      'bodyweightOverrides',
      'weekStart',
      'keepScreenOnDuringRest',
      'customExercises',
    ])
    expect(protocol.SYNCED_SETTING_KEYS).toBe(SYNCED_SETTING_KEYS)
  })

  test('MAX_BODY_BYTES is 2 MiB and is the contract value', () => {
    expect(MAX_BODY_BYTES).toBe(2 * 1024 * 1024)
    expect(protocol.MAX_BODY_BYTES).toBe(MAX_BODY_BYTES)
  })
})
