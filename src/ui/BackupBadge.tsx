/**
 * The backup reminder: a quiet marker on the Settings entry, never a modal or a notification.
 *
 * E2-T6 stub — the behaviour is not written yet.
 */
export const BACKUP_REMINDER_DAYS = 14

/**
 * True once more than `BACKUP_REMINDER_DAYS` days have passed since `lastExportedAt`, and true
 * when `lastExportedAt` is null — a database that has never been exported is due from the
 * start. Pure: takes `now` rather than reading the clock itself.
 */
export function isBackupDue(_lastExportedAt: number | null, _now: number): boolean {
  throw new Error('isBackupDue is not implemented yet (E2-T6)')
}

export type BackupBadgeProps = {
  lastExportedAt: number | null
  now: number
}

/**
 * The badge itself: nothing when a backup is not due, an inline marker inviting one when it is.
 * Never blocks the screen and never acts on its own — pressing Export is up to the trainee.
 */
export function BackupBadge(_props: BackupBadgeProps): JSX.Element | null {
  throw new Error('BackupBadge is not implemented yet (E2-T6)')
}
