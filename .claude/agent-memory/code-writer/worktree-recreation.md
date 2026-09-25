---
name: worktree-recreation
description: my dispatched worktree directory can vanish mid-task while its branch survives; recreate it and rerun setup
metadata:
  type: feedback
---

Between early-start (`PREPARED`) and the `RED <sha>` resume, the harness can delete my
worktree's directory (environment update silently repoints "Primary working directory" to the
epic worktree instead). The branch `worktree-agent-<id>` still exists at the last commit — run
`git worktree add <path> worktree-agent-<id>` to recreate it, then `npm ci` again (a bare
`git worktree add` leaves `node_modules` empty/stale, which makes unrelated suites — e.g.
`src/worker/*.test.ts` needing `jose` — fail to load and looks like a real regression).

Why: worktree cleanup elsewhere in the harness isn't scoped to only finished agents.
How to apply: if a dispatch's working directory doesn't match the one from setup, `git branch`
in the repo root for `worktree-agent-<my-id>` before assuming work was lost, and always `npm ci`
after any worktree recreation, before trusting a full-suite red.
