#!/usr/bin/env bash
# Shoots the "after" half of the v7 before/after boards (build-plan step 12): the main phases and
# every secondary screen, at the steps the before shots were taken. boards.py composes them.
# Usage: bash docs/design/competitors-2026-11/build/final/shoot.sh [outdir]
# Needs the dev server on http://127.0.0.1:5192/ and Playwright on NODE_PATH.
set -u
out="${1:-docs/design/competitors-2026-11/build/final/after}"
mkdir -p "$out"
state=scripts/render-states/stats-45.json
shoot() { node scripts/ux-review/shoot.mjs --url http://127.0.0.1:5192/ --state "$state" "$@" || echo "FAILED: $*"; }
day=2026-10-16T07:40:00+03:00

# Phases.
shoot wait:1200 "shot:$out/01-home.png"
shoot --now "$day" wait:1200 tap:Today wait:600 "shot:$out/02-workout-page.png"
shoot wait:1200 'tap:Start Workout B' wait:900 "shot:$out/03-set.png" \
  'tap:Log set 1' wait:900 "shot:$out/04-rest.png" \
  'tap:Change next set' wait:600 'tap:Increase weight' wait:400 'tap:Log set 2' wait:900 "shot:$out/05-pr.png"
shoot wait:1200 'tap:Start Workout B' wait:900 'tap:Log set 1' wait:900 'tap:All exercises' wait:700 "shot:$out/06-all.png"
shoot wait:1200 tab:Sessions wait:700 'tap:Mon 12 Oct' wait:900 "shot:$out/07-summary.png"
shoot wait:1200 tab:Progress wait:900 "shot:$out/08-progress.png"
shoot wait:1200 tab:Progress wait:900 tap:Deadlift wait:900 "shot:$out/09-lift.png"
shoot wait:1200 tab:Program wait:900 "shot:$out/10-program.png"

# Secondary screens.
shoot wait:1200 tab:Sessions wait:900 "shot:$out/11-sessions.png"
shoot wait:1200 tab:Sessions wait:700 'tap:Wed 14 Oct' wait:800 'tap:Edit session' wait:900 "shot:$out/12-session-editor.png"
shoot wait:1200 tab:Sessions wait:700 'tap:Log a past workout' wait:800 "shot:$out/13-log-past-sheet.png"
shoot wait:1200 'tap:Start Workout B' wait:900 'tap:Exercise tools' wait:800 "shot:$out/14-tools-sheet.png" \
  'tap:Lift history' wait:900 "shot:$out/15-tools-lift-history.png"
shoot wait:1200 'tap:Start Workout B' wait:900 'tap:Exercise tools' wait:800 'tap:Swap exercise' wait:900 "shot:$out/16-swap-sheet.png"
shoot wait:1200 'tap:Start Workout B' wait:900 'tap:Exercise tools' wait:800 'tap:Exercise info' wait:900 "shot:$out/17-exercise-detail.png"
shoot wait:1200 'tap:Start Workout B' wait:900 'tap:Log set 1' wait:900 tap:Finish wait:800 "shot:$out/18-finish-sheet.png" \
  'tap:Discard workout' wait:800 "shot:$out/19-discard-confirm.png" \
  'tap:Discard 1 logged set' wait:900 "shot:$out/28-after-discard.png"
shoot wait:1200 tab:Program wait:700 tap:Exercises wait:900 "shot:$out/20-exercises-my-lifts.png" \
  'type:.library-search=squat' wait:700 "shot:$out/21-exercises-search.png"
shoot wait:1200 tab:Program wait:700 'tap:Edit A/B Split' wait:900 "shot:$out/22-program-editor.png"
shoot wait:1200 tab:Progress wait:900 tap:Muscles wait:900 "shot:$out/23-muscles.png"
shoot wait:1200 tab:Progress wait:900 tap:Body wait:900 "shot:$out/24-body.png"
shoot wait:1200 tap:Settings wait:900 "shot:$out/25-settings.png"
node scripts/ux-review/shoot.mjs --url http://127.0.0.1:5192/ --now "$day" wait:1200 "shot:$out/26-first-run.png" \
  tab:Sessions wait:800 "shot:$out/27-first-run-sessions.png" || echo "FAILED first run"
