import type { SyncView } from '../../services/sync'

/** "14:02", 24-hour. */
function clock(at: number): string {
  const date = new Date(at)
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "Synced 14:02" today, "Synced 14 Oct" on an earlier day. */
function syncedText(at: number, now: number): string {
  const then = new Date(at)
  const today = new Date(now)
  const sameDay =
    then.getFullYear() === today.getFullYear() && then.getMonth() === today.getMonth() && then.getDate() === today.getDate()
  return sameDay ? `Synced ${clock(at)}` : `Synced ${then.getDate()} ${MONTHS[then.getMonth()]}`
}

/**
 * The one sync status line (DX-13), under the Sessions title, in words a trainee reads at a
 * glance: is what I logged safe?
 *  - never signed in: "Saved on this phone · not synced"
 *  - a sync running: "Syncing…"
 *  - signed in, last sync failed: "Sync failed · Try again"
 *  - synced: "Synced 14:02" (or the day, when not today)
 */
export function syncLineText(sync: SyncView, now: number): string {
  if (sync.status === 'syncing') return 'Syncing…'
  if (sync.accountEmail === null || sync.status === 'signed-out') return 'Saved on this phone · not synced'
  if (sync.status === 'error' || sync.status === 'offline' || sync.status === 'account-mismatch' || sync.status === 'update-required') {
    return 'Sync failed · Try again'
  }
  if (sync.lastSyncedAt !== null) return syncedText(sync.lastSyncedAt, now)
  return 'Saved on this phone · not synced'
}

/**
 * The line itself: a button into Settings (Data & sync) when the app can open it, else plain text.
 */
export function SyncLine({ sync, now, onOpen }: { sync: SyncView; now: number; onOpen?: () => void }): JSX.Element {
  const text = syncLineText(sync, now)
  if (onOpen === undefined) return <span className="sessions-sync-line">{text}</span>
  return (
    <button type="button" className="sessions-sync-line btn-quiet" onClick={onOpen}>
      {text}
    </button>
  )
}
