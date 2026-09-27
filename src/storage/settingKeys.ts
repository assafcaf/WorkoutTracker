/** One key of the `settings` table: whether sync pushes it, and which topic it belongs to. */
export type SettingKeyInfo = {
  key: string
  synced: boolean
  topic: 'programs' | 'preferences' | null
}

/** Every setting key, synced or device-local, declared once (E11-T2). */
export const SETTING_KEYS: readonly SettingKeyInfo[] = []

/** The keys sync pushes and pulls. */
export function syncedSettingKeys(): string[] {
  throw new Error('syncedSettingKeys is not implemented')
}

/** The topic a setting key belongs to, or null for sync bookkeeping. */
export function topicOfSetting(key: string): 'programs' | 'preferences' | null {
  void key
  throw new Error('topicOfSetting is not implemented')
}
