#!/usr/bin/env bash
# Render an HTML mock to PNG with headless Chrome.
# Usage: bash render.sh <file.html> <out.png> [width] [height]
set -e
CHROME="${CHROME:-/c/Program Files (x86)/Google/Chrome/Application/chrome.exe}"
in="$1"; out="$2"; w="${3:-2400}"; h="${4:-1000}"
"$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
  --virtual-time-budget=3000 --window-size="$w,$h" \
  --screenshot="$(cygpath -w "$out")" "file:///$(cygpath -m "$(realpath "$in")")" 2>/dev/null
echo "rendered $out"
