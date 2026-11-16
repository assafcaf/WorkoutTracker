#!/usr/bin/env bash
# Shoots Home's five states, the workout page, 320 x 568 and 200 % text into before/ or after/.
# Usage: bash docs/design/competitors-2026-11/build/home/shoot.sh before|after
# Needs the dev server on http://127.0.0.1:5188/ and Playwright on NODE_PATH.
set -u
mode="$1"
out="docs/design/competitors-2026-11/build/home/$mode"
mkdir -p "$out"
state=scripts/render-states/stats-45.json
shoot() { node scripts/ux-review/shoot.mjs --url http://127.0.0.1:5188/ "$@"; }
# The workout page: Home's Today panel opens it; before, Train is the workout page.
open_page=()
if [ "$mode" = after ]; then open_page=(tap:Today wait:600); fi

shoot --state "$state" --now 2026-10-16T07:40:00+03:00 wait:1200 "shot:$out/01-a-training-day.png"
shoot --state "$state" --now 2026-10-15T18:05:00+03:00 wait:1200 "shot:$out/02-b-rest-day.png"
shoot --state "$state" --now 2026-11-09T07:40:00+02:00 wait:1200 "shot:$out/03-c-after-a-break.png"
shoot --state "$state" --now 2026-10-14T19:20:00+03:00 wait:1200 "shot:$out/04-d-after-a-workout.png"
shoot --now 2026-10-16T07:40:00+03:00 wait:1200 "shot:$out/05-e-new-user.png"
shoot --state "$state" --now 2026-10-16T07:40:00+03:00 wait:1200 "${open_page[@]}" "shot:$out/06-workout-page.png"
shoot --state "$state" --now 2026-10-16T07:40:00+03:00 --full wait:1200 "${open_page[@]}" "shot:$out/06b-workout-page-full.png"
shoot --state "$state" --now 2026-10-16T07:40:00+03:00 --viewport 320x568 wait:1200 "shot:$out/07-a-320x568.png"
shoot --state "$state" --now 2026-10-16T07:40:00+03:00 --viewport 320x568 --full wait:1200 "shot:$out/07b-a-320x568-full.png"
shoot --state "$state" --now 2026-10-16T07:40:00+03:00 --font 200% --full wait:1200 "shot:$out/08-a-200pct-full.png"
shoot --state "$state" --now 2026-10-16T07:40:00+03:00 --viewport 320x568 --full wait:1200 "${open_page[@]}" "shot:$out/09-workout-page-320x568-full.png"
shoot --state "$state" --now 2026-10-16T07:40:00+03:00 --font 200% --full wait:1200 "${open_page[@]}" "shot:$out/10-workout-page-200pct-full.png"
