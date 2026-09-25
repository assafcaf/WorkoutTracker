// A fake of the sync Worker (E7-T5), holding the protocol's semantics, for tests that go through
// `fetch`: per-account sessions and settings, a sequence cursor, last-writer-wins by
// `updatedAt`, `/api/replace` wiping the account first. Test-only; never imported by the app.
import type {
  ReplaceRequest,
  SyncedSession,
  SyncedSetting,
  SyncRequest,
  SyncResponse,
} from '../sync/protocol'

export type Failure = 'network-down' | 'opaqueredirect' | number
export type RecordedRequest = {
  url: string
  method: string
  init: RequestInit | undefined
  body: unknown
}

type ServerAccount = {
  seq: number
  sessions: Map<string, { doc: SyncedSession; seq: number }>
  settings: Map<string, { doc: SyncedSetting; seq: number }>
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

/** What `fetch` hands back for a cross-origin redirect under `redirect: 'manual'`. */
function opaqueRedirectResponse(): Response {
  const response = new Response(null, { status: 200 })
  Object.defineProperties(response, {
    type: { value: 'opaqueredirect' },
    status: { value: 0 },
    ok: { value: false },
    statusText: { value: '' },
  })
  return response
}

export class FakeSyncServer {
  /** The account Cloudflare Access has signed the browser into. */
  signedInEmail = 'a@x'
  requests: RecordedRequest[] = []
  /** path -> how that path fails. */
  failures = new Map<string, Failure>()
  /** Requests received and not yet answered (held, or still being handled). */
  pending = 0
  /** Requests answered (or thrown), in total. */
  completed = 0
  private holds = new Map<string, Promise<void>>()
  private accounts = new Map<string, ServerAccount>()

  /**
   * Makes every request to `path` wait, without an answer, until the returned release is called.
   */
  hold(path: string): () => void {
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    this.holds.set(path, gate)
    return () => {
      this.holds.delete(path)
      release()
    }
  }

  private account(email: string): ServerAccount {
    let account = this.accounts.get(email)
    if (!account) {
      account = { seq: 0, sessions: new Map(), settings: new Map() }
      this.accounts.set(email, account)
    }
    return account
  }

  private storeSession(account: ServerAccount, doc: SyncedSession): void {
    const stored = account.sessions.get(doc.id)
    if (stored && stored.doc.updatedAt >= doc.updatedAt) return
    account.seq += 1
    account.sessions.set(doc.id, { doc: structuredClone(doc), seq: account.seq })
  }

  private storeSetting(account: ServerAccount, doc: SyncedSetting): void {
    const stored = account.settings.get(doc.key)
    if (stored && stored.doc.updatedAt >= doc.updatedAt) return
    account.seq += 1
    account.settings.set(doc.key, { doc: structuredClone(doc), seq: account.seq })
  }

  seedSession(email: string, doc: SyncedSession): void {
    this.storeSession(this.account(email), doc)
  }

  seedSetting(email: string, doc: SyncedSetting): void {
    this.storeSetting(this.account(email), doc)
  }

  sessionsOf(email: string): SyncedSession[] {
    return [...this.account(email).sessions.values()]
      .map((row) => row.doc)
      .sort((one, other) => one.id.localeCompare(other.id))
  }

  requestsTo(path: string): RecordedRequest[] {
    return this.requests.filter((r) => r.url === path)
  }

  fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const method = (init?.method ?? 'GET').toUpperCase()
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined
    this.requests.push({ url, method, init, body })
    this.pending += 1
    try {
      const gate = this.holds.get(url)
      if (gate) await gate
      return this.answer(url, method, body)
    } finally {
      this.pending -= 1
      this.completed += 1
    }
  }

  private answer(url: string, method: string, body: unknown): Response {
    const failure = this.failures.get(url)
    if (failure === 'network-down') throw new TypeError('Failed to fetch')
    if (failure === 'opaqueredirect') return opaqueRedirectResponse()
    if (typeof failure === 'number') {
      return jsonResponse({ error: `failed with ${failure}` }, failure)
    }

    const account = this.account(this.signedInEmail)
    if (url === '/api/me') return jsonResponse({ email: this.signedInEmail })

    if (url === '/api/sync' && method === 'POST') {
      const request = body as SyncRequest
      for (const doc of request.sessions) this.storeSession(account, doc)
      for (const doc of request.settings) this.storeSetting(account, doc)
      const answer: SyncResponse = {
        cursor: account.seq,
        sessions: [...account.sessions.values()]
          .filter((row) => row.seq > request.since)
          .map((row) => structuredClone(row.doc)),
        settings: [...account.settings.values()]
          .filter((row) => row.seq > request.since)
          .map((row) => structuredClone(row.doc)),
      }
      return jsonResponse(answer)
    }

    if (url === '/api/replace' && method === 'POST') {
      const request = body as ReplaceRequest
      account.sessions.clear()
      account.settings.clear()
      for (const doc of request.sessions) this.storeSession(account, doc)
      for (const doc of request.settings) this.storeSetting(account, doc)
      return jsonResponse({ cursor: account.seq })
    }

    return jsonResponse({ error: 'not found' }, 404)
  }
}
