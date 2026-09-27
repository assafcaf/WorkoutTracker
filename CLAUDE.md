## Delivering work

New work flows through `/spec` (idea → outcomes), `/tickets` (outcomes → tracker tasks) and
`/batch-implement` (tasks → red-then-green, merged code, tracker updated as it goes). The
definition of done is `.claude/workflow/definition-of-done.md`; per-repo settings are in
`.claude/workflow/config.md`. Durable decisions go in `docs/decisions/`.

Keep committed files machine-neutral: no absolute paths, no one OS's shell. Host-specific facts
go in your own gitignored `CLAUDE.local.md`.

## A local app during a batch run

While `/batch-implement` runs, the orchestrator keeps the app running locally in dev mode, so
the operator can see and debug each merge without waiting for a deployment:

- Start it from the **epic worktree** (the merger's checkout) once the baseline is green:
  `npx vite --port 5173 --strictPort --host 127.0.0.1`. Every merge the merger lands there then
  reaches the page through Vite's hot reload.
- **If a merge does not show up** — the page is stale, the server crashed, or the merge changed
  `package.json`, `package-lock.json` or `vite.config.ts`, which hot reload does not pick up —
  the orchestrator stops the server, frees the port, and starts it again. After a lockfile
  change, run `npm ci` in the epic worktree first.
- Dev mode serves the app only. `/api/*` (sign-in and cloud sync) needs the Worker, so debug
  those with `npm run worker:dev` or on the deployed app.
- Stop the server when the run ends.

## Deploying

The app is one Cloudflare Worker (`wrangler.toml`): static assets plus `/api/*`, a D1 database
`workout-tracker`, behind a Cloudflare Access application that logs users in with an emailed
one-time PIN. See `docs/decisions/0007-cloudflare-hosting-access-login-and-sync.md`.

- **Normal path: merge to `main`.** `.github/workflows/deploy.yml` builds, applies the D1
  migrations and deploys, using the `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`
  repository secrets. Run it on another ref with `gh workflow run deploy.yml --ref <ref>`.
- **By hand, only when the operator asks for a deploy**, from a clean checkout of the commit
  being deployed (never a worktree an agent is writing in), in this order:
  1. `npm ci && npm run build`
  2. `npx wrangler d1 migrations apply workout-tracker --remote` (answer `y`; applies only new
     files in `migrations/`)
  3. `npx wrangler deploy`
- **Check it landed:** `npx wrangler deployments list` shows a new version, and
  `curl -s -o /dev/null -w '%{http_code}' https://workout-tracker.assafcaf.workers.dev/api/me`
  answers `302` (the redirect to the Access login). A `200` there means Access is off.
- Wrangler is pinned to 3.x because wrangler 4 needs Node 22. Ignore its "out-of-date" warning.
- **Who can log in is dashboard state, not code:** Zero Trust → Access controls → Policies. The
  include rule must use the **Emails** selector. "Emails ending in" takes a domain, and with a
  full address it matches nobody, so no code is ever sent. `ACCESS_TEAM_DOMAIN` and `ACCESS_AUD`
  in `wrangler.toml` must match the Access application, or every `/api/*` request is `401`.
