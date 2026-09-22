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
| Tests | `test-designer` | `sonnet` | Its own worktree. Writes the failing tests and stubs |
| Code | `code-writer` | `sonnet` | Its own worktree. Cherry-picks the red commit; may not change tests |

Use `opus` for a task labelled `complex`, and for the retry of a task that failed a gate.

## Tracker updates during a run

So progress is visible without reading the terminal:

| When | Task | Comment |
|---|---|---|
| Wave starts | → doing | run id and epic branch |
| Red proven | — | red sha, outcome → test mapping |
| Merged and gates green | → done | merge and red shas, commands and results, files outside the ticket's list |
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
| `<tag>` | `<what needs it>` | `<command that runs a test there, and how to check it's free>` |

## Execution

- **Branches:** epic branch `epic/<EPIC>-<slug>` (e.g. `epic/E1-log-a-workout`), in worktree
  `.claude/worktrees/<EPIC>`. `.claude/settings.json` must set `worktree.baseRef: head`, so
  implementer worktrees branch from the epic branch.
- **Parallelism:** at most `3` implementers at once.
- **Final review:** `off`. Set to a `/code-review` level (`low`, `medium`, …) to run one
  review over the finished epic branch before the PR.
- **Publishing:** this repo has no `origin` and no GitHub remote. Pushes and `gh pr create`
  are skipped; the epic branch stays local and the run ends at the last merge instead of a
  draft PR. Add a remote and restore the push/PR steps when there is one.
