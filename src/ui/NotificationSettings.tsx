import type { Reminders } from '../contract'

export type NotificationStatus =
  | 'unsupported'
  | 'not-installed'
  | 'denied'
  | 'on'
  | 'off'
  | 'unconfigured'
  | 'signed-out'

export type NotificationSettingsProps = {
  status: NotificationStatus
  failed?: boolean
  onEnable(): void
  onDisable(): void
  reminders: Reminders | null
  onRemindersChange(value: Reminders | null): void
  weekStart?: number
}

export function NotificationSettings(_props: NotificationSettingsProps): JSX.Element | null {
  return null
}
