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

## Outcome (E26, 2026-11-17)
- Built: layers L0-L2. The native camera (`<input capture>`) with a manual align screen under the
  last photo's ghost always works; when the live camera opens, it shows the ghost (35 / 60 % / off),
  a level from `devicemotion` gravity (within 1.5 degrees reads "Level") and a 10 s timer, and any
  camera failure falls back to the native camera. Photos are stored on the phone only, as an
  `ArrayBuffer` plus its type (not a `Blob`), re-encoded to at most 1600 px with no EXIF
  (`src/storage/photoStore.ts`); the first save asks `navigator.storage.persist()` once; backups
  include photos only when asked.
- Not built: L3 (on-device pose cues for distance and turn, and auto-capture). It needs the device
  checks listed above first, and about 15 MB of model files outside the precache.
- Not verified: anything on the iPhone. The installed-app camera, the motion permission and
  persistence need the operator's phone after deploy (`iphone` resource).

## Outcome (photos v2, 2026-11-17)
The owner tried E26 on the iPhone: no back camera, a jittery tilt, and no sense of distance.
`docs/design/photos-2026-11/stability-and-distance.md` set the fixes; built as recommended:
- **Back camera.** A Front/Back camera choice on the setup screen and a named 44 px switch in the
  live view, remembered per view in localStorage (device-local). A switch stops every old track and
  clears the video before asking for the other camera (WebKit 179363) and disables the shutter
  while it runs; a failed switch reopens the camera that worked. The back camera prefers a
  remembered deviceId, else the plain "Back Camera" lens by label (never ultra-wide, dual, triple or
  telephoto), else `facingMode`; on the first grant it reopens on the plain lens and remembers it.
  Only the front preview and its ghost are mirrored; the saved frame never is. The native-camera
  input's `capture` follows the choice. References are per view **and** camera (photos from before
  v2 count as front).
- **Level.** Gravity = `accelerationIncludingGravity − acceleration` (CoreMotion's fused gravity on
  iOS), raw with a median of 5 when `acceleration` is missing; roll and pitch; a 1€ filter (0.5 Hz,
  β 0.05, dcutoff 1 Hz; raw 0.3 Hz, β 0.03); a Schmitt trigger (roll in ≤ 1.0° out > 2.0°, pitch
  in ≤ 1.5° out > 3.0°, 300 ms dwell; raw roll 1.5/2.5°, 500 ms); a spec-convention sign flip
  detected when upright. Motion events never set state: the line and pitch dot are drawn every
  animation frame, the words ("Tilt right 2.5°", "Top away 3°") at 10 Hz in 0.5° steps. The target
  is the reference photo's stored angles (else 0/0); the shutter stores the median of the last
  0.5 s. Hidden past 25° of roll or after 1 s without events.
- **Distance.** The ghost and the video share one box and `object-fit: contain`; the stream asks
  for 1440×1920, 3:4, all `ideal`. MediaPipe Pose Landmarker lite (CPU, VIDEO mode, about 9 Hz),
  loaded by dynamic import only when the live camera opens: S = shoulder-mid to ankle-mid (torso
  ratio when an ankle is hidden), r = S/S_ref, median of 5, EMA of log r with τ 0.4 s; green zone in
  ±3 % out ±5 % with a 500 ms dwell; one "◄ closer / farther ►" bar over ±20 % with a whole-percent
  number (4 Hz); one cue at a time (tilt, then distance, "Step into frame", "Matched"). S_ref is
  stored with each live photo; a reference without one is measured once on its still. With the
  back camera, Web Audio ticks speed up as you near the zone and one high tone marks Matched; the
  10 s timer beeps. Without the model (offline before first use, unsupported) the reference's head
  and feet lines are drawn; they come from the landmarks, or the user marks them on the align
  screen ("Head & feet").
- **Data.** `Photo` gained optional `camera`, `roll`, `pitch`, `bodyScale`, `bodyLines`, `source`
  (`live` / `native` / `library`) and `streamWidth` / `streamHeight`. A photo without them keeps its
  old shape, malformed values are dropped, backups carry them. No schema version (no new index).
- **Check-in.** After a save the flow offers "Next: Side", then "Next: Back" (skipping views
  already taken that day), and Done; `PhotoCaptureFlow`'s props are unchanged.
- **Cache.** `vision_bundle` (155 KB) is a lazy chunk in the precache. The wasm (15 MB) is copied
  from the npm package into `dist/mediapipe/wasm/` at build time, and the lite model (about 5.8 MB)
  is fetched from Google's model bucket; both are runtime-cached CacheFirst, outside the precache.
- **Not verified on the iPhone:** the research's section 6 checks (fused gravity while the camera
  is live and its noise, the sign of `gy`, the real stream size and field of view, back-camera
  labels and lens switching, a re-prompt on switching, pose `r` noise at 2.5 m), plus Web Audio
  while the camera runs and the model's first load and offline reuse in the Home Screen app.

## Outcome (mirror mode, 2026-11-17)
The owner will take the photos in front of a mirror, not from a shelf 2.5 m away.
`docs/design/photos-2026-11/mirror-mode.md` set the redesign; built in its order, with one change
the owner asked for during the build: there is no setup screen.
- **Camera first.** Capture opens straight onto the live camera with the last-used view (Front the
  first time) and that view's remembered mode. Every choice is a compact 44 px control on the
  camera view: View (Front / Side / Back) and How (Mirror / Stand) under the header, the ghost in
  it, the timer and camera switch (Stand only) by the shutter. Changing one reconfigures the view
  in place. "Use camera app" (the native camera, `capture` following the camera) and "Choose from
  library" stay on the camera view; when the live camera fails it says so there. Setup tips show
  as an inline card while a view and mode have no reference yet; the Back + Mirror note ("A back
  photo needs the phone on a stand, or a second mirror. Use Stand?", Use Stand / Keep Mirror) is
  inline too. Close ends the capture. The motion permission is asked on opening and again on the
  first tap if needed.
- **Two modes**, remembered per view in localStorage (`photoMode.<view>`, `photoView`): Mirror is
  the default for Front and Side (back camera, locked; no timer, no camera switch; silent unless
  Sounds is on), Stand for Back (photos v2 unchanged: the timer, now defaulting to 10 s with the
  back camera, the switch and the sounds). References are per view **+ mode + camera**; photos
  without a mode count as Stand.
- **Mirror cues**, one at a time: tilt (pitch first; roll relaxed to in 2.0° / out 4.0°), phone
  height, feet in frame ("Step back until your feet show"), distance ("Step back from the mirror"
  / "Step closer to the mirror"), Matched. Phone height h = (y_shoulderMid - y_horizon) / torso
  with y_horizon = 0.5 + 0.75·tan(pitch), median of 5 then EMA τ 0.4 s, in ±0.10 out ±0.18 with a
  500 ms dwell, "Raise the phone" / "Lower the phone", and a vertical height scale on the
  viewfinder's left edge. The hand is the raised wrist's image side; "Phone in your right hand,
  like last time" is a non-blocking hint. A stand photo never guides a mirror one ("No mirror
  photo yet. This one becomes the reference."); a mirror reference without a stored height is
  measured once on its still.
- **Auto-capture** (`autoCapture.ts`, pure): all matched 0.6 s (1 s for a first photo), then a
  1.5 s "Hold still · 3 · 2 · 1" with a ring round the shutter, then the frame at the first tick
  with `rotationRate` under 15°/s (at most 0.4 s more). A tap starts a 2 s countdown; a tap
  during any countdown cancels it. Auto can be turned off. A 120 ms flash and "Got it" mark the
  shot (no flash with reduced motion).
- **Data.** `Photo` gained optional `mode` (`mirror` / `stand`), `phoneHeight` (torso lengths)
  and `phoneHand`; malformed values are dropped; backups carry them. Saved pixels are never
  flipped.
- **Compare and viewer.** A mirror photo is drawn with `scaleX(-1)` before its align transform only
  next to a Stand photo (Compare: the other of the pair; viewer: any Stand photo of that angle);
  same-mode pairs never flip. A "Mirror" chip marks mirror photos; Compare has a Flip toggle.
  Auto-align (L1 automatic) is still not built; `mirroredPoints` (x to 1 - x) is ready for it.
- **Not verified on the iPhone** (mirror-mode.md section 3): pose visibility on a reflection and
  r noise hand-held; h noise and the sign of the pitch term; the raised wrist behind the phone and
  its image side; the smallest distance with feet in frame at the owner's mirror; rotation rate
  while holding still and auto-shot sharpness; focus and glare on the mirror; time to level
  hand-held and the relaxed roll band; the plain back lens; Stand for Back end to end; Compare of
  a mirror and a stand photo. Also: the pitch words' direction ("Tilt top away" for a positive
  pitch), and whether motion permission granted on opening (no fresh tap) holds in the Home
  Screen app.
