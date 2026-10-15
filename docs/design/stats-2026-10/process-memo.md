# Process memo: the 2026-10 stats research run

The second run of the research shape first logged in
`docs/design/redesign-2026-10/research-process-memo.md`. This memo records what the skill rules
from that run changed here, and what this run teaches. Tags: **Good**, **Bad**, **Skill rule**.

## The task as given
"please similar to the research we did regarding the ui/ux ... do a similar research for stats
displaying." Before dispatch, four framing questions (scope layers, deliverable, freedom,
checkpoint) were asked in one round. Answers: all four layers; research + 3–4 mocks; anything
goes; no checkpoint.

## Skill rules from run 1, applied
| Rule from run 1 | Applied how |
|---|---|
| Restate scope as layers and confirm before dispatch | One AskUserQuestion round. No mid-run redirect needed (so far) |
| Collect prior decisions and rejected options first | `frame.md` lists 0006, the warm-up rule, both rejected looks |
| Name all deliverables up front | `frame.md` "Deliverables" row, written before any dispatch |
| Headless render, not the browser extension | `render.sh` copied; the frame forbids the extension |
| Write files with the Write tool, not heredocs | in the frame's shared facts |
| Audit track gets the longest budget and makes the shared content | the auditor seeds a 16-week dataset (`research/dataset.json`) |
| Principles track yields the rubric | same; also told to keep it quality-only so 4 concepts can pass |
| Divergence axis per frame, not only for one screen | to apply in the brief |
| Independent reviewer + one cross-concept review | to apply in review |

## Log

### Phase 0: frame and recon
- **Good:** the task template from run 1 became `frame.md`, a file every worker reads first.
  Prompts shrink to the role-specific part; shared facts are written once.
- **Good:** a chart-craft skill (`dataviz`) was available in the session and is named in the
  frame as the craft baseline, with a runnable palette validator. **Skill rule:** in Phase 0, list
  the skills relevant to the domain and pass their paths to workers.

### Phase 1: research
- **Good (principles, first back):** domain science changed the answer, not just the styling.
  On this A/B, 8–15-rep program, e1RM is a secondary stat (noisy at high reps, needs ~6
  sessions per lift). Weekly sets zig-zag by calendar week, so volume needs 2- or 4-week windows.
  The headline stats are working-weight progress, sets per muscle against the plan, adherence and
  a stall list. Run 1's mocks all led with an e1RM line. **Skill rule:** for a data/stats domain,
  the principles track must include the domain's own science (here, training science), not only
  visualisation theory. Without it, the concepts converge on the market's defaults.
- **Good:** provenance is honest. The agent named what it did not re-check and what failed to
  load (Apple HIG, Material).
- **Good (market, 22 products):** this converged with principles without either track seeing
  the other: forward-looking views (sets against targets, a "your normal" band), honest
  sparse-data states, no e1RM from high-rep sets, and a stall called only after 3–4 weeks flat.
- **Bad (tooling):** reddit.com is refused by both WebSearch and WebFetch, so the planned
  "what lifters actually want" community source was replaced by forums and App Store reviews.
  **Skill rule:** in Phase 0, probe the key sources once (one fetch each) and tell the market
  track which ones are unreachable, so it plans substitutes instead of spending turns finding out.
- **Good (audit, again the most valuable track):** it built its own headless CDP driver from the
  repo's `ws` package, seeded 45 sessions straight into IndexedDB, rendered 40 screens in five
  data states, and cross-checked the app's maths with an independent Python re-implementation.
  It found *correctness* bugs, not taste: warm-ups counted in the region panel (breaks a roadmap
  invariant), Lats disagreeing between tabs, e1RM dropping on a PR day, a session-indexed time
  axis hiding missed weeks, a 9-week plateau shown as "+4.2 kg", and 446 PRs in 45 sessions. It
  also found that `Stats.tsx` is no longer mounted since the redesign.
  **Skill rule:** for a data-display audit, require an independent recomputation of the displayed
  numbers. Wrong numbers matter more than ugly charts, and only a recomputation finds them.
- **Bad:** the seed is an optimistic novice (nearly every lift climbs every week), which inflates
  PRs and under-tests stalls. **Skill rule:** the shared dataset should be specified with
  deliberate realism quotas (n stalls, a deload, a regression, a gap), not left to the auditor.

### Phase 2: synthesis (~18 min, 56 calls)
- **Good:** the per-frame divergence rule from run 1 worked at brief level. The four concepts
  differ in headline stat, IA, primary chart form, interaction and look: verdict-feed (written
  findings), lift-ledger (14 sparkline rows), training-week (the week as the unit, bullet
  graphs), progression-ladder (no Stats tab, stats at the lift).
- **Good:** the director made the shared data *executable*: `brief-data.py` → `brief-data.json`.
  It added the realism the audit lacked (a deload, a regression) and wrote exact rules for the
  must-fix truths (e1RM only from ≤10-rep sets, one record per lift per session: 446 → 201
  records; verdicts moving/stalled/slipping/too-new). **Skill rule:** when the subject is data,
  the shared content is a generated file from a script, and the makers read numbers from that
  file only.
- **Good:** 12 departures listed, including one that touches a decision record (a docked scrub
  readout against 0006). These are flagged for the operator, not decided silently.
- **Watch:** the frame list grew from 8 to 18 per concept. Mocks will take longer to build;
  reviewers need a sampling rule.

### Phase 3: making (4 in parallel)
- One template, varied by slug, craft reference and a risk warning tied to the nearest rejected
  look (training-week: dark, "never neon"; progression-ladder: scoreboard/gamified).
- Makers took ~25–30 min each, 110–150 tool calls: about 1.5× run 1, which matches the frame list
  growing from 8 to 18. All four scripted click-throughs on their own, and all ran the palette
  validator. The training-week maker reported a *failing* validator pair (ΔE 11.7 normal-vision)
  instead of hiding it.
- **Bad (minor):** one maker used a Python heredoc despite the frame forbidding it, and said so.
  `render.sh` needs an absolute output path (Chrome resolves relative paths elsewhere). Fix the
  script, or say so in the frame.

### Phase 4: review, pipelined; revisions pipelined too
- **Change from run 1:** a revision starts as soon as *its* review lands, instead of after all
  reviews. Brief conflicts a reviewer raises are ruled by the orchestrator once, and every
  ruling is written into every later revision prompt (rulings log below), so concepts don't get
  inconsistent rulings.
- **Rulings log:** (1) the no-colour-blocks warning beats an accent-filled current state;
  (2) one record vocabulary, the names in `brief-data.json`; (3) a drill-down destination keeps
  the lift's verdict visible; (4) range presets go below the chart, in thumb reach, ≥44 px;
  (5) no number on every point, so e1RM is shown at the latest and the scrubbed point only;
  (6) the landing's fold must carry lift progress, not only adherence; (7) whole numbers on
  landing rows, exact values in drill-downs; (8) warning colour only for real shortfalls against
  a window, never for work scheduled later in the week.
- progression-ladder review: self 24P/6 partial → independent 22P/8 partial/0F. Real catches:
  a false banner sentence ("never reach the target" when the data shows 45/45 and 47/45), and
  solid accent walls. **Skill rule:** when the stat display includes generated *sentences*, the
  reviewer must check each sentence against the data. Words lie more easily than charts.
- training-week review: self 21P/9 partial → 22P/7 partial/1F (≤2 taps to a session failed).
  It found 5 brief conflicts, and 4 of them were the *director's* rules colliding with the
  principles checklist. **Skill rule:** before makers start, the director (or a quick second
  agent) cross-checks the brief against the rubric item by item. Each conflict caught there is
  ruled once, instead of being rediscovered by each reviewer after a full making round.
- verdict-feed review: 25P/5 partial/0F, the best first-round result. Its brief conflicts gave
  rulings (9) numerals never in the serif, (10) the attention colour means attention only, never
  "the finding" on good news.
- progression-ladder revision (~7 min): all fixes in; 27P/3 partial on the re-self-check. It
  rejected one reviewer point with a principles citation (no line through 1–2 sessions). That
  evidence-based pushback is the behaviour the rule asks for.
- lift-ledger review: self 22P/8 partial/0F → 20P/7 partial/3F, the widest self-grade gap. The
  blocker was a *cross-element* honesty failure: each number was right on its own (40+ spot
  checks matched), but a "▲ +2 kg" change sat beside a "Stalled" verdict because the two used
  different windows. Ruling (11): a delta printed beside a verdict uses the verdict's own window.
  **Skill rule:** spot-checking numbers isn't enough for stats. The rubric needs an item like
  "no two adjacent elements contradict each other", checked by reading each row as a sentence.
- Rulings 12–16 (bottom control bar for a chart-less layout, a heat ramp distinct from the
  accent, no deltas before 4 sessions, sparkline size, the record names) were again brief-vs-rubric
  conflicts. In total, 16 rulings came out of 4 reviews, about 4 per concept. This confirms the
  pre-make cross-check rule above.

### Phase 4c: delta-reviews (run 1's "gap", closed)
- Delta-reviews resumed the *same reviewer* (context intact) and ran in ~3 min, against about
  10 for a full review.
- **Good, and the case for the delta-review:** training-week's revision fixed all 4 majors but
  introduced a new major. Rounding made the muscle rows stop adding up (`13 of 25 · adds 13`).
  The maker's own self-check missed it. **Skill rule:** after a revision, the delta-review must
  look for regressions, not only tick off the fix list. For stats, the regression check includes
  "do the displayed parts still sum to the displayed whole?"
- **Bad (orchestration):** rulings issued *while* a revision ran never reached that maker. Two
  delta-reviews then found rulings "not applied" that the maker had never been sent. It also
  caused a regression. Applying ruling 2's names mechanically put false record dates in
  progression-ladder's tables. **Skill rule:** keep the rulings in one file (`rulings.md`) that
  every maker re-reads before it finishes, rather than embedding them in each prompt. And any
  rename across data-bound text must be followed by a scripted check of the values against the
  source data.
- **Bad, and the pattern of this run:** every honesty defect found after round 1 was a
  *hard-coded string inside generated text* ("= 0" for every stalled lift, bench's date in the
  push-ups caption, "none in the 0 sessions since"). The numbers in charts and tables were
  always right because they were read from the data file; the sentences were typed by hand.
  **Skill rule:** in a data mock, every number or date inside copy is computed from the shared
  data, never typed. The maker's last step is a script that checks each sentence against the
  data for every entity, not only the one on the board.
- A regression found in the delta-review gets one small, scoped fix round with no re-review. The
  maker verifies the arithmetic with a script. This is the stop rule.
- **Operator interjection (mid-run):** "what takes so long? are you still in the research or
  trying to implement?" The orchestrator had not said how long the run would take or that no code
  was being written. **Skill rule:** at dispatch, give the operator the run's phases with rough
  durations (here ~2.5 h). Say plainly that nothing touches product code, and give a progress
  line at each phase boundary.

### Phase 5: cross-concept review and presentation
- One agent looked at all four together and built same-frame comparison strips
  (`reviews/_compare/`). It found what no single reviewer could: Lift Ledger and Progression
  Ladder are too similar a pair (same lift rows, same weight-over-reps chart), and the secondary
  frames (summary, sparse states, muscles) converged again, partly *because of* rulings that
  apply to every concept (ruling 13 pushed three concepts to the same bullet bar).
  **Skill rule:** shared rulings standardise. Mark each ruling as either a quality floor (all
  concepts) or a concept-specific fix, so a ruling doesn't erase divergence.
- **Bad (minor):** the cross-concept review ran before lift-ledger's delta-review and used its
  round-0 scores (46 against 54 after the revision). The gallery uses the latest scores. **Skill
  rule:** start the cross-concept review only after the last delta-review, or have it read scores
  from a single scoreboard file.
- The recommendation is a hybrid built on Verdict Feed, with Progression Ladder as runner-up. Its
  main risk is the lift-classification rules: every concept had a false sentence at some point.

## Totals (approximate)
- 4 research/synthesis dispatches (market, audit, principles, director), 4 makers, 4 reviewers,
  1 cross-concept reviewer = 13 agents. 4 + 4 + 4 resumptions (revision 1, delta-review,
  revision 2). Wall-clock ≈ 3 h; making (~25–40 min) and the audit (~20 min) dominated.
- 16 orchestrator rulings, about 4 per concept, almost all brief-vs-rubric conflicts.
- Self-grade vs independent first review: inflated by 1–3 Fails and 2–6 Partials per concept.
  After revision 2, all four are at 0 Fails.

## Changes for the skill, distilled from this run
1. Frame file before dispatch, from the template; probe the key sources once (Reddit was blocked).
2. For a data domain: the principles track includes the domain's science; the audit recomputes
   the displayed numbers; the shared dataset is *generated* by a script with realism quotas.
3. Cross-check the brief against the rubric before making, and rule on conflicts once.
4. Rulings live in one file the makers re-read; mark each one as a floor or concept-specific.
5. Every number in copy is computed; the maker's last step is a sentence-vs-data script.
6. Pipeline everything: review → revise → delta-review (regressions too) → one scoped fix round.
7. Tell the operator the phases and durations at dispatch, and that no product code changes.
