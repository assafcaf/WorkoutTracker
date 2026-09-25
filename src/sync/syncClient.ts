import { db, type SettingRow } from "../storage/db";
import type { Session } from "../types";
import {
  SYNCED_SETTING_KEYS,
  type MeResponse,
  type ReplaceRequest,
  type ReplaceResponse,
  type SyncedSession,
  type SyncedSetting,
  type SyncedSettingKey,
  type SyncRequest,
  type SyncResponse,
} from "./protocol";

export type SyncResult =
  | { status: "ok"; at: number; pushed: number; pulled: number }
  | { status: "offline" }
  | { status: "signed-out" }
  | { status: "error"; message: string }
  | { status: "account-mismatch"; deviceEmail: string; signedInEmail: string };

export type SyncState = {
  accountEmail: string | null;
  lastSyncedAt: number | null;
};

export const SIGN_IN_PATH = "/api/login";

export type SyncDeps = { fetch?: typeof fetch; now?: () => number };

// Bookkeeping rows in `db.settings`. None of them is ever pushed: only SYNCED_SETTING_KEYS are.
const ACCOUNT_EMAIL_KEY = "accountEmail";
const SYNC_CURSOR_KEY = "syncCursor";
/** Every local row with `updatedAt` above this has not reached the server yet. */
const LAST_PUSHED_AT_KEY = "lastPushedAt";
const LAST_SYNCED_AT_KEY = "lastSyncedAt";

/** A request that ended without an answer the caller can use; carries the result to report. */
class SyncStop extends Error {
  constructor(readonly result: SyncResult) {
    super(result.status);
  }
}

/** The call in progress, shared by any `syncNow` or `replaceRemote` made while it runs. */
let running: Promise<SyncResult> | null = null;

function shared(run: () => Promise<SyncResult>): Promise<SyncResult> {
  if (running) return running;
  const call = run()
    .catch((error: unknown) => {
      if (error instanceof SyncStop) return error.result;
      return {
        status: "error",
        message: error instanceof Error ? error.message : String(error),
      } as const;
    })
    .finally(() => {
      running = null;
    });
  running = call;
  return call;
}

/**
 * One request to the API: relative, same-origin credentials and manual redirects, so an
 * expired Access session shows up as an opaque redirect instead of being followed.
 */
async function request<T>(
  deps: SyncDeps,
  path: string,
  body?: unknown,
): Promise<T> {
  const doFetch = deps.fetch ?? globalThis.fetch;
  let response: Response;
  try {
    response = await doFetch(path, {
      method: body === undefined ? "GET" : "POST",
      credentials: "same-origin",
      redirect: "manual",
      ...(body === undefined
        ? {}
        : {
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
          }),
    });
  } catch {
    throw new SyncStop({ status: "offline" });
  }
  if (response.type === "opaqueredirect" || response.status === 401) {
    throw new SyncStop({ status: "signed-out" });
  }
  if (!response.ok) {
    throw new SyncStop({
      status: "error",
      message: `${path} answered ${response.status}`,
    });
  }
  return (await response.json()) as T;
}

async function readSetting(key: string): Promise<unknown> {
  return (await db.settings.get(key))?.value;
}

async function readNumber(key: string): Promise<number | null> {
  const value = await readSetting(key);
  return typeof value === "number" ? value : null;
}

async function readAccountEmail(): Promise<string | null> {
  const value = await readSetting(ACCOUNT_EMAIL_KEY);
  return typeof value === "string" ? value : null;
}

function isSyncedKey(key: string): key is SyncedSettingKey {
  return (SYNCED_SETTING_KEYS as readonly string[]).includes(key);
}

/** A session as it is pushed; one from before E7 gets the stamp the v2 upgrade would give it. */
function toSynced(session: Session): SyncedSession {
  return {
    ...session,
    updatedAt: session.updatedAt ?? session.finishedAt ?? session.startedAt,
  };
}

function toSyncedSetting(row: SettingRow): SyncedSetting {
  return {
    key: row.key as SyncedSettingKey,
    value: row.value,
    updatedAt: row.updatedAt ?? 0,
  };
}

type Outgoing = { sessions: SyncedSession[]; settings: SyncedSetting[] };

/** Local sessions and synced settings changed after `since`, plus any never stamped. */
async function collectChanged(since: number): Promise<Outgoing> {
  return db.transaction("r", db.sessions, db.settings, async () => {
    const changed = await db.sessions.where("updatedAt").above(since).toArray();
    const unstamped = await db.sessions
      .filter((s) => s.updatedAt === undefined)
      .toArray();
    const settings = (
      await db.settings.bulkGet([...SYNCED_SETTING_KEYS])
    ).filter(
      (row): row is SettingRow =>
        row !== undefined &&
        (row.updatedAt === undefined || row.updatedAt > since),
    );
    return {
      sessions: [...changed, ...unstamped].map(toSynced),
      settings: settings.map(toSyncedSetting),
    };
  });
}

async function collectAll(): Promise<Outgoing> {
  return db.transaction("r", db.sessions, db.settings, async () => {
    const sessions = await db.sessions.toArray();
    const settings = (
      await db.settings.bulkGet([...SYNCED_SETTING_KEYS])
    ).filter((row): row is SettingRow => row !== undefined);
    return {
      sessions: sessions.map(toSynced),
      settings: settings.map(toSyncedSetting),
    };
  });
}

/**
 * Stores what the server sent (unless the local copy is equal or newer), stamps pushed rows that
 * lacked `updatedAt`, and records the cursor and the push watermark, all in one transaction so a
 * write made while the request was in flight is either kept and pushed next time, or not made yet.
 */
async function applyAnswer(
  pushed: Outgoing,
  pulled: Outgoing,
  cursor: number,
  at: number,
): Promise<number> {
  return db.transaction("rw", db.sessions, db.settings, async () => {
    const previous = (await readNumber(LAST_PUSHED_AT_KEY)) ?? 0;
    // Versions this round has put on the server or stored here, so the watermark can move past them.
    const known = new Map<string, number>();
    let written = 0;

    for (const doc of pushed.sessions) {
      known.set(`s:${doc.id}`, doc.updatedAt);
      const local = await db.sessions.get(doc.id);
      if (local && local.updatedAt === undefined) {
        await db.sessions.put({ ...local, updatedAt: doc.updatedAt });
      }
    }
    for (const doc of pushed.settings) {
      known.set(`k:${doc.key}`, doc.updatedAt);
      const local = await db.settings.get(doc.key);
      if (local && local.updatedAt === undefined) {
        await db.settings.put({ ...local, updatedAt: doc.updatedAt });
      }
    }

    for (const doc of pulled.sessions) {
      const local = await db.sessions.get(doc.id);
      if (local?.updatedAt !== undefined && local.updatedAt >= doc.updatedAt)
        continue;
      await db.sessions.put(doc);
      known.set(`s:${doc.id}`, doc.updatedAt);
      written += 1;
    }
    for (const doc of pulled.settings) {
      if (!isSyncedKey(doc.key)) continue;
      const local = await db.settings.get(doc.key);
      if (local?.updatedAt !== undefined && local.updatedAt >= doc.updatedAt)
        continue;
      await db.settings.put({
        key: doc.key,
        value: doc.value,
        updatedAt: doc.updatedAt,
      });
      known.set(`k:${doc.key}`, doc.updatedAt);
      written += 1;
    }

    // Rows above the old watermark are either this round's (known) or written since the push.
    const above: { id: string; updatedAt: number }[] = [
      ...(await db.sessions.where("updatedAt").above(previous).toArray()).map(
        (s) => ({
          id: `s:${s.id}`,
          updatedAt: s.updatedAt as number,
        }),
      ),
      ...(await db.settings.bulkGet([...SYNCED_SETTING_KEYS]))
        .filter(
          (row): row is SettingRow =>
            row !== undefined && (row.updatedAt ?? 0) > previous,
        )
        .map((row) => ({
          id: `k:${row.key}`,
          updatedAt: row.updatedAt as number,
        })),
    ];
    const unpushed = above.filter((row) => known.get(row.id) !== row.updatedAt);
    const watermark =
      unpushed.length > 0
        ? Math.max(
            previous,
            Math.min(...unpushed.map((row) => row.updatedAt)) - 1,
          )
        : Math.max(previous, ...above.map((row) => row.updatedAt));

    await db.settings.bulkPut([
      { key: LAST_PUSHED_AT_KEY, value: watermark },
      { key: SYNC_CURSOR_KEY, value: cursor },
      { key: LAST_SYNCED_AT_KEY, value: at },
    ]);
    return written;
  });
}

/**
 * Checks which account the browser is signed into against the one this device belongs to. A
 * device with none adopts the first it sees; a different one stops the call with a mismatch.
 */
async function bindAccount(deps: SyncDeps): Promise<void> {
  const { email } = await request<MeResponse>(deps, "/api/me");
  const deviceEmail = await readAccountEmail();
  if (deviceEmail === null) {
    await db.settings.put({ key: ACCOUNT_EMAIL_KEY, value: email });
    return;
  }
  if (deviceEmail !== email) {
    throw new SyncStop({
      status: "account-mismatch",
      deviceEmail,
      signedInEmail: email,
    });
  }
}

/**
 * Copies this device's changes up and the server's newer changes down. Never rejects: offline,
 * signed-out, a server error and an account mismatch all resolve as results.
 */
export function syncNow(deps: SyncDeps = {}): Promise<SyncResult> {
  return shared(async () => {
    await bindAccount(deps);
    const since = (await readNumber(SYNC_CURSOR_KEY)) ?? 0;
    const outgoing = await collectChanged(
      (await readNumber(LAST_PUSHED_AT_KEY)) ?? 0,
    );
    const body: SyncRequest = { since, ...outgoing };
    const answer = await request<SyncResponse>(deps, "/api/sync", body);
    const at = (deps.now ?? Date.now)();
    const pulled = await applyAnswer(outgoing, answer, answer.cursor, at);
    return {
      status: "ok",
      at,
      pushed: outgoing.sessions.length + outgoing.settings.length,
      pulled,
    };
  });
}

/**
 * Makes the server hold exactly this device's sessions and synced settings, then keeps the
 * cursor it returns, so the next sync does not bring replaced sessions back.
 */
export function replaceRemote(deps: SyncDeps = {}): Promise<SyncResult> {
  return shared(async () => {
    await bindAccount(deps);
    const outgoing = await collectAll();
    const body: ReplaceRequest = outgoing;
    const answer = await request<ReplaceResponse>(deps, "/api/replace", body);
    const at = (deps.now ?? Date.now)();
    await applyAnswer(
      outgoing,
      { sessions: [], settings: [] },
      answer.cursor,
      at,
    );
    return {
      status: "ok",
      at,
      pushed: outgoing.sessions.length + outgoing.settings.length,
      pulled: 0,
    };
  });
}

/**
 * Makes this device belong to `email`: clears the local sessions, the synced settings and the
 * sync bookkeeping, so the next sync pulls that account's data from the start.
 */
export async function adoptSignedInAccount(email: string): Promise<void> {
  await db.transaction("rw", db.sessions, db.settings, async () => {
    await db.sessions.clear();
    await db.settings.bulkDelete([
      ...SYNCED_SETTING_KEYS,
      SYNC_CURSOR_KEY,
      LAST_PUSHED_AT_KEY,
      LAST_SYNCED_AT_KEY,
    ]);
    await db.settings.put({ key: ACCOUNT_EMAIL_KEY, value: email });
  });
}

/** The account this device belongs to and when it last synced, each null until it has. */
export async function getSyncState(): Promise<SyncState> {
  return {
    accountEmail: await readAccountEmail(),
    lastSyncedAt: await readNumber(LAST_SYNCED_AT_KEY),
  };
}
