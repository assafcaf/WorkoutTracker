// A Durable Object namespace stand-in: `idFromName(name)` and `get(id).fetch(request)` reach one
// instance per name, built once from the class and kept (as the runtime keeps a live object).
// Each instance gets in-memory storage with an alarm slot. Alarms never fire on their own: a test
// calls `fireAlarm(name)`, which clears the slot and runs the instance's `alarm()` like the runtime.

export type FakeDoStorage = {
  get<T = unknown>(key: string): Promise<T | undefined>
  put(key: string, value: unknown): Promise<void>
  delete(key: string): Promise<boolean>
  setAlarm(scheduledTimeMs: number): Promise<void>
  getAlarm(): Promise<number | null>
  deleteAlarm(): Promise<void>
}

type DoInstance = { fetch(request: Request): Promise<Response>; alarm?(): Promise<void> }

export type FakeDurableObjectNamespace = {
  idFromName(name: string): { toString(): string; name: string }
  get(id: { toString(): string }): { fetch(request: Request): Promise<Response> }
  /** When the name's alarm is set to fire (epoch ms), or null. */
  alarmAt(name: string): number | null
  /** Keys held in the name's storage, sorted. */
  storedKeys(name: string): Promise<string[]>
  /** Run the name's alarm handler: clears the alarm slot first, as the runtime does. Runs it even when none was set. */
  fireAlarm(name: string): Promise<void>
}

/** `create` is the DO class constructor; `getEnv` is read when an instance is first built. */
export function createFakeDurableObjectNamespace<Env>(
  create: new (state: { storage: FakeDoStorage }, env: Env) => DoInstance,
  getEnv: () => Env,
): FakeDurableObjectNamespace {
  const instances = new Map<string, { instance: DoInstance; data: Map<string, unknown>; alarm: { at: number | null } }>()

  function entry(name: string) {
    let found = instances.get(name)
    if (!found) {
      const data = new Map<string, unknown>()
      const alarm: { at: number | null } = { at: null }
      const storage: FakeDoStorage = {
        get: async <T,>(key: string) => data.get(key) as T | undefined,
        put: async (key, value) => void data.set(key, structuredClone(value)),
        delete: async (key) => data.delete(key),
        setAlarm: async (at) => void (alarm.at = at),
        getAlarm: async () => alarm.at,
        deleteAlarm: async () => void (alarm.at = null),
      }
      found = { instance: new create({ storage }, getEnv()), data, alarm }
      instances.set(name, found)
    }
    return found
  }

  return {
    idFromName: (name) => ({ name, toString: () => name }),
    get: (id) => ({ fetch: (request) => entry(id.toString()).instance.fetch(request) }),
    alarmAt: (name) => instances.get(name)?.alarm.at ?? null,
    storedKeys: async (name) => [...(instances.get(name)?.data.keys() ?? [])].sort(),
    async fireAlarm(name) {
      const found = entry(name)
      found.alarm.at = null
      await found.instance.alarm?.()
    },
  }
}
