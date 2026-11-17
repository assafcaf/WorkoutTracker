# Progress photos: a steady level, a distance cue you can trust, and the back camera

Date: 2026-11-17 · Scope: research for a follow-up to E26-T7 (`src/features/progress/photos/capture/`)
· Builds on `docs/design/competitors-2026-11/photo-standardization.md` and decision 0026.

The owner tried the live capture on the iPhone and reported three things:

1. The tilt reading is too jittery.
2. The distance guidance does not say whether they stand where they stood last time.
3. They want the back camera too, with a switch.

Tags: **[src]** = read in our code, **[web]** = cited source, **[eng]** = engineering judgement,
**[spike]** = must be measured on the phone.

## Bottom line

| Problem | Cause in our code | Fix |
|---|---|---|
| Jittery level | Raw `accelerationIncludingGravity` (it includes hand shake), one React state update per event (60 Hz), no filter, one 1.5° threshold with no hysteresis, absolute 0° target | Use **gravity = `accelerationIncludingGravity` − `acceleration`**: on iOS this is CoreMotion's gyro-fused gravity. Then a 1€ filter, a Schmitt-trigger "matched" state (in at ≤1.0° held for 300 ms, out at >2.0°), a 10 Hz text update with 0.5° steps, and targets taken from the reference photo's stored roll and pitch |
| Distance not indicative | Nothing measures distance. The only cue is the ghost, and it is drawn at a **different scale** from the preview (`object-fit: contain` on the ghost, `cover` on the video). Native-camera photos (4:3, full sensor) and `getUserMedia` frames (often a 16:9 or 640×480 crop) also differ in field of view | 1) Make the ghost truthful: same fit, same aspect, same camera. 2) Measure with the pose model: body scale relative to the reference, shown as one "closer ← ● → farther" bar with a green zone of ±3 % and a % number. 3) Without the model: head and feet lines from the reference. 4) Auto-normalise scale at compare time, so ±5 % costs nothing |
| No back camera | `facingMode: 'user'` and `capture="user"` are hard-coded | A Front/Back switch that stops the old tracks before it asks for the new camera, picks the plain wide back lens, mirrors only the front preview, keeps a reference per camera, and adds beeps for when the screen faces away |

## 1. What the current code does [src]

- `LiveView` listens to `devicemotion`. Each event calls `setTilt(tiltDegrees(g.x, g.y))` with
  `g = accelerationIncludingGravity`, which re-renders about 60 times a second.
  `tiltDegrees = atan2(x, -y)` is roll only, so pitch (leaning toward or away) is never shown.
- The reading shows "Level" when |roll| ≤ 1.5°, and otherwise `Tilt N°` with `N = round(|roll|)`.
  At rest the noise is about ±0.5°, and hand shake is several degrees, so near the edge the
  label flips between "Level" and "Tilt 2°" many times a second.
- The target is absolute 0°. Decision 0026 asks for the reference photo's pitch and roll, but
  `Photo` stores no motion data.
- Distance: the setup card says "2.5 m away… tape on the floor". The live view adds a ghost,
  `img.photo-ghost { object-fit: contain }`, over `video.photo-video { object-fit: cover }`.
  On a 19.5:9 iPhone screen, `cover` zooms the 4:3 or 16:9 video until it fills the screen,
  and `contain` letterboxes the ghost, so the two are drawn at different scales. Lining up
  your body with the ghost then puts you at the wrong distance, by up to about 30 % on a
  4:3 stream **[eng: from the aspect ratios; check on the phone]**.
- `getUserMedia({ video: { facingMode: 'user' } })` has no size or aspect constraint, so iOS
  picks its default (often 640×480). The file-input path gives a full-sensor 4:3 photo. A
  ghost from one path over a preview from the other differs in field of view and framing.
- No preview mirroring, so the front preview moves "the wrong way" compared with the iOS
  Camera app. The saved frame is unmirrored, which is correct.

## 2. A steady level

### 2.1 How others do it

- **The iOS Camera level** (iOS 17+): a broken line that turns into one yellow line when level,
  disappears beyond about 25–30° and comes back when tilted less. Some reviewers report a
  faint haptic tap when it snaps level. Apple publishes no thresholds.
  [Tom's Guide](https://www.tomsguide.com/phones/iphones/my-photos-were-always-crooked-until-i-found-this-hidden-iphone-camera-trick),
  [MacRumors](https://www.macrumors.com/how-to/ios-17-straighten-camera-shooting-angle/),
  [Nerdschalk](https://nerdschalk.com/how-to-add-level-indicator-inside-camera-on-ios-17/).
  The lesson is to snap: the line *becomes* level, with a binary state on top of a continuous
  indicator.
- **Native level apps** read CoreMotion's `CMDeviceMotion.gravity`, which fuses the
  accelerometer and the gyro, rather than the raw accelerometer
  ([Apple: CMDeviceMotion.gravity](https://developer.apple.com/documentation/coremotion/cmdevicemotion/gravity),
  [NSHipster](https://nshipster.com/cmdevicemotion/)).
- **The classic low-pass filter** (Apple's old accelerometer sample, many tutorials) is
  `out += α·(in − out)`. A smaller α is steadier and lags more. α should come from the real
  time step, `α = dt / (τ + dt)`, because the event rate varies
  ([O'Reilly iOS Programming: smoothing accelerometer data](https://www.oreilly.com/library/view/ios-programming-the/9780132757058/ch08s05.html),
  [Yellow Rabbit](https://yrabbit.github.io/blog/2017/low-pass-filter-android-sensors),
  [thedelphigeek](https://www.thedelphigeek.com/2012/02/accelerometer-revisited.html)).
- **The 1€ filter** (Casiez et al.) is an EMA whose cutoff rises with speed. It is
  rock-steady at rest and quick when you move. To tune it, set β = 0, lower `mincutoff` until
  the resting jitter is gone, then raise β until fast moves stop lagging
  ([authors' page](https://cristal.univ-lille.fr/~casiez/1euro),
  [npm 1eurofilter](https://www.npmjs.com/package/1eurofilter)). It is about 40 lines, with
  no dependency.
- **A complementary filter** (gyro integrated, then pulled toward the accelerometer at
  0.98/0.02) is what you write when you only have raw sensors
  ([cursa overview](https://cursa.app/en/page/filtering-sensor-data-from-moving-averages-to-complementary-filters)).
  We don't need it, see below.

### 2.2 The key fact: iOS already gives us fused gravity [web, WebKit source]

WebKit's iOS motion code reads `CMDeviceMotion` at 1/60 s (`kMotionUpdateInterval = 1.0f / 60.0f`).
It sends `acceleration = userAcceleration · 9.80665` and
`accelerationIncludingGravity = (userAcceleration + gravity) · 9.80665`
([WebCoreMotionManager.mm](https://github.com/WebKit/WebKit/blob/main/Source/WebCore/platform/ios/WebCoreMotionManager.mm),
[WebCoreMotionManager.h](https://github.com/WebKit/WebKit/blob/main/Source/WebCore/platform/ios/WebCoreMotionManager.h)).
So on any iPhone with a gyro:

```
gravity = accelerationIncludingGravity − acceleration   // exactly CoreMotion's fused gravity × g
```

This removes hand-shake acceleration at the source, which is most of the jitter, and costs
nothing. When `acceleration` is null (no gyro, or a non-iOS browser), fall back to the raw
`accelerationIncludingGravity` with a stronger filter.

**Axis signs.** iOS reports gravity with the opposite sign to the spec and Android: lying flat
gives `z = −9.81` on iOS and `+9.81` on Android
([W3C thread, 2014](https://lists.w3.org/Archives/Public/public-geolocation/2014Jul/0024.html),
[follow-up](https://lists.w3.org/Archives/Public/public-geolocation/2014Nov/0001.html)).
Our `atan2(x, −y)` is right for iOS. To be safe elsewhere, compare against the reference's
own stored angles, measured on the same device, so a sign convention cancels out. Detect a
flipped `y` once: if the phone is held upright and `gy > 0`, negate all three axes.

### 2.3 Recommended level algorithm [eng]

```
on devicemotion(e):                       // ~60 Hz, do NOT setState here
  g = e.acceleration?.x != null
        ? aIG − acc                        // fused gravity (iOS)
        : aIG                              // raw fallback
  roll  = atan2(gx, −gy)          (deg)    // left/right
  pitch = atan2(gz, hypot(gx, gy)) (deg)   // top toward/away
  rollF  = oneEuro(roll,  t)               // filter the angles; the vector filter below is equivalent
  pitchF = oneEuro(pitch, t)
on requestAnimationFrame:                  // draw the bubble or line from rollF, pitchF (continuous)
every 100 ms:                              // the text and colour state, at 10 Hz
  err = { roll: rollF − ref.roll, pitch: pitchF − ref.pitch }
  matched = schmitt(err)                   // see below
  label  = matched ? "Matched" : stepped(err) // 0.5° steps, changes only when off by ≥ 0.5°
```

| Parameter | Value (60 Hz, fused gravity) | Value (raw fallback) | Why |
|---|---|---|---|
| 1€ `mincutoff` | **0.5 Hz** | 0.3 Hz | resting jitter well under 0.2° |
| 1€ `beta` | **0.05** per °/s | 0.03 | at 30°/s the cutoff ≈ 2 Hz, so a deliberate tilt is tracked within about 100 ms |
| 1€ `dcutoff` | 1 Hz | 1 Hz | the authors' default |
| or: EMA on the gravity vector | τ = **0.15 s** (α = dt/(τ+dt) ≈ 0.10 at 60 Hz) | τ = 0.30 s (α ≈ 0.05) | simpler alternative to 1€; renormalise the vector after the filter |
| Pre-filter | none | median of 5 samples | removes single spikes from taps on the screen |
| Roll tolerance | in at **≤ 1.0°**, out at **> 2.0°** | in ≤ 1.5°, out > 2.5° | hysteresis, so it cannot flicker at the edge |
| Pitch tolerance | in at **≤ 1.5°**, out at **> 3.0°** | same | pitch matters less than roll for a body photo |
| Dwell to enter "matched" | **300 ms** inside the inner band | 500 ms | a pass-through does not count |
| Text update | **10 Hz**, numbers in **0.5°** steps, shown only past the outer band | same | a readable number |
| Bubble or line | every animation frame from the filtered angle | same | motion stays smooth, only the label is discrete |
| Hide | \|roll\| > 25° or no event in 1 s | same | like iOS: the phone is not pointing at you |

**Reference angles.** At the shutter, store `{ roll, pitch }` as the **median of the last 0.5 s**
of filtered samples, together with `facing`. The target is the reference photo's angles for
the same view and the same camera. With no reference, the target is roll 0, pitch 0
(upright). A shelf rarely is level, but it is the same shelf every time. Photos from the file
input have no angles, so they fall back to 0/0.

**Feedback.** `navigator.vibrate` does not exist on iOS Safari, so there is no haptic. Instead,
when the state turns "Matched", play a short Web Audio tick (the same audio context as the
timer beeps, unlocked by the "Take photo" tap) and turn the line green. This matters most with
the back camera, see 4.4.

**Display.** Show one horizontal line that rotates by `rollF − ref.roll` against a fixed
reference line, like the iOS Camera level. Show pitch as a small dot that rides up and down.
When matched, the two lines merge into one green line. Text is secondary: "Tilt left 2°",
"Top away 3°".

## 3. Distance you can trust

### 3.1 What other apps do

| App | Distance method | Source |
|---|---|---|
| GainFrame | A ghost overlay of the last photo ("makes a tripod unnecessary"), a marked floor spot for mirror selfies, "same camera, lens, height and distance", **ML body alignment on compare** (shoulders, torso, hips: scale and position) | [GainFrame guide](https://gainframe.app/blog/5-tips-better-progress-photos/), [compare tool](https://gainframe.app/tools/progress-photo-compare/) |
| ProgressCam | Ghost of the previous photo, with zoom and manual fine-tuning to match framing | [App Store](https://apps.apple.com/app/id6760968159), [listing](https://mwm.ai/apps/progresscam-progress-photos/6760968159) |
| PhotoJourney | "Ghost Mode" plus camera guides | [App Store](https://apps.apple.com/us/app/-/id6499454966) |
| EZ Progress | Previous shot pinned as a semi-transparent anchor, to match angle, distance and light | [App Store](https://apps.apple.com/us/app/-/id6748616451) |
| PhotoAlign, AlignShot, MatchShot, ReShoot | General overlay cameras. One review notes you must step closer to match a zoomed "before" photo | [PhotoAlign](https://photoalign-before-and-after.pages.dev/), [AlignShot](https://apps.apple.com/app/id6754617984), [MatchShot](https://www.producthunt.com/p/matchshot/matchshot), [ReShoot](https://apps.apple.com/app/id6761676222) |
| MacroFactor | Advice only: same place, same time | [help](https://help.macrofactorapp.com/en/articles/117-tips-for-taking-good-progress-photos) |
| Timelapse community | Fixed spot, tripod, then software alignment | [uniquephoto Q&A](https://www.uniquephoto.com/community/qa/how-can-i-consistently-align-phone-photos-for-a-daily-timelapse-from-the-same-spot) |

Nobody advertises a live, measured distance cue. Everyone uses a **ghost**, and the best of them
**fix the scale after capture** (GainFrame). Searches found nothing specific about distance for
Happy Scale, Progressly or Body Journal.

### 3.2 What actually matters [eng]

At 2.5 m, standing 5 % closer (12 cm) makes the body about 5 % bigger in the frame. It barely
changes perspective: the relative size of near and far body parts changes by about
(body depth 0.3 m / 2.5 m) × 5 % ≈ 0.6 %. **Scale is fixable after capture; perspective
is not.** So:

- **Distance within ±5 % is enough** when compare auto-normalises the scale (decision 0026 L1).
  The live cue only needs to stop gross errors (wrong tile, a step off) and give confidence.
- **Camera height and pitch** change proportions (legs versus torso) and cannot be fixed
  afterwards. The level (2) and "phone at chest height" matter more than centimetres of
  distance.
- **Same lens and same field of view** are required, or every measurement compares two
  different cameras.

### 3.3 Methods compared

| Method | Reliability | Cost and offline | Verdict |
|---|---|---|---|
| (f) Same camera, aspect and fit for the ghost and the preview | Required for anything else to mean something | none | **Do first** |
| (d) Ghost overlay, aligned by the user | Good once (f) is fixed. People match head and feet well | none | Keep, as the always-on cue |
| (c) Fixed setup: tape, stand, same zoom | The most reliable physical method. Needs the user's discipline | none | Keep the card, and add "Spot" notes |
| (a) Pose landmarks, body scale against the reference | ±2–3 % after smoothing **[spike]**. Works at 2.5 m, front, side and back (back-view visibility uncertain) | lite model ≈ 5.8 MB plus wasm ≈ 9 MB, CPU, runtime-cached; already planned as L3 | **Primary measured cue** |
| (b) Face size (BlazeFace short-range, 224 KB) | Poor at full-body distance: the face is about 4 % of frame height (≈ 30 px in a 640-px stream), so ±1 px is ±3 %. The short-range model targets faces within about 2 m (selfies); the full-range model exists but is still noisy at this size. Iris depth reaches about 4 % error, but only up close | small | **No.** Mirror selfies only, not worth a second model |
| (e) Auto-normalise scale at compare | Removes the residual scale error entirely | the same pose model, IMAGE mode | **Yes, already decided (L1)** |
| Head and feet lines from the reference (non-ML) | As good as the ghost, and clearer | needs the reference's landmarks once, or two lines the user sets on the reference | **Fallback cue** |

Sources: [MediaPipe Pose Landmarker](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker),
[MediaPipe Face Detector](https://developers.google.com/edge/mediapipe/solutions/vision/face_detector),
[BlazeFace short-range model card (224 KB)](https://dcmpx.remotevs.com/com/googleapis/storage/SL/mediapipe-assets/MediaPipe%20BlazeFace%20Model%20Card%20%28Short%20Range%29.pdf),
[MediaPipe Iris, about 4 % depth error](https://goo.gle/3kJHkTG).

### 3.4 Recommended distance design

**Step 0: make the ghost truthful (no ML, do it now).**
- Draw the video and the ghost with the **same `object-fit`** in the same box. Use `contain`
  for both (a letterboxed viewfinder, as the native Camera app does at 4:3), or `cover` for
  both with the ghost cropped exactly like the video. Today they differ.
- Request one aspect: `{ width: { ideal: 1440 }, height: { ideal: 1920 }, aspectRatio: { ideal: 3/4 } }`,
  as `ideal`, never `exact` (WebKit throws OverconstrainedError for an exact 4/3 in portrait,
  [WebKit 214689](https://bugs.webkit.org/show_bug.cgi?id=214689)). Then read `track.getSettings()`
  and store `width`, `height`, `facing` and `source: 'live' | 'native'` with the photo.
  4:3 matches the native camera's full-sensor photo; 16:9 is a crop
  ([webrtcHacks](https://webrtchacks.com/how-to-figure-out-webrtc-camera-resolutions/),
  [Mozilla 1286945](https://bugzilla.mozilla.org/show_bug.cgi?id=1286945)).
- Choose the reference photo **for the same view and the same `facing`**. A front-camera
  ghost over a back-camera preview is a different field of view.

**Step 1: the measured cue (pose, L3).** Pose Landmarker lite, VIDEO mode, CPU, **8–10 Hz**
(`requestVideoFrameCallback` or rAF, skipping frames). Use normalised coordinates times the
displayed frame size so aspect is consistent.

```
S = median over the last 5 inferences of:
      full  = dist(shoulderMid(11,12), ankleMid(27,28))          // when both ankles visibility ≥ 0.5
      torso = dist(shoulderMid, hipMid(23,24)) × k_ref            // otherwise; k_ref = full/torso on the reference
r = S / S_ref                                                     // S_ref measured on the reference still (IMAGE mode), stored
rF = EMA(log r, τ = 0.4 s)                                        // smooth the log, symmetric for closer and farther
```

Shoulder-to-ankle avoids the nose (head tilt) and the feet (pose). Using `k_ref` stops slouching
from reading as distance, which the prior research flagged. Require visibility ≥ 0.5 on both
shoulders and hips, or show "Step into frame".

| Parameter | Value |
|---|---|
| Green zone | enter at \|r − 1\| ≤ **3 %**, leave at > **5 %** (hysteresis) |
| Bar range | ±20 %, clamped, with arrows past it |
| Dwell for "Matched" | 500 ms |
| Displayed number | whole % against the reference, update ≤ 4 Hz, hidden inside green |
| Words | r > 1.05 "Step back", r < 0.95 "Come closer" (bigger in frame means you are closer) |
| Optional cm | ≈ (1 − 1/r) × last distance, when the user entered "2.5 m" on the setup card |

**Presentation: one relative bar, not prose.**

```
 closer  ◄────────[ ███ ]────────►  farther
                      ●  +4 %
```

The dot sits left of the green zone when you are too close ("closer" means you are closer than
last time). Put it under the level line and show **one cue at a time** (tilt → distance → centre
→ turn), as the prior research says. All green means "Matched" plus a tick, and auto-capture
after 1.0 s if enabled.

**Step 2: fallback without the model (no ML).** If the model is not cached, offline, or the
user declines, draw two horizontal **reference lines**: the top of the head and the soles, taken
from the reference's landmarks if it was ever analysed, otherwise two lines the user drags once
on the reference photo in the align screen. "Fill the lines" is a far clearer instruction than
a 35 % ghost. Keep the ghost toggle.

**Step 3: normalise at compare (L1, decided).** Fit each photo to the canonical frame with the
least-squares similarity transform on nose, shoulder-mid, hip-mid and ankle-mid. Any remaining
±5 % scale error disappears. Without the model it stays manual (pinch), as built.

**Bundle and offline.** Pose lite `.task` ≈ 5.8 MB plus tasks-vision wasm (several MB), self-hosted
under `public/mediapipe/` with a CacheFirst runtime route, not precache (the Workbox 2 MiB limit),
behind a dynamic `import()`, so the main bundle does not change. The level and the lines need
nothing. A face model would add only about 0.2–1 MB, but section 3.3 rejects it.

## 4. Back camera and a switch

### 4.1 Facts

- `facingMode: 'user' | 'environment'` selects the camera. On iOS, a **second `getUserMedia`
  call ends the first stream's video track** ([WebKit 179363](https://bugs.webkit.org/show_bug.cgi?id=179363)).
  The working pattern is to stop every old track, clear `video.srcObject`, then request the
  other camera ([peerlist write-up](https://peerlist.io/priyangsu/articles/solving-camera-switch-in-mobile-browsers-a-unified-approach-)).
  Front and back cannot run at once ([WebKit 264288](https://bugs.webkit.org/show_bug.cgi?id=264288)).
- `facingMode` was ignored in iOS 16.4 beta ([WebKit 252560](https://bugs.webkit.org/show_bug.cgi?id=252560), fixed).
  `environment` began picking the **ultra-wide** on multi-camera iPhones ([WebKit 253186](https://bugs.webkit.org/show_bug.cgi?id=253186)).
  The "Back Triple Camera" switches lenses by itself while it crops to keep the field of view
  ([WebKit 262416](https://bugs.webkit.org/show_bug.cgi?id=262416)), and `zoom` does not stop it
  ([Apple forum 776460](https://developer.apple.com/forums/thread/776460)). For progress photos,
  a lens switch mid-series breaks consistency.
- `enumerateDevices()` returns labels only after permission has been granted in this session.
- `<input capture="user" | "environment">` is a hint. iOS opens that camera
  ([MDN capture](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/capture)).

### 4.2 Recommended switching code [eng]

```
async function open(facing) {
  current?.getTracks().forEach(t => t.stop()); video.srcObject = null      // WebKit 179363
  const base = { width:{ideal:1440}, height:{ideal:1920}, aspectRatio:{ideal:3/4} }
  let id = savedDeviceId[facing]                                            // from a previous session
  if (!id && facing === 'environment') {
    const cams = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'videoinput')
    // labels exist only after a grant; prefer the single wide lens over Dual/Triple/Ultra Wide
    id = cams.find(d => /back/i.test(d.label) && !/ultra|dual|triple|telephoto/i.test(d.label))?.deviceId
  }
  stream = await getUserMedia({ video: id ? { ...base, deviceId:{exact:id} } : { ...base, facingMode:{ideal:facing} } })
  verify(stream.getVideoTracks()[0].getSettings().facingMode === facing)   // else tell the user
  savedDeviceId[facing] = track.getSettings().deviceId                     // persist per facing
  await firstFrame(3000)                                                    // keep the existing freeze guard
}
```

- On iOS, device labels are **localised** to the phone's language, and the owner's phone may
  not be set to English. If the label match finds nothing, fall back to `facingMode`, then check
  `getSettings()` and a stable `deviceId` after the first good open **[spike: label strings on
  the owner's phone]**.
- Put the switch in the live header (a "Front / Back" segmented control, or one flip icon).
  Remember the choice **per view** in local settings. Disable the shutter while it switches,
  and show "Switching…".
- **Mirror only the front preview**: `transform: scaleX(-1)` on the `<video>` *and* on the ghost
  in the live view, so the two coincide. Never mirror the saved frame. In the align and compare
  screens, draw both unmirrored.
- Store `facing` on each photo. The reference, the level angles and `S_ref` are per facing.
  Compare across cameras is allowed, because normalisation fixes the scale.
- The file-input fallback uses `capture={facing === 'environment' ? 'environment' : 'user'}`.
- **[spike]** Does a switch inside one session re-prompt for permission in the Home Screen app?
  Does iOS keep the chosen back lens for the whole session?

### 4.3 Why the back camera changes the cue design

Back camera means the phone is on a shelf facing you (or someone holds it), and you **cannot see
the screen**. So:

- The level is for the person placing the phone. Check it before walking to the spot.
- Distance and pose cues must be **audible**. Use Web Audio, unlocked by the tap: a slow tick
  while out of zone, faster ticks as you approach the green zone, one high tone when all
  green, then the 10 s countdown beeps. `speechSynthesis` ("step back") would be nicer, but it
  is unproven in Home Screen apps **[spike]**.
- Big, high-contrast arrows are readable from 2.5 m: the bar plus an arrow of about 30 % of the
  screen width.

## 5. Summary of parameters

| Item | Value |
|---|---|
| Gravity source | `accelerationIncludingGravity − acceleration` (CoreMotion fused). Fallback: raw |
| Angles | roll = atan2(gx, −gy), pitch = atan2(gz, hypot(gx, gy)). Flip the signs if `gy > 0` when upright |
| Filter | 1€: mincutoff 0.5 Hz, beta 0.05, dcutoff 1 Hz. Or an EMA on the vector, τ 0.15 s (α ≈ 0.10 at 60 Hz). Raw fallback: median of 5, then mincutoff 0.3 or τ 0.30 s |
| Level state | roll in ≤ 1.0°, out > 2.0°. pitch in ≤ 1.5°, out > 3.0°. Dwell 300 ms |
| UI rate | the line every animation frame. Text 10 Hz in 0.5° steps. No setState in the event handler |
| Reference angles | median of the last 0.5 s at the shutter, stored with `facing`. Target = reference, else 0/0 |
| Distance metric | shoulder-mid to ankle-mid (torso × k_ref when the ankles are hidden), r = S/S_ref, EMA of log r with τ 0.4 s at 8–10 Hz |
| Distance zone | in ±3 %, out ±5 %, bar ±20 %, dwell 500 ms, "Step back" or "Come closer" |
| Ghost | the same `object-fit` as the video, 3:4 `ideal` stream, a reference from the same view and `facing` |
| Fallback | head and feet lines plus the ghost. Compare auto-normalises scale (L1) |
| Camera switch | stop tracks, then clear srcObject, then gUM. Prefer the plain "Back Camera" deviceId, persisted. Mirror front only. Per-view facing |
| Back-camera cues | Web Audio ticks and tones. Big arrows |

## 6. Spike checks to add (owner's iPhone, Home Screen app)

1. Is `e.acceleration` non-null in `devicemotion` while `getUserMedia` is live? What is the noise
   of the fused gravity at rest, and with the phone held in the hand?
2. Is the sign of `gy` upright negative?
3. `getSettings()` for `{ideal: 1440×1920, 3/4}` on the front and the back: the actual size and
   the field of view against a native photo.
4. Back-camera labels from `enumerateDevices` on the owner's phone. Does the plain "Back Camera"
   deviceId stop lens switching?
5. Does switching facing inside one session re-prompt?
6. Pose `r` noise at 2.5 m standing still: the target is under 1.5 % sd after smoothing.
