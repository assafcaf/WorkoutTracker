# Progress photos in a mirror: Mirror mode and Stand mode

Date: 2026-11-17 · Scope: research and redesign for `src/features/progress/photos/capture/`
· Builds on decision 0026 and `stability-and-distance.md` (photos v2).

The owner: "in practice I will picture myself in front of a mirror." Photos v2 was designed for
a phone on a shelf 2.5 m away, back camera, screen facing away, with sounds. That is not how the
photos will be taken. This note rethinks capture for the mirror selfie and keeps the shelf as a
second mode.

Tags: **[src]** read in our code, **[web]** cited source, **[eng]** engineering judgement,
**[spike]** must be measured on the owner's iPhone.

## Bottom line

| Question | Answer |
|---|---|
| Default way to take front and side | **Mirror**: back camera aimed at the mirror, phone in hand, screen facing you. You can see every cue, so sounds are off by default. |
| Back photo | **Stand + timer** (the photos v2 flow) is the default for Back. A single mirror cannot show your back with the screen in view. |
| Main live cue in Mirror | **Phone tilt (pitch first)**, then **phone height**, then **distance**, then a **same hand** hint. Hand-held, so the level matters more than on a shelf. |
| Shutter | **Auto-capture**: everything matched for 0.6 s, then a 1.5 s visible countdown, then the frame is taken when the phone is still. A tap starts a 2 s countdown instead of shooting at once. |
| Phone height | Measured without the hand: with the phone tilt known, the image's horizon row is the camera's height, so the shoulders' row against it, in torso lengths, is phone height relative to your body. |
| Saved pixels | **Kept as the mirror shows them** (not flipped), with `mode: 'mirror'` stored. Compare flips a mirror photo for display only when it sits next to a Stand photo. |
| References | Per **view + mode + camera**. A mirror reference never guides a stand photo. |
| Distance | Still valid: body scale in the frame ∝ 1 / (camera-to-reflection distance ≈ 2 × distance to the mirror). Same thresholds. |

## 1. Findings

### 1.1 What coaches and guides say about mirror progress photos [web]

- **Mirror is accepted when the setup repeats.** GainFrame: mirror selfies are fine "when that
  is the setup you can repeat"; keep the phone at the same height and on the same side, use the
  same mirror, avoid twisting toward it; a fixed camera makes a relaxed back photo easier because
  neither hand holds the phone
  ([GainFrame, by yourself](https://gainframe.app/blog/take-progress-photos-by-yourself/)).
  Stand on a fixed mark, such as a floor tile or mat edge; an arm's-length selfie widens the
  midsection ([GainFrame, 5 tips](https://gainframe.app/blog/5-tips-better-progress-photos/)).
- **Same mirror, same light, consistent phone height and angle; do not shoot straight after a
  shower** (steam on the mirror and lens); for a back shot in a mirror, face away and hold the
  phone in selfie mode at shoulder height; keep the same arm position
  ([Aristos Nutrition / CrossFit Stewarton](https://crossfitstewarton.squarespace.com/blog/2018/7/1/progress-pictures-a-practical-guide-by-cfs-nutrition)).
- **Pick one method and keep it; a mirror shot is reversed**, so mixing mirror and front-camera
  photos makes the second one flipped; choose whether the free arm is in front or at the side and
  keep it ([search summary of Gymondo, iFit, Slendertone, diet-vs-disease guides](https://blog.gymondo.com/en/post/7-pro-tips-on-taking-awesome-before-and-after-photos),
  [diet vs disease PDF](https://www.dietvsdisease.org/wp-content/uploads/2021/06/How_To_Take_Before_After_Photos_.pdf)).
  Gymondo also says to mark the camera placement with tape.
- **Some guides discourage the mirror** as hard to keep consistent and prefer someone else or a
  timer ([Aristos Nutrition](https://crossfitstewarton.squarespace.com/blog/2018/7/1/progress-pictures-a-practical-guide-by-cfs-nutrition),
  [Legion](https://legionathletics.com/how-to-take-progress-photos), 403 to our fetcher, cited from search).
  Our cues exist to remove exactly that objection.
- **Camera height:** chest or sternum height, lens level; below the waist makes the legs short
  and the torso big. Distance: 6 ft (1.8 m) or more; height consistency matters more than the
  exact height ([reshape guide](https://reshape-website-hthehqceckbmfpgk.francecentral-01.azurewebsites.net/blog/how-to-take-progress-photos-for-fitness),
  [setforset](https://www.setforset.com/blogs/news/how-to-take-progress-pics),
  [GainFrame, look smaller](https://gainframe.app/blog/why-do-i-look-smaller-in-photos/)).
- **Light:** same time of day, same source, no flash, no bright window behind you; overhead light
  changes how abs read ([MacroFactor](https://help.macrofactorapp.com/en/articles/117-tips-for-taking-good-progress-photos),
  [GainFrame, lighting](https://gainframe.app/blog/why-abs-show-in-some-lighting/)).
- **Back photos:** a 10 s timer on a stand or tripod is the standard advice
  ([GainFrame](https://gainframe.app/blog/take-progress-photos-by-yourself/),
  [transformai](https://transformai.pages.dev/blog/how-to-take-progress-photos/)). A
  second mirror works but no guide treats it as the normal path.

Nothing found addresses "phone covering the face" or "same hand" directly; both are
consequences of "same arm position" and "same height". [eng]

### 1.2 What apps do for mirrors [web]

| App | Mirror support found |
|---|---|
| PhotoJourney | Ghost mode, thirds grid, "selfie line" guides; no mirror setting found ([listing](https://mwm.ai/apps/my-body-tracker-photojourney/6499454966)) |
| ProgressCam | Ghost of the last photo plus smart alignment ([App Store](https://apps.apple.com/app/id6760968159)) |
| EZ Progress | Anchor photo faded into the viewfinder ([App Store](https://apps.apple.com/us/app/-/id6748616451)) |
| GainFrame | Ghost overlay, marked floor spot for mirror selfies, ML alignment at compare ([blog](https://gainframe.app/blog/5-tips-better-progress-photos/)) |
| Hevy | Overlay to match the previous camera position, one photo a day ([feature page](https://www.hevyapp.com/features/progress-photos/), [help](https://help.hevyapp.com/hc/en-us/articles/35385479603479-Body-Composition-Tracking-Measurements-and-Progress-Photos)) |
| A layered-image tracker | Lets you **flip the reference horizontally** when it was a selfie ([notion page](https://thinkable-paprika-658.notion.site/Layered-image-progress-tracker-43ad21ce5bda4b8098e0f2510171f7ba)) |
| Recreate (old) | Reviewed for **not** mirroring the reference for selfies ([App Store](https://apps.apple.com/us/app/recreate-the-then-now-camera-app/id946092340)) |
| MacroFactor, Fitbod, Progressly, Physiqs | Advice only, or nothing found |

Nobody advertises a mirror mode with measured cues. Everyone has a ghost. The one mirror-specific
feature seen is a horizontal flip of the reference. This is open ground, and the ghost plus
level plus body-scale cues we already have transfer directly.

### 1.3 Optics of a mirror selfie [web + eng]

- **Distance doubles.** The reflection is as far behind the mirror as you are in front of it, so
  the camera sees your body at about 2 × d ([Physics Classroom](https://www.physicsclassroom.com/class/refln/u13l2b),
  [Vaia worked problem](https://vaia.com/en-us/textbooks/physics/physics-principle-and-problems-2004-edition/chapter-17/problem-56-penny-wishes-to-take-a-picture-of-her-image-in-a-)).
  Exactly: camera-to-reflection = (d − a) + d = 2d − a, where a is how far the phone is held in
  front of the body. Body scale S ∝ 1/(2d − a), so **r = S/S_ref still measures distance**, and
  it also absorbs a different arm reach (10 cm more reach at d = 1.5 m is about 3.4 %). [eng]
- **Perspective.** At d = 1.2–1.8 m the camera is 2.4–3.6 m from the reflection, the same range
  as the 2.5 m shelf, so photos v2's "scale is fixable, perspective is not" holds: phone
  **height and pitch** must repeat; distance within ±5 % is enough because compare normalises
  scale. [eng, from stability-and-distance.md 3.2]
- **The mirror size you need is half your height**, wherever you stand
  ([Physics Classroom: portion of a mirror](https://www.physicsclassroom.com/class/refln/Lesson-2/What-Portion-of-a-Mirror-is-Required-to-View-an-Im)).
  For the camera at height h_c, the feet reflect off the mirror at about h_c/2 and the head top
  at (h_c + H)/2, so a full-length door mirror works and a basin mirror does not. [eng]
- **Fitting head to feet with a level phone.** The plain iPhone wide lens is about 26 mm
  equivalent; in a 3:4 portrait frame the vertical half-angle is atan(17.3/26) ≈ 33.6°. With the
  phone level at eye height (≈ 1.6 m), the feet enter the frame when 2d − a ≥ 1.6 / tan 33.6° ≈
  2.4 m, so **d ≥ about 1.3 m**. At chest height (≈ 1.3 m) d ≥ about 1.1 m. A level phone puts
  the body in the lower part of the frame; that is fine (the compare crop handles it) and better
  than tilting down, which shortens the legs. [eng, spike for the real FOV]
- **Where the phone appears.** When the phone is held flat to the mirror (pitch 0, roll 0), its
  own reflection sits on the optical axis, i.e. at the **image centre**. Tilting moves it by
  f·tan(angle). So the phone is always in the photo, near the centre, and it covers the face only
  if the phone is held in front of the face. [eng]
- **Orientation.** The back camera looks at the mirror as your eyes do, so the preview shows what
  you see in the mirror: raise your right hand and it rises on the right of the screen. **No
  preview flip is needed.** [eng]
- **Saved image.** A back-camera photo of a mirror is the mirror view (text on a T-shirt reads
  backwards). iOS's own "Mirror Front Camera" setting only concerns the front camera, and
  reports of what it does conflict ([Apple Community 255104341](https://discussions.apple.com/thread/255104341),
  [SlashGear](https://www.slashgear.com/1623533/mirror-front-camera-iphone-explained)). Mirror
  selfies are conventionally kept as taken. [web]

### 1.4 Pose on a reflection [web + eng]

- MediaPipe sees an ordinary image of a person; a reflection is a mirror-image person.
  Left/right labels are anatomical guesses from appearance, and in a mirrored image the model's
  "left" is the person's real right; hand handedness is documented to swap this way
  ([theneuralbase, handedness](https://theneuralbase.com/mediapipe/learn/beginner/handedness-left-vs-right/),
  [Pose Landmarker guide](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker)).
  Pose labels on a reflection are not documented. **Do not use labels for "which hand"; use
  image side** (in Mirror mode, image right = your right). [spike]
- Our distance metric (`bodyScaleOf`: shoulders, hips, ankles) never uses the nose or wrists
  [src], so a phone over the face does not break it. `bodyLinesOf` uses the nose; with the face
  covered its visibility may drop below 0.5 and the head line falls back. [spike]
- The raised arm can occlude one shoulder in a **side** mirror shot if the phone is held in the
  mirror-side hand. Holding it in the far hand, across the body, hides the chest profile. Pick
  the mirror-side hand, phone at face height, elbow out; the torso stays clear. [eng, spike]

## 2. Redesign

### 2.1 Two modes

| | **Mirror** (default for Front, Side) | **Stand + timer** (default for Back) |
|---|---|---|
| Setup | Phone in hand, back camera at a full-length mirror, screen facing you | Phone on a shelf or stand, as photos v2 |
| Camera | Back, locked (the switch is hidden) | Front or Back, as now |
| Views | Front, Side. Back only with a second mirror (not guided) | Front, Side, Back |
| Cues | Visual: level, height, distance, hand; sounds off | v2: level for placing, ticks and tones, big bar |
| Shutter | Auto-capture + countdown; tap = 2 s countdown | 10 s timer default on with the back camera |
| Native fallback | `capture="environment"` | follows the camera choice |

**How the flow asks.** On the setup screen, under the view picker, one segmented control
**"How: Mirror | Stand"**, remembered **per view** in localStorage (as `cameraPrefs` does for
the camera). First-ever defaults: Front → Mirror, Side → Mirror, Back → Stand. When Back is
picked with Mirror, show one line: "A back photo needs the phone on a stand, or a second mirror.
Use Stand?" with **Use Stand** / **Keep Mirror**. The check-in's "Next: Side → Next: Back" chain
keeps each view's mode, so the usual run is Mirror, Mirror, Stand.

### 2.2 The Mirror live screen

Top to bottom (dark viewfinder, the Ledger & Instrument language unchanged):

1. **Header:** Close · view name ("Front, mirror") · Ghost 35 % (0 / 35 / 60).
2. **Viewfinder:** the back-camera preview, not mirrored; the ghost of the **last mirror photo
   of this view** drawn through its stored align transform, same `object-fit: contain` box.
   Without a pose model: head and feet lines, as v2.
3. **One cue line** (`pickCue`, extended), one at a time in this order:
   tilt → phone height → frame → distance → matched.
4. **Instruments row:** the level line and pitch dot (exists); a **height marker**: a short
   vertical scale on the left edge of the viewfinder with the reference's mark and a live dot
   ("▲ raise / lower ▼"); the distance bar "◄ closer · farther ►" (exists; "closer" now means
   closer to the mirror).
5. **Hand hint** (small, under the cue, non-blocking): "Phone in your right hand, like last time"
   when the current hand differs from the reference's; hidden when they match or unknown.
6. **Footer:** Auto on/off toggle (default on) · shutter · "Sounds" off by default (a small
   speaker icon; v2 ticks stay available).

**Countdown.** When the cue reaches Matched, a ring fills around the shutter for 0.6 s
(confirming), then "3 · 2 · 1" in the cue line at 0.5 s steps (1.5 s), then capture. Any cue
leaving its outer band cancels and the ring drains. The frame is grabbed at the first animation
frame after the countdown in which the rotation rate is low; a white 120 ms flash and "Got it"
mark the capture.

### 2.3 Parameters

| Item | Value | Note |
|---|---|---|
| Level, pitch | in ≤ **1.5°**, out > **3.0°**, dwell 300 ms | unchanged; pitch is the one that cannot be fixed later |
| Level, roll (Mirror only) | in ≤ **2.0°**, out > **4.0°** | hand-held; roll is fixed by the align rotation at compare |
| Level target | the mirror reference's stored roll/pitch; none: pitch **0**, roll 0 | first photo: level phone (see 1.3) |
| Phone height h | h = (y_shoulderMid − y_horizon) / torso, where torso = shoulder-mid to hip-mid (normalised by frame height) and y_horizon = 0.5 + k·tan(pitch), k = 0.5 / tan(vFOV/2) ≈ 0.75 | y grows downward; h larger = phone higher. Sign of the pitch term: [spike] |
| Height zone | \|h − h_ref\| in ≤ **0.10** torso (≈ 5 cm), out > **0.18** (≈ 9 cm), dwell 500 ms; median of 5 then EMA τ 0.4 s (reuse `DistanceSmoother` shape on h, linear not log) | |
| Height words | h − h_ref > 0: "Lower the phone"; < 0: "Raise the phone" | shown only past the outer band |
| Distance | unchanged: r = S/S_ref, in ±3 %, out ±5 %, 500 ms, bar ±20 % | "Step back" / "Come closer" become "Step back from the mirror" / "Step closer to the mirror" |
| Frame | ankles or shoulders unseen: "Step back until your feet show" (ankles) / "Step into frame" | |
| Hand | the wrist (15/16) with the higher image position (smaller y) and y < shoulder-mid y; its side of the image vs shoulder-mid x gives right/left (image right = your right in Mirror) | non-blocking hint; [spike] wrist visibility behind the phone |
| Auto-capture | Matched (all measured cues in) for **600 ms**, then a **1.5 s** countdown | default on in Mirror |
| Stillness | `devicemotion.rotationRate` magnitude < **15 °/s**, waiting at most 400 ms past the countdown, else take it anyway | avoids blur |
| Tap | starts a **2 s** countdown; tap again cancels | the tap shakes the phone |
| Sounds | off in Mirror (toggle on: one tick on Matched, count beeps); on in Stand with the back camera | |
| No reference yet | cues: level (target 0/0), frame; auto-capture when level and head-to-ankles visible for 1 s | the first mirror photo becomes the reference |
| Stored with each live photo | adds `mode: 'mirror' \| 'stand'`, `phoneHeight` (h, torso units), `phoneHand: 'left' \| 'right'` | optional fields, same rules as v2's |

Pitch is tuned before height on purpose: h depends on pitch through y_horizon, and with pitch
inside 1.5° the uncorrected error is about 0.02 of the frame height, about 8 % of a torso, so
the correction is needed only to make the number honest. [eng]

### 2.4 Copy

Setup card, Mirror:
> **In the mirror.** Back camera at a full-length mirror, phone in your right hand at face
> height, held straight up. Stand where your feet show, about 1.3 m from the mirror, and mark
> the spot. Same light, same time of day; not right after a shower.

(The hand in the copy is the remembered hand, else "right".)

Setup card, Stand (Back): keep v2's text but drop "2.5 m" as a must: "Phone on a shelf or stand
at chest height, back camera facing you. 10 s timer. Mark where your toes go."

Cue lines: "Tilt top away 2°" / "Tilt top toward you 2°" (pitch), "Tilt right 2.5°" (roll),
"Raise the phone" / "Lower the phone", "Step back until your feet show", "Step closer to the
mirror" / "Step back from the mirror", "Matched", "Hold still 3 · 2 · 1", "Got it".
Hand hint: "Phone in your right hand, like last time".
Back with Mirror chosen: "A back photo needs the phone on a stand, or a second mirror. Use Stand?"

### 2.5 What to drop or change from photos v2

- **Sounds by default** in Mirror (ticks, the Matched tone). Keep them in Stand and as a toggle.
- **"2.5 m away… shelf" copy** on the setup card for Front and Side; it moves to Stand.
- **Timer emphasis:** no 10 s / Off segment in Mirror; auto-capture and the 2 s tap replace it.
- **The Front/Back camera switch** in Mirror (always back). Keep it in Stand.
- **Big-arrow, read-from-2.5 m sizing** goes; the screen is at arm's length.
- **Distance words** gain "the mirror".
- **Roll tolerance** relaxes in Mirror only (2.3).
- Keep: ghost, level filter, distance pipeline, native-camera fallback, align and compare.

### 2.6 Saved pixels, references, compare and viewer

- **Do not flip the saved photo.** Keep the mirror view: it is what the user saw, what every
  mirror selfie looks like, and decision 0026 says pixels are never changed. Store
  `mode: 'mirror'`. Photos without `mode` count as `stand` (all photos so far were taken that way
  or by the native camera).
- **References per view + mode + camera.** The ghost, level target, S_ref, h_ref and hand all come
  from the last photo with the same three keys. A first mirror photo has no reference even when
  stand photos exist (offer: "No mirror photo yet. This one becomes the reference.").
- **Compare and viewer:** a photo is drawn flipped (`scaleX(-1)` applied before its align
  transform) only when it is compared with a photo of the **other** mode, so both show the same
  side of the body on the same side. Same-mode pairs are never flipped. A small "Mirror" chip on
  each mirror photo; a "Flip" toggle in compare for the odd case.
- **Auto-align (L1)** fits nose, shoulder-mid, hip-mid and ankle-mid, all midpoints or
  centre-line points, so a flipped photo needs only the x of each point negated before the fit;
  no left/right label swap. [src: decision 0026]
- The phone is in every mirror photo. No attempt to remove it; the ghost makes it a fixed
  landmark that also helps the user repeat the hold.

### 2.7 Light (not built, optional later)

Bathroom and hallway light is overhead. Advice in the setup card is enough for now. A later cue
could store the frame's mean luminance and say "Darker than last time", but iOS auto-exposure
hides most of the difference, so it is not worth building before a device check. [eng]

## 3. Real-iPhone checks (owner's phone, Home Screen app)

1. **Pose on the reflection:** with the phone at face height, front and side, are both shoulders,
   both hips and both ankles at visibility ≥ 0.5? Standing still and hand-held, is the sd of r
   under 1.5 % after smoothing?
2. **Phone height h:** noise standing still (target sd ≤ 0.04 torso); raising the phone 5 cm
   changes h by about 0.1; the sign of the pitch term in y_horizon.
3. **Hand:** is the raised wrist found behind the phone, and does the image side match the
   hand? (Also log the model's labels to see whether they swap.)
4. **Mirror fit:** at the owner's mirror, the smallest distance at which the feet show with the
   phone level at face height (expected about 1.3 m) and whether the mirror's bottom edge cuts the
   feet.
5. **Auto-capture sharpness:** typical rotation rate while holding still; a tap-shot versus an
   auto-shot side by side for blur.
6. **Focus and exposure on a mirror:** does the back camera focus on the reflection (2d away)
   rather than smudges on the glass? Glare from the ceiling light?
7. **Level hand-held:** with fused gravity, how long does it take to reach pitch ≤ 1.5° and stay;
   are the relaxed roll bands comfortable?
8. **Lens:** the plain "Back Camera" lens stays chosen (no macro or ultra-wide switch at 2–3 m).
9. **Stand mode for Back** still works end to end, with the v2 sounds and the 10 s timer.
10. **Compare** of one mirror and one stand photo: the flip puts the same side on the same side.

## 4. Build order (suggested)

1. `mode` on the setup screen and on `Photo`; references keyed by view + mode + camera; Mirror
   copy; hide the camera switch, timer and sounds in Mirror. (No ML change.)
2. Auto-capture with countdown, stillness gate and the 2 s tap.
3. Phone height h (pure function next to `bodyScaleOf`, plus a smoother and hysteresis), its
   cue in `pickCue`, stored `phoneHeight`.
4. Hand hint and stored `phoneHand`.
5. Compare flip across modes.
