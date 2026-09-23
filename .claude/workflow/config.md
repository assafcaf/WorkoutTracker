# Workflow config

Read by `/spec`, `/tickets`, `/batch-implement` and the agents in `.claude/agents/`. Everything
specific to this repository lives here, so the skills and agents stay project-agnostic. The
installer wrote this from your answers; `/setup-workflow` fills in what it can discover
(statuses, transition ids, the commands that actually run here) and checks the rest. After
that it is yours: edit it when the project changes.

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
| Lint | `npx tsc --noEmit && npx eslint .` |
| Red means | exit code `1`: tests ran and at least one failed. A suite that failed to import, or a path matching no test files, exits `2` and does not count |
| Test paths | `src/`, tests colocated with the code as `*.test.ts` / `*.test.tsx` |
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

> **Not yet runnable.** There is no `package.json` in this repo, so every command above fails
> today. E1's scaffolding task creates the project and must commit `package.json` *and*
> `package-lock.json` in its red commit — `verify-red.sh` installs in a throwaway worktree at
> that commit, so without the lockfile the red check cannot run. The scaffolding task is done
> when the full-suite command above exits 0 here.

## Serial resources

Outcomes tagged with a resource run one task at a time, by the orchestrator, after merge. Use
this for anything the host can't provide or can't share: a GPU machine, a device, a staging
database. None are configured.

| Tag | Meaning | How to run |
|---|---|---|
| `iphone` | The trainee's iPhone, with the app installed to the home screen. Needed for outcomes about installing, launching standalone, and cold-starting with no network — no emulator reproduces iOS's behaviour here | Not a command. The orchestrator posts the steps and the expected result, the operator performs them on the phone at the merged commit, and pastes what happened into the run log. The resource is free when the operator says so |

## Execution

- **Branches:** epic branch `epic/<EPIC>-<slug>` (e.g. `epic/E1-log-a-workout`), in worktree
  `.claude/worktrees/<EPIC>`. `.claude/settings.json` must set `worktree.baseRef: head`, so
  implementer worktrees branch from the epic branch.
- **Parallelism:** at most `5` tasks (ticket owners) at once. Raised from 3 on 2026-09-23: E5 ran at 5 on the operator's ruling.
- **Final review:** `off`. Set to a `/code-review` level (`low`, `medium`, …) to run one
  review over the finished epic branch before the PR.
- **Publishing:** `origin` is https://github.com/assafcaf/WorkoutTracker (public), added
  2026-09-22 after E1's last merge. The merger pushes the epic branch after each merge, so
  tracker comments cite fetchable commits; open a draft PR against `main` as the skill describes. E1 ran before the remote existed, so its push and PR happened after the
  fact; from E2 on they are part of the run.
