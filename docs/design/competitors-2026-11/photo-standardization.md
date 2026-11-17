# Progress photos: standardizing distance and angle in an installed iOS PWA

Research date: 2026-11-17. Scope: WorkoutTracker as installed today (React + Vite PWA,
`display: standalone`, offline-first, IndexedDB, no native code, no hash routing).
Labels: **[src]** = backed by the linked source; **[eng]** = my engineering reasoning;
**[spike]** = unverified, the real-iPhone spike must prove it.

## Bottom line

1. **The one thing that works everywhere is the file input with `capture`.** It opens the
   native camera and returns a full-resolution photo, but it cannot show anything over the
   viewfinder. Consistency on this path has to come from **after-capture alignment** plus
   setup instructions.
2. **A live camera with overlays (`getUserMedia`) does work in Home Screen apps**, but it is
   fragile. The permission is asked again **on every cold launch** (WebKit 327237, filed
   2026-10-12, NEW). There are intermittent freeze and capture-failure bugs (275527, NEW). So
   treat it as an **enhancement that may fail**, never as the only path.
3. **Pose estimation on device is feasible and works offline.** MediaPipe Pose Landmarker
   (Apache-2.0) has a lite model of about 5.8 MB plus the wasm runtime. It solves both
   problems the owner named. Distance comes from body height in the frame, and angle from
   shoulder width and the shoulder/hip lines. It also runs on a **still image**, so the
   capture-only path gets automatic alignment too.
4. **For "phone level", use `devicemotion` gravity rather than `deviceorientation`
   beta/gamma.** Euler angles go unstable when the phone is held upright, near beta = 90°
   **[eng]**. The motion permission needs a tap, and it probably has to be granted again on
   every launch as well **[spike]**.
5. Recommendation, in four layers, each one optional on top of the last:
   - **L0** capture + guides
   - **L1** after-capture alignment (pose-based, with manual pinch/drag as fallback)
   - **L2** live ghost overlay + level
   - **L3** live pose cues + auto-capture

## 1. Live camera in standalone iOS PWAs

| Finding | Source |
|---|---|
| `getUserMedia` in Home Screen apps was fixed in iOS 13.4 (bug 185448, closed Feb 2020; the reporter said "for the time being it works"). | [WebKit 185448](https://bugs.webkit.org/show_bug.cgi?id=185448) |
| Permission was revoked on every **hash** change in standalone mode. Closed "configuration changed", with the fix on Safari's side. Comments from Jan 2025 (cold start) and Jun 2025 (iOS 18.5, permission reverts to "Ask") report it still re-prompts. WebKit's maintainer asked for a separate bug about persistence. | [WebKit 215884](https://bugs.webkit.org/show_bug.cgi?id=215884) |
| **Follow-up bug, 2026-10-12: "Home Screen web apps ask for camera/microphone permission again on every launch."** Status NEW, Radar 189868738. Safari tabs can keep a per-site Allow, but Home Screen apps cannot. | [WebKit 327237](https://bugs.webkit.org/show_bug.cgi?id=327237) |
| Camera freezes or ends with "A MediaStreamTrack ended due to a capture failure" in installed PWAs. Reports run from iOS 17.5.1 to 18.1.1 (latest May 2025). NEW, and the maintainer cannot reproduce it. | [WebKit 275527](https://bugs.webkit.org/show_bug.cgi?id=275527) |
| Stream fails to start in standalone on some devices, iOS 17.4.1, NEW. A separate older bug covers the `<video>` element failing to play the stream in a PWA. | [WebKit 273938](https://bugs.webkit.org/show_bug.cgi?id=273938), [WebKit 252465 thread](https://lists.webkit.org/pipermail/webkit-unassigned/2023-April/1099833.html) |
| The ImageCapture API (`takePhoto()`) is not on iOS. The only way to get a still is `drawImage(video)` to a canvas, so a live-path photo is a **video frame**. Historically it was capped near 1280×720; a 2020 comment says higher resolutions worked on 13.4. | [Apple forum 113532](https://developer.apple.com/forums/thread/113532), [WebKit 179994](https://bugs.webkit.org/show_bug.cgi?id=179994) |
| Safari treats bare `width`/`height` like `exact`. Use `ideal` or ranges with a fallback. | [SO via kiwix](https://kiwix.lema.org/stackoverflow.com_en_all_2023-11/questions/45796011/how-to-change-dimensions-with-getusermedia-on-ios) |
| `<input type="file" accept="image/*" capture="user|environment">` is supported on iOS Safari 6 through 27.x. | [caniuse html-media-capture](https://caniuse.com/html-media-capture), [MDN capture](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/capture) |

Implications:

- **Front vs back camera.** `facingMode: 'user' | 'environment'` is the standard selector.
  For the self-timer use case, the **back camera** gives better quality, but the user cannot
  see the screen. The **front camera** lets the user see the overlay **[eng]**. Default to
  front when the live path works, and offer back + audio cues once L3 is in.
- **Resolution.** Ask for `{width: {ideal: 1920}, height: {ideal: 1440}}`, then read back
  `track.getSettings()`. 1080p-class is plenty for a progress photo **[eng]**. Whether a 4:3
  1920×1440 or a 4K stream is granted is **[spike]**.
- **Permission per launch.** Request the camera only on the "Take photo" tap, never on
  launch. Show our own one-line pre-prompt ("iOS will ask for the camera each time you open
  the app"), so the system prompt is not a surprise.
- **Watchdog.** If `track.readyState === 'ended'`, `track.muted` stays true, or no
  `requestVideoFrameCallback`/`timeupdate` frame arrives within 3 s of `play()`, tear down and
  fall back to the file input with a toast **[eng]**. This covers 275527 and 273938.
- **Our routing.** The app does not use hash routing (grep of `src/`), so 215884's
  hash-change trigger does not apply. The camera screen must still not change `location`
  while the stream is open **[eng]**.
- **What the file-input fallback gives:** a full-res HEIC/JPEG from the native camera (iOS
  hands the page a JPEG for `image/*` **[spike]**), with EXIF orientation. CSS
  `image-orientation` defaults to `from-image`, so `<img>` shows it upright
  ([MDN image-orientation](https://developer.mozilla.org/en-US/docs/Web/CSS/image-orientation)).
  It gives no live overlay, no level and no auto-capture. The native camera's own grid and
  level still help if the user has turned them on in iOS Settings → Camera **[eng]**.

## 2. Angle and tilt: DeviceOrientation and DeviceMotion

| Finding | Source |
|---|---|
| Since iOS 13, `DeviceOrientationEvent.requestPermission()` and `DeviceMotionEvent.requestPermission()` must be called from a user gesture. Both are HTTPS-only. | [WebKit 203287](https://bugs.webkit.org/show_bug.cgi?id=203287), [Medium iOS 13 guide](https://medium.com/@sawanrathod/get-device-motion-and-orientation-back-on-ios-13-9c704bed104f) |
| Developers report being asked again on every launch. One iOS 16.6 report has `deviceorientation` returning "denied" in an iframe while `devicemotion` worked, and all-zero alpha/beta/gamma after a grant. | [Apple forum 766483](https://developer.apple.com/forums/thread/766483), [Defold forum](https://forum.defold.com/t/how-to-force-safari-browser-to-allow-deviceorientation-permission-solved/75641) |
| A standalone PWA freezes after an orientation change (older bug). | [WebKit 211062](https://bugs.webkit.org/show_bug.cgi?id=211062) |

Design notes:

- **Use gravity, not Euler angles [eng].** In portrait-upright, `beta ≈ 90°`. That is the
  Tait-Bryan singularity, where `gamma` jumps and flips. Instead compute it from
  `DeviceMotionEvent.accelerationIncludingGravity` (gx, gy, gz):
  - roll (left/right tilt) = `atan2(gx, -gy)`
  - pitch (lean toward/away) = `atan2(gz, hypot(gx, gy))`

  Low-pass filter both (EMA, α = 0.15). The accelerometer gives about ±0.5° when the phone is
  still, which is enough for a "level" bubble **[spike: measure the noise floor]**.
- **One tap grants both [eng].** The same "Start camera" tap can call
  `DeviceMotionEvent.requestPermission()` and then `getUserMedia()`. iOS shows two prompts on
  each launch, which is a cost to weigh. If the user declines motion, hide the level and keep
  everything else.
- **With the camera running:** no source says the motion sensors stop while `getUserMedia`
  is active, but none confirms they keep running either **[spike]**.
- **How apps use it:** the iOS Camera app's level shows a crosshair or line that turns
  yellow when level. Ghost-overlay progress apps (below) lean on the overlay, not on sensors.
  The useful idea is to **store the pitch/roll of the reference shot and ask the user to
  match it**, not to require absolute level. A shelf rarely is level, but it is the same
  every time **[eng]**.

## 3. Distance and pose: on-device pose estimation

| Finding | Source |
|---|---|
| MediaPipe Pose Landmarker: 33 landmarks with x/y normalized to the image, `visibility` and `presence` per landmark, world landmarks in metres (hip-centred), optional segmentation mask. Lite/Full/Heavy variants, all 256×256 input. Web supports IMAGE and VIDEO modes; live use is VIDEO + `requestAnimationFrame`. Delegate CPU (wasm, the default) or GPU. | [MediaPipe Pose Landmarker](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker), [web guide](https://developers.google.cn/edge/mediapipe/solutions/vision/pose_landmarker/web_js) |
| Model sizes: `pose_landmarker_lite.task` 5.78 MB, `pose_landmarker_heavy.task` 30.7 MB (community mirrors). | [HF lite](https://huggingface.co/AndorML/Public/blob/a6ba17720dfb88f514fcab0f8161a4c655fbccd3/pose_landmarker_lite.task), [HF heavy](https://huggingface.co/spaces/learnmlf/FollowYourEmoji/blob/0fb37f37f9ebb8bc2c94bffbaad9b03071b54b62/media_pipe/mp_models/pose_landmarker_heavy.task) |
| GPU delegate on iOS Safari: scrambled outputs in ImageSegmenter on iOS 18.7.1 (iPhone 12 Pro), tasks-vision 0.10.22. A GPU-process crash on iPhone 17 Pro Max (not MediaPipe-specific). | [mediapipe #6142](https://github.com/google-ai-edge/mediapipe/issues/6142), [WebKit 321693](https://bugs.webkit.org/show_bug.cgi?id=321693) |
| Thermal throttling: 30 → 18 fps after about 8 min with GPU on iPhone 12 (native, one anecdote). | [DEV post](https://dev.to/diyoraharshit52/mediapipe-on-ios-what-the-docs-leave-out-22bl) |
| WebGPU ships on by default in Safari 26 / iOS 26. Early iOS 26 canvas-flicker bugs. | [web.dev](https://web.dev/blog/webgpu-supported-major-browsers?hl=en), [WebKit 301627](https://bugs.webkit.org/show_bug.cgi?id=301627) |
| TF.js alternatives: BlazePose TF.js is 10.6 / 14 / 34.9 MB (lite/full/heavy) + 1.57 MB runtime. MoveNet has 17 keypoints, with about 60 fps on a recent iPhone reported (anecdote). | [TF blog BlazePose](https://blog.tensorflow.org/2021/05/high-fidelity-pose-tracking-with-mediapipe-blazepose-and-tfjs.html), [TF forum MoveNet](https://discuss.tensorflow.org/t/tensorflow-js-announces-new-model-movenet-super-fast-and-accurate-pose-estimation/871) |

Choice: **MediaPipe tasks-vision + `pose_landmarker_lite`, CPU delegate first.** We only need
about 10 inferences per second, not 30, so CPU is enough. It avoids the iOS GPU bugs and
throttles less. Try GPU in the spike and keep it only if it is faster *and* correct
**[eng/spike]**. MoveNet (17 keypoints) has no visibility for a back view and no
world-coordinates, and BlazePose TF.js is bigger, so MediaPipe wins **[eng]**. Licence:
MediaPipe is Apache-2.0 ([repo](https://github.com/google-ai-edge/mediapipe)).

**Offline caching [eng, from our `vite.config.ts`].** Workbox `generateSW` precache already
globs `*.wasm`, but `maximumFileSizeToCacheInBytes` defaults to 2 MiB. The tasks-vision wasm
(several MB) and the 5.8 MB `.task` would be **silently skipped**. So:

- Self-host both under `public/mediapipe/` (no CDN at runtime).
- Either raise `maximumFileSizeToCacheInBytes` to about 16 MiB, or better, keep them out of
  precache and add a `CacheFirst` runtime route, warmed the first time the user opens the
  photo feature online. Cost: about 15 MB of disk, only for users who use photos.
- Lazy-load the module with dynamic `import()`, so the main bundle does not grow.

**Turning landmarks into cues.** Indices are from MediaPipe. All values are in the
normalized frame. The reference is the previous photo of the same view (front, side or back).

- **Body height `H`** = mid-ankle y (27/28) − nose y (0). Landmarks have no top-of-head, so
  the nose stands in. Track it as a ratio to the reference, not as an absolute value.
- **Centre `C`** = midpoint of hips (23/24) and midpoint of shoulders (11/12).
- **Shoulder width ratio `R`** = |x11 − x12| / (shoulder-mid to hip-mid distance). This is
  the body's turn, and it does not depend on distance.
- **Shoulder line tilt `T`** = atan2 of the line from 11 to 12, in degrees. Hip line likewise.
- **View class:**
  - front: `R ≥ 0.55`, and nose visibility ≥ 0.6
  - back: `R ≥ 0.55`, and nose visibility < 0.3 (back-view visibility is uncertain, see
    [spike])
  - side: `R ≤ 0.30`
  - anything between is "turn more". The user picks the view, and the classifier only
    checks it.

**Non-ML guides (work on any path that shows a live preview, and as printed instructions):**

- ghost of the previous photo at 35 % opacity, with a toggle to 0/35/60 %
- an outline silhouette (head ellipse, shoulder bar, ankle line) placed from the reference
  landmarks
- a 10 s timer
- a "same setup" card: same spot (mark the floor with tape), phone at chest height on a
  shelf, same lighting and time of day, same clothes, arms relaxed 15 cm from the body.
  MacroFactor's own guidance is the same: consistent location and time
  ([MacroFactor tips](https://help.macrofactorapp.com/en/articles/117-tips-for-taking-good-progress-photos)).

## 4. Post-capture normalization

- **Store a transform, never change the pixels [eng].** Per photo, keep
  `{ s, θ, tx, ty }` (a similarity transform) that maps it onto a **canonical frame**. The
  canonical frame is the first photo of that view, or a fixed layout: hip-mid at (0.5, 0.55),
  nose to ankle = 0.80 of the height. Show it with a CSS
  `transform: matrix(...)` inside an `overflow: hidden` frame. The original stays intact and
  can be re-aligned later.
- **Automatic:** run Pose Landmarker in IMAGE mode on the stored still. Fit the
  least-squares similarity (Umeyama/Procrustes, 4 lines of maths) on point pairs: nose,
  shoulder-mid, hip-mid, ankle-mid (plus knees when visible). Fit to the canonical frame,
  not just to the last photo, so errors do not add up from photo to photo. Reject the fit
  when the residual is > 3 % of the frame height, or any of those landmarks has visibility
  < 0.5, and drop to manual.
- **Manual:** the reference ghost at 50 % over the new photo, with one-finger drag,
  two-finger pinch and rotate (pointer events), a "reset" button, and an "auto" button.
  Rotation snaps to 0° within ±1°.
- **Compare:** a side-by-side view, plus a **wipe slider** (`clip-path: inset()` on the
  top image, both aligned). It also gives a GIF/timelapse later for free. GainFrame
  advertises this exact combination: ghost camera plus auto body alignment on the compare
  screen ([App Store](https://apps.apple.com/app/id6759252082)).
- This layer works for photos from the file input **and** photos imported from the gallery.
  So it is the layer that fixes inconsistency even when the live camera never works.

## 5. Hands-free capture

| Option | Verdict | Source |
|---|---|---|
| Voice ("cheese") with Web Speech `SpeechRecognition` | **No.** Historically unavailable in Home Screen web apps. Feature detection passes, then nothing happens. | [WebKit 225298](https://bugs.webkit.org/show_bug.cgi?id=225298), [Apple forum 748048](https://developer.apple.com/forums/thread/748048) |
| Timer (3 / 10 s) with beeps from the Web Audio API | **Yes**, on every path that has a live preview. The file-input path uses the native camera's own timer. | [eng] |
| Auto-capture on pose match | **Yes**, on the live path once L3 works (tolerances below). | [eng] |
| Burst (5 frames over 1 s, keep the sharpest by Laplacian variance) | Optional, cheap. | [eng] |

## 6. Storage

| Finding | Source |
|---|---|
| Safari 17+: the origin quota is up to 60 % of disk for browser apps and 15 % for others. A Home Screen web app gets the same quotas as in the browser. Eviction is least-recently-used per origin, under storage pressure or by ITP inactivity. `navigator.storage.persist()` is granted by heuristics, and being a Home Screen app counts in favour. | [WebKit storage policy](https://webkit.org/blog/14403/updates-to-storage-policy/) |
| iOS canvas limits: historically 16,777,216 px per canvas and 224–384 MB of total canvas memory. iOS 18 reportedly raised this to 8192². Past the limit, `toBlob` fails or gives `data:,`. | [PQINA area](https://pqina.nl/blog/canvas-area-exceeds-the-maximum-limit/), [PQINA memory](https://www.pqina.nl/blog/total-canvas-memory-use-exceeds-the-maximum-limit/), [lionpuro](https://lionpuro-com.pages.dev/posts/canvas-is-finally-usable-on-safari) |

Rules **[eng]**:

- Decode with `createImageBitmap(file)`, which applies EXIF orientation by default
  **[spike]**.
- Draw to a canvas with the long edge at **1600 px** (12 MP becomes about 1.9 MP, well under
  every limit), then `toBlob('image/jpeg', 0.85)`. That gives about 250–450 KB per photo.
  Re-encoding through a canvas writes **no source EXIF**, so GPS and device tags are gone,
  which is what we want.
- Keep a 320 px thumbnail as well, for lists.
- Store the Blobs in their own IndexedDB object store, alongside `{ id, date, view, pitch,
  roll, landmarks, transform, source: 'live' | 'input' }`.
- Call `navigator.storage.persist()` after the first saved photo, and show the result
  (`persisted()`).
- Offer "Export all (zip)" as the real backup. These photos are the hardest data to recreate.
- **Do not sync photos through D1** (it is a row store) **[eng]**. If cloud backup is wanted
  later, it is an R2 decision, not part of this work.

## 7. What other progress-photo apps do for consistency

| App | Consistency features | Source |
|---|---|---|
| PhotoJourney (My Body Tracker) | "Ghost Mode" overlay of the previous photo, plus a body alignment guide | [listing](https://mwm.ai/apps/my-body-tracker-photojourney/6499454966) |
| ProgressCam | Ghost of the previous photo in the viewfinder, "smart alignment" | [listing](https://mwm.ai/apps/progresscam-progress-photos/6760968159) |
| GainFrame | Ghost overlay camera, front/side/back pose templates, **automatic body alignment** (shoulders, torso, hips) on compare | [App Store](https://apps.apple.com/app/id6759252082) |
| EZ Progress / AlignShot / MatchShot | Pin any earlier shot as a semi-transparent anchor; on-device only | [EZ](https://apps.apple.com/us/app/-/id6748616451), [AlignShot](https://apps.apple.com/app/id6754617984), [MatchShot](https://www.producthunt.com/p/matchshot/matchshot) |
| Progressly | Ghost overlays for front, side and back | [appgoblin](https://appgoblin.info/apps/6789591055) |
| MacroFactor | Front/side/back slots, gallery, before/after compare. **No overlay found**; consistency is left to written tips | [feature post](https://macrofactor.com/body-metrics/), [tips](https://help.macrofactorapp.com/en/articles/117-tips-for-taking-good-progress-photos) |
| Hevy | One photo per day with measurements, private. Basic, with no alignment | [Hevy help](https://help.hevyapp.com/hc/en-us/articles/35385479603479-Body-Composition-Tracking-Measurements-and-Progress-Photos) |

Fitness Trackr, SideLens and Dayloop were not found with public consistency features in this
pass. **Market pattern:** the ghost overlay is table stakes, and auto-alignment on compare is
the differentiator. **Nobody advertises live distance/angle coaching from pose.** That would
be ours, but it is also the riskiest layer.

## Feasibility matrix

| Technique | Works in iOS PWA? | Offline? | Cost (build / runtime) |
|---|---|---|---|
| `<input capture>` native camera | Yes, reliable, since iOS 6 | Yes | S / none |
| Gallery import | Yes | Yes | S / none |
| Setup card, floor-mark instructions | Yes | Yes | S / none |
| Manual pinch/drag alignment + ghost | Yes | Yes | M / none |
| Pose-based auto-alignment on the still (IMAGE mode) | Very likely [spike] | Yes, once ~15 MB is cached | M / ~0.3 s per photo |
| Compare: side-by-side + wipe slider | Yes | Yes | S / none |
| `getUserMedia` live preview | Yes but fragile: re-prompt per launch (327237), freezes (275527) | Yes | M / battery |
| Ghost overlay at 35 % on the live preview | Yes, wherever the preview works | Yes | S |
| Level bubble from `devicemotion` gravity | Likely; extra permission prompt per launch [spike] | Yes | S |
| Live pose cues (distance, centre, turn, tilt) | Likely at ~10 fps with lite/CPU [spike] | Yes, once cached | L / heat, ~15 MB |
| Auto-capture on pose match | Follows from the line above | Yes | S on top of the line above |
| Timer + Web Audio beeps | Yes | Yes | S |
| Voice trigger (Web Speech) | **No** (Home Screen apps) | No | Not worth it |
| ImageCapture `takePhoto()` full-res still | **No** (not on iOS) | — | — |

## Recommended layered design

### (a) Works everywhere: L0 + L1

1. **"New photo" sheet:** pick the view (Front / Side / Back). Show the "same setup" card.
   The first time, it asks the user to write down the spot and the shelf height in a note
   field we show again each time.
2. **Capture:** a "Take photo" button.
   - If L2 is enabled and healthy, open the live camera.
   - Otherwise use the file input, `<input type="file" accept="image/*" capture="user">`.
     Front by default, with a switch for "Back camera (use the iOS timer)".
   - "Choose from library" is always there too.
3. **Process:** downscale to 1600 px and re-encode to JPEG 0.85 (EXIF dropped), plus a
   thumbnail. Save to IndexedDB. Call `persist()` once.
4. **Align (L1):** lazy-load the pose model.
   - If it is cached, run IMAGE mode, fit the similarity transform to the canonical frame,
     and show the result over the reference ghost at 50 %. The user can accept, nudge or
     reset it.
   - If the model is unavailable (never cached, failed to load) or the fit fails, open
     manual alignment directly.
   - Store the transform and the landmarks.
5. **Compare:** pick any two dates of the same view, then side-by-side or wipe slider, both
   aligned.

### (b) When the live camera works: L2 + L3

- **L2: ghost + level (no ML).** The reference photo, already aligned to the canonical frame
  with its stored transform, sits over the live preview at 35 % opacity (toggle 0/35/60). Add
  a level bubble from gravity, matched against the reference shot's stored pitch/roll, plus a
  3/10 s timer with beeps. Capture = `drawImage(video)` at the track's native size. Store
  pitch/roll with the photo.
- **L3: pose coach.** Run VIDEO-mode Pose Landmarker (lite, CPU) at **10 Hz**, throttled on
  `requestVideoFrameCallback`. Show one cue at a time, in this priority: phone tilt → step
  back/closer → move left/right → turn → straighten shoulders. Show the cue big enough to
  read from 2–3 m away, and speak it as a short tone pattern rather than speech.

**Starting tolerances (tune in the spike; add 25 % hysteresis before a green state turns
red again):**

| Check | Target | Green if | Cue when outside |
|---|---|---|---|
| Phone roll (gravity) | reference roll | within ±1.5° | "Tilt phone left/right" |
| Phone pitch (gravity) | reference pitch | within ±2.0° | "Tilt top toward/away" |
| Distance: H / H_ref | 1.00 | 0.96–1.04 (±4 %) | > 1.04 "Step back"; < 0.96 "Come closer" |
| Horizontal centre: hip-mid x − ref | 0 | within ±0.03 of frame width | "Move left/right" |
| Vertical placement: hip-mid y − ref | 0 | within ±0.03 of frame height | "Raise/lower the phone" (that is, the shelf) |
| Turn: R / R_ref | 1.00 | 0.92–1.08 (±8 %) for front/back; R ≤ 0.30 for side | "Turn a little left/right" |
| Shoulder tilt T − T_ref | 0° | within ±3° | "Level your shoulders" |
| Landmark quality | — | visibility ≥ 0.6 on 0, 11, 12, 23, 24, 27, 28 | "Step fully into frame" |
| Stillness | — | phone acceleration variance under a threshold, and landmark jitter < 0.01 over the window | (wait) |

**Auto-capture:** when every check is green for **1.0 s continuously** (≥ 9 of the last 10
inferences), play 3 short beeps (0.6 s), re-check, then grab the frame. Optionally grab a
5-frame burst and keep the sharpest one. Always store the landmarks with it, so L1 alignment
has nothing left to compute. Before L3 is trusted, a manual shutter and the timer always
remain.

The **first photo of each view becomes the reference**, and no cues are shown for it, only
the setup card and the silhouette. The user can re-pick the reference in the compare view.

### Fallback rules

1. **Live camera.**
   - Camera permission denied, `getUserMedia` rejects, or the watchdog finds no frame within
     3 s or a muted/ended track: close the stream, show "Camera preview unavailable, using
     iPhone camera", and open the file input in the same tap chain. Disable L2 for the rest
     of the session.
   - After 2 failed sessions in 7 days, default to the file input and keep L2 as an opt-in
     toggle in settings.
2. **Level.** Motion permission denied, or no `devicemotion` event within 1 s: hide the level
   and keep everything else.
3. **Pose model.**
   - Not cached and offline: L3 is off, and L1 drops to manual alignment. Show "Download
     alignment model (15 MB)" next time the app is online.
   - Inference slower than 150 ms per frame at a steady state: drop to 5 Hz. Still slower
     than 300 ms: turn L3 off and keep the ghost (L2).
   - GPU delegate gives NaN or out-of-range landmarks: switch to CPU for good.
4. **Thermal.** Live session longer than 3 min with no capture: pause inference and show
   "Tap to resume". This limits heat and battery drain.
5. **Fit quality.** Residual > 3 % or low visibility: no auto-transform; open manual
   alignment.

## Risks

- **Permission fatigue.** Two system prompts (camera + motion) on every launch (WebKit
  327237 is NEW, no ETA). This may push users to the file-input path anyway. That is why L1
  carries the core value.
- **Live-stream bugs** (275527, 273938) are intermittent and device-specific, so we cannot
  test them away. The watchdog is mandatory.
- **Front-camera quality.** Front-camera video frames are lower resolution and noisier than
  the native back camera's still. That is fine for comparing body shape, worse for detail.
- **Pose on the back view and in loose clothing:** visibility scores and the shoulder ratio
  may be unreliable, so view classification can flicker.
- **Bundle and offline size:** about 15 MB extra cache, and the Workbox 2 MiB precache limit
  trap.
- **Heat and battery** from continuous inference; the GPU delegate is buggy on iOS Safari
  (mediapipe #6142).
- **Privacy:** these are the most sensitive images the app will hold. They stay on device
  with EXIF stripped and are excluded from sync. Eviction is still possible without
  `persist()`, so export matters.
- **Distance from `H` alone confuses posture with distance.** Slouching shrinks `H`. Use
  shoulder-to-ankle and nose-to-ankle together, and cue only when both agree.

## What a 1-day spike must prove on a real iPhone (installed to the Home Screen, not in a Safari tab)

1. **Camera.** `getUserMedia({video: {facingMode: 'user', width: {ideal: 1920}}})` opens in
   standalone on the operator's iOS version.
   - Log `getSettings()` for the front and back cameras.
   - Count prompts across 3 cold launches (confirm 327237).
   - Run it 10 times and count freezes or muted tracks (275527).
2. **Watchdog.** Force a failure (deny the permission) and confirm the fallback to
   `<input capture>` opens in the same tap.
3. **File input.** `<input capture="user">` and `capture="environment"`:
   - the format and size the page receives
   - whether `createImageBitmap` comes out upright
   - that the 1600 px JPEG re-encode works and carries no EXIF (check with an EXIF reader)
4. **Motion with the camera on.** `DeviceMotionEvent.requestPermission()` in standalone:
   - whether it persists across launches
   - whether `devicemotion` keeps firing **while the camera is live**
   - the noise floor of pitch/roll with the phone still on a shelf (target < 0.5°)
5. **Pose model offline.** tasks-vision + `pose_landmarker_lite` served from `public/`,
   cached by the service worker. Then turn on airplane mode, cold launch, and confirm it
   loads.
6. **Pose speed.** ms per inference, CPU vs GPU, at 10 Hz for 3 min:
   - fps over time
   - device temperature (does the warning appear?)
   - whether GPU landmarks match CPU landmarks
7. **Cue stability.** Front, side and back of the operator at 2.5 m:
   - whether the view class is stable
   - jitter of `H`, `R` and centre over 2 s standing still (must be well under the ±4 % /
     ±0.03 tolerances, or the tolerances widen)
8. **Auto-align quality.** Run IMAGE mode on 6 existing photos. Measure the residual, and do
   a visual check of the wipe slider.
9. **Storage.** `navigator.storage.persist()` result in standalone. Store 50 photos (about
   20 MB) and read them back after a relaunch.

Exit criteria: decide whether L2 and L3 ship on by default, opt-in, or not at all. L0 + L1
ship regardless.
