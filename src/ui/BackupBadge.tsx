import './BackupBadge.css'

/**
 * The backup reminder: a quiet marker on the Settings entry, never a modal or a notification.
 */
export const BACKUP_REMINDER_DAYS = 14

/**
 * True once more than `BACKUP_REMINDER_DAYS` days have passed since `lastExportedAt`, and true
 * when `lastExportedAt` is null — a database that has never been exported is due from the
 * start. Pure: takes `now` rather than reading the clock itself.
 */
export function isBackupDue(lastExportedAt: number | null, now: number): boolean {
  if (lastExportedAt === null) return true
  return now - lastExportedAt > BACKUP_REMINDER_DAYS * 24 * 60 * 60 * 1000
}

export type BackupBadgeProps = {
  lastExportedAt: number | null
  now: number
}

/**
 * The badge itself: nothing when a backup is not due, an inline marker inviting one when it is.
 * Never blocks the screen and never acts on its own — pressing Export is up to the trainee.
 */
export function BackupBadge(props: BackupBadgeProps): JSX.Element | null {
  const { lastExportedAt, now } = props
  if (!isBackupDue(lastExportedAt, now)) return null
  return (
    <span className="backup-badge" role="status">
      Back up your data — it has been a while since the last export.
    </span>
  )
}
