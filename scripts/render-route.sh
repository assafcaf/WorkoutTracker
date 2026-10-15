#!/usr/bin/env bash
# The web-ui surface's Render command (PAD 0.4): renders one screen of the app to a PNG.
#
#   bash scripts/render-route.sh <route> <width> <height> <out.png> [state.json]
#
# Brings up its own Vite dev server (free port, never 5173) and headless Chrome, and shuts both
# down on success and on failure. <route> is one of / /dashboard /sessions /lifts /program
# /exercises /settings, or /<tab label> (/progress, /train), optionally followed by taps by
# visible text: '/progress|Back squat|3M' (quote it). The app has no URL routes; the renderer
# clicks to the screen. An empty or absent [state.json] renders a fresh install; otherwise it
# is seeded into IndexedDB first (scripts/render-states/stats-45.json, stats-1.json and
# stats-3.json also pin the clock and the zone, and render at DPR 2).
# See scripts/render-route.mjs for details. Chrome is taken from $CHROME when set.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$here/.."

route="${1:-}" width="${2:-}" height="${3:-}" out="${4:-}" state="${5:-}"
# Git Bash on Windows rewrites arguments that look like POSIX paths when it starts a native
# program, which turns the route `/` into the Git install directory. Turn that off, and hand
# node the file paths in a form it reads instead.
if command -v cygpath >/dev/null 2>&1; then
  export MSYS_NO_PATHCONV=1 MSYS2_ARG_CONV_EXCL='*'
  [ -n "$out" ] && out="$(cygpath -m "$out")"
  [ -n "$state" ] && state="$(cygpath -m "$state")"
  [ -n "${CHROME:-}" ] && export CHROME="$(cygpath -m "$CHROME")"
fi

node scripts/render-route.mjs "$route" "$width" "$height" "$out" "$state" &
pid=$!
trap 'kill "$pid" 2>/dev/null; wait "$pid" 2>/dev/null; exit 130' INT TERM HUP
wait "$pid"
