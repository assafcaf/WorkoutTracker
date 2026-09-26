# 0010. User Programs are one synced setting, and a new user starts with no Program

Date: 2026-09-26 · Status: accepted · Tracker: E9

## Context
The app shipped two bundled Programs and the trainee could only pick one. Training anything
else, or changing a Plan's sets, reps or rest, meant editing JSON and redeploying. The trainee
wanted to build Programs in the app and edit the bundled ones. A new user was dropped straight
into `assaf-ab-2026`, a program named after one person.

## Decision
- **Storage.** User Programs live in one `settings` row, `userPrograms: UserProgram[]`
  (`UserProgram = Program & { createdAt }`), synced as one of E7's settings, last write wins,
  and carried by backups. `mergePrograms(bundled, user)` puts a user copy in place of the
  bundled Program with the same id, then appends user Programs by creation.
- **Editing a bundled Program** stores a user copy under the same id. `Reset to original`
  removes it.
- **Delete hides** (`hidden: true`) rather than erasing, so Sessions still resolve their
  Program and Workout names. `visiblePrograms` drops hidden ones from every displayed list. The
  active Program and the Workout tab resolve against the full merged list.
- **Validation** is one pure function, `validateProgram(program, resolve)`, returning one
  `{ path, message }` per fault. The editor shows each fault beside its field and disables Save
  while any remain.
- **A Plan may carry `startWeightKg`**, which presets Set 1 when there is no history.
- **The in-progress guard blocks only deletions**: deleting the Program or Workout of the
  Session in progress is refused with `Finish the workout in progress first`. Editing numbers
  mid-Session is allowed.
- **New user.** With no stored `activeProgramId` and no Session, there is no active Program.
  The Workout tab shows `No program yet`, and the Program tab offers `A/B Split` (the renamed
  `assaf-ab-2026`; the id stays) and `New program`. `full-body-starter` is hidden. A device
  with Sessions but no stored id adopts the latest Session's Program.

## Alternatives rejected
- A `programs` table with per-row sync: schema and protocol work for a conflict that one
  trainee editing a small list does not have.
- Editing the bundle: lost on the next deploy.
- Copy-only for bundled Programs: the trainee asked to edit them.
- Erasing on delete: History and Stats need the names.
- Per-set defaults: presets from the last Session carry a ramp forward after the first workout.

## Consequences
Programs are data the trainee owns, and they travel with sync and backups for free. Two devices
editing Programs at once lose the older save. A hidden Program can still be the active one if a
Session points at it; only lists hide it. Every consumer of Programs has to choose between the
merged list (resolving) and the visible list (offering).

## Outcome
Built in E9 as ten tasks plus seven fixes from a browser check. PR: see the E9 pull request.

- T1 `2de91c8` Programs as data (`mergePrograms`, `visiblePrograms`, `validateProgram`, types)
- T3 `eb8f295` Program tab actions: New program, Edit, Copy, Delete, Reset, inline Confirm
- T4 `a7547ec` a Plan's `startWeightKg` presets Set 1
- T7 `fc930ba` the Program editor
- T5 `fd8495c` storage, sync and backup of `userPrograms`
- T8 `63a7b1e` faults beside fields, Save disabled while any remain
- T2 `13db695` a new user starts with no Program
- T6 `3dfdf3d` `A/B Split` is the one preset, `full-body-starter` hidden
- T9 `a1a1a21` create, copy and edit Programs end to end
- T10 `fa0055e` delete and reset, guarded by the Session in progress
- Fixes from the browser check: `cba72cb` the editor opens at the top; `435fed8` Copy is
  headed `Copy program`; `f414c4b` a disabled Save looks disabled; `c631fbf` each Program's
  actions sit on its card at the top of the Program tab; `2586ce2` the Add exercise search box
  keeps one line; `fc56e2c` the refusal message is announced and moves no button; `e8244d2` the
  new-user chooser uses cards and primary buttons.

Departures from the spec:
- **The active Program resolves against the full list, not `visiblePrograms`.** The tickets
  said to filter it. Filtering would strand a trainee whose Session is on a now-hidden Program
  (`full-body-starter`), so only offering lists filter.
- **The Program tab's actions moved** from a list at the bottom, below every muscle map, onto
  each Program's card at the top. The browser check found them hard to find. Not in the spec.
- **The Program editor's validation made four of T7's tests invalid.** Those tests saved an
  unnamed, empty Workout. T8's red commit gave them valid setup rather than narrowing O16.
- **O18 (building and training on the iPhone)** was run by the operator on the deployed epic
  head; the result is recorded in the PR.
