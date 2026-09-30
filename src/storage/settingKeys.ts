import {
  ACTIVE_PROGRAM_ID_KEY,
  EXERCISE_NOTES_KEY,
  EFFORT_TRACKING_KEY,
  GYM_EQUIPMENT_KEY,
  LAST_EXPORTED_AT_KEY,
  USER_PROGRAMS_KEY,
  VOLUME_BASELINE_KEY,
  WEIGHT_STEPS_KEY,
} from './settingsStore'

/** One key of the `settings` table: whether sync pushes it, and which topic it belongs to. */
export type SettingKeyInfo = {
  key: string
  synced: boolean
  topic: 'programs' | 'preferences' | null
}

/** Every setting key, synced or device-local, declared once (E11-T2). */
export const SETTING_KEYS: readonly SettingKeyInfo[] = [
  { key: ACTIVE_PROGRAM_ID_KEY, synced: true, topic: 'programs' },
  { key: USER_PROGRAMS_KEY, synced: true, topic: 'programs' },
  { key: GYM_EQUIPMENT_KEY, synced: true, topic: 'preferences' },
  { key: WEIGHT_STEPS_KEY, synced: true, topic: 'preferences' },
  { key: VOLUME_BASELINE_KEY, synced: true, topic: 'preferences' },
  { key: EXERCISE_NOTES_KEY, synced: true, topic: 'preferences' },
  { key: EFFORT_TRACKING_KEY, synced: true, topic: 'preferences' },
  // Device-local: each device remembers its own last export.
  { key: LAST_EXPORTED_AT_KEY, synced: false, topic: 'preferences' },
  // Sync's own bookkeeping (syncClient.ts): never pushed, and no topic changes with it.
  { key: 'accountEmail', synced: false, topic: null },
  { key: 'syncCursor', synced: false, topic: null },
  { key: 'lastPushedAt', synced: false, topic: null },
  { key: 'lastSyncedAt', synced: false, topic: null },
]

/** The keys sync pushes and pulls. */
export function syncedSettingKeys(): string[] {
  return SETTING_KEYS.filter((info) => info.synced).map((info) => info.key)
}

/** The topic a setting key belongs to, or null for sync bookkeeping. */
export function topicOfSetting(key: string): 'programs' | 'preferences' | null {
  return SETTING_KEYS.find((info) => info.key === key)?.topic ?? null
}
