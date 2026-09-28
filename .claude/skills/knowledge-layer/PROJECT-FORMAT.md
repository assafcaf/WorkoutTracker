# project.md format

`.claude/workflow/project.md`, committed. The map of the repo: its structure, its design, and
the nuances that take reading many files to piece together. Compact enough that an agent reads
it instead of scanning the code to orient itself. Not a changelog, a spec or a status report.

`config.md` holds the settings a run executes. This file holds the things a run would otherwise
get wrong.

## Shape

```markdown
# <Project>: working notes

Mode: on   ·   Last scanned: <yyyy-mm-dd>

## What this repo is
<Two or three sentences. What it is for, who uses it, what it is not.>

## Module map
| Path | Owns |
|---|---|
| `src/ordering/` | Order intake and the state machine from submitted to fulfilled |
| `src/billing/` | Invoice generation and dunning |

## Commands
The gates live in `config.md`'s Commands table. Only what that table cannot say goes here.
- `src/ml/` tests need the fixtures built first: `make fixtures`

## Invariants
- Every write to the ledger goes through `append()`. Direct writes bypass the checksum.

## Standing overlaps
Files that most tasks touch, so `/tickets` and `task-planner` watch them for real conflicts and
put shared wiring in them into one task. Touching one is not by itself a blocking edge.
| Path | Recent commits touching it |
|---|---|
| `db/schema.sql` | 19 of the last 40 |

## Pitfalls
- The dev server caches the schema at boot. A migration needs a restart, not a reload.
```

## Sections, and who writes each

| Section | Written by | Carries |
|---|---|---|
| What this repo is | operator | purpose, users, non-goals |
| Module map | scanner | one row per module, each with a path |
| Commands | scanner | only what `config.md`'s table cannot express |
| Invariants | operator | what must hold, and breaks quietly when it does not |
| Standing overlaps | scanner | path plus the commit count that earned it |
| Pitfalls | operator | what a new contributor gets wrong here |

**The operator's three sections may not be written by an agent.** A context file written by a
model measured worse than no file at all (arXiv 2602.11988: -0.5% on SWE-bench Lite, -2% on
AGENTbench); one written by the repo's own developers measured +4%. An invariant is exactly the
kind of claim a model writes fluently and wrongly, and a wrong invariant is obeyed rather than
ignored: the same study found agents follow context files faithfully, reading and testing more,
without succeeding more.

The scanner's three sections are safe to generate because every row carries a path that either
resolves or fails the gate.

## Rules

- **The inference test.** Before a line goes in: could an agent learn this from the path, or
  from the one file it would open anyway? If yes, cut it. "The tests are in `tests/`" is not
  knowledge. What takes several files to piece together — how parts connect, where a rule is
  enforced, which of two similar things to use — is exactly what belongs.
- **The repo as it is.** No history, no epic or task names, nothing in progress. A line should
  stay true until the code it describes changes.
- **Never duplicate `config.md`.** The Commands section cross-references it. Two copies of a
  test command drift, and the copy an agent happens to read is the one that breaks the run.
- **No decisions.** `docs/decisions/` owns those. Link, do not restate.
- **Name the cost.** A pitfall that does not say what goes wrong is a rule nobody can apply.

## Ceiling

About 2,500 tokens, estimated as bytes / 4. `bin/knowledge-paths.sh` fails the file above it.
Tokens, not lines: the cost is what every task pays to read the file, however it wraps. A row
says what the path owns in one clause; anything the path or the code already says is cut.

The cost of exceeding it is measured rather than aesthetic: context files add over 20% to
inference cost per task (arXiv 2602.11988), charged on every task whether the file earned it or
not.

## Growing it

Add a line when an agent got something wrong that this file would have prevented. Delete a line
when the convention changes. `/batch-implement` runs `/knowledge-layer refresh` at the end of an
epic for exactly this: it adds a term two tasks used that the glossary lacks and a file every
task touched that is not a standing overlap, and puts a blocker whose answer was already an
invariant in the PR body for you.

That loop is the part with evidence behind it. Guidance tuned against observed agent failures
outperforms one-shot generation (arXiv 2606.20512); a file that is written once and never
corrected is the arm that measured negative.
