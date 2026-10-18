# 0019. A versioned contract shared by the phone and the Worker, and a Worker in layers

Date: 2026-10-18 · Status: accepted · Tracker: E20 · Extends: 0007, 0011

## Context
Roadmap R0b (`docs/roadmap/roadmap.md`): nothing was versioned between the phone and the Worker,
the Worker checked only a Session's `id` and `updatedAt`, and `src/worker/sync.ts` mixed HTTP
handlers, request checks and SQL with a circular import into `index.ts`. The operator waived
`/spec` and `/tickets`; the scope was `.work/specs/2026-10-18-contract-and-worker.md`.

## Decision
- One shared module, `src/contract/`, holds the contract version (`CONTRACT_VERSION` = 2), the
  wire types, the request and response checks and `HttpError` (`src/contract/errors.ts`). It
  imports only itself and `src/types.ts`; the lint enforces it. `src/sync/protocol.ts` re-exports it.
- Every phone request carries `X-Contract-Version`. The Worker serves v1..v2; a request without
  the header is v1, so the Worker can be deployed before every installed phone updates. Any other
  value, or one that isn't a plain positive integer, gets `426` with `{ error, supported }` before
  any D1 read. Authentication runs first, so an unauthenticated request stays `401`.
- The Worker checks every required Session field and never the optional ones, so an additive
  field needs no version bump. The phone checks the Worker's answers with the same module before
  writing anything; a malformed `200` writes nothing.
- On `426` the phone stops syncing, writes nothing and shows "Update the app to keep syncing." in
  Settings and a failed sync line on Train; logging keeps working, and Sets logged meanwhile push
  on the next `200`.
- The Worker is layered routes → handlers → services → D1 repositories, with no import cycle; only
  repositories run SQL.

## Consequences
- A breaking wire change bumps `CONTRACT_VERSION` and the supported range together.
- After merge to `main` (which deploys), the operator checks: `curl /api/me` answers `302`; a
  signed-in request with header `2` answers `200` and with `9` answers `426`.

## Outcome
Built as E20 (5 tickets, all merged on `epic/E20-contract-and-worker`, stacked on E19; evidence in
`.work/runs/E20/`). The Worker refactor's red proof was its structure and contract-check outcomes,
since the characterization suite passes before and after the split by design. No `cloudflare`
ticket ran; the deployed check is the operator's step above.
