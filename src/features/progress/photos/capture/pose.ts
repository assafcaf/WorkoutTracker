/**
 * The pose model behind the distance cue (photos v2, decision 0026 L3): MediaPipe Pose Landmarker
 * lite on the CPU. Loaded only when the live camera opens, through a dynamic import, so the main
 * bundle does not carry it. The wasm is self-hosted under /mediapipe/wasm/ (copied from the npm
 * package at build time) and the model comes from Google's model bucket; the service worker caches
 * both CacheFirst at runtime, outside the precache (they are far over Workbox's 2 MiB limit).
 * Offline before the first use, or on a browser that cannot run it, loading rejects and the
 * capture falls back to the head and feet lines.
 */
import type { Landmark } from './distance'

/** A loaded pose model. */
export type PoseModel = {
  /** Landmarks of the one pose in a live video frame at `tMs`, or null when none is found. */
  video(frame: HTMLVideoElement, tMs: number): Landmark[] | null
  /** Landmarks of the one pose in a still. */
  image(frame: ImageBitmap | HTMLImageElement | HTMLCanvasElement): Promise<Landmark[] | null>
  close(): void
}

export type LoadPose = () => Promise<PoseModel>

/** Where the wasm lives: same origin, so the Access cookie goes with it. */
export const POSE_WASM_PATH = '/mediapipe/wasm'
/** The lite model (about 5.8 MB). */
export const POSE_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task'

let loading: Promise<PoseModel> | null = null

/** Loads the model once per page; a failed load can be retried on the next live view. */
export const loadPoseModel: LoadPose = () => {
  if (loading) return loading
  loading = (async () => {
    if (typeof WebAssembly === 'undefined') throw new Error('no WebAssembly')
    const vision = await import('@mediapipe/tasks-vision')
    const fileset = await vision.FilesetResolver.forVisionTasks(POSE_WASM_PATH)
    const landmarker = await vision.PoseLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: POSE_MODEL_URL, delegate: 'CPU' },
      runningMode: 'VIDEO',
      numPoses: 1,
    })
    let mode: 'VIDEO' | 'IMAGE' = 'VIDEO'
    let lastVideoMs = -1
    const first = (result: { landmarks: Landmark[][] }): Landmark[] | null => result.landmarks[0] ?? null
    return {
      video(frame, tMs) {
        if (mode !== 'VIDEO' || frame.readyState < 2) return null
        // MediaPipe needs strictly increasing timestamps.
        const t = Math.max(tMs, lastVideoMs + 1)
        lastVideoMs = t
        return first(landmarker.detectForVideo(frame, t))
      },
      async image(frame) {
        mode = 'IMAGE'
        await landmarker.setOptions({ runningMode: 'IMAGE' })
        try {
          return first(landmarker.detect(frame))
        } finally {
          await landmarker.setOptions({ runningMode: 'VIDEO' })
          mode = 'VIDEO'
        }
      },
      close() {
        landmarker.close()
        loading = null
      },
    }
  })()
  loading.catch(() => {
    loading = null
  })
  return loading
}
