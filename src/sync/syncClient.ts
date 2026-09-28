import {
  allSessions,
  putSessions,
  replaceAllSessions,
  sessionsChangedSince,
} from "../storage/sessionStore";
import { topicOfSetting, syncedSettingKeys } from "../storage/settingKeys";
import { deleteKeys, putRows, readRow } from "../storage/settingsStore";
import { inTransaction } from "../storage/transaction";
import type { Session } from "../types";
import type {
  MeResponse,
  ReplaceRequest,
  ReplaceResponse,
  SyncedSession,
  SyncedSetting,
  SyncedSettingKey,
  SyncRequest,
  SyncResponse,
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

/** The topics a pull wrote rows of: `sessions`, and each written setting's topic. */
export type PulledTopic = "sessions" | "programs" | "preferences";

export type SyncDeps = {
  fetch?: typeof fetch;
  now?: () => number;
  /** Told, once the pull has committed, every topic it wrote rows of; not called when none. */
  onPulled?: (topics: ReadonlySet<PulledTopic>) => void;
};

/** One engine's calls; each shares a call already running with any made while it runs. */
export type SyncClient = {
  syncNow(): Promise<SyncResult>;
  replaceRemote(): Promise<SyncResult>;
};

type SettingRow = NonNullable<Awaited<ReturnType<typeof readRow>>>;

// Bookkeeping rows in the settings table. None of them is ever pushed: only synced keys are.
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
  return (await readRow(key))?.value;
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
  return syncedSettingKeys().includes(key);
}

/** The stored rows of every synced setting key, skipping keys never written. */
async function readSyncedRows(): Promise<SettingRow[]> {
  const rows = await Promise.all(syncedSettingKeys().map((key) => readRow(key)));
  return rows.filter((row): row is SettingRow => row !== undefined);
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
  return inTransaction("r", async () => {
    const sessions = await sessionsChangedSince(since);
    const settings = (await readSyncedRows()).filter(
      (row) => row.updatedAt === undefined || row.updatedAt > since,
    );
    return {
      sessions: sessions.map(toSynced),
      settings: settings.map(toSyncedSetting),
    };
  });
}

async function collectAll(): Promise<Outgoing> {
  return inTransaction("r", async () => {
    const sessions = await allSessions();
    const settings = await readSyncedRows();
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
 * Resolves with how many pulled rows it wrote and the topics they belong to.
 */
async function applyAnswer(
  pushed: Outgoing,
  pulled: Outgoing,
  cursor: number,
  at: number,
): Promise<{ written: number; topics: Set<PulledTopic> }> {
  return inTransaction("rw", async () => {
    const previous = (await readNumber(LAST_PUSHED_AT_KEY)) ?? 0;
    // Versions this round has put on the server or stored here, so the watermark can move past them.
    const known = new Map<string, number>();
    const topics = new Set<PulledTopic>();
    let written = 0;
    const localSessions = new Map(
      (await allSessions()).map((session) => [session.id, session]),
    );

    for (const doc of pushed.sessions) {
      known.set(`s:${doc.id}`, doc.updatedAt);
      const local = localSessions.get(doc.id);
      if (local && local.updatedAt === undefined) {
        const stamped = { ...local, updatedAt: doc.updatedAt };
        await putSessions([stamped]);
        localSessions.set(doc.id, stamped);
      }
    }
    for (const doc of pushed.settings) {
      known.set(`k:${doc.key}`, doc.updatedAt);
      const local = await readRow(doc.key);
      if (local && local.updatedAt === undefined) {
        await putRows([{ ...local, updatedAt: doc.updatedAt }]);
      }
    }

    for (const doc of pulled.sessions) {
      const local = localSessions.get(doc.id);
      if (local?.updatedAt !== undefined && local.updatedAt >= doc.updatedAt)
        continue;
      await putSessions([doc]);
      localSessions.set(doc.id, doc);
      known.set(`s:${doc.id}`, doc.updatedAt);
      topics.add("sessions");
      written += 1;
    }
    for (const doc of pulled.settings) {
      if (!isSyncedKey(doc.key)) continue;
      const local = await readRow(doc.key);
      if (local?.updatedAt !== undefined && local.updatedAt >= doc.updatedAt)
        continue;
      await putRows([
        { key: doc.key, value: doc.value, updatedAt: doc.updatedAt },
      ]);
      known.set(`k:${doc.key}`, doc.updatedAt);
      const topic = topicOfSetting(doc.key);
      if (topic !== null) topics.add(topic);
      written += 1;
    }

    // Rows above the old watermark are either this round's (known) or written since the push.
    const above: { id: string; updatedAt: number }[] = [
      ...(await sessionsChangedSince(previous))
        .filter((s) => s.updatedAt !== undefined)
        .map((s) => ({
          id: `s:${s.id}`,
          updatedAt: s.updatedAt as number,
        })),
      ...(await readSyncedRows())
        .filter((row) => (row.updatedAt ?? 0) > previous)
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

    await putRows([
      { key: LAST_PUSHED_AT_KEY, value: watermark },
      { key: SYNC_CURSOR_KEY, value: cursor },
      { key: LAST_SYNCED_AT_KEY, value: at },
    ]);
    return { written, topics };
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
    await putRows([{ key: ACCOUNT_EMAIL_KEY, value: email }]);
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
async function runSync(deps: SyncDeps): Promise<SyncResult> {
  await bindAccount(deps);
  const since = (await readNumber(SYNC_CURSOR_KEY)) ?? 0;
  const outgoing = await collectChanged(
    (await readNumber(LAST_PUSHED_AT_KEY)) ?? 0,
  );
  const body: SyncRequest = { since, ...outgoing };
  const answer = await request<SyncResponse>(deps, "/api/sync", body);
  const at = (deps.now ?? Date.now)();
  const { written, topics } = await applyAnswer(
    outgoing,
    answer,
    answer.cursor,
    at,
  );
  if (topics.size > 0) deps.onPulled?.(topics);
  return {
    status: "ok",
    at,
    pushed: outgoing.sessions.length + outgoing.settings.length,
    pulled: written,
  };
}

/**
 * Makes the server hold exactly this device's sessions and synced settings, then keeps the
 * cursor it returns, so the next sync does not bring replaced sessions back.
 */
async function runReplace(deps: SyncDeps): Promise<SyncResult> {
  await bindAccount(deps);
  const outgoing = await collectAll();
  const body: ReplaceRequest = outgoing;
  const answer = await request<ReplaceResponse>(deps, "/api/replace", body);
  const at = (deps.now ?? Date.now)();
  await applyAnswer(outgoing, { sessions: [], settings: [] }, answer.cursor, at);
  return {
    status: "ok",
    at,
    pushed: outgoing.sessions.length + outgoing.settings.length,
    pulled: 0,
  };
}

/** A sync engine over `deps`. A call made while another of its calls runs gets that call. */
export function createSyncClient(deps: SyncDeps = {}): SyncClient {
  let running: Promise<SyncResult> | null = null;

  function shared(run: (deps: SyncDeps) => Promise<SyncResult>): Promise<SyncResult> {
    if (running) return running;
    const call = run(deps)
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

  return {
    syncNow: () => shared(runSync),
    replaceRemote: () => shared(runReplace),
  };
}

/**
 * Makes this device belong to `email`: clears the local sessions, the synced settings and the
 * sync bookkeeping, so the next sync pulls that account's data from the start.
 */
export async function adoptSignedInAccount(email: string): Promise<void> {
  await inTransaction("rw", async () => {
    await replaceAllSessions([]);
    await deleteKeys([
      ...syncedSettingKeys(),
      SYNC_CURSOR_KEY,
      LAST_PUSHED_AT_KEY,
      LAST_SYNCED_AT_KEY,
    ]);
    await putRows([{ key: ACCOUNT_EMAIL_KEY, value: email }]);
  });
}

/** The account this device belongs to and when it last synced, each null until it has. */
export async function getSyncState(): Promise<SyncState> {
  return {
    accountEmail: await readAccountEmail(),
    lastSyncedAt: await readNumber(LAST_SYNCED_AT_KEY),
  };
}
