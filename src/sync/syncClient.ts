export type SyncResult =
  | { status: 'ok'; at: number; pushed: number; pulled: number }
  | { status: 'offline' }
  | { status: 'signed-out' }
  | { status: 'error'; message: string }
  | { status: 'account-mismatch'; deviceEmail: string; signedInEmail: string }

export type SyncState = { accountEmail: string | null; lastSyncedAt: number | null }

export const SIGN_IN_PATH = '/api/login'

export type SyncDeps = { fetch?: typeof fetch; now?: () => number }

export async function syncNow(_deps?: SyncDeps): Promise<SyncResult> {
  throw new Error('not implemented: syncNow')
}

export async function replaceRemote(_deps?: SyncDeps): Promise<SyncResult> {
  throw new Error('not implemented: replaceRemote')
}

export async function adoptSignedInAccount(_email: string): Promise<void> {
  throw new Error('not implemented: adoptSignedInAccount')
}

export async function getSyncState(): Promise<SyncState> {
  throw new Error('not implemented: getSyncState')
}
