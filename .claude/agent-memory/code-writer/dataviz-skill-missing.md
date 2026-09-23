---
name: dataviz-skill-missing
description: WorkoutTracker E4 tickets reference a "dataviz" skill to read before chart code, but no such skill file exists in the repo or global skills dirs.
metadata:
  type: project
---

E4-T8's ticket said "Read the `dataviz` skill before the first line of chart code." Searched
`.claude/skills/`, `~/.claude/skills/synced/**`, and grepped the whole repo for "dataviz" —
nothing exists under that name.

Why: following the instruction literally would block on a missing file. The nearest actual
precedent in this repo is `src/ui/body/BodyMap.tsx` (SVG shapes with `data-*` attributes) and
`src/styles/contrast.test.ts`'s green-background rule (any element that `fill`s/`background`s a
green token needs its own `color` declared, even non-text elements like an SVG `rect`).

How to apply: if a future ticket references `dataviz` again, don't stall — read
`src/ui/body/BodyMap.tsx` and `src/styles/contrast.test.ts` instead, and flag the missing skill
in NOTES rather than blocking.
