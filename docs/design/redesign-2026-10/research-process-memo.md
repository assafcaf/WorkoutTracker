# Research process memo: input for a future PAD deep-research skill

A running log of how the 2026-10 redesign research was orchestrated: what worked, what didn't,
and what a skill should encode. The orchestrator updates it as the run goes. Each entry is
tagged **Good**, **Bad** or **Skill rule** (a candidate rule for the skill).

## The task as given, and how to define it better

### As given (the operator's words, two messages)
1. "please research the web for gym related apps, learn their design language and suggest me
   couple of mocks for our system, as I suspect its look like a child did it, and not
   professional in any manner. ... utilize some deep research of multiple agents, one to rationale
   on design cues, other to explore the market, one that is professional design to create the
   mocks ... you are like a product manager that has a budget to hire any type of worker ... until
   at least 4 full mocks exist that you can show to me"
2. (mid-run) "its not only the colors, the full ui/ux, the components, their structure, the
   decision where to put and what to put, the interaction between the app and all of the above"

### What was clear and helped
- **The stopping condition is concrete:** "at least 4 full mocks that you can show me". It gives
  a countable end state.
- **The role framing** ("product manager with a budget to hire workers") gave explicit licence to
  fan out and to decide the team shape, so I didn't need to ask permission for each agent.
- **The suggested roles** (market / design rationale / designer) were a good seed, and "I
  probably missed some" invited me to add roles (auditor, director, reviewer).
- **A problem statement with a felt symptom** ("looks like a child did it") told me the quality
  bar and the failure to avoid.

### What was ambiguous and cost something
| Gap | What it cost | Better phrasing |
|---|---|---|
| Scope layer: "design language" read as visual only | a mid-run redirect of 3 agents | "Scope: full UX — IA, screen structure, components, flows, interaction, and visual" |
| "Full mock" undefined: static image? clickable? which screens? | I had to choose (clickable HTML + PNG board, 5 core screens) | "A mock = clickable prototype of screens X, Y, Z, plus a still of each" |
| How far from today: reskin vs rethink | the director has to guess how radical to be | "Freedom: keep features, IA may change" or "anything goes" |
| Constraints / non-negotiables | none given; I pulled them from memory (rejected looks) | "Must keep: … Must avoid: … (e.g. no dark neon)" |
| How the result is judged | I made the principles agent produce a rubric | "I'll judge by: legible mid-set, fewer taps, looks like Strong/Hevy-tier" |
| Inspiration / anti-inspiration | none | "I like app A's X, I hate app B's Y" — 2–3 references save a research round |
| Budget / time box | open | "Spend up to ~N agents / ~2 hours" (sets review-loop depth) |
| What comes after | unknown: pick one to implement? spec it? | "Next I'll pick one and run /spec on it" (shapes the deliverable) |
| Process deliverable | added later (this memo) | name all deliverables up front: mocks + memo + recommendation |

### A task template the skill could ask for (fill-in, ~2 minutes)
```
Goal / symptom:        what's wrong and what "good" looks like
Scope layers:          [visual] [components] [screen structure] [IA/nav] [flows/interaction] [copy]
Freedom:               reskin | restructure | rethink from zero
Deliverables:          N concepts × {clickable prototype, stills, rationale}; plus any reports
Screens/flows in scope: list
Constraints:           must keep / must avoid / previously rejected
References:            like (app + what) / dislike (app + what)
Judged by:             criteria or "use a researched rubric"
Budget:                agents / time / review rounds
Afterwards:            what the output feeds (spec, ticket, decision record)
Checkpoints:           where you want to be asked (e.g. approve the 4 concepts before mocks)
```

### What makes this kind of task go best for me (the orchestrator's view)
- **Name the output's form and the end state.** I can run many agents in parallel, but each one
  needs an exact file and format to produce; vague deliverables come back in mismatched shapes.
- **Give the "felt" judgement and real references.** I can research the market widely, but I
  can't see your taste. Two liked and two disliked examples anchor it better than adjectives
  ("mellow", "sporty"), which is how the pastel misfire happened last time.
- **Let me check my own output.** Visual work needs a render path (headless Chrome here) so the
  makers and the reviewers see pixels. Saying "I want to see it in the browser / on the phone"
  tells me which.
- **Pick checkpoints deliberately.** Without them I run end to end. That's fast, but one
  early concept review (for example, approving the 4 directions before any mock is built) costs
  you one message and can save a whole making round.
- **Separate decided from open.** "Keep features, rethink layout" is far more actionable than
  silence, which I have to infer from memory and code.

## Run shape (as it unfolds)

| Phase | Workers | Output |
|---|---|---|
| 0. Orchestrator recon | — (me) | read design memory, tokens, routes; found prior rejected directions |
| 1. Research (parallel) | market researcher, current-app auditor, design-principles theorist | `research/market.md`, `research/audit.md`, `research/principles.md` |
| 2. Synthesis | UX architect / design director | `brief.md`: four distinct concepts |
| 3. Making (parallel) | 4 designers, one concept each | `mocks/<concept>/index.html` + rendered PNG board |
| 4. Review loop | review panel, using the principles checklist | scores and revision notes → designers revise |
| 5. Presentation | orchestrator | side-by-side to the operator, with a recommendation |

## Log

### Phase 0: recon before dispatch
- **Good:** I read memory before writing any prompt. It showed the operator had rejected dark +
  neon-lime on 2026-09-26 and picked "Court", which they now call childish. Without that history
  every worker would have re-proposed one of the two rejected looks. Both rejected looks went
  into every prompt as constraints.
- **Skill rule:** Step 0 of any research skill is "collect prior decisions and rejected options"
  (memory, `docs/decisions/`, specs), and they go into every worker prompt as constraints.

### Phase 1: research dispatch
- **Good:** Three roles with different methods, not three copies of "go research": an external
  market scan, an internal audit of the current app, and a principles/theory track. Each writes
  to its own file, so nothing overlaps and the outputs are durable and citable.
- **Good:** Each prompt fixed the output path, the required sections, and a ≤300-word reply
  summary. The orchestrator's context stays small; the detail lives in the files.
- **Good:** The principles agent has to produce an acceptance checklist, which becomes the
  review rubric for Phase 4. Research produces its own evaluation instrument.
- **Bad:** I scoped the problem as visual ("design language") from the operator's first
  message. They meant full UI/UX: IA, structure, components, flows, interaction. I had to correct
  all three agents mid-flight by SendMessage. That works, but some early work was aimed at the
  narrow scope.
- **Skill rule:** Before dispatch, restate the research scope back as layers (visual / component
  / screen structure / IA / interaction & flow / content) and confirm which are in. One cheap
  question prevents a mid-run redirect.
- **Good:** Mid-run redirects through SendMessage worked without restarting the agents.
  **Skill rule:** the skill should name "redirect, don't restart" as the default for scope
  changes.

- **Good (principles track, ~4 min, 26 tool calls):** Returned a sourced report and a
  25-item yes/no checklist split into visual / gym-context / IA. It said where it could only reach
  secondary sources, which is honest provenance worth requiring in the skill.
- **Risk spotted:** The checklist is quite prescriptive ("exactly one accent", "radii ≤ 12px").
  Applied as a mandate, it would push all 4 concepts toward the same look. **Skill rule:** the
  rubric gates *quality*, and the brief separately requires *divergence*. The director must give
  each concept a different IA or interaction thesis, and the reviewer scores distinctness too.

- **Good (market track, ~6.5 min, 44 tool calls):** 19 products; it marked inferred vs sourced
  (no app publishes tokens; its hexes are from marketing sites). Its archetype framing (A–F)
  made the rejected looks legible: dark neon = "B", Court = "E without the discipline".
- **Good (audit track, ~12 min, 97 tool calls):** The most valuable report. It actually drove
  the app in Chrome and measured with getBoundingClientRect, and found *broken* components
  (a 16px-wide dial track clipping digits, a rest timer covering controls), not just taste
  issues. It reframed the problem: "the components were never designed", not "wrong colours".
  It also produced a shared content inventory (the real A/B program), so all mocks show the
  same data and can be compared.
- **Bad:** The Chrome extension kept dropping for the auditor; half the screens were audited
  from code only. **Skill rule:** prefer a headless render/screenshot path for audits too
  (a script that runs the dev server and screenshots routes), not the interactive extension.
- **Observation:** The three tracks converged on their own (one accent, neutral field, tabular
  numerals, a non-blocking rest timer, Undo over confirm, 1-tap log). Convergence across
  independent methods is a confidence signal the synthesis should report.
- **Skill rule:** Give the internal-audit track the longest budget. It finds facts nobody else
  can, and it produces the shared content for the makers.

### Phase 2: synthesis
- Dispatched one director with all three reports, told to write a brief that requires
  divergence in IA and interaction, shared real content, fixed frame list (S1–S7 + flow strip),
  a deliverable format (single self-contained HTML board + rationale) and a mandatory
  render-and-look self-check.
- **Decision:** no operator checkpoint between brief and mocks (the operator asked for
  autonomy up to 4 mocks). The memo template above suggests offering that checkpoint as an
  explicit option next time.

- **Result (~14 min):** 4 concepts that diverge on *structure*, not skin:
  1. Set Table: a 4-tab table logger, light, green thread.
  2. Single Set Focus: full-screen, one set at a time, dark graphite + muted apricot.
  3. Guided Session: no tabs, a coach-led step list, serif editorial.
  4. Progress Dashboard: data-first home, a set grid, indigo.

  Each concept carries tap counts for 4 core flows, so they can be compared on numbers.
- **Good:** The director made judgement calls (it fixed inconsistent sample dates, invented
  missing "previous" values so all mocks match, fixed board coordinates, darkened accents to
  pass 7:1) and *reported each departure*. **Skill rule:** require a "where I departed from
  the brief/research and why" section in every synthesis output.
- **Good:** The director found a tooling gap (`render.sh` can't take a query string, so no
  per-frame render) and routed around it (render the board, crop with Pillow) rather than
  blocking.

### Phase 3: making (4 designers in parallel)
- One prompt template, varied only by concept slug, a craft reference ("Strong/Hevy-level",
  "Whoop-level"…) and a concept-specific risk warning (the dark concept: "never neon"; the
  serif concept: "don't drift to cream/toy"). Each designer writes only inside its own
  `mocks/<slug>/`, so nothing conflicts in parallel. A mandatory ≥2-round render-look-fix loop.
- **Skill rule:** Put the operator's *rejected* options in the risk warning of the maker
  whose concept sits nearest them. That's where regression is likeliest.

- **Result so far:** Progress Dashboard (~20 min, 50 tool calls, 3 render rounds) and Single Set
  Focus (~21 min, 47 calls, 2 rounds plus 13 scripted click-test sequences). Both look like
  shipped products at first glance, a huge step from the current app. Both listed honest
  weaknesses (the keypad covers a stepper; cells under the 56px target; blocky body silhouette).
- **Bad / risk:** Both makers self-graded all 25 checklist items "Pass". Self-assessment is
  inflated even when the weakness list is honest. **Skill rule:** never accept a maker's own
  rubric score as evidence; an independent reviewer, with a different prompt and no stake,
  scores against the same rubric.
- **Good:** The orchestrator previewed each board itself (Pillow-downscaled to ~1600px, then
  Read) as it landed: a cheap sanity check that costs one image in context, not the files.

- **All 4 landed** (Set Table ~21 min/42 calls; Guided Session ~25 min/87 calls; the slowest
  made the most self-check calls).
- **Bad (homogenisation):** Viewed side by side, the 4 diverge where the brief demanded it
  (the logging model, nav, palette), but the secondary screens (History, Progress, Program)
  converged on nearly the same bar chart, e1RM line chart, records table and body-map card.
  Cause: one shared frame list, one shared dataset, and one research corpus recommending the
  same patterns. The brief demanded divergence only for the logging model. **Skill rule:** the
  brief should name the *divergence axis for every frame* (e.g. "History: concept 3 is a
  narrative journal, concept 4 a dense dashboard"), or explicitly accept convergence on frames
  where divergence isn't the point. Comparability (same data) is good; same layouts is not.
- **Good:** The orchestrator's own side-by-side look caught this. The per-concept reviewers
  each see only one concept and structurally cannot. **Skill rule:** add one cross-concept
  review step (one agent or the orchestrator viewing all boards together) for distinctness and
  for which ideas to steal between concepts.

### Phase 4: review, pipelined
- **Good:** Reviews start per concept as soon as its mock lands. Three reviewers launched while
  the 4th designer still builds, which saves wall-clock (a pipeline, not a barrier).
- Reviewer design: an independent persona, explicitly told the maker self-graded all-Pass;
  must crop and view every frame at full resolution, script a click-through, score 25 items
  with evidence, give 6 holistic 1–10 scores (incl. *distinctness*), and a ranked fix list
  (≤12, with severity). The fix list goes back to the *same* designer (resumed with context
  intact via SendMessage), not a new agent.
- **Bad (tooling):** A bash heredoc writing a shared reviewer-prompt file hung past the 120s
  timeout and wrote nothing (Git Bash on Windows). I inlined the prompt into each dispatch
  instead. **Skill rule:** write prompt templates with the Write tool, never a shell heredoc.

- **Review results (each ~5–8 min, 37–57 tool calls):**

  | Concept | Prof. | Gym | IA | Craft | Fidelity | Distinct | Checklist (self → independent) |
  |---|---|---|---|---|---|---|---|
  | Set Table | 8 | 7 | 8 | 7 | 8 | 5 | 24P → 15P / 8 partial / 1F |
  | Single Set Focus | 8 | 8 | 8 | 7 | 8 | 9 | 25P → 22P / 2 partial / 1F |
  | Guided Session | 7 | 6 | 8 | 6 | 8 | 8 | 24P → 17P / 6 partial / 1F |
  | Progress Dashboard | 8 | 6 | 7 | 7 | 7 | 8 | 24P → 17P / 5 partial / 2F |

- **Good, and the strongest case for independent review:** Self-grading inflated by 2–9
  checklist items per concept. The reviewers found things no maker reported: a whole missing
  feature (edit/delete/Undo absent in Progress Dashboard while its self-check claimed it), a
  wrong plate diagram, an exercise name scrolling off-screen during rest, a 7th type size, and
  the closest drift toward a *rejected* look (Guided Session's warm rest frames).
- **Good:** Reviewers scripted click-throughs (injected scripts into temp copies, rendered each
  step headless). Interaction is verified, not just pixels.
- **Good:** Reviewers flagged brief conflicts (e.g. "two equal primary targets are mandated by
  the brief, so raise it with the director") instead of silently trading one rule for another.
  **Skill rule:** reviewers separate "maker defect" from "spec conflict"; spec conflicts route
  to the orchestrator.
- **Good:** The distinctness score confirmed my cross-concept observation for the baseline
  concept (Set Table = 5). In each revision prompt I added a concept-specific divergence
  direction for the secondary screens (journal / table-log / dense analytics).
- **Revision mechanism:** I resumed each *original designer* with SendMessage (context intact)
  and the review path, plus my cross-concept notes, and asked for an honest re-self-check.
  Cheaper and more coherent than a fresh agent.

### Phase 4b: revisions
- All 4 designers revised in one round (~7–13 min each). Honest re-self-checks came back with
  partials named (e.g. 20P/4 partial), not all-Pass. Asking for "honest, Partial where partial"
  worked once a reviewer had already contradicted them.
- **Good:** Designers pushed back on bad reviewer advice with evidence (Single Set Focus kept
  `#F06065` because the suggested `#E5484D` was 3.94:1 on its surface). **Skill rule:** makers
  may reject a fix with measured evidence; they say so in the reply.
- **Gap:** No second review round. Revisions were verified only by the maker's self-check and
  my visual pass. With a bigger budget, a short delta-review (only the fixed items) would
  close the loop. **Skill rule:** stop rule = one full review, then a delta-review only of
  blockers/majors.

### Phase 5: presentation
- A gallery page (`index.html`) with a card per concept: a thumbnail, thesis, nav, logging,
  look, best-for, round-1 scores, and links to the prototype, rationale and review.

## Totals (approximate)
- 15 agent dispatches + 4 resumptions: 3 research, 1 director, 4 designers, 4 reviewers,
  4 revision resumptions. Wall-clock ≈ 2 h; the making phase (~25 min) and the reviews
  (~8 min) dominated.
- Deliverables: 3 research reports, 1 brief, 4 boards with clickable prototypes + rationales,
  4 reviews, 1 gallery, this memo.

## Candidate skill shape (distilled)
1. **Frame:** scope layers, deliverable form, constraints and rejected options, references,
   checkpoints (template above). Ask once if unclear.
2. **Recon:** prior decisions and memory; confirm the render/verification tooling.
3. **Research fan-out:** external market / internal audit (longest budget, drives the app) /
   principles that yield a rubric. Each writes a file and returns ≤300 words, with provenance.
4. **Synthesis:** one director, N concepts with a divergence axis *per frame*, shared real
   content, and departures reported.
5. **Optional checkpoint:** the operator approves the concepts.
6. **Make:** N parallel makers, isolated folders, a mandatory render-look-fix loop, a risk
   warning tied to rejected options.
7. **Review (pipelined):** an independent reviewer per artifact (pixels + scripted
   interaction + rubric with evidence + distinctness), plus one cross-artifact comparison.
   Maker defects vs spec conflicts.
8. **Revise:** resume the same maker; evidence-based pushback allowed; optional delta-review.
9. **Present:** a gallery + recommendation; the process memo updated throughout.

### Tooling
- **Good:** Before the making phase I checked that headless Chrome renders HTML to PNG
  (`render.sh`). Designers can look at their own output, and the reviewer judges pixels, not code.
- **Skill rule:** For any visual deliverable, confirm a render-to-image path in Phase 0 and pass
  it to the makers and reviewers. "The artifact can be seen by the checker" is a precondition.
- **Note:** Browser-extension tools are a single shared resource. Several parallel agents
  driving one Chrome would collide. Headless CLI rendering is parallel-safe.

## Open questions for the skill
- How many concepts by default? (The operator asked for at least 4.)
- Should the review panel be one agent or several lenses (visual / UX / gym-context)?
- Stop rule for the revise loop: score threshold or a fixed number of rounds?
