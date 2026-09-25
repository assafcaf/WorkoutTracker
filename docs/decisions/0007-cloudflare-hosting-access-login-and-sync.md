# 0007. The app is hosted on Cloudflare, behind Access, and syncs each user's log to D1

Date: 2026-09-25 · Status: accepted · Tracker: E7 — Sign in, and keep the log in the cloud

## Context
0002 ruled out a backend, accounts and sync, and 0003 put the app on GitHub Pages under
`/WorkoutTracker/`. Both assumed one trainee and one phone. The operator now wants the app
hosted with a login for up to ten people, each person's log kept in a database that survives a
lost phone, for at most $1 a month. GitHub Pages serves static files only, so the data has to
live somewhere else.

## Decision
- **One Cloudflare Worker serves the built app as static assets and answers `/api/*`**, with
  a D1 (SQLite) database bound as `DB`. The app is served from `/` on
  `workout-tracker.<account>.workers.dev`. This supersedes 0003's base path and GitHub Pages
  deploy: `.github/workflows/deploy.yml` now deploys to Cloudflare.
- **Cloudflare Access is the login.** Users sign in with an emailed one-time code, and the
  allowed emails are the Access policy, edited in the dashboard. The Worker also verifies the
  `Cf-Access-Jwt-Assertion` JWT's signature, issuer and audience itself, and fails closed when
  Access isn't configured. It never trusts the plain email header.
- **IndexedDB stays the store the UI reads and writes.** Sync is a background copy: push
  changed records, pull newer ones, last writer wins per session and per setting by a client
  `updatedAt`, with a server-assigned per-user `seq` as the pull cursor. Logging never waits
  on the network. This supersedes 0002's "no backend, no accounts, no sync". Its
  offline-first stance stands.
- **A device belongs to one account.** If a different email signs in, sync stops until the
  user chooses to replace the device's data with that account's.
- **Import still replaces the whole database**, and it now replaces the server copy too
  (`/api/replace`), so a sync cannot resurrect what an import removed.
- The export/import file (0003) stays as a user-held backup.

## Alternatives rejected
- **Supabase**: free projects pause after a week idle, and the app would carry a public key
  whose safety rests entirely on row-level security rules.
- **Firebase**: a NoSQL model, plus a rules language to learn, for relational-shaped data.
- **A VPS running PocketBase**: over budget, and a server to maintain.
- **Our own accounts and passwords**: storing credentials is the riskiest code a small app
  can own. Access does it for free.
- **Server-first reads**: the gym has no signal.
- **Per-set merging**: conflict machinery for two devices editing one session at once, which
  one person per account almost never does.

## Consequences
- The app now makes network calls. `/api/*` and `/cdn-cgi/*` are excluded from the service
  worker's navigation fallback, and the manifest is fetched with credentials so Access
  doesn't block installation.
- An expired Access session shows up as "signed out" in Settings with a "Sign in" link. The
  app keeps working offline meanwhile.
- The user list is dashboard state, not repo state. Changing who has access needs no deploy.
- `project.md`'s invariants about the base path, no network calls and no runtime caching are
  stale. Refresh the knowledge layer after this lands.
- Two clocks decide a conflict. A phone with a badly wrong clock can lose a
  last-writer-wins race. That's acceptable at one person per account.

## Outcome
Built across E7-T1..T8 on `epic/E7-cloud-sync-and-login`. At the epic head, 53 test files and
746 tests pass, `tsc` is clean and `eslint` reports no errors. The Worker (`src/worker/`)
verifies the Access JWT with `jose` and routes `/api/me`, `/api/login`, `/api/sync` and
`/api/replace`. D1 holds per-user `sessions`, `settings` and a `counters` table whose `seq`
is the pull cursor. The client stamps `updatedAt` on every write (Dexie v2, which migrates v1
data). `src/sync/syncClient.ts` does the push, pull and account binding, and `useSync` runs it
on start, after a finished session, on `online`, and after an import. Settings shows the
account and sync state.

Where it departed from the decision above, and why:

- **The server's tests run on `sql.js`, not on D1.** `src/test/fakeD1.ts` applies the real
  `migrations/*.sql` to an in-memory SQLite, so the schema and SQL are exercised on the host.
  D1's own behaviour is checked only by the live deploy.
- **Wrangler is pinned to 3.114.x,** because wrangler 4 needs Node 22 and this host runs 18.
  CI deploys on Node 20.
- **The Access application was created from the Worker's "Enable Access" button.** It defaulted
  to "Sign in with Cloudflare" and a 24-hour session. It was switched to one-time PIN only, with
  instant authentication and a 1-month session, so an installed phone does not re-authenticate
  daily. The auto-created policy used the "Emails ending in" selector with a full address, which
  matches nobody and so sends no code. It was changed to the "Emails" selector. `CLAUDE.md`
  records both.
- **The on-device acceptance (O16) was not run before the PR.** The operator chose to deploy
  only once the epic is finished, and merging to `main` is the deploy. The phone sign-in,
  offline launch and two-device sync are checked after merge.
- **`src/pwa/offline.test.ts` got a 60 s per-file timeout** after its cold launch in jsdom
  overran 5 s while four task suites built in parallel. One O2 test in `manifest.test.ts`,
  "no URL in the service worker resolves to the domain root", was removed as vacuous once
  the base became `/`.
