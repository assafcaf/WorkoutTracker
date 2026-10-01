# Workflow config

Read by `/spec`, `/tickets`, `/batch-implement` and the agents in `.claude/agents/`. Everything
specific to this repository lives here, so the skills and agents stay project-agnostic. The
installer wrote this from your answers; `/setup-workflow` fills in what it can discover
(statuses, transition ids, the commands that actually run here) and checks the rest. After
that it is yours: edit it when the project changes.

PAD version: 0.2.0

## Tracker

- **Adapter:** `local`. Operations are in `.claude/workflow/trackers/local.md`; the
  alternatives are `jira`, `github` and `local`.
- **Location:** Markdown under `.work/tickets/`, gitignored. Epic `E<n>`, task `E<n>-T<m>`.
  Nothing to authenticate and no connection to check.
- **Statuses:** the `status:` field in each ticket's frontmatter, one of `todo`, `doing`,
  `review`, `done`. There are no transition ids — the adapter edits the field. A task that
  passes the definition of done moves to done; the epic moves to review when its PR opens.
- **Blocking link:** `blocked_by:` in the task's frontmatter.
- **Label for agent-created tickets:** `agent-planned`.

## Agents

Roles are agents in `.claude/agents/`, so each carries its own tools. Change a model here, not
in the agent file.

| Role | Agent | Model | Notes |
|---|---|---|---|
| Tracker | `tracker` | `haiku` | The only agent with tracker tools. Every ticket read and write goes through it |
| Planning | `task-planner` | `sonnet` | Read-only. Runs once per `/batch-implement` run |
| Task ownership | `ticket-owner` | `sonnet` | One per task. Runs the task's test-designer and code-writer, proves red, gates the branch, moves the ticket |
| Merging | `epic-merger` | `sonnet` | One per run. The epic branch's only writer: re-checks, merges one task at a time, gates, pushes |
| Tests | `test-designer` | `sonnet` | Its own worktree, dispatched by the ticket owner. Writes the failing tests and stubs |
| Code | `code-writer` | `sonnet` | Its own worktree, dispatched by the ticket owner. Cherry-picks the red commit; may not change tests |
| Memory curation | `memory-curator` | `sonnet` | Once per epic, at the end. Keeps the agents' memory clean; never adds a lesson |

### Tiers

`/tickets` gives every task a tier (`.claude/workflow/ticket-template.md`, "Tiers"). The tier
picks the flow and the models; the Tests and Code rows above are the `standard` defaults.

| Tier | Flow | Test-designer | Code-writer | Retry |
|---|---|---|---|---|
| `small` | one `code-writer` in solo mode: red commit, then green | — | `sonnet` | `opus`, standard flow |
| `standard` | `test-designer`, with a `code-writer` started alongside that implements once red is proven | `sonnet` | `sonnet` | `opus` code-writer |
| `complex` | as standard, wider reading brief | `opus` | `opus` | `opus` code-writer |

A ticket with no `## Tier` section is `standard`; one labelled `complex` is `complex`.

**Thinking effort** is set in an agent file's `effort:` field, and a dispatch can't override it,
so it can't follow a task's tier. The coordinators, whose work is the same in every task, have
one: `ticket-owner` `medium` (it makes the occasional ruling), `epic-merger` `low`. The test
and code agents inherit the session's effort; their tier brief ("Effort by tier") is what
scales their reading and thinking.

**Memory.** `test-designer`, `code-writer`, `ticket-owner`, `epic-merger` and `tracker` have
`memory: project`: each keeps lessons in `.claude/agent-memory/<agent>/MEMORY.md`, committed and
loaded on every start. The rules are in `.claude/workflow/agent-memory.md`, and
`memory-curator` enforces them at the end of each epic.

## Tracker updates during a run

So progress is visible without reading the terminal:

| When | Task | Comment |
|---|---|---|
| Wave starts | → doing | run id and epic branch |
| Red proven (standard, complex) | — | red sha, test count and files. A small task puts it in the done comment |
| Merged and gates green | → done | at most five lines: merge and red shas, red and green commands with results, files outside the ticket's list. The full evidence is in `.work/runs/<run id>/<KEY>.md` |
| Gate failed or blocked | stays doing | what failed, and what is needed |
| Epic finished | epic → review | PR URL |

## Paths

| What | Where | Committed |
|---|---|---|
| Working specs | `.work/specs/<yyyy-mm-dd>-<slug>.md` | no |
| Plans (task bodies + tracker keys) | `.work/plans/<slug>.md` | no |
| Run logs for `/batch-implement` | `.work/runs/<run-id>/progress.md` | no |
| Development record | `docs/decisions/NNNN-<slug>.md` | yes |
| Promoted specs | `docs/specs/<slug>.md` | yes, only when the operator says so |

`spec_commit: ask`. After a spec is approved, ask once whether to promote it. Default: no.

The status line reads `.work/tickets/` directly on the `local` adapter, so nothing here writes
`.work/progress.json`. That file is for the `jira` and `github` adapters, where counting the
epic means an API call the status line can't make.

## Project knowledge

Mode: on

| Reader | Reads |
|---|---|
| `/spec` | `CONTEXT.md`, so outcomes are written in this project's terms |
| `/tickets` | `project.md` Module map, for each task's Files and Interfaces |
| `task-planner` | `project.md` Module map and Standing overlaps, before computing waves |
| `test-designer` | `CONTEXT.md`, so test names use the project's words |
| `code-writer` | `CONTEXT.md`, plus `project.md` Invariants and Pitfalls |

Nothing else reads them. A reader not in this table is a reader paying for context it was not
given a use for.

Enabled 2026-09-23 from a scan plus the committed decision records, without an operator grill.
Every line in both files is either transcribed from `docs/decisions/` with the record cited, or
carries a path a scanner checked. `project.md`'s Unsettled section holds what the scan found
and nobody has ruled on yet. Run `/knowledge-layer refresh` to re-scan.

## Commands

The stack is React + TypeScript + Vite + Vitest (decided 2026-09-22; see
`docs/decisions/0002-pwa-local-first-workout-tracker.md`). The installer's Python defaults are
gone.

| Gate | Command |
|---|---|
| Setup in a fresh worktree | `npm ci` |
| Run named tests | `bash .claude/workflow/bin/vitest-gate.sh {tests}` (`{tests}` = space-separated test file paths) |
| Full suite | `bash .claude/workflow/bin/vitest-gate.sh` |
| Typecheck | `npx tsc --noEmit` |
| Lint | `npx eslint .` |
| Dependency directory | `node_modules` |
| Lockfile | `package-lock.json` |
| Red means | exit code `1`: tests ran and at least one failed. A suite that failed to import, or a path matching no test files, exits `2` and does not count |
| Test paths | `src/**/*.test.ts src/**/*.test.tsx` — tests colocated with the code. Pass these globs as `--test-paths`: a bare `src/` is read as a prefix, so every product file under `src/` counts as a changed test and `task-submit.sh` rejects every task (E13, 2026-09-30) |
| Weakened tests | `bash .claude/workflow/bin/weakened-tests.sh <base> <head>`, with the two env vars below exported first |

**Why `vitest-gate.sh` and not `npx vitest run` directly.** The red gate rests on telling "the
test ran and failed" apart from "the test never ran". pytest splits these across exit codes 1
and 2; vitest returns 1 for both, so a task whose test file fails to import would certify as
red without a single assertion executing. `vitest-gate.sh` wraps vitest and restores pytest's
codes — 0 passed, 1 genuinely red, 2 nothing ran. Verified 2026-09-22 against all four cases
(pass, real failure, import error, no files matched).

**Weakened-test patterns.** `weakened-tests.sh` defaults to pytest syntax and finds nothing in
a TypeScript diff. Export these first (verified 2026-09-22 to catch an added `it.skip` and a
deleted test; the "a moved test is fine" path is untested here):

```sh
export TEST_DEF="[[:space:]]*(it|test)\(['\"]([^'\"]+)"
export WEAK_ADDED="((it|test|describe)\.(skip|todo|only|fails)|xit\(|xdescribe\(|TODO)"
```

`.only` counts as weakening: it silences every other test in the file, which would let a red
gate pass on a suite that never ran. Test names must be plain quoted strings, not template
literals, or `TEST_DEF` cannot see them.

## Git moves

The git commands the workflow's agents run, one per capability, each in the form this repo's
settings allow. `bash .claude/workflow/bin/check-moves.sh` proves every row against the
effective settings (`~/.claude/settings.json`, `.claude/settings.json`,
`.claude/settings.local.json`): a command must match an allow rule and no deny rule, since one
that matches neither would stop the run on a prompt. A failing row prints the allow rule to add.
`<sha>`, `<branch>` and `<path>` stand for any value.

This repo denies `git checkout`, `git switch`, `git stash` and `git reset --hard`, so four rows
differ from PAD's defaults. A fresh agent worktree starts at an ancestor of the epic head, so
`merge --ff-only` reaches the same commit `reset --hard` would (E9, 2026-09-26).

| Capability | Command |
|---|---|
| `branch-from-epic-head` | `git worktree add -b <branch> <path> <sha>` |
| `move-onto-sha` | `git merge --ff-only <sha>` |
| `take-red` | `git merge --ff-only <sha>` |
| `rebase-red` | `git rebase <sha>` |
| `discard-changes` | `git restore -- <path>` |
| `set-aside-work` | `git commit -a -m <message>` |
| `try-merge` | `git merge --no-ff --no-commit <branch>` |
| `abort-merge` | `git merge --abort` |
| `commit-merge` | `git commit --no-edit` |
| `revert-merge` | `git revert -m 1 <sha>` |
| `push-epic` | `git push origin <branch>` |
| `remove-worktree` | `git worktree remove <path>` |
| `delete-merged-branch` | `git branch -d <branch>` |

## Serial resources

Outcomes tagged with a resource run one task at a time, by the orchestrator, after merge. Use
this for anything the host can't provide or can't share: a GPU machine, a device, a staging
database. None are configured.

Each resource has a class. `automated`: the orchestrator runs the command and reads the result
itself. `operator-run`: only a person can run it (a real session, a device); the orchestrator
does not run it but writes a review packet for the operator, and the outcome waits on that.

| Tag | Class | Meaning | How to run |
|---|---|---|---|
| `iphone` | `operator-run` | The trainee's iPhone, with the app installed to the home screen. Needed for outcomes about installing, launching standalone, and cold-starting with no network — no emulator reproduces iOS's behaviour here | Not a command. The orchestrator posts the steps and the expected result, the operator performs them on the phone at the merged commit, and pastes what happened into the run log. The resource is free when the operator says so |
| `cloudflare` | `automated` | The operator's Cloudflare account: the deployed Worker, its D1 database and the Access application in front of it. Needed for outcomes about the real login, the real database and the deployed URL | The orchestrator runs `npx wrangler deploy` / `npx wrangler d1 ...` from the merged commit (wrangler is logged in on this host) and checks the deployed URL; steps that need a browser sign-in or the phone are posted to the operator, who pastes the result into the run log |

## Surfaces

The places where the product is seen or used, from a scan on 2026-09-30. `bin/preview.sh` runs
the `web-ui` preview from the epic worktree during a run, so each merge shows up live at
http://127.0.0.1:5173 (the local app of E10; see `CLAUDE.md`, "A local app during a batch
run"). After a lockfile change, run `npm ci` in the epic worktree before the restart.

| Surface | Entry point | Test drives it by | Person looks by | Automated check | Preview start | Ready when | Restart when changed | Cannot show |
|---|---|---|---|---|---|---|---|---|
| `web-ui` | `src/main.tsx` | vitest + jsdom + Testing Library (`src/**/*.test.tsx`) | opening http://127.0.0.1:5173 | `npm run build` | `npx vite --port 5173 --strictPort --host 127.0.0.1` | `curl -sf -o /dev/null http://127.0.0.1:5173/` | `package.json, package-lock.json, vite.config.ts` | `/api/*` (sign-in, cloud sync) and the service worker: dev mode serves the app only |
| `api-worker` | `src/worker/index.ts` | vitest, D1 faked with sql.js (`src/worker/*.test.ts`) | `npm run worker:dev` after `npm run build`, or the deployed https://workout-tracker.assafcaf.workers.dev | | | | | the real Access login: only the deployed Worker has it (`cloudflare` resource) |
| `installed-pwa` | `src/pwa/registerSW.ts` | jsdom unit tests of the manifest, precache and offline paths (`src/pwa/*.test.ts`) | installing the deployed app on the iPhone (`iphone` resource) | | | | | install and offline cold launch anywhere but a real device on the deployed origin |

## Review

- **Cadence:** `after-first-wave`. When the operator reviews the running product. Options:
  `after-first-wave` (once, after the first wave merges), `per-wave` (after every wave),
  `end-only` (once, before the PR), `none`.

## Execution

- **Branches:** epic branch `epic/<EPIC>-<slug>` (e.g. `epic/E1-log-a-workout`), in worktree
  `.claude/worktrees/<EPIC>`. `.claude/settings.json` must set `worktree.baseRef: head`, so
  implementer worktrees branch from the epic branch.
- **Mode:** `owner`. How `/batch-implement` runs a task: `owner` (ticket-owner agents) or
  `workflow` (the Workflow tool). `--mode` overrides it for one run. The Workflow tool is
  available here; owner stays the default until a `--mode workflow` run proves it (2026-09-30).
- **Parallelism:** at most `5` tasks (ticket owners) at once. Raised from 3 on 2026-09-23: E5 ran at 5 on the operator's ruling.
- **Suite slots:** `3` — at most this many full-suite runs at once, through `bin/suite-slot.sh`;
  a waiting merge gate goes first. `PAD_SUITE_SLOTS` overrides it. The 2026-09-30 load probe ran
  3 at once with no failures (~137s each, 88s alone).
- **Final review:** `off`. Set to a `/code-review` level (`low`, `medium`, …) to run one
  review over the finished epic branch before the PR.
- **Publishing:** `origin` is https://github.com/assafcaf/WorkoutTracker (public), added
  2026-09-22 after E1's last merge. The merger pushes the epic branch after each merge, so
  tracker comments cite fetchable commits; open a draft PR against `main` as the skill describes. E1 ran before the remote existed, so its push and PR happened after the
  fact; from E2 on they are part of the run.
