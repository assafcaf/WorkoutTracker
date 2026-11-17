# 0026. Progress photos are captured in layers; alignment after capture carries the consistency

Date: 2026-11-17 · Status: accepted (design); device proof pending · Tracker: E26-T6

## Context
Hand-taken progress photos cannot be compared because distance and angle change every time. The
app is an installed iOS web app with no native code. `docs/design/competitors-2026-11/photo-standardization.md`
found: the file input with `capture` is the only path that always works and shows nothing over the
viewfinder; `getUserMedia` works in Home Screen apps but re-asks permission on every launch
(WebKit 327237) and can freeze (275527); `devicemotion` gravity gives a level but needs a tap
each launch; MediaPipe Pose Landmarker (lite, about 5.8 MB, CPU) runs offline and on a still.
Mocks: `docs/design/photos-2026-11/` (01 live capture, 02 fallback, 03 align, 04 compare).

This record chooses the design from research. The research's one-day spike on the owner's
installed iPhone has not been run (an agent has no device); its nine checks stay open and decide
only the defaults of L2 and L3, never L0 and L1.

## Decision
Four layers, each optional on top of the last:
- **L0, capture and guides (always).** Pick the view (front, side, back); a setup card (same spot,
  phone at chest height, same light) with a note field for the spot. "Take photo" opens the
  iPhone camera through `<input type="file" accept="image/*" capture="user">`; "Choose from
  library" is always offered. No live camera is needed for the photo to be useful.
- **L1, alignment after capture (always).** Each photo stores a similarity transform
  `{ scale, rotate, dx, dy }` onto a canonical frame; pixels are never changed. Automatic when the
  pose model is cached (IMAGE mode, least-squares fit to nose, shoulder-mid, hip-mid, ankle-mid;
  rejected above 3 % of frame height residual or visibility under 0.5); otherwise manual: drag,
  pinch and rotate over a 50 % ghost of the reference, Reset and Auto buttons.
- **L2, live ghost and level (when the live camera works).** The reference, already transformed,
  sits at 35 % over a `getUserMedia` preview (toggle 0/35/60); a level from `devicemotion` gravity
  matched to the reference shot's pitch and roll; a 10 s timer with beeps. Capture is a
  `drawImage(video)` frame. Camera is requested only on the "Take photo" tap.
- **L3, live pose cues (opt-in until proven).** MediaPipe lite on CPU at 10 Hz gives one cue at a
  time (tilt, step back or closer, move, turn, shoulders) and auto-captures after 1.0 s all green.

Fallbacks are automatic and silent apart from one line: a rejected stream, an ended or muted
track, or no frame in 3 s closes the preview and opens the file input in the same tap, with L2
off for the session; two failed sessions in seven days default to the file input. No motion
permission hides the level only. An uncached model turns L3 off and L1 manual.

Compare is a wipe slider (default) or side by side over two photos of the same view, each drawn
through its stored transform. Photos stay on the phone (E26 scope); the model and wasm are
self-hosted under `public/mediapipe/` and runtime-cached, not precached, after the first online
use of the feature.

Visual language is Ledger & Instrument: paper surfaces, ink as the action colour, live blue for
now, up green for "lined up", tabular numerals. The camera view alone is dark, as a viewfinder.

## Alternatives rejected
- **Live camera as the only path:** open WebKit bugs would leave the owner with no photo.
- **Native camera only, no alignment:** what the owner does today; it is the problem.
- **Voice trigger (Web Speech):** unavailable in Home Screen apps (WebKit 225298).
- **TF.js BlazePose or MoveNet:** larger, or no back-view visibility and no world landmarks.
- **Euler `deviceorientation` for the level:** unstable when the phone is upright; gravity is not.
- **Storing aligned pixels:** loses the original and compounds errors; a transform is re-fittable.

## Consequences
- L0 and L1 deliver the value on any iPhone; E26-T7 (capture) and E26-T8 (compare) build against
  the four mocks, with L2 and L3 behind capability checks.
- Build order: L0 and L1 first; L2 next; L3 only after the device spike sets its tolerances
  (starting values are in the research: distance ±4 %, centre ±0.03, turn ±8 %, tilt ±1.5°).
- The spike's checks that remain open: prompts per cold launch, freezes in 10 runs, motion
  events while the camera is live, pose speed and heat on CPU, offline model load, upright
  `createImageBitmap`. If L2 fails on the device it ships as an opt-in; the layers below stand.
- About 15 MB of cache is used only by people who open photos; the Workbox 2 MiB precache limit
  means these files must not go through the precache glob.
