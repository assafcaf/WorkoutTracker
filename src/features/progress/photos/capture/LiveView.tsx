import { useEffect, useMemo, useRef, useState } from 'react'
import type { Photo, PhotoAngle, PhotoBodyLines, PhotoBodyScale, PhotoCamera, PhotoCaptureInfo } from '../../../../storage/photoStore'
import { Segmented } from '../../../../ui/controls'
import { cssTransform } from './align'
import type { LiveFeed } from './camera'
import { pickCue } from './cue'
import type { DistanceCue } from './cue'
import {
  DistanceSmoother,
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

type Timer = '10' | 'off'
export type ViewName = { value: PhotoAngle; label: string }

type LevelView = { visible: boolean; matched: boolean; words: string | null }
type DistanceView =
  | { kind: 'off' }
  | { kind: 'loading' }
  | { kind: 'no-body' }
  | { kind: 'measured'; matched: boolean; word: string | null; percent: number; position: number; clamped: boolean; closer: boolean }

/** What the pose loop writes and the 4 Hz display reads; never React state. */
type PoseState = {
  ready: boolean
  refScale: PhotoBodyScale | null
  body: boolean
  r: number | null
  matched: boolean
  scales: { t: number; scale: PhotoBodyScale }[]
  lines: PhotoBodyLines | null
}

const sameLevel = (a: LevelView, b: LevelView): boolean =>
  a.visible === b.visible && a.matched === b.matched && a.words === b.words
const sameDistance = (a: DistanceView, b: DistanceView): boolean => JSON.stringify(a) === JSON.stringify(b)

/** The body size to store at the shutter: the median of the last few inferences. */
function medianScale(scales: readonly PhotoBodyScale[]): PhotoBodyScale | null {
  if (scales.length === 0) return null
  const fulls = scales.map((s) => s.full).filter((f): f is number => f !== null)
  return {
    torso: median(scales.map((s) => s.torso)),
    full: fulls.length * 2 > scales.length ? median(fulls) : null,
  }
}

async function decodeStill(blob: Blob): Promise<{ frame: ImageBitmap; width: number; height: number } | null> {
  if (typeof createImageBitmap !== 'function') return null
  const frame = await createImageBitmap(blob)
  return { frame, width: frame.width, height: frame.height }
}

const round2 = (n: number): number => Math.round(n * 100) / 100

/**
 * The live viewfinder (decision 0026 L2 and L3, photos v2): the stream and the reference ghost in
 * one box with the same fit, mirrored together for the front camera; a level line drawn every
 * frame; one cue at a time; the distance bar when the pose model runs, or the reference's head and
 * feet lines when it does not; sounds for when the screen faces away.
 */
export function LiveView({
  feed,
  facing,
  switching,
  view,
  reference,
  referenceBlob,
  referenceUrl,
  loadPose,
  onClose,
  onSwitch,
  onFrame,
}: {
  feed: LiveFeed | null
  facing: PhotoCamera
  switching: boolean
  view: ViewName
  reference: Photo | undefined
  referenceBlob: Blob | null
  referenceUrl: string | null
  loadPose?: LoadPose
  onClose(): void
  onSwitch(next: PhotoCamera): void
  onFrame(blob: Blob, info: PhotoCaptureInfo): void
}): JSX.Element {
  const video = useRef<HTMLVideoElement>(null)
  const line = useRef<HTMLSpanElement>(null)
  const dot = useRef<HTMLSpanElement>(null)
  const [ghostIndex, setGhostIndex] = useState(0)
  const [timer, setTimer] = useState<Timer>('off')
  const [count, setCount] = useState<number | null>(null)
  const [level, setLevel] = useState<LevelView>({ visible: false, matched: false, words: null })
  const [distance, setDistance] = useState<DistanceView>({ kind: 'off' })
  const tracker = useMemo(() => new LevelTracker(), [])
  const pose = useRef<PoseState>({ ready: false, refScale: null, body: false, r: null, matched: false, scales: [], lines: null })
  const ghost = GHOSTS[ghostIndex]
  const mirrored = facing === 'user'
  const onFrameRef = useRef(onFrame)
  onFrameRef.current = onFrame

  // The target is the reference photo's own angles, from the same view and camera; else upright.
  tracker.target = { roll: reference?.roll ?? 0, pitch: reference?.pitch ?? 0 }

  useEffect(() => {
    if (feed && video.current) feed.attach(video.current)
  }, [feed])

  // Motion events only feed the tracker: no React state at 60 Hz.
  useEffect(() => {
    const onMotion = (event: Event): void => tracker.push(event as DeviceMotionEvent, Date.now())
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
        words = levelWords(err, shown, tracker.tuning)
      } else {
        shown = null
      }
      if (matched && !wasMatched) playTick()
      wasMatched = matched
      const next = { visible, matched, words }
      setLevel((prev) => (sameLevel(prev, next) ? prev : next))
    }, LEVEL_TEXT_MS)
    return () => clearInterval(id)
  }, [tracker])

  // The pose model: loaded only now, when the live camera is open; measured against the reference.
  useEffect(() => {
    if (!feed || !loadPose) return
    let cancelled = false
    let timerId: ReturnType<typeof setTimeout> | undefined
    const state: PoseState = { ready: false, refScale: null, body: false, r: null, matched: false, scales: [], lines: null }
    pose.current = state
    const smoother = new DistanceSmoother()
    const trigger = distanceTrigger()
    const run = async (): Promise<void> => {
      let model: PoseModel
      try {
        model = await loadPose()
      } catch {
        return // Offline before the first use, or unsupported: the head and feet lines stay.
      }
      if (cancelled) return
      let refScale = reference?.bodyScale ?? null
      if (!refScale && referenceBlob) {
        try {
          const still = await decodeStill(referenceBlob)
          const landmarks = still ? await model.image(still.frame) : null
          if (still && landmarks) refScale = bodyScaleOf(landmarks, still.width, still.height)
        } catch {
          refScale = null
        }
      }
      if (cancelled) return
      state.refScale = refScale
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
            trigger.reset()
          } else {
            state.body = true
            state.scales.push({ t, scale })
            while (state.scales.length > 5) state.scales.shift()
            state.lines = bodyLinesOf(landmarks)
            if (refScale) {
              state.r = smoother.push(scaleRatio(scale, refScale), t)
              state.matched = trigger.update([state.r - 1], t)
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
  }, [feed, loadPose, reference, referenceBlob])

  // The distance bar and number, at most four times a second; ticks when the screen faces away.
  useEffect(() => {
    let lastTick = 0
    const id = setInterval(() => {
      const ps = pose.current
      const t = Date.now()
      let next: DistanceView
      if (!ps.ready) next = { kind: loadPose && reference && feed ? 'loading' : 'off' }
      else if (!ps.refScale) next = { kind: 'off' }
      else if (!ps.body) next = { kind: 'no-body' }
      else if (ps.r === null) next = { kind: 'loading' }
      else {
        const { position, clamped } = barPosition(ps.r)
        next = {
          kind: 'measured',
          matched: ps.matched,
          word: distanceWord(ps.r, ps.matched),
          percent: percentOff(ps.r),
          position,
          clamped,
          closer: ps.r > 1,
        }
        if (facing === 'environment' && !ps.matched && t - lastTick >= tickInterval(ps.r)) {
          playTick()
          lastTick = t
        }
      }
      setDistance((prev) => (sameDistance(prev, next) ? prev : next))
    }, DISTANCE_TEXT_MS)
    return () => clearInterval(id)
  }, [facing, feed, loadPose, reference])

  const distanceCue: DistanceCue =
    distance.kind === 'measured' ? { kind: 'measured', matched: distance.matched, word: distance.word } : distance.kind === 'no-body' ? { kind: 'no-body' } : { kind: 'off' }
  const cue = pickCue(level, distanceCue, reference ? 'Matched' : 'Level')

  useEffect(() => {
    if (cue.kind === 'matched') playMatched()
  }, [cue.kind])

  const capture = (): void => {
    if (!feed) return
    const t = Date.now()
    const angles = tracker.reference(t)
    const recent = pose.current.scales.filter((s) => s.t >= t - SCALE_WINDOW_MS).map((s) => s.scale)
    const bodyScale = medianScale(recent)
    const info: PhotoCaptureInfo = { camera: facing, source: 'live' }
    if (angles) {
      info.roll = round2(angles.roll)
      info.pitch = round2(angles.pitch)
    }
    if (bodyScale) info.bodyScale = bodyScale
    if (bodyScale && pose.current.lines) info.bodyLines = pose.current.lines
    if (feed.size) {
      info.streamWidth = feed.size.width
      info.streamHeight = feed.size.height
    }
    void feed.grab().then((blob) => onFrameRef.current(blob, info))
  }
  const captureRef = useRef(capture)
  captureRef.current = capture

  useEffect(() => {
    if (count === null) return
    if (count > 0) {
      playCount(false)
      const id = setTimeout(() => setCount(count - 1), 1000)
      return () => clearTimeout(id)
    }
    playCount(true)
    setCount(null)
    captureRef.current()
  }, [count])

  const shutter = (): void => {
    unlockCaptureSound()
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

  return (
    <div className="photo-live">
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
      </div>
      {referenceUrl && ghost === 0 ? <span className="photo-visually-hidden">{`Last ${view.value} photo hidden`}</span> : null}
      <header className="photo-header photo-header-live">
        <button type="button" className="btn-quiet" onClick={onClose}>
          Close
        </button>
        <h1 className="photo-title">{view.label}</h1>
        <button type="button" className="chip photo-chip" onClick={() => setGhostIndex((ghostIndex + 1) % GHOSTS.length)}>
          {`Ghost ${ghost}%`}
        </button>
      </header>
      <div className="photo-guides">
        {level.visible ? (
          <div className="photo-gauge" data-matched={level.matched} aria-hidden="true">
            <span className="photo-gauge-ref" />
            <span ref={line} className="photo-gauge-line" />
            <span ref={dot} className="photo-gauge-dot" />
          </div>
        ) : null}
        {cue.text ? (
          <p className="photo-level photo-cue" data-level={cue.kind === 'matched'} aria-live="polite">
            {cue.text}
          </p>
        ) : null}
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
      </div>
      {count !== null ? <p className="photo-countdown">{count}</p> : null}
      {switching || !feed ? (
        <p className="photo-switching" role="status">
          Switching…
        </p>
      ) : null}
      <div className="photo-live-controls">
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
        <button
          type="button"
          className="icon-btn photo-shutter"
          aria-label="Shutter"
          disabled={switching || !feed}
          onClick={shutter}
        />
        <button
          type="button"
          className="chip photo-chip photo-switch"
          aria-label={`Switch to ${otherName} camera`}
          disabled={switching}
          onClick={() => {
            unlockCaptureSound()
            setCount(null)
            onSwitch(other)
          }}
        >
          {`${otherName === 'back' ? 'Back' : 'Front'} camera`}
        </button>
      </div>
    </div>
  )
}
