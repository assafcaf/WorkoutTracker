import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type {
  Photo,
  PhotoAngle,
  PhotoBodyLines,
  PhotoBodyScale,
  PhotoCamera,
  PhotoCaptureInfo,
  PhotoHand,
  PhotoMode,
} from '../../../../storage/photoStore'
import { Segmented } from '../../../../ui/controls'
import { cssTransform } from './align'
import { AutoCapture, FIRST_PHOTO_CONFIRM_MS, rotationOf } from './autoCapture'
import type { AutoState } from './autoCapture'
import type { LiveFeed } from './camera'
import { pickCue } from './cue'
import type { DistanceCue, HeightCue } from './cue'
import {
  DistanceSmoother,
  MIN_VISIBILITY,
  POSE,
  barPosition,
  bodyLinesOf,
  bodyScaleOf,
  distanceTrigger,
  distanceWord,
  percentOff,
  scaleRatio,
  tickInterval,
} from './distance'
import type { Landmark } from './distance'
import { HeightSmoother, handOf, heightPosition, heightTrigger, heightWord, phoneHeightOf } from './height'
import { LevelTracker, levelWords, median, steppedDegrees } from './level'
import type { Angles } from './level'
import type { LoadPose, PoseModel } from './pose'
import { playCount, playMatched, playTick, unlockCaptureSound } from './sound'

const GHOSTS = [35, 60, 0] as const
const TIMER_SECONDS = 10
/** Level text and state rate: 10 Hz. */
const LEVEL_TEXT_MS = 100
/** Distance number rate: at most 4 Hz. */
const DISTANCE_TEXT_MS = 250
/** Pose inference rate: about 9 Hz. */
const POSE_INTERVAL_MS = 110
/** Body sizes this recent are what a shutter stores. */
const SCALE_WINDOW_MS = 1500
/** The auto-capture state machine's rate. */
const AUTO_MS = 50
/** A rotation rate older than this is unknown. */
const ROTATION_STALE_MS = 500
/** The white flash at the shutter. */
const FLASH_MS = 120

type Timer = '10' | 'off'
export type ViewName = { value: PhotoAngle; label: string }
/** Where the live camera is: being opened, showing, or refused (the camera app is the way). */
export type CameraState = 'opening' | 'open' | 'failed'

type LevelView = { visible: boolean; matched: boolean; words: string | null }
type DistanceView =
  | { kind: 'off' }
  | { kind: 'loading' }
  | { kind: 'no-body' }
  | { kind: 'measured'; matched: boolean; word: string | null; percent: number; position: number; clamped: boolean; closer: boolean }
type HeightView = { kind: 'off' } | { kind: 'measured'; matched: boolean; word: string | null; position: number }
type MirrorView = { height: HeightView; feet: boolean | null; hand: PhotoHand | null }

/** What the pose loop writes and the 4 Hz display reads; never React state. */
type PoseState = {
  ready: boolean
  refScale: PhotoBodyScale | null
  refHeight: number | null
  body: boolean
  r: number | null
  matched: boolean
  scales: { t: number; scale: PhotoBodyScale }[]
  lines: PhotoBodyLines | null
  feet: boolean | null
  h: number | null
  hMatched: boolean
  heights: { t: number; h: number }[]
  hands: PhotoHand[]
}

const emptyPose = (): PoseState => ({
  ready: false,
  refScale: null,
  refHeight: null,
  body: false,
  r: null,
  matched: false,
  scales: [],
  lines: null,
  feet: null,
  h: null,
  hMatched: false,
  heights: [],
  hands: [],
})

const sameLevel = (a: LevelView, b: LevelView): boolean =>
  a.visible === b.visible && a.matched === b.matched && a.words === b.words
const sameJson = <T,>(a: T, b: T): boolean => JSON.stringify(a) === JSON.stringify(b)

/** The body size to store at the shutter: the median of the last few inferences. */
function medianScale(scales: readonly PhotoBodyScale[]): PhotoBodyScale | null {
  if (scales.length === 0) return null
  const fulls = scales.map((s) => s.full).filter((f): f is number => f !== null)
  return {
    torso: median(scales.map((s) => s.torso)),
    full: fulls.length * 2 > scales.length ? median(fulls) : null,
  }
}

/** The hand seen most often lately, or null. */
function usualHand(hands: readonly PhotoHand[]): PhotoHand | null {
  if (hands.length === 0) return null
  const right = hands.filter((h) => h === 'right').length
  if (right * 2 === hands.length) return hands[hands.length - 1]
  return right * 2 > hands.length ? 'right' : 'left'
}

async function decodeStill(blob: Blob): Promise<{ frame: ImageBitmap; width: number; height: number } | null> {
  if (typeof createImageBitmap !== 'function') return null
  const frame = await createImageBitmap(blob)
  return { frame, width: frame.width, height: frame.height }
}

const round2 = (n: number): number => Math.round(n * 100) / 100
const ankleSeen = (l: Landmark | undefined): boolean => !!l && (l.visibility ?? 1) >= MIN_VISIBILITY

const VIEWS: ViewName[] = [
  { value: 'front', label: 'Front' },
  { value: 'side', label: 'Side' },
  { value: 'back', label: 'Back' },
]
const MODES: { value: PhotoMode; label: string }[] = [
  { value: 'mirror', label: 'Mirror' },
  { value: 'stand', label: 'Stand' },
]

/** Mirror mode's distance words name the mirror ("closer" is closer to it). */
const mirrorDistanceWord = (word: string | null): string | null =>
  word === 'Step back' ? 'Step back from the mirror' : word === 'Come closer' ? 'Step closer to the mirror' : word

/**
 * The camera view (decision 0026 L2 and L3, photos v2, mirror mode): every choice sits on it, so
 * capture opens straight onto the live camera. The view (Front / Side / Back) and the mode
 * (Mirror / Stand) are compact controls under the header; changing one reconfigures the view in
 * place. The stream and the reference ghost share one box with the same fit, mirrored together
 * for the front camera; one cue at a time; the distance bar when the pose model runs, or the
 * reference's head and feet lines when it does not.
 *
 * Stand mode is photos v2 unchanged: the timer, the camera switch and sounds for when the screen
 * faces away. Mirror mode (back camera at a mirror, phone in hand) adds the phone height and feet
 * cues, the hand hint and auto-capture with a countdown; it has no timer or camera switch and is
 * silent unless Sounds is turned on.
 */
export function LiveView({
  feed,
  facing,
  camera,
  view,
  mode,
  reference,
  referenceBlob,
  referenceUrl,
  referenceDay,
  loadPose,
  notes,
  onView,
  onMode,
  onClose,
  onSwitch,
  onFrame,
  onCameraApp,
  onLibrary,
  onTouch,
}: {
  feed: LiveFeed | null
  facing: PhotoCamera
  camera: CameraState
  view: ViewName
  mode: PhotoMode
  reference: Photo | undefined
  referenceBlob: Blob | null
  referenceUrl: string | null
  /** "10 Nov": the reference photo's day, shown as what this one matches. */
  referenceDay: string | null
  loadPose?: LoadPose
  /** Inline notes (setup tips, the back-in-a-mirror note), drawn under the cues. */
  notes?: ReactNode
  onView(next: PhotoAngle): void
  onMode(next: PhotoMode): void
  onClose(): void
  onSwitch(next: PhotoCamera): void
  onFrame(blob: Blob, info: PhotoCaptureInfo): void
  onCameraApp(): void
  onLibrary(): void
  /** Any tap on the view: the motion permission and sound unlock need a user gesture. */
  onTouch(): void
}): JSX.Element {
  const mirror = mode === 'mirror'
  const video = useRef<HTMLVideoElement>(null)
  const line = useRef<HTMLSpanElement>(null)
  const dot = useRef<HTMLSpanElement>(null)
  const [ghostIndex, setGhostIndex] = useState(0)
  const [timer, setTimer] = useState<Timer>(!mirror && facing === 'environment' ? '10' : 'off')
  const [count, setCount] = useState<number | null>(null)
  const [auto, setAuto] = useState(true)
  const [soundsOn, setSoundsOn] = useState(!mirror)
  const [shot, setShot] = useState<AutoState | null>(null)
  const [flash, setFlash] = useState(false)
  const [level, setLevel] = useState<LevelView>({ visible: false, matched: false, words: null })
  const [distance, setDistance] = useState<DistanceView>({ kind: 'off' })
  const [mirrorView, setMirrorView] = useState<MirrorView>({ height: { kind: 'off' }, feet: null, hand: null })
  const tracker = useMemo(() => new LevelTracker(), [])
  const machine = useMemo(() => new AutoCapture(), [])
  const rotation = useRef<{ t: number; rate: number | null }>({ t: 0, rate: null })
  const pose = useRef<PoseState>(emptyPose())
  const ghost = GHOSTS[ghostIndex]
  const mirrored = facing === 'user'
  const onFrameRef = useRef(onFrame)
  onFrameRef.current = onFrame
  const sounds = useRef(soundsOn)
  sounds.current = soundsOn

  // The target is the reference photo's own angles, from the same view, mode and camera; else upright.
  tracker.target = { roll: reference?.roll ?? 0, pitch: reference?.pitch ?? 0 }
  tracker.setMirror(mirror)

  useEffect(() => {
    if (feed && video.current) feed.attach(video.current)
  }, [feed])

  // Motion events only feed the tracker and the rotation rate: no React state at 60 Hz.
  useEffect(() => {
    const onMotion = (event: Event): void => {
      const t = Date.now()
      tracker.push(event as DeviceMotionEvent, t)
      rotation.current = { t, rate: rotationOf((event as DeviceMotionEvent).rotationRate) }
    }
    window.addEventListener('devicemotion', onMotion)
    return () => window.removeEventListener('devicemotion', onMotion)
  }, [tracker])

  // The line and the pitch dot follow the filtered angles every animation frame.
  useEffect(() => {
    if (typeof requestAnimationFrame !== 'function') return
    let id = 0
    const draw = (): void => {
      const err = tracker.error()
      if (err) {
        const roll = Math.max(-25, Math.min(25, err.roll))
        const pitch = Math.max(-10, Math.min(10, err.pitch))
        if (line.current) line.current.style.transform = `rotate(${-roll}deg)`
        if (dot.current) dot.current.style.transform = `translateY(${pitch * 4}px)`
      }
      id = requestAnimationFrame(draw)
    }
    id = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(id)
  }, [tracker])

  // The level's words and matched state, ten times a second, in 0.5° steps.
  useEffect(() => {
    let shown: Angles | null = null
    let wasMatched = false
    const id = setInterval(() => {
      const t = Date.now()
      const visible = tracker.visible(t)
      const matched = tracker.matched(t)
      const err = tracker.error()
      let words: string | null = null
      if (visible && err && !matched) {
        shown = { roll: steppedDegrees(shown?.roll ?? null, err.roll), pitch: steppedDegrees(shown?.pitch ?? null, err.pitch) }
        words = levelWords(err, shown, tracker.tuning, mirror)
      } else {
        shown = null
      }
      if (matched && !wasMatched && sounds.current) playTick()
      wasMatched = matched
      const next = { visible, matched, words }
      setLevel((prev) => (sameLevel(prev, next) ? prev : next))
    }, LEVEL_TEXT_MS)
    return () => clearInterval(id)
  }, [tracker, mirror])

  // The pose model: loaded only now, when the live camera is open; measured against the reference.
  useEffect(() => {
    if (!feed || !loadPose) return
    let cancelled = false
    let timerId: ReturnType<typeof setTimeout> | undefined
    const state = emptyPose()
    pose.current = state
    const smoother = new DistanceSmoother()
    const trigger = distanceTrigger()
    const heights = new HeightSmoother()
    const heightZone = heightTrigger()
    const run = async (): Promise<void> => {
      let model: PoseModel
      try {
        model = await loadPose()
      } catch {
        return // Offline before the first use, or unsupported: the head and feet lines stay.
      }
      if (cancelled) return
      let refScale = reference?.bodyScale ?? null
      let refHeight = mirror ? reference?.phoneHeight ?? null : null
      if ((!refScale || (mirror && refHeight === null)) && referenceBlob) {
        try {
          const still = await decodeStill(referenceBlob)
          const landmarks = still ? await model.image(still.frame) : null
          if (still && landmarks) {
            refScale = refScale ?? bodyScaleOf(landmarks, still.width, still.height)
            if (mirror && refHeight === null) refHeight = phoneHeightOf(landmarks, reference?.pitch ?? 0)
          }
        } catch {
          // Keep what is stored.
        }
      }
      if (cancelled) return
      state.refScale = refScale
      state.refHeight = refHeight
      state.ready = true
      const step = (): void => {
        if (cancelled) return
        const v = video.current
        if (v && v.videoWidth > 0 && v.videoHeight > 0) {
          const t = Date.now()
          let landmarks: Landmark[] | null = null
          try {
            landmarks = model.video(v, typeof performance !== 'undefined' ? performance.now() : t)
          } catch {
            landmarks = null
          }
          const scale = landmarks ? bodyScaleOf(landmarks, v.videoWidth, v.videoHeight) : null
          if (!scale || !landmarks) {
            state.body = false
            state.matched = false
            state.feet = null
            state.hMatched = false
            trigger.reset()
            heightZone.reset()
          } else {
            state.body = true
            state.scales.push({ t, scale })
            while (state.scales.length > 5) state.scales.shift()
            state.lines = bodyLinesOf(landmarks)
            state.feet = ankleSeen(landmarks[POSE.leftAnkle]) && ankleSeen(landmarks[POSE.rightAnkle])
            if (refScale) {
              state.r = smoother.push(scaleRatio(scale, refScale), t)
              state.matched = trigger.update([state.r - 1], t)
            }
            if (mirror) {
              const h = phoneHeightOf(landmarks, tracker.angles?.pitch ?? 0)
              if (h !== null) {
                state.h = heights.push(h, t)
                state.heights.push({ t, h })
                while (state.heights.length > 5) state.heights.shift()
                if (refHeight !== null) state.hMatched = heightZone.update([state.h - refHeight], t)
              }
              const hand = handOf(landmarks)
              if (hand) {
                state.hands.push(hand)
                while (state.hands.length > 9) state.hands.shift()
              }
            }
          }
        }
        timerId = setTimeout(step, POSE_INTERVAL_MS)
      }
      step()
    }
    void run()
    return () => {
      cancelled = true
      if (timerId !== undefined) clearTimeout(timerId)
    }
  }, [feed, loadPose, reference, referenceBlob, mirror, tracker])

  // The distance bar and number, at most four times a second; ticks when the screen faces away.
  useEffect(() => {
    let lastTick = 0
    const id = setInterval(() => {
      const ps = pose.current
      const t = Date.now()
      let next: DistanceView
      if (!ps.ready) next = { kind: loadPose && reference && feed ? 'loading' : 'off' }
      else if (!ps.refScale) next = { kind: mirror && !ps.body ? 'no-body' : 'off' }
      else if (!ps.body) next = { kind: 'no-body' }
      else if (ps.r === null) next = { kind: 'loading' }
      else {
        const { position, clamped } = barPosition(ps.r)
        const word = distanceWord(ps.r, ps.matched)
        next = {
          kind: 'measured',
          matched: ps.matched,
          word: mirror ? mirrorDistanceWord(word) : word,
          percent: percentOff(ps.r),
          position,
          clamped,
          closer: ps.r > 1,
        }
        if (facing === 'environment' && sounds.current && !ps.matched && t - lastTick >= tickInterval(ps.r)) {
          playTick()
          lastTick = t
        }
      }
      setDistance((prev) => (sameJson(prev, next) ? prev : next))
      if (mirror) {
        let height: HeightView = { kind: 'off' }
        if (ps.ready && ps.body && ps.h !== null && ps.refHeight !== null) {
          const delta = ps.h - ps.refHeight
          height = { kind: 'measured', matched: ps.hMatched, word: heightWord(delta, ps.hMatched), position: heightPosition(delta) }
        }
        const mv: MirrorView = { height, feet: ps.ready && ps.body ? ps.feet : null, hand: usualHand(ps.hands) }
        setMirrorView((prev) => (sameJson(prev, mv) ? prev : mv))
      }
    }, DISTANCE_TEXT_MS)
    return () => clearInterval(id)
  }, [facing, feed, loadPose, reference, mirror])

  const distanceCue: DistanceCue =
    distance.kind === 'measured' ? { kind: 'measured', matched: distance.matched, word: distance.word } : distance.kind === 'no-body' ? { kind: 'no-body' } : { kind: 'off' }
  const heightCue: HeightCue =
    mirrorView.height.kind === 'measured' ? { kind: 'measured', matched: mirrorView.height.matched, word: mirrorView.height.word } : { kind: 'off' }
  const cue = pickCue(level, distanceCue, reference ? 'Matched' : 'Level', mirror ? { height: heightCue, feet: mirrorView.feet } : {})

  useEffect(() => {
    if (cue.kind === 'matched' && sounds.current) playMatched()
  }, [cue.kind])

  const capture = (): void => {
    if (!feed) return
    const t = Date.now()
    const angles = tracker.reference(t)
    const recent = pose.current.scales.filter((s) => s.t >= t - SCALE_WINDOW_MS).map((s) => s.scale)
    const bodyScale = medianScale(recent)
    const info: PhotoCaptureInfo = { camera: facing, source: 'live', mode }
    if (angles) {
      info.roll = round2(angles.roll)
      info.pitch = round2(angles.pitch)
    }
    if (bodyScale) info.bodyScale = bodyScale
    if (bodyScale && pose.current.lines) info.bodyLines = pose.current.lines
    if (mirror) {
      const hs = pose.current.heights.filter((h) => h.t >= t - SCALE_WINDOW_MS).map((h) => h.h)
      if (hs.length > 0) info.phoneHeight = round2(median(hs))
      const hand = usualHand(pose.current.hands)
      if (hand) info.phoneHand = hand
    }
    if (feed.size) {
      info.streamWidth = feed.size.width
      info.streamHeight = feed.size.height
    }
    void feed.grab().then((blob) => onFrameRef.current(blob, info))
  }
  const captureRef = useRef(capture)
  captureRef.current = capture

  // Stand mode's timer, one second at a time.
  useEffect(() => {
    if (count === null) return
    if (count > 0) {
      if (sounds.current) playCount(false)
      const id = setTimeout(() => setCount(count - 1), 1000)
      return () => clearTimeout(id)
    }
    if (sounds.current) playCount(true)
    setCount(null)
    captureRef.current()
  }, [count])

  // Mirror mode's shutter: all matched 0.6 s, then 3·2·1, then the frame when the phone is still.
  const poseSettled = !loadPose || distance.kind !== 'loading'
  const autoReady = cue.kind === 'matched' && poseSettled && camera === 'open'
  const autoInput = useRef({ autoReady, auto, confirmMs: reference ? undefined : FIRST_PHOTO_CONFIRM_MS })
  autoInput.current = { autoReady, auto, confirmMs: reference ? undefined : FIRST_PHOTO_CONFIRM_MS }
  useEffect(() => {
    if (!mirror || !feed) return
    let lastCount: number | null = null
    const id = setInterval(() => {
      const t = Date.now()
      const r = rotation.current
      const input = autoInput.current
      const state = machine.update({
        t,
        matched: input.autoReady,
        auto: input.auto,
        rotation: t - r.t <= ROTATION_STALE_MS ? r.rate : null,
        confirmMs: input.confirmMs,
      })
      if (state.count !== lastCount && state.count !== null && sounds.current) playCount(false)
      lastCount = state.count
      setShot((prev) => (prev && sameJson(prev, { ...state, fire: false }) ? prev : { ...state, fire: false }))
      if (state.fire) {
        if (sounds.current) playCount(true)
        setFlash(true)
        captureRef.current()
      }
    }, AUTO_MS)
    return () => clearInterval(id)
  }, [mirror, feed, machine])

  useEffect(() => {
    if (!flash) return
    const id = setTimeout(() => setFlash(false), FLASH_MS)
    return () => clearTimeout(id)
  }, [flash])

  const shutter = (): void => {
    unlockCaptureSound()
    if (mirror) {
      machine.tap(Date.now())
      return
    }
    if (count !== null) {
      setCount(null)
      return
    }
    if (timer === 'off') capture()
    else setCount(TIMER_SECONDS)
  }

  const other: PhotoCamera = facing === 'user' ? 'environment' : 'user'
  const otherName = other === 'user' ? 'front' : 'back'
  const ghostTransform = `${mirrored ? 'scaleX(-1) ' : ''}${cssTransform(reference?.align ?? null)}`
  const lines = reference?.bodyLines ?? null
  const showLines = lines !== null && distance.kind !== 'measured' && referenceUrl !== null
  const phase = mirror ? shot?.phase ?? 'idle' : 'idle'
  const counting = phase === 'counting' || phase === 'steadying'
  const cueText = phase === 'fired' ? 'Got it' : counting && shot?.count ? `Hold still · ${shot.count}` : cue.text
  const cueKind = phase === 'fired' || counting ? 'matched' : cue.kind
  const hint =
    mirror && reference?.phoneHand && mirrorView.hand && mirrorView.hand !== reference.phoneHand
      ? `Phone in your ${reference.phoneHand} hand, like last time`
      : null
  const height = mirror ? mirrorView.height : { kind: 'off' as const }

  return (
    <div className="photo-live" data-mode={mode} onClickCapture={onTouch}>
      <div className="photo-viewfinder">
        <video ref={video} className="photo-video" data-mirrored={mirrored} playsInline muted />
        {referenceUrl && ghost > 0 ? (
          <img
            className="photo-ghost photo-ghost-live"
            src={referenceUrl}
            alt={`Last ${view.value} photo`}
            style={{ opacity: ghost / 100, transform: ghostTransform }}
          />
        ) : null}
        {showLines && reference ? (
          <svg
            className="photo-lines"
            viewBox={`0 0 ${reference.width} ${reference.height}`}
            preserveAspectRatio="xMidYMid meet"
            style={{ transform: ghostTransform }}
            role="img"
            aria-label="Head and feet lines from the last photo"
          >
            <line x1={0} x2={reference.width} y1={lines.head * reference.height} y2={lines.head * reference.height} />
            <line x1={0} x2={reference.width} y1={lines.feet * reference.height} y2={lines.feet * reference.height} />
          </svg>
        ) : null}
        {height.kind === 'measured' ? (
          <div className="photo-height" role="group" aria-label="Phone height" data-matched={height.matched}>
            <span className="photo-height-end">higher</span>
            <span className="photo-height-scale">
              <span className="photo-height-ref" />
              <span className="photo-height-dot" style={{ top: `${50 - height.position * 45}%` }} />
            </span>
            <span className="photo-height-end">lower</span>
          </div>
        ) : null}
        {flash ? <span className="photo-flash" aria-hidden="true" /> : null}
      </div>
      {referenceUrl && ghost === 0 ? <span className="photo-visually-hidden">{`Last ${view.value} photo hidden`}</span> : null}
      <header className="photo-header photo-header-live">
        <button type="button" className="btn-quiet" onClick={onClose}>
          Close
        </button>
        <h1 className="photo-title">{mirror ? `${view.label}, mirror` : view.label}</h1>
        <button type="button" className="chip photo-chip" onClick={() => setGhostIndex((ghostIndex + 1) % GHOSTS.length)}>
          {`Ghost ${ghost}%`}
        </button>
      </header>
      <div className="photo-live-setup">
        <Segmented name="photo-angle" label="View" value={view.value} options={VIEWS} onChange={onView} />
        <Segmented name="photo-mode" label="How" value={mode} options={MODES} onChange={onMode} />
      </div>
      <div className="photo-guides">
        {referenceDay ? <p className="photo-live-note photo-matching">{`Matching ${referenceDay}`}</p> : null}
        {level.visible ? (
          <div className="photo-gauge" data-matched={level.matched} aria-hidden="true">
            <span className="photo-gauge-ref" />
            <span ref={line} className="photo-gauge-line" />
            <span ref={dot} className="photo-gauge-dot" />
          </div>
        ) : null}
        {cueText ? (
          <p className="photo-level photo-cue" data-level={cueKind === 'matched'} aria-live="polite">
            {cueText}
          </p>
        ) : null}
        {hint ? <p className="photo-live-note photo-hand">{hint}</p> : null}
        {distance.kind === 'measured' ? (
          <div className="photo-distance" role="group" aria-label="Distance" data-matched={distance.matched}>
            <div className="photo-distance-row">
              <span className="photo-distance-end">◄ closer</span>
              <span className="photo-bar">
                <span className="photo-bar-zone" />
                <span
                  className="photo-bar-dot"
                  data-clamped={distance.clamped}
                  style={{ left: `${50 + distance.position * 50}%` }}
                />
              </span>
              <span className="photo-distance-end">farther ►</span>
            </div>
            <p className="photo-distance-number">
              {distance.matched ? 'Same distance' : `${distance.percent}% ${distance.closer ? 'closer' : 'farther'}`}
            </p>
          </div>
        ) : null}
        {feed && feed.facingMatches === false ? (
          <p className="photo-live-note">{`This may not be the ${facing === 'user' ? 'front' : 'back'} camera.`}</p>
        ) : null}
        {camera === 'failed' ? (
          <p className="photo-live-note photo-live-failed" role="status">
            Camera preview unavailable on this phone. Use camera app opens the iPhone camera.
          </p>
        ) : null}
        {notes}
      </div>
      {count !== null ? <p className="photo-countdown">{count}</p> : null}
      {camera === 'opening' ? (
        <p className="photo-switching" role="status">
          Switching…
        </p>
      ) : null}
      <div className="photo-live-bottom">
        <div className="photo-live-controls">
          {mirror ? (
            <button
              type="button"
              className="chip photo-chip photo-toggle"
              aria-pressed={auto}
              onClick={() => {
                if (auto) machine.reset()
                setAuto(!auto)
              }}
            >
              {auto ? 'Auto on' : 'Auto off'}
            </button>
          ) : (
            <Segmented
              name="photo-timer"
              label="Timer"
              value={timer}
              options={[
                { value: '10', label: '10s' },
                { value: 'off', label: 'Off' },
              ]}
              onChange={setTimer}
            />
          )}
          <button
            type="button"
            className="icon-btn photo-shutter"
            aria-label="Shutter"
            data-phase={phase}
            disabled={camera !== 'open' || !feed}
            onClick={shutter}
          />
          {mirror ? (
            <button
              type="button"
              className="chip photo-chip photo-toggle"
              aria-pressed={soundsOn}
              onClick={() => {
                unlockCaptureSound()
                setSoundsOn(!soundsOn)
              }}
            >
              {soundsOn ? 'Sounds on' : 'Sounds off'}
            </button>
          ) : (
            <button
              type="button"
              className="chip photo-chip photo-switch"
              aria-label={`Switch to ${otherName} camera`}
              disabled={camera === 'opening'}
              onClick={() => {
                unlockCaptureSound()
                setCount(null)
                onSwitch(other)
              }}
            >
              {`${otherName === 'back' ? 'Back' : 'Front'} camera`}
            </button>
          )}
        </div>
        <div className="photo-live-more">
          <button type="button" className="btn-quiet" onClick={onCameraApp}>
            Use camera app
          </button>
          <button type="button" className="btn-quiet" onClick={onLibrary}>
            Choose from library
          </button>
        </div>
      </div>
    </div>
  )
}
