/** The Account section's view of the phone's cloud sync (E7-T7). */
export type SyncView = {
  accountEmail: string | null
  lastSyncedAt: number | null
  status: 'idle' | 'syncing' | 'ok' | 'offline' | 'signed-out' | 'error' | 'account-mismatch'
  // Present when status is 'account-mismatch'.
  signedInEmail?: string
  // Present when status is 'error'.
  message?: string
}
