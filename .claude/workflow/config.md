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

> **UNRESOLVED — the defaults below do not run here.** `/setup-workflow` ran each on
> 2026-09-22 against an empty repo: `python -m pytest -q` exits 1 with "No module named
> pytest", and `pip install -e .` fails with no `pyproject.toml`. The stack is undecided.
> Replace this table before the first `/batch-implement`, or every gate fails.

Replace these with the commands that work in this repo; `/setup-workflow` runs each one and
reports what fails. The defaults assume Python with pytest.

| Gate | Command |
|---|---|
| Setup in a fresh worktree | `pip install -e .` |
| Run named tests | `python -m pytest -q {tests}` (`{tests}` = space-separated node ids) |
| Full suite | `python -m pytest -q` |
| Lint | `true` (none configured) |
| Red means | exit code `1`: tests collected, ran, and failed. Collection errors (exit `2`) do not count |
| Test paths | `tests/` |
| Weakened tests | `bash .claude/workflow/bin/weakened-tests.sh <base> <head>` (pytest patterns by default; set `WEAK_ADDED` and `TEST_DEF` for another stack — see the script's header) |

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
