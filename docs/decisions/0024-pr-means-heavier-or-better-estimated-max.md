# 0024. A PR means heavier, or a better estimated max: one rule for every surface

Date: 2026-11-15 · Status: accepted · Tracker: UX iteration 6 (V5-06, wave 3) · Supersedes in part: 0017

## Context
Decision 0017 counted one record per lift per Session, first match wins: Heaviest weight (Least
assistance, First added load) > Rep record at a lever already lifted > Estimated 1RM. Every one
of those counted as a "PR". On the stats fixture that is 201 PRs in 45 Sessions, so nearly every
row of every lift's log carried a PR tag, and the tag stopped meaning anything (V5-06).

The v6 rebuild then grew a second rule. The Lift page tagged PRs with its own
`src/domain/stats/realRecord.ts`, which differed from `records.ts`: it estimated a max for every
loaded lift whatever its rep range, and it called more reps on a plain Bodyweight lift a record.
So a Session's "2 PRs" in Sessions did not match the PR tags on its lifts' pages.

## Decision
- **A PR is a new heaviest weight or a new best estimated max**, against every earlier Session
  of the lift:
  - heaviest weight: on an assisted lift, less assistance; on a Bodyweight lift, a first added
    Load;
  - estimated max: Epley, +0.5 kg, only for lifts that are not Bodyweight and whose Plan tops out
    at 10 reps or fewer, and only from sets of 10 reps or fewer (0017's e1RM rule, unchanged).
- **More reps at a weight already lifted is a rep best**, shown quietly and never counted or
  tagged as a PR. That includes more reps on a plain Bodyweight lift.
- **One implementation**: `asPr` / `isRealRecord` / `sessionPrs` / `liftPrs` in
  `src/domain/stats/records.ts`. The Sessions rows, the summary, the live strip, "PR if logged",
  the Rest beat, the week's count, and the Lift page's PR tags, chart record points, Records rows
  and status rules all read it. `realRecord.ts` is deleted.
- `computeRecords` still finds every Session best (0017's one-per-lift-per-Session order). The
  verdicts' "no record in the last 4" reads PRs through `liftPrs`.

## Alternatives rejected
- **Keep the Lift page's own rule**: two rules mean two counts for the same Session, which is
  the "one lift, four answers" problem (V6-02) again.
- **Estimate a max for every loaded lift**: Epley drifts above 10 reps, so a 12-rep curl day
  would read as a stronger max than a heavier 10-rep day.
- **Count plain Bodyweight rep bests as PRs**: they are the only measure such a lift has, but
  they come nearly every Session. They stay visible as rep bests and in Records ("Most reps in a
  set").

## Consequences
- The fixture now has 92 PRs in 45 Sessions instead of 201. Nothing stored changes.
- A plain Bodyweight lift (Push-ups) never shows a PR tag; its progress shows in Records and its
  status.
- A lift planned above 10 reps has no "Best est. max" row in Records. Its chart still offers the
  Est. max view.
