# Stats research: the task frame

Date: 2026-10-15. Written by the orchestrator, before any dispatch. Every worker reads this first.
It follows the task template in `docs/design/redesign-2026-10/research-process-memo.md`.

| Field | Value |
|---|---|
| **Goal / symptom** | The redesign (Progress Dashboard, shipped in #23) rethought logging and layout. Stats were not researched on their own: the mocks' secondary screens converged on the same bar chart, e1RM line, records table and body-map card. The operator wants stats researched as thoroughly as the UI/UX was. "Good" = a lifter opens Stats and in seconds knows whether they are progressing, where, and what to do next. |
| **Scope layers** | All four: **which stats** to show (and which are noise), **how to chart** them, **where they live** (IA, drill-downs), **interaction** (ranges, scrubbing, comparison, filters, empty/sparse states). |
| **Freedom** | **Anything goes.** Concepts may depart from the shipped Progress Dashboard visual language and from today's History \| Stats placement (decision 0006). Features already shipped must still have a home. |
| **Deliverables** | 3 research reports (`research/market.md`, `research/audit.md`, `research/principles.md`), `brief.md`, 4 concepts each `mocks/<slug>/index.html` (clickable) + `board.png` + `rationale.md`, independent `reviews/<slug>.md`, a cross-concept note, `index.html` gallery, and this run's `process-memo.md`. |
| **Constraints: must keep** | Warm-up sets never count toward records, e1RM, progression, volume or muscle maps. Exercise kinds (decision 0006): loaded, bodyweight, assisted (`invertProgress`: less is better, reversed axis, nothing negated). Epley e1RM `w × (1 + r/30)`. The app suggests and never edits. Charts are hand-drawn SVG, no library (0006) — mocks may be any HTML/SVG. Phone-first, one-handed, offline PWA. |
| **Constraints: must avoid** | Rejected looks: dark + neon lime (2026-09-26), light ivory + pastel "Court" (called childish 2026-10-13). Dual-axis charts. Rainbow palettes. |
| **References** | None given by the operator. Market research supplies them. |
| **Judged by** | A researched rubric from `research/principles.md`, plus distinctness between concepts. |
| **Budget** | Same shape as the 2026-10 UI run: ~15 dispatches, one full review round, one revision round. |
| **Afterwards** | The operator picks a concept (or hybrid) → it feeds roadmap R7 "Body and deeper stats" via /spec, or the light design process. |
| **Checkpoints** | None. Run to the gallery. |

## Shared facts for every worker

- Repo root holds `CLAUDE.md`. App: React + Vite PWA in `src/`. Stats today: `src/ui/Stats.tsx`,
  `src/ui/ExerciseDetail.tsx`, `src/ui/charts/`, `src/ui/VolumeVsBaseline.tsx`,
  `src/ui/RegionHeat.tsx`, `src/ui/body/`, `src/ui/HistoryStatsSwitch.tsx`, `src/ui/SessionSummary.tsx`.
  Domain maths: `src/domain/{records,series,progression,dashboard,exerciseVolume,programVolume,muscles,summary,prMoment,lifts}.ts`.
- Decisions: `docs/decisions/` (0006 is the stats one). Roadmap: `docs/roadmap/roadmap.md` (R6, R7)
  and `docs/roadmap/feature-research.md` (section E, "Deeper statistics").
- The previous UI research is in `docs/design/redesign-2026-10/` (`research/*.md`, `brief.md`,
  the chosen mock `mocks/progress-dashboard/`). Reuse it; do not redo it.
- The trainee's real program (A/B days, 14 exercises) is in the E1 spec's catalog table and in
  `docs/design/redesign-2026-10/research/audit.md`'s content inventory.
- Render HTML to PNG headless: `bash docs/design/stats-2026-10/render.sh <in.html> <out.png> [w] [h]`.
  Parallel-safe. Do not use the Chrome browser extension (one shared browser; it dropped last time).
- Chart craft reference: the `dataviz` skill at
  `C:\Users\Assaf\AppData\Local\Temp\claude\bundled-skills\2.1.299\43f51d1d7a77caa044f9a4b49481cad4\dataviz\`
  (`SKILL.md`, `references/*.md`, `scripts/validate_palette.js` — run with `node`).
- Write files with the Write/Edit tools, never a shell heredoc (it hung on Git Bash last run).
  `python3` is a stub here; use `python`.
