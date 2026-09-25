// A test utility: runs the *built* service worker in a constructed ServiceWorkerGlobalScope so
// a test can install it, take the network away and ask it for a URL. Never imported by shipped
// code.
//
// Why this exists: vitest has no `ServiceWorkerGlobalScope` and no `CacheStorage` under either
// of its environments, and a service worker is exactly the kind of thing that cannot be proven
// by reading it — whether the app survives a dead network depends on what Workbox actually put
// in the cache and which route actually answers. So `dist/sw.js` is evaluated for real, in a
// `node:vm` context whose global is a fake `self`: an event dispatcher, a `CacheStorage` backed
// by Maps, and a `fetch` that serves the build output until the harness is told to go offline.
//
// The worker is the real generated one, and the Workbox runtime it pulls in with
// `importScripts` is the real one too. Only the browser around them is fake.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createContext, runInContext } from 'node:vm'
import type { BuiltApp } from './buildFixture'

/** The origin the harness pretends the app was deployed to. */
export const ORIGIN = 'https://example.test'

/** The path the app is served from at the root of the Cloudflare Worker. */
export const BASE = '/'

/** The absolute URL of `relPath` inside the deployed app. */
export function appUrl(relPath: string): string {
  return new URL(relPath.replace(/^\.?\//, ''), `${ORIGIN}${BASE}`).href
}

/** The build-output path an absolute URL points at, or null when it is off the app's base. */
export function distPathOf(url: string): string | null {
  const parsed = new URL(url)
  if (parsed.origin !== ORIGIN) return null
  if (!parsed.pathname.startsWith(BASE)) return null
  return parsed.pathname.slice(BASE.length)
}

export type ServiceWorkerHarness = {
  /** Runs the worker's `install` handlers and waits for everything they extended. */
  install(): Promise<void>
  /** Runs the worker's `activate` handlers and waits for everything they extended. */
  activate(): Promise<void>
  /** Every URL the worker holds in any cache, Workbox's revision parameter removed. */
  cachedUrls(): string[]
  /** Takes the network away: every `fetch` from inside the worker rejects, as offline does. */
  goOffline(): void
  /**
   * Asks the worker for a URL the way the browser would, and returns what it responded with,
   * or undefined when no handler answered (which is the browser going to the network).
   *
   * `mode` is the request mode: 'navigate' for the document, 'cors'/'no-cors' for a subresource.
   */
  request(url: string, mode?: RequestMode): Promise<Response | undefined>
  /** Every URL the worker has asked the network for, in order. */
  readonly networkLog: string[]
}

type StoredResponse = {
  status: number
  statusText: string
  headers: [string, string][]
  body: Uint8Array
}

const CONTENT_TYPES: Record<string, string> = {
  css: 'text/css',
  html: 'text/html',
  js: 'text/javascript',
  json: 'application/json',
  png: 'image/png',
  svg: 'image/svg+xml',
  webmanifest: 'application/manifest+json',
}

function contentTypeOf(relPath: string): string {
  const extension = relPath.slice(relPath.lastIndexOf('.') + 1).toLowerCase()
  return CONTENT_TYPES[extension] ?? 'application/octet-stream'
}

/**
 * The only cross-origin host the app ever fetches from (src/data/photos.ts): a non-catalog
 * library exercise's photo, pinned to a free-exercise-db commit. A real fetch to it succeeds,
 * so the harness answers it with fake-but-stable bytes instead of the generic off-origin 404 —
 * otherwise a runtime-caching route for it could never observe a cacheable response to cache.
 */
const REMOTE_PHOTO_HOST = /^https:\/\/raw\.githubusercontent\.com\//

/** The `Response` a real fetch to a remote free-exercise-db photo URL would resolve with. */
function remotePhotoResponse(url: string): Response {
  return new Response(new TextEncoder().encode(`fake remote photo bytes for ${url}`), {
    status: 200,
    headers: { 'content-type': 'image/jpeg' },
  })
}

/** Every global `fake-indexeddb/auto` (src/test/setup.ts) defines on the node process global. */
const IDB_GLOBAL_NAMES = [
  'indexedDB',
  'IDBCursor',
  'IDBCursorWithValue',
  'IDBDatabase',
  'IDBFactory',
  'IDBIndex',
  'IDBKeyRange',
  'IDBObjectStore',
  'IDBOpenDBRequest',
  'IDBRequest',
  'IDBTransaction',
  'IDBVersionChangeEvent',
] as const

/** The subset of the node global that carries the fake IndexedDB the worker's vm scope needs. */
function idbGlobals(): Record<string, unknown> {
  const source = globalThis as unknown as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const name of IDB_GLOBAL_NAMES) out[name] = source[name]
  return out
}

/** The URL of a `fetch`/cache argument, which the Cache API accepts as a string or a Request. */
function urlOf(input: unknown): string {
  if (typeof input === 'string') return new URL(input, `${ORIGIN}${BASE}`).href
  return (input as { url: string }).url
}

/** A cache key with Workbox's precache revision parameter stripped off. */
function withoutRevision(url: string): string {
  const parsed = new URL(url)
  parsed.searchParams.delete('__WB_REVISION__')
  parsed.search = parsed.searchParams.toString()
  return parsed.href
}

function toResponse(stored: StoredResponse): Response {
  return new Response(stored.body, {
    status: stored.status,
    statusText: stored.statusText,
    headers: stored.headers,
  })
}

/** The subset of the Cache API that Workbox's precaching and routing actually call. */
class HarnessCache {
  readonly entries = new Map<string, StoredResponse>()

  private lookup(url: string, options?: CacheQueryOptions): StoredResponse | undefined {
    const direct = this.entries.get(url)
    if (direct || !options?.ignoreSearch) return direct
    const bare = url.split('?')[0]
    for (const [key, value] of this.entries) {
      if (key.split('?')[0] === bare) return value
    }
    return undefined
  }

  async put(request: unknown, response: Response): Promise<void> {
    this.entries.set(urlOf(request), {
      status: response.status,
      statusText: response.statusText,
      headers: [...response.headers],
      body: new Uint8Array(await response.arrayBuffer()),
    })
  }

  async match(request: unknown, options?: CacheQueryOptions): Promise<Response | undefined> {
    const stored = this.lookup(urlOf(request), options)
    return stored ? toResponse(stored) : undefined
  }

  async matchAll(request?: unknown, options?: CacheQueryOptions): Promise<Response[]> {
    if (request === undefined) return [...this.entries.values()].map(toResponse)
    const stored = this.lookup(urlOf(request), options)
    return stored ? [toResponse(stored)] : []
  }

  async delete(request: unknown, options?: CacheQueryOptions): Promise<boolean> {
    const url = urlOf(request)
    if (this.entries.delete(url)) return true
    if (!options?.ignoreSearch) return false
    const bare = url.split('?')[0]
    for (const key of [...this.entries.keys()]) {
      if (key.split('?')[0] === bare) return this.entries.delete(key)
    }
    return false
  }

  async keys(request?: unknown): Promise<Request[]> {
    const urls = request === undefined ? [...this.entries.keys()] : [urlOf(request)]
    return urls.filter((url) => this.entries.has(url)).map((url) => new Request(url))
  }
}

class HarnessCacheStorage {
  readonly caches = new Map<string, HarnessCache>()

  async open(name: string): Promise<HarnessCache> {
    let cache = this.caches.get(name)
    if (!cache) {
      cache = new HarnessCache()
      this.caches.set(name, cache)
    }
    return cache
  }

  async has(name: string): Promise<boolean> {
    return this.caches.has(name)
  }

  async keys(): Promise<string[]> {
    return [...this.caches.keys()]
  }

  async delete(name: string): Promise<boolean> {
    return this.caches.delete(name)
  }

  async match(request: unknown, options?: CacheQueryOptions): Promise<Response | undefined> {
    for (const cache of this.caches.values()) {
      const hit = await cache.match(request, options)
      if (hit) return hit
    }
    return undefined
  }
}

/** An ExtendableEvent: handlers hold it open with `waitUntil`. */
class HarnessEvent {
  readonly type: string
  private pending: Promise<unknown>[] = []

  constructor(type: string) {
    this.type = type
  }

  waitUntil(promise: unknown): void {
    this.pending.push(Promise.resolve(promise))
  }

  /** Resolves once nothing is left extending the event, including work added while waiting. */
  async settled(): Promise<void> {
    while (this.pending.length > 0) {
      await Promise.all(this.pending.splice(0))
    }
  }
}

class HarnessFetchEvent extends HarnessEvent {
  readonly request: Request
  response: Promise<Response> | undefined

  constructor(request: Request) {
    super('fetch')
    this.request = request
  }

  respondWith(response: unknown): void {
    this.response = Promise.resolve(response) as Promise<Response>
  }
}

/**
 * A Request with `mode` set. The browser decides a request's mode — a navigation is 'navigate',
 * a subresource is 'cors' or 'no-cors' — and `new Request(url, { mode: 'navigate' })` is a
 * TypeError by spec, so the harness has to say it on the request's behalf.
 */
function requestWithMode(url: string, mode: RequestMode): Request {
  const real = new Request(url)
  return new Proxy(real, {
    get(target, property, receiver) {
      if (property === 'mode') return mode
      const value = Reflect.get(target, property, receiver) as unknown
      return typeof value === 'function' ? (value as () => unknown).bind(target) : value
    },
  })
}

/**
 * Evaluates `dist/sw.js` against a fake browser and hands back the controls for driving it.
 *
 * The returned harness is online: `install()` fetches the precache from the build output, as
 * the first visit does over the network. Call `goOffline()` before the assertions that matter.
 */
export async function startServiceWorker(app: BuiltApp): Promise<ServiceWorkerHarness> {
  const listeners = new Map<string, ((event: unknown) => unknown)[]>()
  const cacheStorage = new HarnessCacheStorage()
  const networkLog: string[] = []
  let offline = false

  const serve = (relPath: string): Response => {
    if (!app.files.includes(relPath)) return new Response('not found', { status: 404 })
    return new Response(readFileSync(join(app.outDir, ...relPath.split('/'))), {
      status: 200,
      headers: { 'content-type': contentTypeOf(relPath) },
    })
  }

  const harnessFetch = async (input: unknown): Promise<Response> => {
    const url = urlOf(input)
    networkLog.push(url)
    if (offline) throw new TypeError('Failed to fetch')
    const relPath = distPathOf(url)
    if (relPath === null) {
      if (REMOTE_PHOTO_HOST.test(url)) return remotePhotoResponse(url)
      return new Response('off origin', { status: 404 })
    }
    return serve(relPath.split('?')[0])
  }

  const scope: Record<string, unknown> = {
    Request,
    Response,
    Headers,
    // Workbox refuses to precache unless the event it is handed is a real FetchEvent, so the
    // harness's own event classes are what the worker sees under those names.
    ExtendableEvent: HarnessEvent,
    FetchEvent: HarnessFetchEvent,
    URL,
    URLSearchParams,
    TextEncoder,
    TextDecoder,
    console,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    queueMicrotask,
    fetch: harnessFetch,
    caches: cacheStorage,
    // Workbox's ExpirationPlugin (a runtime-caching `expiration` option) tracks cache entry
    // timestamps in IndexedDB, through the `idb` package's `instanceof IDB*` checks. Tests
    // setup.ts installs `fake-indexeddb/auto` on the node global for the rest of the suite
    // (Dexie reads it the same way); the worker runs in its own `vm` context though, so its
    // global has to be handed every IDB* constructor `fake-indexeddb/auto` defines, not just
    // `indexedDB` itself.
    ...idbGlobals(),
    navigator: { userAgent: 'workout-tracker-sw-harness', onLine: true },
    // vitest builds with NODE_ENV=test, so Workbox emits its logging build. Silence it, or a
    // single install buries the assertion output under a hundred lines.
    __WB_DISABLE_DEV_LOGS: true,
    location: new URL(`${ORIGIN}${BASE}sw.js`),
    registration: { scope: `${ORIGIN}${BASE}`, waiting: null, installing: null, active: null },
    clients: { claim: async () => undefined, matchAll: async () => [] },
    skipWaiting: async () => undefined,
    addEventListener(type: string, handler: (event: unknown) => unknown) {
      const forType = listeners.get(type) ?? []
      forType.push(handler)
      listeners.set(type, forType)
    },
    removeEventListener(type: string, handler: (event: unknown) => unknown) {
      const forType = listeners.get(type) ?? []
      listeners.set(
        type,
        forType.filter((candidate) => candidate !== handler),
      )
    },
    importScripts(...urls: string[]) {
      for (const url of urls) {
        const relPath = distPathOf(new URL(url, `${ORIGIN}${BASE}`).href)
        if (relPath === null || !app.files.includes(relPath)) {
          throw new Error(`the service worker imported ${url}, which the build did not emit`)
        }
        runInContext(readFileSync(join(app.outDir, ...relPath.split('/')), 'utf-8'), context, {
          filename: url,
        })
      }
    },
  }
  scope.self = scope
  scope.globalThis = scope

  const context = createContext(scope)
  runInContext(app.read('sw.js'), context, { filename: `${ORIGIN}${BASE}sw.js` })

  // `sw.js` is an AMD bundle: it pulls the Workbox runtime in through `importScripts` and then
  // runs its own body in a `.then`, so its listeners are not registered until the microtask
  // queue drains. A macrotask turn is enough and does not depend on how many ticks deep it is.
  await new Promise((resolve) => setTimeout(resolve, 0))

  const dispatch = async (event: HarnessEvent): Promise<void> => {
    for (const handler of listeners.get(event.type) ?? []) handler(event)
    await event.settled()
  }

  return {
    async install() {
      await dispatch(new HarnessEvent('install'))
    },
    async activate() {
      await dispatch(new HarnessEvent('activate'))
    },
    cachedUrls() {
      const urls = new Set<string>()
      for (const cache of cacheStorage.caches.values()) {
        for (const url of cache.entries.keys()) urls.add(withoutRevision(url))
      }
      return [...urls].sort()
    },
    goOffline() {
      offline = true
    },
    async request(url: string, mode: RequestMode = 'no-cors') {
      const event = new HarnessFetchEvent(requestWithMode(url, mode))
      for (const handler of listeners.get('fetch') ?? []) {
        handler(event)
        if (event.response) break
      }
      const response = event.response ? await event.response : undefined
      await event.settled()
      return response
    },
    networkLog,
  }
}
