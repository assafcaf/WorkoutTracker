import {
  CONTRACT_VERSION,
  VERSION_HEADER,
  checkPushKeyResponse,
  checkPushTestResponse,
  parseReminders,
  type PushTestResponse,
  type Reminders,
} from '../contract'
import { getWorkoutReminders, setWorkoutReminders } from '../storage/settingsStore'
import type { ServiceDeps } from './deps'
import { callStorage, ServiceError } from './errors'

export type PushStatus = 'unsupported' | 'not-installed' | 'denied' | 'on' | 'off'
export type PushEnableResult = PushStatus | 'unconfigured' | 'signed-out' | 'failed'

/** What PushService.test() answers: the Worker's answer, or why there is none. */
export type PushTestOutcome = PushTestResponse | { error: 'signed-out' | 'unconfigured' | 'failed' }

/** One push subscription as the browser hands it out. */
export type PushSubscriptionLike = {
  endpoint: string
  toJSON(): { endpoint?: string; keys?: Record<string, string> }
  unsubscribe(): Promise<boolean>
}

/** The browser facts the service reads, injected so a test can fake each one. */
export type PushEnv = {
  /** Resolves the registration's push manager; absent when there is no service worker. */
  serviceWorker?: {
    ready: Promise<{
      pushManager: {
        getSubscription(): Promise<PushSubscriptionLike | null>
        subscribe(options: { userVisibleOnly: boolean; applicationServerKey: Uint8Array }): Promise<PushSubscriptionLike>
      }
    }>
  }
  hasPushManager: boolean
  notification?: { permission: NotificationPermission; requestPermission(): Promise<NotificationPermission> }
  standalone: boolean
}

export type PushService = {
  status(): Promise<PushStatus>
  enable(): Promise<PushEnableResult>
  disable(): Promise<PushStatus>
  scheduleRest(endsAt: number, label: string): Promise<void>
  cancelRest(): Promise<void>
  /** Asks the Worker to send a test notification now; never throws. */
  test(): Promise<PushTestOutcome>
  reminders(): Promise<Reminders | null>
  setReminders(value: Reminders | null): Promise<void>
}

export type PushDeps = ServiceDeps & { fetch?: typeof fetch; env?: PushEnv }

const KEY_PATH = '/api/push/key'
const SUBSCRIPTION_PATH = '/api/push/subscription'
const REST_PATH = '/api/push/rest'
const TEST_PATH = '/api/push/test'

/** The browser's own facts; a missing global reads as unsupported. */
function browserEnv(): PushEnv {
  const nav = typeof navigator === 'undefined' ? undefined : (navigator as Navigator & { standalone?: boolean })
  const standalone =
    (typeof matchMedia === 'function' && matchMedia('(display-mode: standalone)').matches) || nav?.standalone === true
  return {
    serviceWorker: nav && 'serviceWorker' in nav ? (nav.serviceWorker as unknown as PushEnv['serviceWorker']) : undefined,
    hasPushManager: typeof window !== 'undefined' && 'PushManager' in window,
    notification: typeof Notification === 'undefined' ? undefined : Notification,
    standalone,
  }
}

function keyBytes(base64Url: string): Uint8Array {
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (base64Url.length % 4)) % 4)
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
}

/**
 * The phone's push service (E24-T8, O22-O24): whether push can work here, subscribing from a
 * tap, scheduling and cancelling the rest push without ever throwing, and the reminders
 * setting. Every request carries the contract version.
 */
export function createPushService(deps: PushDeps): PushService {
  const env = deps.env ?? browserEnv()

  async function send(method: string, path: string, body?: unknown): Promise<Response | null> {
    try {
      const doFetch = deps.fetch ?? globalThis.fetch
      return await doFetch(path, {
        method,
        credentials: 'same-origin',
        redirect: 'manual',
        headers: {
          [VERSION_HEADER]: String(CONTRACT_VERSION),
          ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      })
    } catch {
      return null
    }
  }

  const signedOut = (r: Response) => r.type === 'opaqueredirect' || r.status === 401

  async function subscription(): Promise<PushSubscriptionLike | null> {
    try {
      const registration = await env.serviceWorker?.ready
      return (await registration?.pushManager.getSubscription()) ?? null
    } catch {
      return null
    }
  }

  async function status(): Promise<PushStatus> {
    if (!env.serviceWorker || !env.hasPushManager || !env.notification) return 'unsupported'
    if (!env.standalone) return 'not-installed'
    if (env.notification.permission === 'denied') return 'denied'
    return (await subscription()) ? 'on' : 'off'
  }

  async function enable(): Promise<PushEnableResult> {
    const before = await status()
    if (before === 'unsupported' || before === 'not-installed' || before === 'denied') return before
    if ((await env.notification!.requestPermission()) !== 'granted') return 'denied'

    const keyResponse = await send('GET', KEY_PATH)
    if (!keyResponse) return 'failed'
    if (signedOut(keyResponse)) return 'signed-out'
    if (keyResponse.status === 503) return 'unconfigured'
    if (!keyResponse.ok) return 'failed'
    const publicKey = checkPushKeyResponse(await keyResponse.json().catch(() => null))?.publicKey
    if (!publicKey) return 'failed'

    let created: PushSubscriptionLike
    try {
      const registration = await env.serviceWorker!.ready
      created = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyBytes(publicKey),
      })
    } catch {
      return 'failed'
    }
    const { endpoint, keys } = created.toJSON()
    const posted = await send('POST', SUBSCRIPTION_PATH, { endpoint: endpoint ?? created.endpoint, keys })
    if (posted?.ok) return 'on'
    await created.unsubscribe().catch(() => false)
    if (posted && signedOut(posted)) return 'signed-out'
    return 'failed'
  }

  async function disable(): Promise<PushStatus> {
    const current = await subscription()
    if (current) {
      await send('DELETE', SUBSCRIPTION_PATH, { endpoint: current.endpoint })
      await current.unsubscribe().catch(() => false)
    }
    return 'off'
  }

  return {
    status,
    enable,
    disable,
    async scheduleRest(endsAt, label) {
      if ((await status()) !== 'on') return
      await send('POST', REST_PATH, {
        delayMs: Math.max(0, Math.round(endsAt - deps.now())),
        title: `Rest over — ${label}`,
        body: 'Tap to log it.',
      })
    },
    async cancelRest() {
      if ((await status()) !== 'on') return
      await send('DELETE', REST_PATH)
    },
    async test() {
      const response = await send('POST', TEST_PATH)
      if (!response) return { error: 'failed' }
      if (signedOut(response)) return { error: 'signed-out' }
      if (response.status === 503) return { error: 'unconfigured' }
      if (!response.ok) return { error: 'failed' }
      return checkPushTestResponse(await response.json().catch(() => null)) ?? { error: 'failed' }
    },
    async reminders() {
      const stored = await callStorage(deps, getWorkoutReminders, 'workoutReminders read failed')
      return parseReminders(stored)
    },
    async setReminders(value) {
      const parsed = value === null ? null : parseReminders(value)
      if (value !== null && !parsed) throw new ServiceError('storage-failed', 'the reminders are not valid')
      await callStorage(deps, () => setWorkoutReminders(parsed, deps.now()), 'workoutReminders write failed')
      deps.bus.emit('preferences')
    },
  }
}
