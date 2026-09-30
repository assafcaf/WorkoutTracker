import { describe, expect, test } from 'vitest'
import { SETTING_KEYS, syncedSettingKeys, topicOfSetting } from './settingKeys'
import {
  ACTIVE_PROGRAM_ID_KEY,
  GYM_EQUIPMENT_KEY,
  LAST_EXPORTED_AT_KEY,
  USER_PROGRAMS_KEY,
  VOLUME_BASELINE_KEY,
  WEIGHT_STEPS_KEY,
} from './settingsStore'
import { SYNCED_SETTING_KEYS } from '../sync/protocol'

// Sync's own bookkeeping rows (syncClient.ts keeps them in `db.settings`; they are never pushed).
const SYNC_BOOKKEEPING_KEYS = ['accountEmail', 'syncCursor', 'lastPushedAt', 'lastSyncedAt']

describe('D3 every setting key is declared once in settingKeys', () => {
  test('D3 SETTING_KEYS declares each key exactly once', () => {
    const keys = SETTING_KEYS.map((info) => info.key)

    expect(keys.length).toBeGreaterThan(0)
    expect(new Set(keys).size).toBe(keys.length)
  })

  test('D3 SETTING_KEYS declares every key settingsStore writes', () => {
    const keys = SETTING_KEYS.map((info) => info.key)

    expect(keys).toEqual(
      expect.arrayContaining([
        ACTIVE_PROGRAM_ID_KEY,
        GYM_EQUIPMENT_KEY,
        LAST_EXPORTED_AT_KEY,
        USER_PROGRAMS_KEY,
        VOLUME_BASELINE_KEY,
        WEIGHT_STEPS_KEY,
      ]),
    )
  })

  test('D3 SETTING_KEYS declares sync bookkeeping keys as device-local', () => {
    for (const key of SYNC_BOOKKEEPING_KEYS) {
      expect(SETTING_KEYS.find((info) => info.key === key)).toEqual({ key, synced: false, topic: null })
    }
  })

  test('D3 lastExportedAt is declared device-local', () => {
    expect(SETTING_KEYS.find((info) => info.key === 'lastExportedAt')?.synced).toBe(false)
  })

  test('D3 syncedSettingKeys are exactly the five synced keys', () => {
    expect([...syncedSettingKeys()].sort()).toEqual([
      'activeProgramId',
      'exerciseNotes',
      'gymEquipment',
      'userPrograms',
      'volumeBaseline',
      'weightSteps',
    ])
  })

  test('D3 syncedSettingKeys equals SYNCED_SETTING_KEYS in the sync protocol', () => {
    expect([...syncedSettingKeys()].sort()).toEqual([...SYNCED_SETTING_KEYS].sort())
  })

  test('D3 the synced flags in SETTING_KEYS agree with syncedSettingKeys', () => {
    const flagged = SETTING_KEYS.filter((info) => info.synced).map((info) => info.key)

    expect([...flagged].sort()).toEqual([...syncedSettingKeys()].sort())
  })
})

describe('D3 topicOfSetting maps each key to the topic it changes', () => {
  test.each(['activeProgramId', 'userPrograms'])('D3 %s belongs to programs', (key) => {
    expect(topicOfSetting(key)).toBe('programs')
  })

  test.each(['gymEquipment', 'weightSteps', 'volumeBaseline', 'lastExportedAt'])(
    'D3 %s belongs to preferences',
    (key) => {
      expect(topicOfSetting(key)).toBe('preferences')
    },
  )

  test.each(SYNC_BOOKKEEPING_KEYS)('D3 sync bookkeeping key %s has no topic', (key) => {
    expect(topicOfSetting(key)).toBeNull()
  })

  test('D3 topicOfSetting agrees with the topic each key is declared with', () => {
    expect(SETTING_KEYS.length).toBeGreaterThan(0)
    for (const info of SETTING_KEYS) {
      expect(topicOfSetting(info.key)).toBe(info.topic)
    }
  })
})
